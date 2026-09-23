// The in-browser graph layer, run under Node against Oxigraph's Node build.
import { describe, expect, it } from "vitest";
import * as ox from "oxigraph";
import { createGraph } from "../src/lib/graph.js";
import { answerOver, vocabulary } from "../src/lib/chat.js";

const BASE = "https://example.org/srd/";
// what `ontorag extract-instances` writes since 0.1.13 (orp: provenance)
const ORP_TTL = `
@prefix orp: <https://ontorag.org/provenance#> .
@prefix oa: <http://www.w3.org/ns/oa#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix rpg: <http://www.rpg-schema.org/1.0/> .
<${BASE}Spell/1> a rpg:Spell ; rdfs:label "Fireball" ;
  orp:attestedIn <${BASE}source/srd> ; orp:hasMention <${BASE}mention/m1> .
<${BASE}source/srd> a orp:Source ; dcterms:title "System Reference Document 5.2.1" .
<${BASE}file/f1> a orp:SourceFile ; orp:fileOf <${BASE}source/srd> .
<${BASE}chunk/c1> a orp:Chunk ; dcterms:identifier "doc#p131#c0412" .
<${BASE}mention/m1> a orp:Mention ; orp:mentions <${BASE}Spell/1> ; orp:inChunk <${BASE}chunk/c1> ;
  oa:hasTarget [ a oa:SpecificResource ; oa:hasSource <${BASE}file/f1> ;
    oa:hasSelector [ a oa:TextQuoteSelector ; oa:exact "A bright streak flashes from you" ] ,
                   [ a orp:PageSelector ; orp:pageStart 131 ; orp:pageLabel "131" ] ,
                   [ a orp:SectionSelector ; orp:sectionTitle "Fireball" ] ] .
`;
// graphs written before orp: (per-dataset mcp: namespace)
const LEGACY_TTL = `
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix mcp: <${BASE}mcp/> .
<${BASE}Spell/old> a <http://www.rpg-schema.org/1.0/Spell> ;
  prov:wasDerivedFrom [ a mcp:Mention ; prov:value "An older quote." ; mcp:chunkId "c9" ;
    mcp:sourcePath "old.pdf" ; mcp:pageLabel "7" ; mcp:section "History" ] .
`;
const PX = { rpg: "http://www.rpg-schema.org/1.0/" };
const g = () => createGraph(ox, [ORP_TTL, LEGACY_TTL], { baseIri: BASE, prefixes: PX });

describe("explorer queries", () => {
  it("lists domain types and hides provenance scaffolding by default", () => {
    const names = g().types().map((t) => t.name);
    expect(names).toEqual(["rpg:Spell"]);
    const all = g().types({ showProvenance: true }).map((t) => t.name);
    expect(all).toEqual(expect.arrayContaining(["orp:Mention", "orp:Source", "oa:SpecificResource"]));
  });
  it("lists predicates without rdf:type or scaffolding", () => {
    const p = g().predicates();
    expect(p).toContain("rdfs:label");
    expect(p.some((n) => n.startsWith("orp:") || n.startsWith("oa:") || n.startsWith("prov:"))).toBe(false);
    expect(p).not.toContain("rdf:type");
  });
  it("runs a guarded console query and cites the IRIs in its rows", () => {
    const r = g().query("SELECT ?s ?l WHERE { ?s a rpg:Spell ; rdfs:label ?l }");
    expect(r.columns).toEqual(["s", "l"]);
    expect(r.rows).toHaveLength(1);
    expect(r.citations[0]).toMatchObject({ quote: "A bright streak flashes from you", page: "131" });
  });
  it("refuses writes", () => {
    expect(() => g().query("DELETE WHERE { ?s ?p ?o }")).toThrow();
  });
});

describe("mentions (the engine's query)", () => {
  it("reads orp: provenance", () => {
    expect(g().mentions([BASE + "Spell/1"])).toEqual([{
      quote: "A bright streak flashes from you", source: "System Reference Document 5.2.1",
      chunk_id: "doc#p131#c0412", page: "131", section: "Fireball" }]);
  });
  it("still reads legacy mcp: graphs", () => {
    expect(g().mentions([BASE + "Spell/old"])).toEqual([{
      quote: "An older quote.", source: "old.pdf", chunk_id: "c9", page: "7", section: "History" }]);
  });
});

describe("chat", () => {
  it("gives the model only the domain vocabulary", () => {
    const { classes, props } = vocabulary(g());
    expect(classes).toEqual(["rpg:Spell"]);
    expect(props.every((p) => !/^(orp|oa|prov):/.test(p))).toBe(true);
  });
  it("NL → one query → cited answer, with one repair attempt", async () => {
    const calls = [];
    const replies = [
      "```sparql\nSELECT ?s ?label WHERE { ?s a rpg:Spell ; rdfs:label ?label\n```", // unbalanced brace
      "SELECT ?s ?label WHERE { ?s a rpg:Spell ; rdfs:label ?label }",
      "Fireball [1].",
    ];
    const llm = async (msgs) => { calls.push(msgs); return replies.shift(); };
    const out = await answerOver(g(), "Which spells are there?", llm);
    expect(out.answer).toBe("Fireball [1].");
    expect(out.sparql).toContain("rpg:Spell");
    expect(out.citations[0].page).toBe("131");
    expect(calls).toHaveLength(3);
    expect(calls[1].at(-1).content).toMatch(/errored/);
  });
});
