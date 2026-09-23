import { describe, expect, it } from "vitest";
import { GuardError, guard, iris, isScaffold, prefixHeader, qname, stripFences, systemPrompt, toCitations } from "../src/lib/sparql.js";

const HDR = prefixHeader({ rpg: "http://www.rpg-schema.org/1.0/" }, "https://ex.org/ds/");

describe("guard", () => {
  it("adds a LIMIT and the prefix header to a bare SELECT", () => {
    const q = guard("SELECT ?s WHERE { ?s a rpg:Spell }", HDR);
    expect(q.startsWith("PREFIX")).toBe(true);
    expect(q).toContain("PREFIX rpg: <http://www.rpg-schema.org/1.0/>");
    expect(q).toContain("PREFIX ds: <https://ex.org/ds/>");
    expect(q).toContain("PREFIX orp: <https://ontorag.org/provenance#>");
    expect(q.trimEnd().endsWith("LIMIT 20")).toBe(true);
  });
  it("keeps the query's own prefixes and limit", () => {
    const q = guard("PREFIX x: <urn:x#>\nSELECT ?s WHERE { ?s a x:T } LIMIT 5", HDR);
    expect(q.match(/PREFIX/g).length).toBe(1);
    expect(q).toContain("LIMIT 5");
  });
  it("rejects writes and non-SELECT forms", () => {
    expect(() => guard("DELETE WHERE { ?s ?p ?o }", HDR)).toThrow(GuardError);
    expect(() => guard("INSERT DATA { <a> <b> <c> }", HDR)).toThrow(GuardError);
    expect(() => guard("CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }", HDR)).toThrow(GuardError);
    expect(() => guard("ASK { ?s ?p ?o }", HDR)).toThrow(GuardError);
  });
  it("accepts ASK only in the console", () => {
    expect(guard("ASK { ?s ?p ?o }", HDR, { allowAsk: true })).toContain("ASK");
  });
});

it("strips markdown fences models add anyway", () => {
  expect(stripFences("```sparql\nSELECT ?s WHERE {}\n```")).toBe("SELECT ?s WHERE {}");
  expect(stripFences("```\nSELECT 1\n```")).toBe("SELECT 1");
  expect(stripFences("SELECT 1")).toBe("SELECT 1");
});

it("knows provenance scaffolding from the domain model", () => {
  expect(isScaffold("https://ontorag.org/provenance#Mention")).toBe(true);
  expect(isScaffold("http://www.w3.org/ns/oa#hasTarget")).toBe(true);
  expect(isScaffold("http://www.w3.org/ns/prov#wasDerivedFrom")).toBe(true);
  expect(isScaffold("https://ex.org/ds/mcp/Mention", "https://ex.org/ds/")).toBe(true);
  expect(isScaffold("http://www.rpg-schema.org/1.0/Spell")).toBe(false);
});

it("names IRIs with the longest matching prefix", () => {
  const px = { a: "https://ex.org/", ab: "https://ex.org/ds/" };
  expect(qname("https://ex.org/ds/Magus", px)).toBe("ab:Magus");
  expect(qname("urn:other#Thing", px)).toBe("Thing");
});

it("collects result IRIs for citations, like chat._iris", () => {
  const res = { results: { bindings: [
    { s: { type: "uri", value: "https://ex.org/a" }, l: { type: "literal", value: "A" } },
    { s: { type: "uri", value: "https://ex.org/a" } },
    { s: { type: "uri", value: "urn:x" } },
    { s: { type: "uri", value: "https://ex.org/b" } }] } };
  expect(iris(res)).toEqual(["https://ex.org/a", "https://ex.org/b"]);
});

it("maps mention rows to the citation contract", () => {
  const rows = { results: { bindings: [
    { quote: { value: "q" }, source: { value: "SRD" }, chunkId: { value: "c1" }, page: { value: "131" } },
    { quote: { value: "r" } }] } };
  expect(toCitations(rows)).toEqual([
    { quote: "q", source: "SRD", chunk_id: "c1", page: "131" },
    { quote: "r", source: "", chunk_id: "" }]);
});

it("builds the query-writing prompt from the schema", () => {
  const p = systemPrompt(["rpg:Spell"], ["rdfs:label"], HDR);
  expect(p).toContain("Classes: rpg:Spell");
  expect(p).toContain("Properties: rdfs:label");
  expect(p).toContain("PREFIX rpg:");
});
