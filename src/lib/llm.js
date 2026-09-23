// The user's own model access, kept in this browser only.
// Either "Sign in with OpenRouter" (OAuth PKCE — the browser receives a key scoped to
// the user's OpenRouter account, no secret on our side), a pasted key, or a custom
// OpenAI-compatible base URL such as a local ollama.
// https://openrouter.ai/docs/guides/overview/auth/oauth

const STORE = "hub_llm";
const VERIFIER = "hub_or_verifier";
export const OPENROUTER = "https://openrouter.ai/api/v1";
export const DEFAULT_MODEL = "~deepseek/deepseek-v4-flash-latest";

function safeGet(storage, k) { try { return storage.getItem(k); } catch { return null; } }
function safeSet(storage, k, v) { try { v == null ? storage.removeItem(k) : storage.setItem(k, v); } catch { /* private mode */ } }

export function getLlm() {
  try { return { key: "", baseUrl: "", model: DEFAULT_MODEL, via: "", ...JSON.parse(safeGet(localStorage, STORE) || "{}") }; }
  catch { return { key: "", baseUrl: "", model: DEFAULT_MODEL, via: "" }; }
}
export function setLlm(cfg) { safeSet(localStorage, STORE, JSON.stringify(cfg)); }
export function signOutLlm() { const c = getLlm(); setLlm({ ...c, key: "", via: "" }); }
/** Ready to chat: a key, or a custom endpoint that may not need one (ollama). */
export function llmReady(c = getLlm()) { return !!(c.key || c.baseUrl); }

function b64url(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The page OpenRouter sends the user back to: this app, without query or hash. */
export function callbackUrl() { return location.origin + location.pathname; }

export async function startOpenRouterSignIn() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  safeSet(sessionStorage, VERIFIER, verifier);
  safeSet(sessionStorage, "hub_or_return", location.hash);
  const q = new URLSearchParams({ callback_url: callbackUrl(), code_challenge: challenge,
                                  code_challenge_method: "S256" });
  location.href = `https://openrouter.ai/auth?${q}`;
}

/** On load: if OpenRouter redirected back with ?code=, exchange it for the user's key.
 *  Returns true when a key was stored. Only runs when this browser started the flow. */
export async function completeOpenRouterSignIn() {
  const code = new URLSearchParams(location.search).get("code");
  const verifier = safeGet(sessionStorage, VERIFIER);
  if (!code || !verifier) return false;
  const back = safeGet(sessionStorage, "hub_or_return") || "";
  safeSet(sessionStorage, VERIFIER, null);
  safeSet(sessionStorage, "hub_or_return", null);
  history.replaceState(null, "", callbackUrl() + back);
  const r = await fetch(`${OPENROUTER}/auth/keys`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: "S256" }),
  });
  if (!r.ok) throw new Error(`OpenRouter sign-in failed (${r.status})`);
  const { key } = await r.json();
  if (!key) throw new Error("OpenRouter returned no key");
  setLlm({ ...getLlm(), key, baseUrl: "", via: "openrouter" });
  return true;
}

/** One chat completion against the configured endpoint. */
export async function complete(messages, c = getLlm()) {
  const base = (c.baseUrl || OPENROUTER).replace(/\/+$/, "");
  const headers = { "Content-Type": "application/json" };
  if (c.key) headers.Authorization = `Bearer ${c.key}`;
  if (!c.baseUrl) { headers["HTTP-Referer"] = callbackUrl(); headers["X-Title"] = "OntoRAG Hub"; }
  const r = await fetch(`${base}/chat/completions`, {
    method: "POST", headers,
    body: JSON.stringify({ model: c.model || DEFAULT_MODEL, messages, temperature: 0.1 }),
  });
  if (!r.ok) throw new Error(`model call failed (${r.status}): ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  return data.choices?.[0]?.message?.content ?? "";
}
