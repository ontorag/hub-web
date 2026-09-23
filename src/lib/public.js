// Public datasets, read straight from GitHub (raw.githubusercontent.com allows CORS),
// so browsing, exploring and chatting over them needs no backend.
import { createGraph, loadOxigraph } from "./graph.js";

const RAW = "https://raw.githubusercontent.com";

export async function raw(repo, path) {
  for (const branch of ["main", "master"]) {
    const r = await fetch(`${RAW}/${repo}/${branch}/${path}`);
    if (r.ok) return r.text();
  }
  return null;
}

/** Explorable: has a graph. Servable: follows dataset format 0.1
 *  (https://ontorag.org/vocab/#format), so ontorag-mcp can serve it. */
export function classify(m) {
  const explorable = !!(m && "ontorag" in m && m.ontology?.graph);
  const servable = explorable && !!(m.dataset?.id && m.dataset?.version
    && m.ontology?.entity_index && m.content?.chunks_glob);
  return { explorable, servable };
}

export function describe(item, m) {
  const ds = m?.dataset || {};
  const counts = m?.content?.counts || {};
  const ocounts = m?.ontology?.counts || {};
  const stats = Object.fromEntries(Object.entries({
    documents: counts.documents, chunks: counts.chunks, entities: ocounts.entities,
  }).filter(([, v]) => v != null));
  return { repo: item.repo, title: ds.name || item.title || item.repo.split("/").pop(),
           description: item.description || "", license: ds.license || "",
           version: ds.version || "", stats, url: `https://github.com/${item.repo}`,
           ...classify(m) };
}

export async function manifest(repo) {
  const t = await raw(repo, "manifest.json");
  try { return t ? JSON.parse(t) : null; } catch { return null; }
}

export async function catalog() {
  const r = await fetch(`${import.meta.env.BASE_URL}catalog.json`, { cache: "no-store" });
  const items = r.ok ? await r.json() : [];
  return Promise.all(items.map(async (it) => describe(it, await manifest(it.repo))));
}

const graphs = new Map();
/** The dataset's graph (and schema, if it has one) in an in-browser SPARQL store. */
export function openGraph(repo) {
  if (!graphs.has(repo)) {
    graphs.set(repo, (async () => {
      const m = await manifest(repo);
      if (!classify(m).explorable) throw new Error(`${repo} does not respect the ontorag repository structure`);
      const onto = m.ontology;
      const [ox, world, schema, px] = await Promise.all([
        loadOxigraph(), raw(repo, onto.graph), onto.schema ? raw(repo, onto.schema) : null,
        onto.prefixes ? raw(repo, onto.prefixes) : null,
      ]);
      if (!world) throw new Error(`${repo} has no graph at ${onto.graph}`);
      let prefixes = {};
      try { prefixes = Object.fromEntries(Object.entries(JSON.parse(px || "{}"))
        .filter(([k, v]) => typeof v === "string" && !k.startsWith("_"))); } catch { /* none */ }
      const graph = createGraph(ox, [schema, world], { baseIri: onto.base_iri || "", prefixes });
      return { graph, meta: describe({ repo }, m) };
    })());
    graphs.get(repo).catch(() => graphs.delete(repo));
  }
  return graphs.get(repo);
}
