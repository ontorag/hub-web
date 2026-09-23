<script>
  import { api } from "./lib/api.js";

  export let slug;
  export let ds;
  export let onSaved = () => {};
  export let embedded = false; // reserved

  const d = ds.manifest?.dataset || {};
  const n = d.neo4j || {};
  let form = {
    title: ds.title || "",
    openrouter_model: d.openrouter_model || "",
    openrouter_base_url: d.openrouter_base_url || "",
    concurrency: d.concurrency || 4,
    openrouter_key: "",
    neo4j_uri: n.uri || "",
    neo4j_user: n.user || "",
    neo4j_database: n.database || "",
    neo4j_password: "",
  };
  let busy = false, err = "", ok = false;
  $: usingNeo4j = !!form.neo4j_uri;

  async function save() {
    busy = true; err = ""; ok = false;
    try {
      await api.updateConfig(slug, {
        title: form.title, openrouter_model: form.openrouter_model,
        openrouter_base_url: form.openrouter_base_url, concurrency: +form.concurrency,
        openrouter_key: form.openrouter_key || null,
        neo4j_uri: form.neo4j_uri, neo4j_user: form.neo4j_user,
        neo4j_database: form.neo4j_database,
        neo4j_password: form.neo4j_password || null,
      });
      form.openrouter_key = ""; form.neo4j_password = ""; ok = true; onSaved();
    } catch (e) { err = e.message; } finally { busy = false; }
  }
</script>

<div class="form">
  <label>Title</label>
  <input bind:value={form.title} />
  <label>LLM endpoint — OpenAI-compatible base URL (blank = inherit your default)</label>
  <input bind:value={form.openrouter_base_url} placeholder="inherit" />
  <label>Model (blank = inherit your default)</label>
  <input bind:value={form.openrouter_model} placeholder="inherit" />
  <label>Concurrency</label>
  <input type="number" min="1" bind:value={form.concurrency} />
  <label>Replace API key (leave blank to keep the current one)</label>
  <input type="password" bind:value={form.openrouter_key} placeholder="sk-…" />
  <hr />
  <p class="section">Chat store
    <span class="badge">{usingNeo4j ? "Neo4j · Cypher" : "graph TTL · SPARQL"}</span></p>
  <p class="muted">By default chat answers with SPARQL over this dataset's committed
    <code>world.ttl</code>. Give a bolt URI to answer with Cypher over a Neo4j
    projection instead (load it first with <code>ontorag load-neo4j</code>). Clear the
    URI to switch back.</p>
  <label>Neo4j bolt URI (blank = use the committed TTL)</label>
  <input bind:value={form.neo4j_uri} placeholder="bolt://localhost:7687" />
  {#if usingNeo4j}
    <label>Neo4j user</label>
    <input bind:value={form.neo4j_user} placeholder="neo4j" />
    <label>Neo4j database (blank = server default)</label>
    <input bind:value={form.neo4j_database} placeholder="neo4j" />
    <label>Neo4j password (leave blank to keep the stored one)</label>
    <input type="password" bind:value={form.neo4j_password} placeholder="••••••" />
  {/if}

  {#if err}<p class="err">{err}</p>{/if}
  <div class="row">
    <button class="primary" on:click={save} disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
    {#if ok}<span class="muted">Saved ✓</span>{/if}
  </div>
  <p class="muted">A new key updates both the repo's Actions secret (for extraction) and the
    Hub's encrypted store (for chat). Local endpoints only work where the code runs — use an
    internet-reachable endpoint for the Actions-based extraction.</p>
  <p class="muted">Anything left blank falls back to the chat defaults in your index repo.
    To try a different model or endpoint for one question without saving it, use
    <em>test endpoint</em> under the chat box.</p>
</div>

<style>
  .form { max-width: 520px; }
  .row { display: flex; align-items: center; gap: 0.6rem; margin-top: var(--sp-4); }
  hr { border: 0; border-top: 1px solid var(--line); margin: var(--sp-6) 0 var(--sp-4); }
  .section { font-weight: 600; margin: 0 0 var(--sp-2); display: flex; align-items: center; gap: 0.5rem; }
  .badge { font-family: var(--font-mono); font-size: 0.68rem; color: var(--accent-ink);
    border: 1px solid var(--line); border-radius: var(--r-sm); padding: 0.1rem 0.4rem; }
</style>
