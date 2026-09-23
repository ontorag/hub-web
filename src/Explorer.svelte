<script>
  import { onMount } from "svelte";
  import { openGraph } from "./lib/public.js";
  import { answerOver } from "./lib/chat.js";
  import { complete, getLlm, llmReady } from "./lib/llm.js";
  import Icon from "./Icon.svelte";
  import Citations from "./Citations.svelte";
  import LlmPanel from "./LlmPanel.svelte";

  export let repo;   // "owner/name"

  // Everything here runs in the browser: the graph is loaded from GitHub into an
  // in-browser SPARQL store (Oxigraph), and questions go to the user's own model.
  let graph = null, meta = null, err = "", loading = true;
  let mode = "sparql";          // "sparql" | "ask"
  let showProvenance = false;
  let classes = [];

  // SPARQL console
  let sparql = "";
  let running = false, qErr = "";
  let result = null;            // {columns, rows, citations, sparql}

  // NL ask
  let question = "";
  let asking = false, aErr = "";
  let answer = null;            // {answer, sparql, citations}
  let llmOk = llmReady(getLlm());

  const localName = (q) => (q || "").split(/[#/:]/).pop();
  const short = (v, t) => (t === "uri" ? localName(v) : v);
  const tick = () => new Promise((r) => setTimeout(r, 0));   // let "Running…" paint

  function starterFor(cls) {
    return `SELECT ?s ?p ?o WHERE {\n  ?s a ${cls} ;\n     ?p ?o .\n} LIMIT 30`;
  }

  onMount(async () => {
    try {
      ({ graph, meta } = await openGraph(repo));
      classes = graph.types({ showProvenance });
      if (classes.length) sparql = starterFor(classes[0].name);
    } catch (e) { err = e.message || String(e); }
    finally { loading = false; }
  });

  $: if (graph) classes = graph.types({ showProvenance });

  function useClass(cls) {
    mode = "sparql"; sparql = starterFor(cls); runQuery();
  }
  function suggest(cls) {
    mode = "ask"; question = `List some ${localName(cls).toLowerCase()} entities and what defines them.`;
  }
  function describe(iri) {
    mode = "sparql"; sparql = `SELECT ?p ?o WHERE {\n  <${iri}> ?p ?o .\n} LIMIT 100`; runQuery();
  }

  async function runQuery() {
    running = true; qErr = ""; result = null;
    await tick();
    try { result = graph.query(sparql); }
    catch (e) { qErr = e.message || String(e); }
    finally { running = false; }
  }

  async function ask() {
    if (!llmOk) { aErr = "Connect a model below to ask in natural language."; return; }
    asking = true; aErr = ""; answer = null;
    try { answer = await answerOver(graph, question, (msgs) => complete(msgs)); }
    catch (e) { aErr = e.message || String(e); }
    finally { asking = false; }
  }
</script>

<main class="wrap fade-in">
  <a href="#/" class="back"><Icon name="back" size={14} /> Catalog</a>

  {#if loading}
    <p class="coord">Loading the graph into your browser… (a few MB for large datasets)</p>
  {:else if err}
    <p class="err">{err}</p>
  {:else}
    <header class="head">
      <div class="titles">
        <h1>{meta.title}</h1>
        <a class="repo" href={meta.url} target="_blank" rel="noopener">
          {meta.repo}<Icon name="external" size={12} /></a>
      </div>
      <div class="badges">
        <span class="chip ro"><Icon name="globe" size={11} /> read-only</span>
        {#if meta.servable}<span class="chip" title="follows the OntoRAG dataset format 0.1">servable</span>{/if}
        {#if meta.license}<span class="chip">{meta.license}</span>{/if}
      </div>
    </header>

    <div class="stats">
      {#each Object.entries(meta.stats) as [k, v]}
        <span class="stat"><b>{v.toLocaleString()}</b> {k}</span>
      {/each}
    </div>

    <section class="classes">
      <div class="clhead">
        <h4>Classes in this graph — click to query</h4>
        <label class="inline"><input type="checkbox" bind:checked={showProvenance} /> show provenance</label>
      </div>
      <div class="clist">
        {#each classes as c}
          <button class="clschip" on:click={() => useClass(c.name)} title={"list " + c.name}>
            <span class="cn">{c.name}</span><span class="cc">{c.count.toLocaleString()}</span>
          </button>
        {/each}
      </div>
    </section>

    <div class="modebar">
      <button class="seg {mode === 'sparql' ? 'on' : ''}" on:click={() => (mode = 'sparql')}>SPARQL</button>
      <button class="seg {mode === 'ask' ? 'on' : ''}" on:click={() => (mode = 'ask')}>Ask</button>
    </div>

    {#if mode === "sparql"}
      <section class="card">
        <label>Read-only SELECT — prefixes are added automatically</label>
        <textarea class="mono" rows="6" bind:value={sparql}
          spellcheck="false"></textarea>
        <div class="row">
          <button class="primary" on:click={runQuery} disabled={running || !sparql.trim()}>
            <Icon name="run" size={13} /> {running ? "Running…" : "Run query"}</button>
          {#if classes[0]}
            {#each classes.slice(0, 3) as c}
              <button class="ghost sm" on:click={() => useClass(c.name)}>{c.name}</button>
            {/each}
          {/if}
        </div>
        {#if qErr}<p class="err">{qErr}</p>{/if}
      </section>

      {#if result}
        <section class="card">
          <div class="sheet-hd"><span>results</span><span class="sp"></span>
            <span class="coord">{result.rows.length} row{result.rows.length === 1 ? "" : "s"}</span></div>
          {#if result.rows.length === 0}
            <p class="muted">No rows. Try a different class or property.</p>
          {:else}
            <div class="tblwrap">
              <table>
                <thead><tr>{#each result.columns as c}<th>?{c}</th>{/each}</tr></thead>
                <tbody>
                  {#each result.rows as r}
                    <tr>{#each result.columns as c}
                      <td title={r[c]?.value || ""}>
                        {#if r[c]?.type === "uri"}<button class="uri linkish" title={"describe " + r[c].value}
                          on:click={() => describe(r[c].value)}>{short(r[c].value, "uri")}</button>
                        {:else}{r[c]?.value ?? ""}{/if}
                      </td>
                    {/each}</tr>
                  {/each}
                </tbody>
              </table>
            </div>
            <Citations citations={result.citations} />
          {/if}
        </section>
      {/if}
    {:else}
      <section class="card">
        <label>Ask in plain English</label>
        <div class="askrow">
          <input bind:value={question} placeholder="e.g. Which factions oppose the Order of Hermes?"
            on:keydown={(e) => e.key === "Enter" && ask()} />
          <button class="primary" on:click={ask} disabled={asking || !question.trim()}>
            <Icon name="chat" size={13} /> {asking ? "Thinking…" : "Ask"}</button>
        </div>
        <LlmPanel on:change={(e) => (llmOk = llmReady(e.detail))} />
        {#if llmOk && classes.length}
          <p class="muted">Suggestions: {#each classes.slice(0, 3) as c}<button class="linkish" on:click={() => suggest(c.name)}>{localName(c.name)}</button>{" "}{/each}</p>
        {/if}
        {#if aErr}<p class="err">{aErr}</p>{/if}
      </section>

      {#if answer}
        <section class="card">
          <p class="ans">{answer.answer}</p>
          <Citations citations={answer.citations} />
          {#if answer.sparql}<details class="sparql"><summary>sparql</summary><pre>{answer.sparql}</pre></details>{/if}
        </section>
      {/if}
    {/if}
  {/if}
</main>

<style>
  .wrap { max-width: 980px; margin: clamp(1.2rem, 3vw, 2.4rem) auto; padding: 0 clamp(1rem, 3vw, 2rem); }
  .back { display: inline-flex; align-items: center; gap: 0.35rem; color: var(--muted); font-size: 0.84rem; }

  .head { display: flex; align-items: flex-start; gap: var(--sp-4); margin: var(--sp-4) 0 var(--sp-3); }
  .titles { flex: 1; min-width: 0; }
  .head h1 { font-size: clamp(1.7rem, 1.2rem + 1.6vw, 2.4rem); margin-bottom: 0.3rem; }
  .repo { display: inline-flex; align-items: center; gap: 0.3rem; font-family: var(--font-mono); font-size: 0.78rem; color: var(--muted); }
  .repo:hover { color: var(--accent-ink); text-decoration: none; }
  .badges { display: flex; flex-direction: column; align-items: flex-end; gap: 0.35rem; }
  .chip.ro { color: var(--accent-ink); border-color: color-mix(in oklch, var(--accent-ink), transparent 55%); }

  .stats { display: flex; flex-wrap: wrap; gap: var(--sp-4); margin-bottom: var(--sp-6); }
  .stat { font-size: 0.82rem; color: var(--muted); }
  .stat b { font-family: var(--font-mono); font-weight: 600; color: var(--ink); }

  .classes { margin-bottom: var(--sp-6); }
  .clist { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .clschip { padding: 0.2rem 0.2rem 0.2rem 0.6rem; gap: 0; border-radius: 999px;
    background: var(--surface); border: 1px solid var(--line); overflow: hidden; }
  .clschip:hover { border-color: var(--accent-ink); background: var(--surface); }
  .clschip .cn { font-family: var(--font-mono); font-size: 0.76rem; color: var(--ink); }
  .clschip .cc { font-family: var(--font-mono); font-size: 0.72rem; color: var(--muted);
    background: var(--surface-2); padding: 0.12rem 0.5rem; margin-left: 0.5rem; border-radius: 999px; }

  .modebar { display: inline-flex; gap: 2px; padding: 3px; background: var(--surface-2);
    border: 1px solid var(--line); border-radius: 999px; margin-bottom: var(--sp-4); }
  .seg { border: 0; background: transparent; border-radius: 999px; padding: 0.32rem 0.9rem; color: var(--muted); }
  .seg.on { background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgb(0 0 0 / 0.06); }

  textarea.mono { font-size: 0.82rem; line-height: 1.5; resize: vertical; }
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-top: var(--sp-3); }
  .askrow { display: flex; gap: 0.5rem; }
  .askrow input { flex: 1; }
  .clhead { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--sp-3); justify-content: space-between; }
  .inline { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; color: var(--muted); margin: 0; }
  .inline input { width: auto; }
  .askrow { flex-wrap: wrap; }
  button.sm, .btn.sm { padding: 0.3rem 0.6rem; font-size: 0.78rem; }
  .linkish { background: none; border: 0; padding: 0; color: var(--accent-ink); font: inherit; font-weight: 600; cursor: pointer; }
  .linkish:hover { text-decoration: underline; }

  .ans { margin: 0; white-space: pre-wrap; }
  .sparql { margin-top: var(--sp-3); }
  .sparql summary { font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); cursor: pointer; }
  .sparql pre { font-family: var(--font-mono); font-size: 0.76rem; background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--r); padding: 0.6rem; overflow: auto; margin-top: 0.4rem; }

  .tblwrap { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--r-sm); }
  table { border-collapse: collapse; width: 100%; font-size: 0.82rem; }
  th, td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { font-family: var(--font-mono); font-size: 0.72rem; color: var(--muted); background: var(--surface-2); position: sticky; top: 0; }
  tbody tr:last-child td { border-bottom: 0; }
  td { max-width: 340px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .uri { font-family: var(--font-mono); color: var(--accent-ink); font-weight: 400; }
  @media (max-width: 600px) { .head { flex-direction: column; } .badges { flex-direction: row; align-items: flex-start; } }
</style>
