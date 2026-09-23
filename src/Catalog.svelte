<script>
  import { onMount } from "svelte";
  import { api } from "./lib/api.js";
  import { catalog } from "./lib/public.js";
  import Icon from "./Icon.svelte";

  export let canFork = false;   // post-login: allow forking into the user's account

  let items = [];
  let loading = true;
  let err = "";
  let forking = "";             // repo currently being forked
  let forkErr = {};             // repo -> error message

  onMount(async () => {
    // listed and described client-side (static catalog.json + manifests from GitHub)
    try { items = await catalog(); }
    catch (e) { err = e.message; }
    finally { loading = false; }
  });

  const STAT_LABEL = { documents: "docs", chunks: "chunks", entities: "entities" };

  async function fork(repo) {
    forking = repo; forkErr = { ...forkErr, [repo]: "" };
    try {
      const ds = await api.forkCatalog(repo);
      location.hash = "#/ds/" + ds.slug;
    } catch (e) {
      forkErr = { ...forkErr, [repo]: e.message };
    } finally { forking = ""; }
  }
</script>

<div class="card">
  <div class="sheet-hd">
    <Icon name="globe" size={16} />
    <span>public datasets</span>
    <span class="sp"></span>
    <span class="coord">fetch &amp; fork</span>
  </div>

  {#if loading}
    <p class="muted">Loading catalog…</p>
  {:else if err}
    <p class="err">{err}</p>
  {:else if items.length === 0}
    <p class="muted">No public datasets available yet.</p>
  {:else}
    <p class="intro muted">Governed knowledge graphs shared by the community. Open one to
      browse its ontology and run SPARQL or natural-language queries, right in your browser —
      no account needed.{#if canFork} Fork one to get your own copy.{/if}</p>
    <div class="cat">
      {#each items as it}
        <article class="pub" class:invalid={!it.explorable}>
          <div class="hd">
            <h3>{it.title}</h3>
            {#if it.license}<span class="chip lic">{it.license}</span>{/if}
            {#if it.servable}<span class="chip ok" title="follows the OntoRAG dataset format 0.1 — servable by ontorag-mcp">servable</span>{/if}
          </div>
          <a class="repo" href={it.url} target="_blank" rel="noopener">
            {it.repo}<Icon name="external" size={12} />
          </a>
          {#if it.description}<p class="desc">{it.description}</p>{/if}

          <div class="foot">
            <div class="stats">
              {#each Object.entries(it.stats) as [k, v]}
                <span class="stat"><b>{v.toLocaleString()}</b> {STAT_LABEL[k] || k}</span>
              {/each}
            </div>
            <span class="sp"></span>
            {#if !it.explorable}
              <span class="chip warn" title="manifest does not declare the ontorag structure">
                not an ontorag repo</span>
            {:else}
              <div class="acts">
                <a class="btn sm" href={"#/explore/" + it.repo}>
                  <Icon name="arrow" size={14} /> Explore</a>
                {#if canFork}
                  <button class="ghost sm" on:click={() => fork(it.repo)}
                    disabled={!!forking} title="Create your own copy in your GitHub">
                    <Icon name="fork" size={14} />
                    {forking === it.repo ? "Forking…" : "Fork"}
                  </button>
                {/if}
              </div>
            {/if}
          </div>
          {#if forkErr[it.repo]}<p class="err">{forkErr[it.repo]}</p>{/if}
        </article>
      {/each}
    </div>
  {/if}
</div>

<style>
  .intro { max-width: 62ch; margin: 0 0 var(--sp-4); }
  .cat { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--sp-3); }
  .pub {
    border: 1px solid var(--line); border-radius: var(--r);
    padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-2);
    background: var(--paper);
  }
  .pub.invalid { opacity: 0.72; }
  .pub .hd { display: flex; align-items: baseline; gap: var(--sp-2); }
  .pub .hd h3 { flex: 1; }
  .repo { font-family: var(--font-mono); font-size: 0.76rem; color: var(--muted);
    display: inline-flex; align-items: center; gap: 0.3rem; align-self: flex-start; }
  .repo:hover { color: var(--accent-ink); text-decoration: none; }
  .desc { margin: 0; font-size: 0.9rem; color: var(--ink); line-height: 1.5; }
  .foot { display: flex; align-items: center; gap: var(--sp-3); margin-top: auto; padding-top: var(--sp-2); }
  .foot .sp { flex: 1; }
  .stats { display: flex; flex-wrap: wrap; gap: var(--sp-3); }
  .stat { font-size: 0.78rem; color: var(--muted); }
  .stat b { font-family: var(--font-mono); font-weight: 600; color: var(--ink); font-size: 0.8rem; }
  .lic { color: var(--muted); }
  .ok { color: var(--accent-ink); border-color: color-mix(in oklch, var(--accent-ink), transparent 55%); }
  .pub .hd { flex-wrap: wrap; }
  .cat { grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr)); }
  .warn { color: light-dark(oklch(0.52 0.16 60), oklch(0.80 0.15 70)); border-color: currentColor; }
  .acts { display: flex; align-items: center; gap: 0.4rem; }
  button.sm, .btn.sm { padding: 0.32rem 0.65rem; font-size: 0.8rem; }
</style>
