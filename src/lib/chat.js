// Client-side citing chat over a public dataset: NL → ONE read-only SPARQL query →
// grounded answer with citations. A port of the Hub backend's chat._answer_over, so
// public datasets need no backend; the model call goes straight to the user's
// OpenRouter (or other OpenAI-compatible) endpoint with the user's own key.
import { ANSWER_SYSTEM, guard, iris, isScaffold, stripFences, systemPrompt } from "./sparql.js";

/** Classes and properties to show the model, without provenance scaffolding. */
export function vocabulary(graph) {
  const classes = graph.types().map((t) => t.name);
  const props = graph.predicates().filter((p) => !isScaffold(expand(p, graph), graph.baseIri));
  return { classes, props };
}

function expand(name, graph) {
  const i = name.indexOf(":");
  if (i < 0) return name;
  const ns = { ...graph.prefixes }[name.slice(0, i)];
  return ns ? ns + name.slice(i + 1) : name;
}

/**
 * @param graph   from createGraph()
 * @param llm     async (messages) => string
 */
export async function answerOver(graph, question, llm) {
  const { classes, props } = vocabulary(graph);
  const gen = [
    { role: "system", content: systemPrompt(classes, props, graph.header) },
    { role: "user", content: question },
  ];
  let query = guard(stripFences(await llm(gen)), graph.header);

  let results;
  try {
    results = graph.select(query);
  } catch (e) { // one repair attempt
    gen.push({ role: "assistant", content: query });
    gen.push({ role: "user", content: `That query errored: ${e.message || e}. Return a corrected query only.` });
    query = guard(stripFences(await llm(gen)), graph.header);
    try {
      results = graph.select(query);
    } catch {
      return { answer: "I couldn't query the graph for that.", sparql: query, citations: [] };
    }
  }

  let citations = [];
  try { citations = graph.mentions(iris(results)); } catch { /* provenance is a bonus */ }

  const rows = results?.results?.bindings || [];
  const answer = await llm([
    { role: "system", content: ANSWER_SYSTEM },
    { role: "user", content: `Question: ${question}\n\nResults (JSON):\n${JSON.stringify(rows.slice(0, 25))}` },
  ]);
  return { answer: answer.trim(), sparql: query, citations };
}
