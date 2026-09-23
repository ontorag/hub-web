// Pure SPARQL helpers shared by the explorer and the client-side chat.
// Ported from the Hub backend (app/dialect.py, app/chat.py, app/explore.py) and the
// engine's `SparqlBackend.mentions` (ontorag/mcp_backend.py) — keep them in step.

export const NS = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  prov: "http://www.w3.org/ns/prov#",
  orp: "https://ontorag.org/provenance#",
  oa: "http://www.w3.org/ns/oa#",
  dcterms: "http://purl.org/dc/terms/",
};

const WRITE = /\b(INSERT|DELETE|DROP|CLEAR|LOAD|CREATE|ADD|MOVE|COPY)\b/i;

/** Models keep wrapping queries in ``` fences however firmly you ask them not to. */
export function stripFences(text, tag = "sparql") {
  let t = (text || "").trim();
  if (t.startsWith("```")) {
    t = t.split("```")[1] ?? "";
    if (t.trimStart().toLowerCase().startsWith(tag)) t = t.includes("\n") ? t.slice(t.indexOf("\n") + 1) : t;
  }
  return t.trim();
}

/** Prefix lines for a query: the standard vocabularies, the dataset's own
 *  prefixes.json, and `ds:` for the dataset namespace. Later entries win. */
export function prefixHeader(prefixes = {}, baseIri = "") {
  const merged = { rdf: NS.rdf, rdfs: NS.rdfs, xsd: NS.xsd, prov: NS.prov,
                   orp: NS.orp, oa: NS.oa, ...(baseIri ? { ds: baseIri } : {}), ...prefixes };
  return Object.entries(merged).map(([k, v]) => `PREFIX ${k}: <${v}>\n`).join("");
}

export class GuardError extends Error {}

/** Read-only check, a LIMIT, and the prefix header when the query has none.
 *  Chat requires SELECT; the console also accepts ASK. */
export function guard(query, header = "", { allowAsk = false } = {}) {
  const q = (query || "").trim();
  const up = q.toUpperCase();
  const readForm = up.includes("SELECT") || (allowAsk && /\bASK\b/.test(up));
  if (WRITE.test(q) || !readForm) {
    throw new GuardError(allowAsk ? "only read-only SELECT or ASK queries are allowed"
                                  : "generated query is not a read-only SELECT");
  }
  let out = q;
  if (up.includes("SELECT") && !up.includes("LIMIT")) out = out + "\nLIMIT 20";
  if (!up.includes("PREFIX")) out = header + out;
  return out;
}

/** True for provenance scaffolding (orp:/oa:/prov: and the legacy per-dataset
 *  `mcp:` namespace) as opposed to the domain model. */
export function isScaffold(iri, baseIri = "") {
  return iri.startsWith(NS.orp) || iri.startsWith(NS.oa) || iri.startsWith(NS.prov)
    || (!!baseIri && iri.startsWith(baseIri + "mcp/"));
}

function scaffoldFilter(v, baseIri) {
  const ns = [NS.orp, NS.oa, NS.prov, ...(baseIri ? [baseIri + "mcp/"] : [])];
  return "FILTER(" + ns.map((n) => `!STRSTARTS(STR(${v}), "${n}")`).join(" && ") + ")";
}

/** Distinct instance types with counts (explore.py `_types`). */
export function typesQuery({ showProvenance = false, baseIri = "" } = {}) {
  return "SELECT ?t (COUNT(?s) AS ?n) WHERE { ?s a ?t . FILTER(isIRI(?t)) "
    + (showProvenance ? "" : scaffoldFilter("?t", baseIri))
    + " } GROUP BY ?t ORDER BY DESC(?n) LIMIT 80";
}

/** Distinct predicates (explore.py `_predicates`). */
export function predicatesQuery({ showProvenance = false, baseIri = "" } = {}) {
  return "SELECT DISTINCT ?p WHERE { ?s ?p ?o . FILTER(isIRI(?p)) "
    + (showProvenance ? "" : scaffoldFilter("?p", baseIri))
    + " } LIMIT 200";
}

/** `prefix:Local` for an IRI, using the longest matching namespace. */
export function qname(iri, prefixes = {}) {
  let best = null;
  for (const [p, ns] of Object.entries(prefixes)) {
    if (iri.startsWith(ns) && (best === null || ns.length > prefixes[best].length)) best = p;
  }
  return best ? `${best}:${iri.slice(prefixes[best].length)}` : localName(iri);
}

