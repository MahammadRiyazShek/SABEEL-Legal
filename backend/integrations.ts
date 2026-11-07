import { JWT } from "google-auth-library";
import dns from "node:dns/promises";
import net from "node:net";
import { jsonFetch } from "./ai.js";
import { q } from "./db.js";
export function isPublicIP(ip: string) {
  if (net.isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (net.isIP(ip) === 6) {
    const s = ip.toLowerCase();
    return (
      !s.startsWith("::") &&
      !s.startsWith("fc") &&
      !s.startsWith("fd") &&
      !s.startsWith("fe") &&
      !s.startsWith("ff") &&
      !s.startsWith("2001:db8")
    );
  }
  return false;
}
export async function validateURL(raw: string) {
  const u = new URL(raw);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    (u.port && u.port !== "443")
  )
    throw new Error(
      "External URLs must use HTTPS without credentials or custom ports",
    );
  const hosts = (process.env.ALLOWED_FETCH_HOSTS || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (!hosts.includes(u.hostname.toLowerCase()))
    throw new Error(
      `Host ${u.hostname} is not in ALLOWED_FETCH_HOSTS. Add the exact approved host in your hosting environment.`,
    );
  const records = await dns.lookup(u.hostname, { all: true });
  if (!records.length || records.some((r) => !isPublicIP(r.address)))
    throw new Error("Private/network-internal sources are not supported");
  return u;
}
export async function fetchSource(
  raw: string,
  max = 25000000,
): Promise<{ bytes: Buffer; mime: string; url: string }> {
  let u = await validateURL(raw);
  for (let n = 0; n < 4; n++) {
    const r = await fetch(u, {
      redirect: "manual",
      signal: AbortSignal.timeout(45000),
      headers: {
        "User-Agent": "SABEEL-DocumentMonitor/1.0",
        Accept: "text/html,application/pdf,application/json,text/plain",
      },
    });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
      await r.body?.cancel();
      u = await validateURL(new URL(r.headers.get("location")!, u).href);
      continue;
    }
    if (!r.ok) throw new Error(`Source HTTP ${r.status}`);
    const reader = r.body!.getReader();
    const bufs: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > max) throw new Error("Source exceeds size limit");
        bufs.push(value);
      }
    } finally {
      await reader.cancel();
    }
    return {
      bytes: Buffer.concat(bufs),
      mime: r.headers.get("content-type") || "text/plain",
      url: u.href,
    };
  }
  throw new Error("Too many redirects");
}
export const driveConfigured = () =>
  !!process.env.GOOGLE_DRIVE_FOLDER_ID &&
  !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_REFRESH_TOKEN
  );
