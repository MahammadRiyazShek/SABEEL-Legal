import { q, id, vector } from "./db.ts";
import { embed, generate, DATA_RULES, configured } from "./ai.ts";
import { pinecone, webResearch } from "./integrations.ts";
export function filters(input: any, start = 1) {
  const values: any[] = [];
  const clauses: string[] = [`d.status='ready'`];
  const add = (sql: string, val: any) => {
    clauses.push(sql.replace("?", `$${start + values.length}`));
    values.push(val);
  };
  if (Array.isArray(input.documentIds) && input.documentIds.length)
    add("d.id=ANY(?::uuid[])", input.documentIds);
  if (input.village)
    add("lower(d.metadata->>'village')=lower(?)", input.village);
  if (input.surveyNumber)
    add("lower(d.metadata->>'surveyNumber')=lower(?)", input.surveyNumber);
  if (input.category) add("d.metadata->>'category'=?", input.category);
  if (input.lawyer) add("d.metadata->>'assignedLawyer'=?", input.lawyer);
  return { where: clauses.join(" AND "), values };
}
export async function search(query: string, input: any = {}) {
  const f = filters(input, 2);
  const keyword = await q(
    `SELECT c.id,c.document_id,c.page,c.text,d.title,d.metadata,d.drive_url,ts_rank_cd(c.search,websearch_to_tsquery('simple',$1)) score FROM chunks c JOIN documents d ON d.id=c.document_id WHERE ${f.where} AND c.search@@websearch_to_tsquery('simple',$1) ORDER BY score DESC LIMIT 60`,
    [query, ...f.values],
  );
  let semantic: any[] = [];
  let retrievalWarning: string | undefined;
  if (configured()) {
    try {
      const [v] = await embed([query]);
      if (process.env.VECTOR_BACKEND === "pinecone") {
        const pc = await pinecone("/query", {
          vector: v,
          topK: 100,
          includeMetadata: true,
        });
        const ids = (pc.matches || []).map((m: any) => m.id);
        if (ids.length) {
          const ff = filters(input, 2);
          semantic = await q(
            `SELECT c.id,c.document_id,c.page,c.text,d.title,d.metadata,d.drive_url FROM chunks c JOIN documents d ON d.id=c.document_id WHERE c.id=ANY($1::uuid[]) AND ${ff.where} ORDER BY array_position($1::uuid[],c.id) LIMIT 60`,
            [ids, ...ff.values],
          );
        }
        // Restrictive filters can exhaust Pinecone topK; use the local canonical vector index for exact scoped recall.
        if (semantic.length < 10)
          semantic = await q(
            `SELECT c.id,c.document_id,c.page,c.text,d.title,d.metadata,d.drive_url FROM chunks c JOIN documents d ON d.id=c.document_id WHERE ${f.where} ORDER BY c.embedding<=>$1::vector LIMIT 60`,
            [vector(v), ...f.values],
          );
      } else
        semantic = await q(
          `SELECT c.id,c.document_id,c.page,c.text,d.title,d.metadata,d.drive_url FROM chunks c JOIN documents d ON d.id=c.document_id WHERE ${f.where} ORDER BY c.embedding<=>$1::vector LIMIT 60`,
          [vector(v), ...f.values],
        );
    } catch (e: any) {
      retrievalWarning = "Semantic retrieval unavailable: " + e.message;
    }
  }
  const merged = new Map<string, any>();
  for (const list of [keyword, semantic])
    list.forEach((c, i) => {
      const old = merged.get(c.id);
      merged.set(c.id, { ...c, rrf: (old?.rrf || 0) + 1 / (60 + i + 1) });
    });
  let selected = [...merged.values()]
    .sort((a, b) => b.rrf - a.rrf)
    .slice(0, 24);
  // Expand one evidence-backed relationship hop, respecting every user-supplied document filter.
  const seeds = [...new Set(selected.map((c) => c.document_id))].slice(0, 8);
  if (seeds.length) {
    const ff = filters(input, 2);
    const related = await q(
      `SELECT DISTINCT d.id FROM entities e JOIN entities x ON x.type=e.type AND x.value=e.value JOIN documents d ON d.id=x.document_id WHERE e.document_id=ANY($1::uuid[]) AND x.document_id<>ALL($1::uuid[]) AND e.type IN ('case','person','reference') AND ${ff.where} LIMIT 8`,
      [seeds, ...ff.values],
    );
    for (const rel of related) {
      const hits = await q(
        `SELECT c.id,c.document_id,c.page,c.text,d.title,d.metadata,d.drive_url FROM chunks c JOIN documents d ON d.id=c.document_id WHERE c.document_id=$1 ORDER BY ts_rank_cd(c.search,websearch_to_tsquery('simple',$2)) DESC,c.ordinal LIMIT 2`,
        [rel.id, query],
      );
      selected.push(
        ...hits.map((c) => ({ ...c, relationshipExpansion: true })),
      );
    }
  }
  const unique = new Map(selected.map((c) => [c.id, c]));
  selected = [...unique.values()];
  const docLabels = new Map<string, string>();
  const citations = selected.map((c) => {
    if (!docLabels.has(c.document_id))
      docLabels.set(c.document_id, "D" + (docLabels.size + 1));
    return {
      id: c.id,
      documentId: c.document_id,
      documentTitle: c.title,
      page: c.page,
      text: c.text,
      label: `${docLabels.get(c.document_id)} p.${c.page}`,
      category: c.metadata.category,
      village: c.metadata.village,
      surveyNumbers: [c.metadata.surveyNumber].filter(Boolean),
      driveUrl: c.drive_url,
      relationshipExpansion: !!c.relationshipExpansion,
    };
  });
  const ff = filters(input);
  const count = (
    await q(
      `SELECT count(*)::int AS n FROM documents d WHERE ${ff.where}`,
      ff.values,
    )
  )[0].n;
  return {
    citations,
    coverage: {
      eligibleDocuments: count,
      retrievedDocuments: docLabels.size,
      retrievedPassages: citations.length,
      mode: "hybrid RAG + one-hop evidence graph",
    },
    retrievalWarning,
  };
}
export async function answer(query: string, input: any = {}, extra = "") {
  const result = await search(query, input);
  if (!result.citations.length)
    return {
      ...result,
      synthesis:
        "No matching indexed document passages were found in the selected scope. Upload/index documents or adjust the filters.",
    };
  if (!configured())
    return {
      ...result,
      synthesis:
        "AI is not configured. Retrieved source passages are shown below.",
    };
  const context = result.citations
    .map((c) => `[${c.label}] ${c.documentTitle}\n${c.text}`)
    .join("\n\n");
  const synthesis = await generate(
    DATA_RULES,
    `Question: ${query}\nRequested output: ${input.prepareBriefType || "research answer"}\nDialect: ${input.dialect || "English"}\nCoverage: ${JSON.stringify(result.coverage)}. This is retrieval, not an exhaustive review of every document.\n${extra}\nEVIDENCE:\n${context}`,
  );
  return { ...result, synthesis };
}
export async function fullStudy(job: any) {
  const { documentIds, query } = job.payload;
  const state = job.result?.partial || {};
  let completed = Object.keys(state).length;
  for (const documentId of documentIds) {
    if (state[documentId]) continue;
    const d = (
      await q(
        `SELECT id,title,text,metadata FROM documents WHERE id=$1 AND status='ready'`,
        [documentId],
      )
    )[0];
    if (!d) {
      state[documentId] = {
        title: "Unavailable",
        notes: "Document was removed or is no longer indexed",
        unavailable: true,
      };
      continue;
    }
    const pages = d.text.split("\n\f\n");
    const blocks = chunkBlocks(pages, 16000);
    const notes: string[] = [];
    for (const block of blocks) {
      notes.push(
        await generate(
          DATA_RULES,
          `Exhaustive corpus review. Research question: ${query}. Read EVERY passage below. Extract only relevant facts, exact quotes, contradictions, chronology, cross-document identifiers and missing evidence. Cite [${d.id} p.N]. If irrelevant say so.\nTitle: ${d.title}\n${block}`,
        ),
      );
    }
    state[documentId] = { title: d.title, notes: notes.join("\n") };
    completed++;
    await q("UPDATE jobs SET result=$2 WHERE id=$1", [
      job.id,
      { partial: state, progress: { completed, total: documentIds.length } },
    ]);
  }
  let notes = Object.entries(state)
    .map(([key, value]: any) => `[${key}] ${value.title}\n${value.notes}`)
    .join("\n\n");
  while (notes.length > 60000) {
    const next: string[] = [];
    for (let i = 0; i < notes.length; i += 45000)
      next.push(
        await generate(
          DATA_RULES,
          `Compress research findings while preserving all source UUID/page citations and contradictions. Question: ${query}\n${notes.slice(i, i + 45000)}`,
        ),
      );
    const reduced = next.join("\n");
    if (reduced.length >= notes.length)
      throw new Error(
        "Research reduction did not converge; retry with a smaller document scope",
      );
    notes = reduced;
  }
  const reviewed = Object.values(state).filter(
    (s: any) => !s.unavailable,
  ).length;
  const report = await generate(
    DATA_RULES,
    `Prepare an evidence-based cross-document research report for: ${query}. Include executive findings, chronology, explicit interconnections versus hypotheses, inconsistencies, evidence gaps and next actions. Sources use UUID/page labels supplied in notes. Do not claim more coverage than ${reviewed} reviewed documents of ${documentIds.length} selected.\n${notes}`,
  );
  return {
    report,
    analyzedDocCount: reviewed,
    selectedDocCount: documentIds.length,
    sources: Object.entries(state).map(([documentId, s]: any) => ({
      documentId,
      title: s.title,
      unavailable: !!s.unavailable,
    })),
    coverage:
      "Every extracted page of each available selected document was processed before synthesis.",
  };
}
export function chunkBlocks(pages: string[], size = 16000) {
  const blocks: string[] = [];
  let buffer = "";
  pages.forEach((text, i) => {
    for (let j = 0; j < text.length; j += size - 100) {
      const part = `[p.${i + 1}] ${text.slice(j, j + size - 100)}\n`;
      if (buffer.length + part.length > size && buffer) {
        blocks.push(buffer);
        buffer = "";
      }
      buffer += part;
    }
  });
  if (buffer) blocks.push(buffer);
  return blocks;
}
export async function graph(scope: any = {}) {
  const f = filters(scope);
  const nodes = await q(
    `SELECT d.id,d.title,d.metadata FROM documents d WHERE ${f.where} ORDER BY d.created_at DESC LIMIT 250`,
    f.values,
  );
  const ids = nodes.map((n) => n.id);
  const edges = ids.length
    ? await q(
        `SELECT a.document_id source,b.document_id target,a.type,a.value,a.evidence source_evidence,b.evidence target_evidence FROM entities a JOIN entities b ON a.type=b.type AND a.value=b.value AND a.document_id<b.document_id WHERE a.document_id=ANY($1::uuid[]) AND b.document_id=ANY($1::uuid[]) AND a.type IN ('case','person','reference','survey') AND (a.type<>'survey' OR EXISTS (SELECT 1 FROM entities v JOIN entities w ON v.type='village' AND w.type='village' AND v.value=w.value WHERE v.document_id=a.document_id AND w.document_id=b.document_id)) LIMIT 1500`,
        [ids],
      )
    : [];
  const count = (
    await q(
      `SELECT count(*)::int n FROM documents d WHERE ${f.where}`,
      f.values,
    )
  )[0].n;
  return {
    nodes: nodes.map((n) => ({ id: n.id, title: n.title, ...n.metadata })),
    edges: edges.map((e, i) => ({
      ...e,
      id: String(i),
      label: `Shared ${e.type}: ${e.value}`,
      explanation: `${e.source_evidence}\n↔ ${e.target_evidence}`,
    })),
    totalCorpusSize: count,
    visibleNodes: nodes.length,
    truncated: count > nodes.length,
  };
}
export async function internetAnswer(query: string) {
  const sources = await webResearch(query);
  const synthesis = await generate(
    DATA_RULES,
    "Research this question using live search evidence and cite the complete source URLs inline: " +
      query +
      "\n" +
      JSON.stringify(sources),
  );
  return { synthesis, sources };
}
