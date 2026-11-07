import React, { useState, useEffect, useRef } from "react";
import {
  Scale,
  Files,
  Search,
  Network,
  Clock,
  MessageCircle,
  Settings,
  Upload,
  RefreshCw,
  Download,
  ChevronRight,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Globe,
  Send,
  BookOpen,
  Trash2,
  Play,
  Pause,
  Plus,
  Loader2,
  Link2,
} from "lucide-react";
type Any = Record<string, any>;
async function api(url: string, body?: any, method?: string) {
  const r = await fetch(url, {
    method: method || (body ? "POST" : "GET"),
    credentials: "same-origin",
    ...(body instanceof FormData
      ? { body }
      : {
          ...(body ? { body: JSON.stringify(body) } : {}),
          headers: { "Content-Type": "application/json" },
        }),
  });
  const data = await r
    .json()
    .catch(() => ({ error: "Server returned an invalid response" }));
  if (!r.ok) throw new Error(data.error || "Request failed");
  return data;
}
async function download(url: string, body: any, name: string) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const d = await r.json();
    throw new Error(d.error);
  }
  const blob = await r.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
const date = (s: any) => (s ? new Date(s).toLocaleString() : "—");
function Badge({ value }: { value: any }) {
  const text = String(value || "");
  return (
    <span
      className={
        "badge " +
        (/ready|completed|found_in_source|connected|true/.test(text) &&
        !text.includes("not_")
          ? "good"
          : /failed|error/.test(text)
            ? "bad"
            : "")
      }
    >
      {text.replaceAll("_", " ")}
    </span>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="empty">
      <BookOpen size={30} />
      <p>{children}</p>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export default function App() {
  const [user, setUser] = useState<any>(undefined),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("vault"),
    [status, setStatus] = useState<Any>({}),
    [docs, setDocs] = useState<any[]>([]),
    [total, setTotal] = useState(0),
    [offset, setOffset] = useState(0),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string[]>([]);
  const [question, setQuestion] = useState(""),
    [mode, setMode] = useState("rag"),
    [scope, setScope] = useState("all"),
    [village, setVillage] = useState(""),
    [survey, setSurvey] = useState(""),
    [dialect, setDialect] = useState("English"),
    [output, setOutput] = useState<Any | null>(null),
    [studyJob, setStudyJob] = useState(""),
    [studyStatus, setStudyStatus] = useState<Any | null>(null);
  const [network, setNetwork] = useState<Any>({ nodes: [], edges: [] }),
    [monitors, setMonitors] = useState<any[]>([]),
    [reminders, setReminders] = useState<any[]>([]),
    [jobs, setJobs] = useState<any[]>([]),
    [history, setHistory] = useState<any[]>([]),
    [chatText, setChatText] = useState(""),
    [memories, setMemories] = useState<any[]>([]),
    [memoryText, setMemoryText] = useState(""),
    [auditRows, setAuditRows] = useState<any[]>([]),
    [note, setNote] = useState("");
  const [monitor, setMonitor] = useState<Any>({
      title: "",
      documentId: "",
      url: "",
      matchText: "",
      datePattern: "DD.MM.YYYY",
      timezone: "Asia/Kolkata",
      localTime: "19:00",
      phone: "",
    }),
    [reminder, setReminder] = useState({ title: "", dueAt: "", phone: "" }),
    [showMonitor, setShowMonitor] = useState(false),
    [plain, setPlain] = useState({ title: "", text: "" }),
    [showPaste, setShowPaste] = useState(false),
    [login, setLogin] = useState({ username: "admin", password: "" });
  const fileInput = useRef<HTMLInputElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  async function run(fn: () => Promise<any>) {
    setBusy(true);
    setError("");
    setNote("");
    try {
      return await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function loadDocs(next = offset) {
    const d = await api(
      `/api/documents?limit=100&offset=${next}&search=${encodeURIComponent(search)}`,
    );
    setDocs(d.documents);
    setTotal(d.count);
    setOffset(next);
  }
  async function refresh() {
    const s = await api("/api/status");
    setStatus(s);
    await loadDocs();
  }
  useEffect(() => {
    api("/api/auth/me")
      .then(setUser)
      .catch(() => setUser(null));
  }, []);
  useEffect(() => {
    if (!user) return;
    void run(refresh);
    const t = setInterval(() => {
      api("/api/status")
        .then(setStatus)
        .catch(() => {});
    }, 15000);
    return () => clearInterval(t);
  }, [user]);
  useEffect(() => {
    if (!user) return;
    void run(async () => {
      if (tab === "vault") await loadDocs(0);
      if (tab === "graph") setNetwork(await api("/api/documents/graph"));
      if (tab === "monitor") {
        setMonitors((await api("/api/monitors")).monitors);
        setReminders((await api("/api/reminders")).reminders);
      }
      if (tab === "chat") {
        setHistory((await api("/api/chat/history")).history);
        setMemories((await api("/api/memories")).memories);
      }
      if (tab === "settings") {
        setJobs((await api("/api/jobs")).jobs);
        if (user.role === "admin")
          setAuditRows((await api("/api/audit")).events);
      }
    });
  }, [tab, user]);
  useEffect(() => {
    if (!studyJob) return;
    const poll = async () => {
      try {
        const j = await api("/api/jobs/" + studyJob);
        setStudyStatus(j);
        if (j.status === "completed") {
          setOutput({ ...j.result, synthesis: j.result.report });
          setStudyJob("");
        }
        if (j.status === "failed") {
          setError(j.error);
          setStudyJob("");
        }
      } catch (e: any) {
        setError(e.message);
      }
    };
    void poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [studyJob]);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);
  if (user === undefined)
    return (
      <div className="loading">
        <Loader2 className="spin" /> Loading SABEEL…
      </div>
    );
  if (!user)
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="brandmark">
            <Scale size={36} />
          </div>
          <p className="eyebrow">YOUR PRACTICE. CONNECTED.</p>
          <h1>
            SABEEL<span> Legal Intelligence</span>
          </h1>
          <p className="muted">
            Document vault · Research · WhatsApp assistant
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                setUser(await api("/api/auth/login", login));
              });
            }}
          >
            <Field label="Username">
              <input
                autoComplete="username"
                value={login.username}
                onChange={(e) =>
                  setLogin({ ...login, username: e.target.value })
                }
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                autoComplete="current-password"
                value={login.password}
                onChange={(e) =>
                  setLogin({ ...login, password: e.target.value })
                }
              />
            </Field>
            {error && <div className="error">{error}</div>}
            <button className="primary wide" disabled={busy}>
              {busy ? (
                <Loader2 className="spin" size={18} />
              ) : (
                <ChevronRight size={18} />
              )}{" "}
              Sign in to workspace
            </button>
          </form>
          <small>Use the credentials configured on your deployment.</small>
        </div>
      </div>
    );
  const nav = [
    ["vault", "Document Vault", Files],
    ["research", "Research Studio", Search],
    ["graph", "Document Connections", Network],
    ["monitor", "Monitoring & Reminders", Clock],
    ["chat", "Assistant & Memory", MessageCircle],
    ["settings", "Integrations & Jobs", Settings],
  ] as const;
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    await run(async () => {
      const body = new FormData();
      Array.from(files).forEach((f) => body.append("files", f));
      const d = await api("/api/documents/upload", body);
      setNote(
        `${d.results.length} file(s) received. Indexing runs in the background; refresh to check progress.`,
      );
      await refresh();
    });
  }
  async function ask() {
    await run(async () => {
      setOutput(null);
      if (mode === "web") {
        setOutput(await api("/api/research/web", { query: question }));
        return;
      }
      const body = {
        query: question,
        dialect,
        ...(scope === "selected" ? { documentIds: selected } : {}),
        ...(village ? { village } : {}),
        ...(survey ? { surveyNumber: survey } : {}),
      };
      if (scope === "selected" && !selected.length)
        throw new Error("Select documents in the vault first.");
      if (mode === "corpus") {
        const j = await api("/api/research/deep-study", body);
        setStudyJob(j.jobId);
        setStudyStatus({
          status: "pending",
          result: { progress: { completed: 0, total: j.documentCount } },
        });
      } else
        setOutput(
          await api("/api/documents/rag-search", {
            ...body,
            prepareBriefType:
              mode === "brief"
                ? "brief"
                : mode === "application"
                  ? "application"
                  : "answer",
          }),
        );
    });
  }
  return (
    <div className="workspace">
      <aside className="sidebar">
        <div className="brand">
          <Scale size={31} />
          <div>
            <strong>SABEEL</strong>
            <small>LEGAL INTELLIGENCE</small>
          </div>
        </div>
        <div className="workspace-tag">PRIVATE PRACTICE WORKSPACE</div>
        <nav>
          {nav.map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={tab === key ? "active" : ""}
            >
              <Icon size={19} />
              {label}
              {key === "vault" && <span>{status.counts?.total || 0}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="live-dot" /> Persistent cloud workspace
          <p>
            Documents are shared with authorized practice staff. Conversations
            and memories are private per user.
          </p>
          <button
            onClick={() =>
              void run(async () => {
                await api("/api/auth/logout", {});
                setUser(null);
              })
            }
          >
            <LogOut size={16} /> Sign out · {user.username}
          </button>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <p className="eyebrow">SABEEL / WORKSPACE</p>
            <h1>{nav.find((n) => n[0] === tab)?.[1]}</h1>
          </div>
          <div className="header-actions">
            <Badge
              value={
                status.integrations?.ai ? "AI configured" : "AI setup needed"
              }
            />
            <button onClick={() => void run(refresh)} title="Refresh">
              <RefreshCw size={18} className={busy ? "spin" : ""} />
            </button>
            <span className="avatar">
              {user.username?.slice(0, 2).toUpperCase()}
            </span>
            <button
              title="Sign out"
              aria-label="Sign out"
              onClick={() =>
                void run(async () => {
                  await api("/api/auth/logout", {});
                  setUser(null);
                })
              }
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <div className="content">
          {error && (
            <div className="error">
              <AlertCircle size={18} />
              {error}
              <button onClick={() => setError("")}>Dismiss</button>
            </div>
          )}
          {note && (
            <div className="notice">
              <CheckCircle2 size={18} />
              {note}
            </div>
          )}
          {tab === "vault" && (
            <>
              <div className="hero">
                <div>
                  <p className="eyebrow">ONE VAULT. EVERY CONNECTION.</p>
                  <h2>Your documents, working together.</h2>
                  <p>
                    Original files, searchable passages, source-backed
                    connections and hearing dates — from your actual records.
                  </p>
                </div>
                <button
                  className="primary"
                  onClick={() => fileInput.current?.click()}
                  disabled={busy}
                >
                  <Upload size={18} /> Upload documents
                </button>
                <input
                  ref={fileInput}
                  hidden
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.tif,.tiff,.webp"
                  onChange={(e) => {
                    void upload(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
              <div className="stats">
                <div>
                  <small>STORED DOCUMENTS</small>
                  <strong>{status.counts?.total || 0}</strong>
                </div>
                <div>
                  <small>INDEXED & SEARCHABLE</small>
                  <strong>{status.counts?.ready || 0}</strong>
                </div>
                <div>
                  <small>BACKGROUND JOBS</small>
                  <strong>{status.jobs?.pending || 0}</strong>
                </div>
                <div>
                  <small>NEEDS ATTENTION</small>
                  <strong>{status.counts?.failed || 0}</strong>
                </div>
              </div>
              <div className="toolbar">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(() => loadDocs(0));
                  }}
                >
                  <Search size={18} />
                  <input
                    placeholder="Search title, village, survey number, tag, lawyer…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <button type="submit">Search</button>
                </form>
                <button onClick={() => setShowPaste(!showPaste)}>
                  Paste text
                </button>
                {user.role === "admin" && (
                  <button
                    disabled={busy || !status.integrations?.drive}
                    onClick={() =>
                      void run(async () => {
                        const j = await api("/api/drive/sync", {});
                        setNote("Drive import queued: " + j.jobId);
                      })
                    }
                  >
                    <RefreshCw size={16} /> Import Drive folder
                  </button>
                )}
              </div>
              {showPaste && (
                <section className="panel">
                  <Field label="Document title">
                    <input
                      value={plain.title}
                      onChange={(e) =>
                        setPlain({ ...plain, title: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Document text">
                    <textarea
                      rows={7}
                      value={plain.text}
                      onChange={(e) =>
                        setPlain({ ...plain, text: e.target.value })
                      }
                    />
                  </Field>
                  <button
                    className="primary"
                    disabled={busy || !plain.title || plain.text.length < 20}
                    onClick={() =>
                      void run(async () => {
                        await api("/api/documents/analyze", plain);
                        setPlain({ title: "", text: "" });
                        setShowPaste(false);
                        await refresh();
                      })
                    }
                  >
                    Store & index text
                  </button>
                </section>
              )}
              {selected.length > 0 && (
                <div className="selection">
                  <strong>{selected.length} selected</strong>
                  <button
                    onClick={() => {
                      setScope("selected");
                      setTab("research");
                    }}
                  >
                    Research selected
                  </button>
                  <button
                    onClick={() =>
                      void run(() =>
                        download(
                          "/api/documents/merge",
                          { documentIds: selected },
                          "SABEEL-combined.pdf",
                        ),
                      )
                    }
                  >
                    Merge original PDFs
                  </button>
                  <button onClick={() => setSelected([])}>Clear</button>
                </div>
              )}
              <section className="panel table-panel">
                <div className="section-title">
                  <h3>Document library</h3>
                  <span>{total} matching records</span>
                </div>
                {!docs.length ? (
                  <Empty>
                    Upload documents or import a Google Drive folder to begin.
                  </Empty>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th></th>
                          <th>DOCUMENT / UNIQUE TAG</th>
                          <th>CLASSIFICATION</th>
                          <th>LAWYER / NEXT HEARING</th>
                          <th>STATUS</th>
                          <th>ORIGINAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {docs.map((d) => (
                          <tr key={d.id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={selected.includes(d.id)}
                                onChange={(e) =>
                                  setSelected(
                                    e.target.checked
                                      ? [...selected, d.id]
                                      : selected.filter((i) => i !== d.id),
                                  )
                                }
                              />
                            </td>
                            <td>
                              <strong>{d.title}</strong>
                              <small>
                                {d.uniqueTag || d.id.slice(0, 8)} ·{" "}
                                {d.pages || "?"} page(s)
                              </small>
                              {d.error && (
                                <p className="text-error">{d.error}</p>
                              )}
                              {d.summary && (
                                <details>
                                  <summary>Summary & extracted actions</summary>
                                  <p>{d.summary}</p>
                                  {d.actions?.map((a: any, i: number) => (
                                    <p key={i}>
                                      {a.description} {a.date && `— ${a.date}`}
                                    </p>
                                  ))}
                                  <p>
                                    Hearing evidence:{" "}
                                    {d.dateEvidence || "Not found"}
                                  </p>
                                  <div className="edit-grid">
                                    <Field label="Assigned lawyer">
                                      <input
                                        defaultValue={d.assignedLawyer || ""}
                                        onBlur={(e) =>
                                          void run(() =>
                                            api(
                                              "/api/documents/" + d.id,
                                              {
                                                assignedLawyer: e.target.value,
                                              },
                                              "PATCH",
                                            ),
                                          )
                                        }
                                      />
                                    </Field>
                                    <Field label="Village / project">
                                      <input
                                        defaultValue={d.village || ""}
                                        onBlur={(e) =>
                                          void run(() =>
                                            api(
                                              "/api/documents/" + d.id,
                                              { village: e.target.value },
                                              "PATCH",
                                            ),
                                          )
                                        }
                                      />
                                    </Field>
                                    <Field label="Survey number / reference">
                                      <input
                                        defaultValue={d.surveyNumber || ""}
                                        onBlur={(e) =>
                                          void run(() =>
                                            api(
                                              "/api/documents/" + d.id,
                                              { surveyNumber: e.target.value },
                                              "PATCH",
                                            ),
                                          )
                                        }
                                      />
                                    </Field>
                                  </div>
                                </details>
                              )}
                            </td>
                            <td>
                              {d.category || "Extracting…"}
                              <small>
                                {d.village || "—"}{" "}
                                {d.surveyNumber && `· Sy. ${d.surveyNumber}`}
                              </small>
                            </td>
                            <td>
                              {d.assignedLawyer || "Unassigned"}
                              <small>
                                {d.nextHearingDate || "No stated hearing date"}
                              </small>
                            </td>
                            <td>
                              <Badge value={d.status} />
                              {d.status === "failed" && (
                                <button
                                  onClick={() =>
                                    void run(async () => {
                                      await api(
                                        "/api/documents/" + d.id + "/retry",
                                        {},
                                      );
                                      setNote("Index retry queued.");
                                    })
                                  }
                                >
                                  Retry
                                </button>
                              )}
                            </td>
                            <td>
                              <a
                                className="icon-link"
                                href={d.downloadUrl}
                                title="Download original"
                              >
                                <Download size={18} />
                              </a>
                              {d.driveUrl && (
                                <a
                                  href={d.driveUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Google Drive"
                                >
                                  <Link2 size={17} />
                                </a>
                              )}
                              {user.role === "admin" && (
                                <button
                                  className="icon-button"
                                  title="Remove from vault; original remains in Drive"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        "Remove this document from the vault? The Drive original remains.",
                                      )
                                    )
                                      void run(async () => {
                                        await api(
                                          "/api/documents/" + d.id,
                                          undefined,
                                          "DELETE",
                                        );
                                        setSelected(
                                          selected.filter((i) => i !== d.id),
                                        );
                                        await refresh();
                                      });
                                  }}
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="pagination">
                  <button
                    disabled={offset === 0 || busy}
                    onClick={() =>
                      void run(() => loadDocs(Math.max(0, offset - 100)))
                    }
                  >
                    Previous
                  </button>
                  <span>
                    {total ? offset + 1 : 0}–{Math.min(total, offset + 100)} of{" "}
                    {total}
                  </span>
                  <button
                    disabled={offset + 100 >= total || busy}
                    onClick={() => void run(() => loadDocs(offset + 100))}
                  >
                    Next
                  </button>
                </div>
              </section>
            </>
          )}
          {tab === "research" && (
            <>
              <div className="hero">
                <div>
                  <p className="eyebrow">FROM RECORDS TO REASONING</p>
                  <h2>Research with an evidence trail.</h2>
                  <p>
                    Hybrid search for focused answers. Full-corpus review reads
                    every extracted page in the selected scope before synthesis.
                  </p>
                </div>
                <BookOpen size={50} />
              </div>
              <section className="panel">
                <div className="research-options">
                  <Field label="Research mode">
                    <select
                      value={mode}
                      onChange={(e) => setMode(e.target.value)}
                    >
                      <option value="rag">Focused document Q&A</option>
                      <option value="corpus">
                        Full-corpus research (background)
                      </option>
                      <option value="brief">Prepare a legal brief</option>
                      <option value="application">Draft an application</option>
                      <option value="web">Live internet research</option>
                    </select>
                  </Field>
                  <Field label="Document scope">
                    <select
                      value={scope}
                      onChange={(e) => setScope(e.target.value)}
                    >
                      <option value="all">All indexed documents</option>
                      <option value="selected">
                        Selected in vault ({selected.length})
                      </option>
                    </select>
                  </Field>
                  <Field label="Village filter">
                    <input
                      value={village}
                      onChange={(e) => setVillage(e.target.value)}
                      placeholder="Optional exact village"
                    />
                  </Field>
                  <Field label="Survey / reference filter">
                    <input
                      value={survey}
                      onChange={(e) => setSurvey(e.target.value)}
                      placeholder="Optional exact value"
                    />
                  </Field>
                  <Field label="Response language">
                    <select
                      value={dialect}
                      onChange={(e) => setDialect(e.target.value)}
                    >
                      <option>English</option>
                      <option>Professional Hyderabadi Roman Urdu</option>
                    </select>
                  </Field>
                </div>
                <textarea
                  className="question"
                  rows={5}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Compare the title records and court orders. Explain how they connect, identify contradictions, and cite the supporting pages…"
                />
                <div className="flex-between">
                  <small>
                    Nothing is inferred from demo records. All document
                    citations link to your vault.
                  </small>
                  <button
                    className="primary"
                    disabled={busy || !!studyJob || !question.trim()}
                    onClick={() => void ask()}
                  >
                    {busy ? (
                      <Loader2 size={18} className="spin" />
                    ) : (
                      <Search size={18} />
                    )}{" "}
                    Run research
                  </button>
                </div>
              </section>
              {studyStatus && (
                <div className="notice">
                  <Loader2 size={18} className={studyJob ? "spin" : ""} />
                  <div>
                    <strong>Full-corpus job · {studyStatus.status}</strong>
                    <p>
                      {studyStatus.result?.progress
                        ? `${studyStatus.result.progress.completed} / ${studyStatus.result.progress.total} documents reviewed`
                        : studyStatus.status === "completed"
                          ? "Completed"
                          : studyStatus.error || "Waiting for a worker"}
                    </p>
                    <small>
                      Job {studyStatus.id || studyJob} · progress persists
                      across server restarts.
                    </small>
                  </div>
                </div>
              )}
              {output && (
                <section className="panel">
                  <div className="section-title">
                    <h3>Research findings</h3>
                    <button
                      onClick={() =>
                        void run(() =>
                          download(
                            "/api/export/pdf",
                            {
                              title: "SABEEL Research Report",
                              text: output.synthesis || output.report || "",
                            },
                            "SABEEL-research.pdf",
                          ),
                        )
                      }
                    >
                      <Download size={16} /> Export PDF
                    </button>
                  </div>
                  {output.coverage && (
                    <div className="coverage">
                      {typeof output.coverage === "string"
                        ? output.coverage
                        : `Retrieved ${output.coverage.retrievedPassages} passages from ${output.coverage.retrievedDocuments} of ${output.coverage.eligibleDocuments} eligible documents. This is not an exhaustive corpus review.`}
                    </div>
                  )}
                  {output.retrievalWarning && (
                    <div className="notice">{output.retrievalWarning}</div>
                  )}
                  <div className="report">
                    {output.synthesis || output.report}
                  </div>
                  {output.citations?.length > 0 && (
                    <>
                      <h3>Source passages</h3>
                      <div className="citations">
                        {output.citations.map((c: any) => (
                          <details key={c.id}>
                            <summary>
                              <span className="source-label">{c.label}</span>{" "}
                              {c.documentTitle}
                            </summary>
                            <p>{c.text}</p>
                            <a
                              href={
                                "/api/documents/" + c.documentId + "/download"
                              }
                            >
                              Download original · page {c.page}
                            </a>
                            {c.relationshipExpansion && (
                              <small>
                                Retrieved through a shared-entity connection
                              </small>
                            )}
                          </details>
                        ))}
                      </div>
                    </>
                  )}
                  {output.sources?.map((s: any, i: number) => (
                    <p key={i}>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.title}
                        </a>
                      ) : (
                        <a
                          href={"/api/documents/" + s.documentId + "/download"}
                        >
                          {s.title} · {s.documentId}
                        </a>
                      )}
                    </p>
                  ))}
                </section>
              )}
            </>
          )}
          {tab === "graph" && (
            <>
              <div className="hero">
                <div>
                  <p className="eyebrow">EVIDENCE-BACKED CONNECTIONS</p>
                  <h2>Follow the links between records.</h2>
                  <p>
                    Shared case numbers, parties, references and
                    village-qualified survey numbers. A shared identifier is not
                    automatically a proven title chain.
                  </p>
                </div>
                <button
                  onClick={() =>
                    void run(async () =>
                      setNetwork(
                        await api(
                          "/api/documents/graph" +
                            (village
                              ? "?village=" + encodeURIComponent(village)
                              : ""),
                        ),
                      ),
                    )
                  }
                >
                  <RefreshCw size={18} /> Refresh graph
                </button>
              </div>
              <div className="toolbar">
                <Field label="Village filter">
                  <input
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    placeholder="Exact village, or empty for all"
                  />
                </Field>
                <p>
                  {network.visibleNodes || 0} visible documents ·{" "}
                  {network.totalCorpusSize || 0} indexed in scope ·{" "}
                  {network.edges?.length || 0} visible links
                </p>
              </div>
              {network.truncated && (
                <div className="notice">
                  Visualization is bounded to 250 documents / 1,500 links.
                  Filter by village to explore other parts of the corpus.
                  Retrieval searches the full index.
                </div>
              )}
              {!network.nodes?.length ? (
                <Empty>
                  No indexed records yet. Connections are created from quoted
                  entities in your uploaded documents.
                </Empty>
              ) : (
                <section className="graph-layout">
                  <div className="panel graph-canvas">
                    <svg
                      viewBox="0 0 800 580"
                      aria-label="Document connection graph"
                    >
                      {network.edges.slice(0, 300).map((e: any) => {
                        const a = network.nodes.findIndex(
                            (n: any) => n.id === e.source,
                          ),
                          b = network.nodes.findIndex(
                            (n: any) => n.id === e.target,
                          ),
                          pos = (i: number) => ({
                            x:
                              400 +
                              260 *
                                Math.cos(
                                  (2 * Math.PI * i) / network.nodes.length,
                                ),
                            y:
                              290 +
                              240 *
                                Math.sin(
                                  (2 * Math.PI * i) / network.nodes.length,
                                ),
                          });
                        const p = pos(a),
                          r = pos(b);
                        return (
                          <line
                            key={e.id}
                            x1={p.x}
                            y1={p.y}
                            x2={r.x}
                            y2={r.y}
                            stroke="#d6c898"
                            strokeWidth="1"
                            opacity=".45"
                          />
                        );
                      })}
                      {network.nodes.map((n: any, i: number) => {
                        const x =
                            400 +
                            260 *
                              Math.cos(
                                (2 * Math.PI * i) / network.nodes.length,
                              ),
                          y =
                            290 +
                            240 *
                              Math.sin(
                                (2 * Math.PI * i) / network.nodes.length,
                              );
                        return (
                          <g key={n.id}>
                            <title>{n.title}</title>
                            <circle
                              cx={x}
                              cy={y}
                              r={network.nodes.length > 70 ? 4 : 9}
                              fill="#214d48"
                            />
                            {network.nodes.length <= 35 && (
                              <text
                                x={x}
                                y={y + 23}
                                textAnchor="middle"
                                fontSize="10"
                                fill="#34454b"
                              >
                                {n.title.slice(0, 23)}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                    <small>
                      Hover a node for its document title. The evidence list
                      shows the exact quotes behind each link.
                    </small>
                  </div>
                  <div className="panel edge-list">
                    <h3>Connection evidence</h3>
                    {!network.edges.length ? (
                      <p className="muted">No verified shared entities yet.</p>
                    ) : (
                      network.edges.map((e: any) => (
                        <details key={e.id}>
                          <summary>{e.label}</summary>
                          <p>
                            <a
                              href={"/api/documents/" + e.source + "/download"}
                            >
                              {
                                network.nodes.find(
                                  (n: any) => n.id === e.source,
                                )?.title
                              }
                            </a>{" "}
                            ↔{" "}
                            <a
                              href={"/api/documents/" + e.target + "/download"}
                            >
                              {
                                network.nodes.find(
                                  (n: any) => n.id === e.target,
                                )?.title
                              }
                            </a>
                          </p>
                          <p className="report">{e.explanation}</p>
                        </details>
                      ))
                    )}
                  </div>
                </section>
              )}
            </>
          )}
          {tab === "monitor" && (
            <>
              <div className="hero">
                <div>
                  <p className="eyebrow">TURN DOCUMENTS INTO FOLLOW-THROUGH</p>
                  <h2>Daily checks. Durable reminders.</h2>
                  <p>
                    Configured sources are checked at your chosen local time.
                    Failed or undated sources are reported as unverified, never
                    silently “not listed.”
                  </p>
                </div>
                {user.role === "admin" && (
                  <button
                    className="primary"
                    onClick={() => setShowMonitor(!showMonitor)}
                  >
                    <Plus size={18} /> Add source monitor
                  </button>
                )}
              </div>
              {showMonitor && (
                <section className="panel">
                  <h3>Configure a daily source check</h3>
                  <p className="muted">
                    Use an accessible HTML, PDF, text or JSON source. The host
                    must be included in ALLOWED_FETCH_HOSTS. URL placeholders:{" "}
                    {"{date}"}, {"{YYYY}"}, {"{MM}"}, {"{DD}"} use tomorrow’s
                    date. The date marker also targets tomorrow.
                  </p>
                  <div className="form-grid">
                    {[
                      ["title", "Monitor name"],
                      ["url", "Official source URL"],
                      ["matchText", "Exact case / reference identifier"],
                      [
                        "datePattern",
                        "Publication/date marker (e.g. CAUSELIST FOR DD.MM.YYYY)",
                      ],
                      ["timezone", "Timezone"],
                      ["localTime", "Daily local check time"],
                      ["phone", "WhatsApp recipient (digits; optional)"],
                    ].map(([key, label]) => (
                      <Field key={key} label={label}>
                        <input
                          type={key === "localTime" ? "time" : "text"}
                          value={monitor[key]}
                          onChange={(e) =>
                            setMonitor({ ...monitor, [key]: e.target.value })
                          }
                        />
                      </Field>
                    ))}
                    <Field label="Related source document">
                      <select
                        value={monitor.documentId}
                        onChange={(e) =>
                          setMonitor({ ...monitor, documentId: e.target.value })
                        }
                      >
                        <option value="">No linked document</option>
                        {docs.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.title} {d.caseNumber ? `· ${d.caseNumber}` : ""}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await api("/api/monitors", {
                          ...monitor,
                          documentId: monitor.documentId || null,
                          phone: monitor.phone || undefined,
                        });
                        setShowMonitor(false);
                        setMonitors((await api("/api/monitors")).monitors);
                      })
                    }
                  >
                    Save daily monitor
                  </button>
                </section>
              )}
              <section className="panel">
                <div className="section-title">
                  <h3>Source monitors</h3>
                  <button
                    onClick={() =>
                      void run(async () =>
                        setMonitors((await api("/api/monitors")).monitors),
                      )
                    }
                  >
                    <RefreshCw size={16} /> Refresh
                  </button>
                </div>
                {!monitors.length ? (
                  <Empty>
                    Link a court order or any other document to a real source
                    URL and identifier to begin monitoring.
                  </Empty>
                ) : (
                  monitors.map((m) => (
                    <div className="monitor-card" key={m.id}>
                      <div>
                        <h3>{m.title}</h3>
                        <p className="muted">
                          {m.local_time} · {m.timezone} · {m.match_text}
                        </p>
                        <a href={m.url} target="_blank" rel="noreferrer">
                          {m.url}
                        </a>
                        <p>
                          <Badge value={m.enabled ? "enabled" : "paused"} />{" "}
                          <Badge
                            value={
                              m.last_result?.status || "awaiting first check"
                            }
                          />
                        </p>
                        {m.last_result && (
                          <>
                            <p>
                              {m.last_result.remarks || m.last_result.error}
                            </p>
                            <small>
                              Target {m.last_result.targetDate} · Checked{" "}
                              {date(m.last_result.checkedAt)}
                            </small>
                            {m.last_result.evidence && (
                              <details>
                                <summary>Source excerpt</summary>
                                <p>{m.last_result.evidence}</p>
                              </details>
                            )}
                          </>
                        )}
                      </div>
                      {user.role === "admin" && (
                        <div className="actions">
                          <button
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                const j = await api(
                                  "/api/monitors/" + m.id + "/run",
                                  {},
                                );
                                setNote("Source check queued: " + j.jobId);
                              })
                            }
                          >
                            <Play size={15} /> Check now
                          </button>
                          <button
                            onClick={() =>
                              void run(async () => {
                                await api(
                                  "/api/monitors/" + m.id,
                                  { enabled: !m.enabled },
                                  "PATCH",
                                );
                                setMonitors(
                                  (await api("/api/monitors")).monitors,
                                );
                              })
                            }
                          >
                            {m.enabled ? (
                              <Pause size={15} />
                            ) : (
                              <Play size={15} />
                            )}
                          </button>
                          <button
                            onClick={() =>
                              void run(async () => {
                                await api(
                                  "/api/monitors/" + m.id,
                                  undefined,
                                  "DELETE",
                                );
                                setMonitors(
                                  (await api("/api/monitors")).monitors,
                                );
                              })
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </section>
              <section className="panel">
                <h3>Reminders & hearing dates</h3>
                <div className="form-grid">
                  <Field label="Reminder">
                    <input
                      value={reminder.title}
                      onChange={(e) =>
                        setReminder({ ...reminder, title: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Due date & time (your browser timezone)">
                    <input
                      type="datetime-local"
                      value={reminder.dueAt}
                      onChange={(e) =>
                        setReminder({ ...reminder, dueAt: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="WhatsApp recipient (optional)">
                    <input
                      value={reminder.phone}
                      onChange={(e) =>
                        setReminder({ ...reminder, phone: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <button
                  disabled={busy || !reminder.title || !reminder.dueAt}
                  onClick={() =>
                    void run(async () => {
                      await api("/api/reminders", {
                        ...reminder,
                        dueAt: new Date(reminder.dueAt).toISOString(),
                        phone: reminder.phone || undefined,
                      });
                      setReminder({ title: "", dueAt: "", phone: "" });
                      setReminders((await api("/api/reminders")).reminders);
                    })
                  }
                >
                  <Plus size={16} /> Add reminder
                </button>
                <div className="reminders">
                  {reminders.map((r) => (
                    <label key={r.id}>
                      <input
                        type="checkbox"
                        checked={r.done}
                        onChange={(e) =>
                          void run(async () => {
                            await api(
                              "/api/reminders/" + r.id,
                              { done: e.target.checked },
                              "PATCH",
                            );
                            setReminders(
                              (await api("/api/reminders")).reminders,
                            );
                          })
                        }
                      />
                      <span>
                        {r.title}
                        <small>
                          {date(r.due_at)}{" "}
                          {r.notified ? "· notification processed" : ""}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            </>
          )}
          {tab === "chat" && (
            <div className="chat-layout">
              <section className="panel chat-panel">
                <div className="section-title">
                  <h3>
                    <span className="live-dot" /> SABEEL Assistant
                  </h3>
                  <select
                    value={dialect}
                    onChange={(e) => setDialect(e.target.value)}
                  >
                    <option>English</option>
                    <option>Professional Hyderabadi Roman Urdu</option>
                  </select>
                </div>
                <div className="chat-history">
                  {!history.length && (
                    <Empty>
                      Ask about your documents, retrieve an original file, or
                      save a preference to long-term memory.
                    </Empty>
                  )}
                  {history.map((h, i) => (
                    <div key={h.id || i} className={"bubble " + h.role}>
                      <small>{h.role === "user" ? "YOU" : "SABEEL"}</small>
                      <div className="report">{h.content}</div>
                      {h.attachment && (
                        <a href={h.attachment.url}>
                          <Download size={16} /> {h.attachment.title}
                        </a>
                      )}
                      {h.citations?.length > 0 && (
                        <details>
                          <summary>
                            {h.citations.length} source passages
                          </summary>
                          {h.citations.map((c: any) => (
                            <p key={c.id}>
                              <a
                                href={
                                  "/api/documents/" + c.documentId + "/download"
                                }
                              >
                                [{c.label}] {c.documentTitle}
                              </a>
                              <br />
                              {c.text}
                            </p>
                          ))}
                        </details>
                      )}
                    </div>
                  ))}
                  <div ref={chatEnd} />
                </div>
                <form
                  className="chat-compose"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const msg = chatText;
                    if (!msg.trim()) return;
                    setChatText("");
                    setHistory((h) => [...h, { role: "user", content: msg }]);
                    void run(async () => {
                      const r = await api("/api/chat", {
                        message: msg,
                        dialect,
                      });
                      setHistory((h) => [
                        ...h,
                        {
                          role: "assistant",
                          content: r.reply,
                          attachment: r.attachment,
                          citations: r.citations,
                        },
                      ]);
                    });
                  }}
                >
                  <textarea
                    rows={2}
                    placeholder="Ask SABEEL…"
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                  />
                  <button
                    className="primary"
                    disabled={busy || !chatText.trim()}
                  >
                    <Send size={19} />
                  </button>
                </form>
              </section>
              <div>
                <section className="panel">
                  <h3>Long-term memory</h3>
                  <p className="muted">
                    Saved preferences are private to your signed-in user. All
                    chat messages persist, with rolling summaries for
                    continuity.
                  </p>
                  <textarea
                    rows={3}
                    placeholder="Remember a preference or ongoing context…"
                    value={memoryText}
                    onChange={(e) => setMemoryText(e.target.value)}
                  />
                  <button
                    disabled={busy || !memoryText.trim()}
                    onClick={() =>
                      void run(async () => {
                        await api("/api/memories", { text: memoryText });
                        setMemoryText("");
                        setMemories((await api("/api/memories")).memories);
                      })
                    }
                  >
                    Save memory
                  </button>
                  {memories.map((m) => (
                    <div className="memory" key={m.id}>
                      <p>{m.text}</p>
                      <button
                        onClick={() =>
                          void run(async () => {
                            await api(
                              "/api/memories/" + m.id,
                              undefined,
                              "DELETE",
                            );
                            setMemories((await api("/api/memories")).memories);
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </section>
                <section className="panel command-help">
                  <h3>WhatsApp & chat commands</h3>
                  <code>list documents</code>
                  <code>send Shamshabad 626</code>
                  <code>/remember Preferred lawyer is…</code>
                  <code>/web Latest land policy updates</code>
                  <code>
                    /remind 2026-12-01T09:00:00+05:30 Prepare hearing brief
                  </code>
                  <code>/tool tool_name {`{"key":"value"}`}</code>
                  <p className="muted">
                    WhatsApp also accepts PDFs, Word files, images and voice
                    notes. Commands use the same backend and vault.
                  </p>
                </section>
              </div>
            </div>
          )}
          {tab === "settings" && (
            <>
              <div className="hero">
                <div>
                  <p className="eyebrow">REAL SERVICES. VISIBLE STATE.</p>
                  <h2>Your deployment control room.</h2>
                  <p>
                    Credentials stay in your hosting environment, never in
                    browser code or GitHub source.
                  </p>
                </div>
                <button
                  onClick={() =>
                    void run(async () => {
                      await refresh();
                      setJobs((await api("/api/jobs")).jobs);
                    })
                  }
                >
                  <RefreshCw size={18} /> Refresh
                </button>
              </div>
              <div className="integration-grid">
                {[
                  [
                    "AI provider",
                    status.integrations?.ai,
                    `Provider: ${status.integrations?.provider || "openai"}. Configure OPENAI_API_KEY or GEMINI_API_KEY.`,
                  ],
                  [
                    "Google Drive",
                    status.integrations?.drive,
                    "Set root folder ID and OAuth refresh-token credentials, or a service account with Shared Drive access.",
                  ],
                  [
                    "WhatsApp Cloud API",
                    status.integrations?.whatsapp,
                    "Configure access token, phone number ID, app secret, verify token and allowed numbers.",
                  ],
                  [
                    "Internet research",
                    status.integrations?.web,
                    "Set TAVILY_API_KEY for live research and source URLs.",
                  ],
                  [
                    "Vector search",
                    true,
                    `Active backend: ${status.integrations?.vector || "pgvector"}. Pinecone is optional; PostgreSQL remains the canonical store.`,
                  ],
                  [
                    "Daily monitoring",
                    true,
                    `Durable scheduler. Default timezone: ${status.timezone || "Asia/Kolkata"}. Use an always-running deployment.`,
                  ],
                ].map(([title, connected, text]) => (
                  <section className="panel integration" key={String(title)}>
                    <div className="flex-between">
                      <h3>{title}</h3>
                      <Badge
                        value={connected ? "configured" : "setup needed"}
                      />
                    </div>
                    <p>{text}</p>
                  </section>
                ))}
              </div>
              <section className="panel">
                <h3>WhatsApp webhook URL</h3>
                <code className="endpoint">
                  {status.appUrl || window.location.origin}/api/whatsapp/webhook
                </code>
                <p className="muted">
                  Subscribe to the messages webhook in Meta. Verify with
                  WHATSAPP_VERIFY_TOKEN. Scheduled messages outside the reply
                  window need the configured approved one-parameter alert
                  template.
                </p>
              </section>
              <section className="panel">
                <div className="section-title">
                  <h3>Background jobs</h3>
                  <button
                    onClick={() =>
                      void run(async () =>
                        setJobs((await api("/api/jobs")).jobs),
                      )
                    }
                  >
                    Refresh jobs
                  </button>
                </div>
                {!jobs.length ? (
                  <Empty>No background jobs yet.</Empty>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>JOB</th>
                          <th>STATUS</th>
                          <th>ATTEMPTS</th>
                          <th>DETAIL</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobs.map((j) => (
                          <tr key={j.id}>
                            <td>
                              <strong>{j.kind}</strong>
                              <small>{j.id}</small>
                            </td>
                            <td>
                              <Badge value={j.status} />
                            </td>
                            <td>{j.attempts}</td>
                            <td>
                              {j.error ||
                                (j.progress
                                  ? `${j.progress.completed}/${j.progress.total}`
                                  : date(j.created_at))}
                            </td>
                            <td>
                              {j.kind === "study" &&
                                j.status === "completed" && (
                                  <button
                                    onClick={() =>
                                      void run(async () => {
                                        const r = await api(
                                          "/api/jobs/" + j.id,
                                        );
                                        setOutput({
                                          ...r.result,
                                          synthesis: r.result.report,
                                        });
                                        setTab("research");
                                      })
                                    }
                                  >
                                    Open report
                                  </button>
                                )}
                              {j.status === "failed" &&
                                user.role === "admin" && (
                                  <button
                                    onClick={() =>
                                      void run(async () => {
                                        await api(
                                          "/api/jobs/" + j.id + "/retry",
                                          {},
                                        );
                                        setJobs((await api("/api/jobs")).jobs);
                                      })
                                    }
                                  >
                                    Retry
                                  </button>
                                )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
              {user.role === "admin" && (
                <section className="panel">
                  <h3>Recent activity</h3>
                  {auditRows.slice(0, 25).map((a) => (
                    <div className="audit" key={a.id}>
                      <strong>{a.action}</strong>
                      <span>{a.actor}</span>
                      <small>{date(a.created_at)}</small>
                    </div>
                  ))}
                </section>
              )}
              <section className="panel">
                <h3>Connected tools</h3>
                {status.tools?.length ? (
                  status.tools.map((t: any) => (
                    <p key={t.name}>
                      <strong>{t.name}</strong> — {t.description}
                    </p>
                  ))
                ) : (
                  <p className="muted">
                    Configure CONNECTED_TOOLS_JSON to register your own API or
                    n8n webhook. Allow its exact hostname in
                    ALLOWED_FETCH_HOSTS. Invoke explicitly using /tool.
                  </p>
                )}
              </section>
            </>
          )}
        </div>
        <footer>
          SABEEL · Private legal intelligence{" "}
          <span>
            {status.integrations?.vector || "pgvector"} retrieval ·{" "}
            {status.timezone || "Asia/Kolkata"}
          </span>
        </footer>
      </main>
    </div>
  );
}
