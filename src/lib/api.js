// The backend's URL is set at runtime from config.json (see config.js); until then,
// and in public mode, there is no backend and these calls are not made.
let BASE = "";
export function setBase(b) { BASE = b; }

export function getToken() { return localStorage.getItem("hub_token"); }
export function setToken(t) { localStorage.setItem("hub_token", t); }
export function logout() { localStorage.removeItem("hub_token"); location.hash = ""; location.reload(); }

async function req(method, path, body, isForm) {
  const headers = {};
  const t = getToken();
  if (t) headers["Authorization"] = "Bearer " + t;
  const opts = { method, headers };
  if (isForm) opts.body = body;
  else if (body !== undefined) { headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
  const r = await fetch(BASE + path, opts);
  if (r.status === 401) { logout(); throw new Error("unauthorized"); }
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  const ct = r.headers.get("content-type") || "";
  return ct.includes("json") ? r.json() : r.text();
}

export const api = {
  get base() { return BASE; },
  get loginUrl() { return BASE + "/auth/login"; },
  me: () => req("GET", "/api/me"),
  catalog: () => req("GET", "/api/catalog"),
  forkCatalog: (repo) => req("POST", "/api/catalog/fork", { repo }),
  catalogInspect: (repo) => req("GET", "/api/catalog/inspect?repo=" + encodeURIComponent(repo)),
  catalogQuery: (repo, sparql) => req("POST", "/api/catalog/query", { repo, sparql }),
  catalogChat: (repo, question, key, model, base_url) =>
    req("POST", "/api/catalog/chat", { repo, question, key, model: model || null, base_url: base_url || null }),
  chatSettings: () => req("GET", "/api/settings/chat"),
  saveChatSettings: (b) => req("PUT", "/api/settings/chat", b),
  datasets: () => req("GET", "/api/datasets"),
  createDataset: (d) => req("POST", "/api/datasets", d),
  dataset: (s) => req("GET", "/api/datasets/" + s),
  updateConfig: (s, body) => req("PATCH", `/api/datasets/${s}/config`, body),
  upload: (s, files) => { const fd = new FormData(); for (const f of files) fd.append("files", f); return req("POST", `/api/datasets/${s}/upload`, fd, true); },
  commonBaselines: () => req("GET", "/api/baselines"),
  addBaseline: (s, slug, url) => req("POST", `/api/datasets/${s}/baselines`, { slug, url: url || null }),
  uploadBaseline: (s, bslug, file) => { const fd = new FormData(); fd.append("bslug", bslug); fd.append("file", file); return req("POST", `/api/datasets/${s}/baselines/upload`, fd, true); },
  removeBaseline: (s, bslug) => req("DELETE", `/api/datasets/${s}/baselines/${bslug}`),
  run: (s, stage) => req("POST", `/api/datasets/${s}/run/${stage}`),
  status: (s) => req("GET", `/api/datasets/${s}/status`),
  proposed: (s) => req("GET", `/api/datasets/${s}/schema/proposed`),
  schema: (s) => req("GET", `/api/datasets/${s}/schema`),
  approve: (s, card) => req("POST", `/api/datasets/${s}/schema/approve`, { schema_card: card }),
  // `o` carries one-shot {model, base_url, key} overrides for testing a single chat
  chat: (s, q, o = {}) => req("POST", `/api/datasets/${s}/chat`, {
    question: q, model: o.model || null, base_url: o.base_url || null, key: o.key || null }),
  publish: (s) => req("POST", `/api/datasets/${s}/publish`),
};
