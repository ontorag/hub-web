// Runtime configuration. The deployed site carries a config.json next to index.html:
//   {"apiBase": "https://hub-api.example.org"}   signed-in features via the backend
//   {"apiBase": null}                             public mode only
// so the backend can move without a rebuild. VITE_HUB_API is the build-time fallback.
import { setBase } from "./api.js";

export const config = { apiBase: null, backend: false };

export async function loadConfig() {
  let apiBase = import.meta.env.VITE_HUB_API || null;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: "no-store" });
    if (r.ok) {
      const c = await r.json();
      if ("apiBase" in c) apiBase = c.apiBase || null;
    }
  } catch { /* no config.json: keep the fallback */ }
  config.apiBase = apiBase ? apiBase.replace(/\/+$/, "") : null;
  config.backend = config.apiBase ? await reachable(config.apiBase) : false;
  if (config.backend) setBase(config.apiBase);
  return config;
}

async function reachable(base) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 4000);
  try {
    const r = await fetch(`${base}/api/catalog`, { signal: ctl.signal });
    return r.ok;
  } catch { return false; }
  finally { clearTimeout(t); }
}
