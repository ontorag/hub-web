<script>
  import { onMount } from "svelte";
  import { api } from "./lib/api.js";

  export let slug;
  export let current = [];
  export let onChanged = () => {};

  let common = [], err = "", busy = false;
  let byUrl = { slug: "", url: "" };
  let byUp = { slug: "", file: null };

  onMount(async () => { try { common = await api.commonBaselines(); } catch (e) { err = e.message; } });

  $: available = common.filter((c) => !current.includes(c.slug));

  async function wrap(fn) { busy = true; err = ""; try { await fn(); onChanged(); } catch (e) { err = e.message; } finally { busy = false; } }
  const addCommon = (b) => wrap(() => api.addBaseline(slug, b.slug));
  const remove = (b) => wrap(() => api.removeBaseline(slug, b));
  const addUrl = () => byUrl.slug && byUrl.url && wrap(async () => { await api.addBaseline(slug, byUrl.slug, byUrl.url); byUrl = { slug: "", url: "" }; });
  const addUpload = () => byUp.slug && byUp.file && wrap(async () => { await api.uploadBaseline(slug, byUp.slug, byUp.file); byUp = { slug: "", file: null }; });
</script>

<div>
  {#if err}<p class="err">{err}</p>{/if}

  <div class="chips">
    {#if current.length}
      {#each current as b}<span class="chip">{b}<button class="x" on:click={() => remove(b)} disabled={busy}>✕</button></span>{/each}
    {:else}<span class="muted">No baselines yet — extraction still works, but induced terms won't align to a standard vocabulary.</span>{/if}
  </div>

  {#if available.length}
    <p class="muted" style="margin:.6rem 0 .2rem">Add a common one:</p>
    <div class="chips">
      {#each available as c}
        <button class="add" title={c.description} on:click={() => addCommon(c)} disabled={busy}>+ {c.label}</button>
      {/each}
    </div>
  {/if}

  <details>
    <summary class="muted">Add your own (URL or upload)</summary>
    <div class="own">
      <div class="row">
        <input placeholder="slug (e.g. acme)" bind:value={byUrl.slug} />
        <input placeholder="https://…/ontology.ttl | .rdf | .owl | .jsonld" bind:value={byUrl.url} />
        <button class="ghost" on:click={addUrl} disabled={busy || !byUrl.slug || !byUrl.url}>Add URL</button>
      </div>
      <div class="row">
        <input placeholder="slug" bind:value={byUp.slug} />
        <input type="file" on:change={(e) => (byUp.file = e.target.files[0])} />
        <button class="ghost" on:click={addUpload} disabled={busy || !byUp.slug || !byUp.file}>Upload</button>
      </div>
      <p class="muted">Any RDF serialization (Turtle / RDF-XML / JSON-LD / N-Triples) is accepted and normalized to Turtle.</p>
    </div>
  </details>
</div>

<style>
  .chips { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
  .chip { padding: 0.12rem 0.2rem 0.12rem 0.5rem; }
  .chip .x { background: none; border: 0; color: var(--faint); cursor: pointer; font-size: 0.72rem; padding: 0 0.15rem; }
  .chip .x:hover { color: var(--ink); background: none; }
  button.add { background: transparent; border: 1px dashed var(--line-strong); color: var(--muted); padding: 0.22rem 0.55rem; }
  button.add:hover { color: var(--ink); background: var(--surface-2); border-color: var(--line-strong); }
  summary { cursor: pointer; }
  .own { margin-top: 0.6rem; }
  .own .row { display: flex; gap: 0.4rem; margin-bottom: 0.4rem; }
  .own .row input[type="file"] { padding: 0.3rem; }
</style>
