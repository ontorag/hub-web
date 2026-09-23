// A dataset's graph in the browser: Oxigraph (WASM) loaded with the dataset's
// Turtle, answering the same queries the Hub backend's explore.py and chat.py run.
import {
  NS, guard, iris, mentionsQuery, predicatesQuery, prefixHeader, qname, toCitations, typesQuery,
} from "./sparql.js";

/** Wrap an Oxigraph module (browser `oxigraph/web.js` after init, or Node `oxigraph`). */
export function createGraph(ox, turtles, { baseIri = "", prefixes = {} } = {}) {
  const store = new ox.Store();
  for (const ttl of turtles) {
    if (ttl && ttl.trim()) store.load(ttl, { format: "text/turtle", base_iri: baseIri || undefined, lenient: true });
  }
  const header = prefixHeader(prefixes, baseIri);
  // names are shown with the same prefixes queries are written with
  const known = { rdf: NS.rdf, rdfs: NS.rdfs, xsd: NS.xsd, prov: NS.prov, orp: NS.orp,
                  oa: NS.oa, dcterms: NS.dcterms, ...(baseIri ? { ds: baseIri } : {}), ...prefixes };

  function select(query) {
    const out = store.query(query, { results_format: "application/sparql-results+json" });
    return typeof out === "string" ? JSON.parse(out) : out;
  }

  return {
    size: store.size,
    header,
    baseIri,
    prefixes: known,
    select,

    types({ showProvenance = false } = {}) {
      const res = select(typesQuery({ showProvenance, baseIri }));
      return res.results.bindings.map((b) => ({
        iri: b.t.value, name: qname(b.t.value, known), count: Number(b.n?.value || 0) }));
    },

    predicates({ showProvenance = false } = {}) {
      const res = select(predicatesQuery({ showProvenance, baseIri }));
      return res.results.bindings.map((b) => qname(b.p.value, known))
        .filter((n, i, all) => n && n !== "rdf:type" && all.indexOf(n) === i);
    },

    mentions(instanceIris, limit = 8) {
      if (!instanceIris.length) return [];
      return toCitations(select(mentionsQuery(instanceIris, limit)));
    },

    /** The console: a guarded read-only query, its rows, and citations for the IRIs in it. */
    query(sparql) {
      const q = guard(sparql, header, { allowAsk: true });
      const res = select(q);
      if (typeof res.boolean === "boolean") return { sparql: q, columns: ["ask"], rows: [{ ask: { type: "literal", value: String(res.boolean) } }], citations: [] };
      const rows = res.results.bindings;
      let citations = [];
      try { citations = this.mentions(iris(res)); } catch { /* provenance is a bonus */ }
      return { sparql: q, columns: res.head.vars, rows: rows.slice(0, 200), citations };
    },
  };
}

let oxReady = null;
/** Load and initialise Oxigraph's WASM build once (browser only). */
export function loadOxigraph() {
  if (!oxReady) {
    oxReady = import("oxigraph/web.js").then(async (mod) => { await mod.default(); return mod; });
  }
  return oxReady;
}