async function driveToken() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const c = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new JWT({
      email: c.client_email,
      key: c.private_key,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
    const d = await auth.authorize();
    return d.access_token;
  }
  const d = await jsonFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN || "",
      grant_type: "refresh_token",
    }),
  });
  return d.access_token;
}
async function driveJSON(path: string, opts: RequestInit = {}) {
  return jsonFetch("https://www.googleapis.com/drive/v3/" + path, {
    ...opts,
    headers: { Authorization: `Bearer ${await driveToken()}`, ...opts.headers },
  });
}
export async function driveUpload(
  title: string,
  mime: string,
  bytes: Buffer,
  folder?: string,
) {
  const boundary = "sabeel_" + Date.now();
  const meta = {
    name: title,
    parents: [folder || process.env.GOOGLE_DRIVE_FOLDER_ID],
  };
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`,
    ),
    bytes,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  return jsonFetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await driveToken()}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
}
export async function driveOrganize(meta: any) {
  const safe = (s: string) =>
    String(s || "General")
      .replace(/[\\/]/g, "-")
      .slice(0, 100);
  let parent = process.env.GOOGLE_DRIVE_FOLDER_ID!;
  for (const name of [safe(meta.category), safe(meta.village)]) {
    const query = `'${parent.replace(/'/g, "\\'")}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const d = await driveJSON(
      "files?" +
        new URLSearchParams({
          q: query,
          fields: "files(id)",
          supportsAllDrives: "true",
          includeItemsFromAllDrives: "true",
        }),
    );
    if (d.files?.length) parent = d.files[0].id;
    else
      parent = (
        await driveJSON("files?supportsAllDrives=true&fields=id", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            mimeType: "application/vnd.google-apps.folder",
            parents: [parent],
          }),
        })
      ).id;
  }
  return parent;
}
export async function driveListFolder(folder: string, pageToken = "") {
  return driveJSON(
    "files?" +
      new URLSearchParams({
        q: `'${folder.replace(/'/g, "\\'")}' in parents and trashed=false`,
        fields:
          "nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink)",
        pageSize: "100",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
        ...(pageToken ? { pageToken } : {}),
      }),
  );
}
export async function driveDownload(file: any) {
  const google = file.mimeType.startsWith("application/vnd.google-apps.");
  const url =
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}` +
    (google
      ? "/export?mimeType=application%2Fpdf"
      : "?alt=media&supportsAllDrives=true");
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${await driveToken()}` },
    signal: AbortSignal.timeout(90000),
  });
  if (!r.ok) throw new Error("Drive download HTTP " + r.status);
  const bytes = Buffer.from(await r.arrayBuffer());
  if (bytes.length > 25000000) throw new Error("Drive file exceeds 25 MB");
  return { bytes, mime: google ? "application/pdf" : file.mimeType };
}
export async function pinecone(path: string, body: any) {
  if (!process.env.PINECONE_HOST || !process.env.PINECONE_API_KEY)
    throw new Error("Pinecone host and key are required");
  const host = process.env.PINECONE_HOST.replace(/\/$/, "");
  if (!/^https:\/\/[a-z0-9.-]+\.pinecone\.io$/i.test(host))
    throw new Error("PINECONE_HOST must be your HTTPS index host");
  return jsonFetch(host + path, {
    method: "POST",
    headers: {
      "Api-Key": process.env.PINECONE_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...body,
      namespace: process.env.PINECONE_NAMESPACE || "sabeel",
    }),
  });
}
export async function webResearch(query: string) {
  if (!process.env.TAVILY_API_KEY)
    throw new Error("Set TAVILY_API_KEY for live internet research");
  const d = await jsonFetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: "advanced",
      max_results: 6,
      include_raw_content: false,
    }),
  });
  return (d.results || []).map((r: any) => ({
    title: r.title,
    url: r.url,
    text: r.content,
  }));
}
export function allowedPhone(phone: string) {
  return (process.env.WHATSAPP_ALLOWED_NUMBERS || "")
    .split(",")
    .map((s) => s.replace(/\D/g, ""))
    .filter(Boolean)
    .includes(phone.replace(/\D/g, ""));
}
export async function waSend(to: string, text: string, forceTemplate = false) {
  if (!allowedPhone(to))
    throw new Error("Recipient is not in WHATSAPP_ALLOWED_NUMBERS");
  if (
    !process.env.WHATSAPP_ACCESS_TOKEN ||
    !process.env.WHATSAPP_PHONE_NUMBER_ID
  )
    throw new Error("WhatsApp credentials not configured");
  const recent = await q(
    `SELECT 1 FROM conversations WHERE owner=$1 AND channel='whatsapp' AND role='user' AND created_at>now()-interval '24 hours' LIMIT 1`,
    ["wa:" + to],
  );
  const template = forceTemplate || !recent.length;
  if (template && !process.env.WHATSAPP_ALERT_TEMPLATE)
    throw new Error(
      "An approved WhatsApp alert template is required outside the 24-hour reply window",
    );
  if (!template && text.length > 3800) {
    const results = [];
    for (let i = 0; i < text.length; i += 3800)
      results.push(await waSend(to, text.slice(i, i + 3800)));
    return { parts: results.length, results };
  }
  const body = template
    ? {
        type: "template",
        template: {
          name: process.env.WHATSAPP_ALERT_TEMPLATE,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en" },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text:
                    text.length > 950
                      ? text.slice(0, 800) +
                        "… Full result: " +
                        (process.env.APP_URL || "SABEEL workspace")
                      : text,
                },
              ],
            },
          ],
        },
      }
    : { type: "text", text: { body: text.slice(0, 4000) } };
  return jsonFetch(
    `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v23.0"}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", to, ...body }),
    },
  );
}
export async function waDocument(to: string, doc: any) {
  if (!allowedPhone(to)) throw new Error("Recipient not allowed");
  const root = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v23.0"}/${process.env.WHATSAPP_PHONE_NUMBER_ID}`;
  const headers = {
    Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
  };
  const f = new FormData();
  f.set("messaging_product", "whatsapp");
  f.set(
    "file",
    new Blob([new Uint8Array(doc.bytes)], { type: doc.mime }),
    doc.title,
  );
  const media = await jsonFetch(root + "/media", {
    method: "POST",
    headers,
    body: f,
  });
  return jsonFetch(root + "/messages", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "document",
      document: { id: media.id, filename: doc.title },
    }),
  });
}
export async function connectedTool(name: string, input: any) {
  const tools = JSON.parse(process.env.CONNECTED_TOOLS_JSON || "[]");
  const tool = tools.find((t: any) => t.name === name);
  if (!tool) throw new Error("Unknown configured tool");
  const u = await validateURL(tool.url);
  const method = tool.method || "POST";
  if (!["GET", "POST"].includes(method))
    throw new Error("Tool method must be GET or POST");
  const response = await fetch(u, {
    method,
    redirect: "error",
    headers: {
      "Content-Type": "application/json",
      ...(tool.tokenEnv
        ? { Authorization: `Bearer ${process.env[tool.tokenEnv] || ""}` }
        : {}),
    },
    ...(method === "POST" ? { body: JSON.stringify(input) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error("Tool HTTP " + response.status);
  return (await response.text()).slice(0, 40000);
}