export function localName(iri) {
  const parts = (iri || "").replace(/[#/]+$/, "").split(/[#/]/);
  return parts[parts.length - 1] || "";
}

/** The IRIs in a result set that citations are resolved for (chat.py `_iris`). */
export function iris(results, max = 8) {
  const seen = [];
  for (const row of results?.results?.bindings || []) {
    for (const cell of Object.values(row)) {
      const v = cell?.value || "";
      if (cell?.type === "uri" && v.startsWith("http") && !seen.includes(v)) seen.push(v);
    }
  }
  return seen.slice(0, max);
}

/** Provenance for the given instances — a copy of the engine's
 *  `SparqlBackend.mentions` (orp:Mention, and the legacy mcp:Mention graphs). */
export function mentionsQuery(instanceIris, limit = 8) {
  const PROV_DERIVED_FROM = NS.prov + "wasDerivedFrom";
  const PROV_VALUE = NS.prov + "value";
  const ORP = NS.orp, OA = NS.oa, DCTERMS = NS.dcterms;
  const values = instanceIris.map((i) => `<${i}>`).join(" ");
  return (
    `SELECT ?s ?quote ?source ?chunkId ?page ?section WHERE {\n` +
    `  VALUES ?s { ${values} }\n` +
    `  {\n` +
    `    ?s <${ORP}hasMention> ?m .\n` +
    `    ?m <${OA}hasTarget> ?t .\n` +
    `    ?t <${OA}hasSelector> ?qs . ?qs <${OA}exact> ?quote .\n` +
    `    OPTIONAL { ?t <${OA}hasSource>/<${ORP}fileOf>/<${DCTERMS}title> ?source }\n` +
    `    OPTIONAL { ?m <${ORP}inChunk>/<${DCTERMS}identifier> ?chunkId }\n` +
    `    OPTIONAL { ?t <${OA}hasSelector>/<${ORP}pageLabel> ?page }\n` +
    `    OPTIONAL { ?t <${OA}hasSelector>/<${ORP}sectionTitle> ?section }\n` +
    `  } UNION {\n` +
    `    ?s <${PROV_DERIVED_FROM}> ?m .\n` +
    `    ?m <${PROV_VALUE}> ?quote .\n` +
    `    OPTIONAL { ?m ?sp ?source . FILTER(STRENDS(STR(?sp), "sourcePath")) }\n` +
    `    OPTIONAL { ?m ?cp ?chunkId . FILTER(STRENDS(STR(?cp), "chunkId")) }\n` +
    `    OPTIONAL { ?m ?pp ?page . FILTER(STRENDS(STR(?pp), "pageLabel")) }\n` +
    `    OPTIONAL { ?m ?xp ?section . FILTER(STRENDS(STR(?xp), "/section")) }\n` +
    `  }\n` +
    `} LIMIT ${Math.trunc(limit)}`
  );
}

/** Mentions results → the Hub's citation contract {quote, source, chunk_id, page?, section?}. */
export function toCitations(results) {
  return (results?.results?.bindings || []).map((r) => {
    const c = { quote: r.quote?.value || "", source: r.source?.value || "",
                chunk_id: r.chunkId?.value || "" };
    if (r.page?.value) c.page = r.page.value;
    if (r.section?.value) c.section = r.section.value;
    return c;
  });
}

/** The query-writing prompt (dialect.py `SparqlDialect.system_prompt`). */
export function systemPrompt(classes, props, header) {
  return (
    "You translate a user question into ONE read-only SPARQL SELECT over an RDF " +
    "knowledge graph. Instances are typed with the classes listed below (use them " +
    "exactly as written, with their prefix, e.g. `?s a rpg:Character`). Always SELECT " +
    "?s (the instance IRI) plus a readable ?label (rdfs:label or a name property) and " +
    "any other useful value. Keep it simple; add LIMIT 20. Provenance (orp:, oa:, prov:) " +
    "is resolved for you — do not query it. Output ONLY the SPARQL " +
    "query — no prose, no markdown fences.\n\n" +
    header +
    "\nClasses: " + classes.slice(0, 80).join(", ") +
    "\nProperties: " + props.slice(0, 80).join(", ")
  );
}

export const ANSWER_SYSTEM =
  "Answer the question using ONLY the query results provided. Be concise and " +
  "grounded; if the results are empty, say the knowledge graph doesn't contain " +
  "that. Do not invent facts.";
