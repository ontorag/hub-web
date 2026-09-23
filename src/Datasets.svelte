<script>
  import { onMount } from "svelte";
  import { api } from "./lib/api.js";
  import Catalog from "./Catalog.svelte";

  let items = [];
  let err = "";
  let creating = false;
  let common = [];
  let selected = {};          // baseline slug -> bool
  let form = { title: "", slug: "", openrouter_key: "", openrouter_model: "", openrouter_base_url: "", concurrency: 4 };

  // user-level chat defaults, stored in the personal index repo
  let defs = null;            // {model, base_url, key_set}
  let dform = { model: "", base_url: "", key: "" };
  let dOpen = false, dBusy = false, dErr = "", dOk = false;

  async function loadDefaults() {
    try {
      defs = await api.chatSettings();
      dform = { model: defs.model || "", base_url: defs.base_url || "", key: "" };
    } catch (e) { dErr = e.message; }
  }
  async function saveDefaults() {
    dBusy = true; dErr = ""; dOk = false;
    try {
      // "" clears a field server-side; the key is only sent when actually typed
      defs = await api.saveChatSettings({
        model: dform.model, base_url: dform.base_url,
        key: dform.key ? dform.key : null,
      });
      dform.key = ""; dOk = true;
    } catch (e) { dErr = e.message; } finally { dBusy = false; }
  }
  async function clearKey() {
    dBusy = true; dErr = ""; dOk = false;
    try { defs = await api.saveChatSettings({ key: "" }); dform.key = ""; }
    catch (e) { dErr = e.message; } finally { dBusy = false; }
  }

  async function load() { try { items = await api.datasets(); } catch (e) { err = e.message; } }
  onMount(() => {
    load();
    loadDefaults();
    api.commonBaselines().then((b) => (common = b)).catch(() => {});
  });

  function slugify() {
    if (!form.slug && form.title)
      form.slug = form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  async function create() {
    err = ""; creating = true;
    try {
      const ds = await api.createDataset({
        title: form.title, slug: form.slug, openrouter_key: form.openrouter_key,
        openrouter_model: form.openrouter_model || null,
        openrouter_base_url: form.openrouter_base_url || null,
        baselines: common.filter((c) => selected[c.slug]).map((c) => c.slug),
        concurrency: +form.concurrency,
      });
      location.hash = "#/ds/" + ds.slug;
    } catch (e) { err = e.message; } finally { creating = false; }
  }
</script>

<div class="card">
  <div class="sheet-hd"><span class="no">§</span><span>your datasets</span><span class="sp"></span>
    <span class="coord">{items.length} total</span></div>
  {#if err}<p class="err">{err}</p>{/if}
  {#if items.length === 0}<p class="muted">No datasets yet — draft one below.</p>{/if}
  <div class="dslist">
    {#each items as d}
      <a class="row" href={"#/ds/" + d.slug}>
        <span class="ttl">{d.title || d.slug}</span>
        <span class="sp"></span>
        <span class="chip st">{d.state}</span>
        <span class="go">→</span>
      </a>
    {/each}
  </div>
</div>

<div class="card">
  <div class="sheet-hd"><span class="no">§</span><span>chat defaults</span><span class="sp"></span>
    <span class="coord">{defs?.key_set ? "key stored" : "no key"}</span>
    <button class="togg" on:click={() => (dOpen = !dOpen)}>{dOpen ? "▾" : "▸"}</button>
  </div>
  {#if !dOpen}
    <p class="muted">Used by any dataset that doesn't set its own — model
      <code>{defs?.model || "hub default"}</code>, endpoint
      <code>{defs?.base_url || "openrouter"}</code>.</p>
  {:else}
    <p class="muted">Stored in your <code>{"<you>/ontorag-index"}</code> repo as
      <code>settings.json</code>; the key is encrypted before it is committed.</p>
    <label>Model</label>
    <input bind:value={dform.model} placeholder="~deepseek/deepseek-v4-flash-latest" />
    <label>LLM endpoint — OpenAI-compatible base URL</label>
    <input bind:value={dform.base_url} placeholder="https://openrouter.ai/api/v1 (default)" />
    <label>Default API key {defs?.key_set ? "(one is stored — type to replace)" : ""}</label>
    <input type="password" bind:value={dform.key} placeholder="sk-…" />
    {#if dErr}<p class="err">{dErr}</p>{/if}
    <p class="drow">
      <button class="primary" on:click={saveDefaults} disabled={dBusy}>
        {dBusy ? "Saving…" : "Save defaults"}</button>
      {#if defs?.key_set}<button class="ghost" on:click={clearKey} disabled={dBusy}>Remove key</button>{/if}
      {#if dOk}<span class="muted">Saved ✓</span>{/if}
    </p>
  {/if}
</div>

<div class="card">
  <div class="sheet-hd"><span class="no">§</span><span>new dataset</span></div>
  <label>Title</label>
  <input bind:value={form.title} on:blur={slugify} placeholder="My Corpus" />
  <label>Slug</label>
  <input bind:value={form.slug} placeholder="my-corpus" />
  <label>API key (BYOK — stored encrypted){defs?.key_set ? " — blank uses your default" : ""}</label>
  <input type="password" bind:value={form.openrouter_key}
    placeholder={defs?.key_set ? "leave blank to use your default key" : "sk-..."} />
  <label>LLM endpoint — OpenAI-compatible base URL (optional)</label>
  <input bind:value={form.openrouter_base_url}
    placeholder="https://openrouter.ai/api/v1 (default) · or your own OpenAI-compatible server" />
  <label>Model (optional)</label>
  <input bind:value={form.openrouter_model} placeholder="~deepseek/deepseek-v4-flash-latest" />
  <label>Baseline ontologies (optional — add more, incl. your own, later)</label>
  <div class="chks">
    {#each common as c}
      <label class="chk" title={c.description}><input type="checkbox" bind:checked={selected[c.slug]} /> {c.label}</label>
    {/each}
  </div>
  <label>Concurrency</label>
  <input type="number" min="1" bind:value={form.concurrency} />
  <p>
    <button class="primary" on:click={create}
      disabled={creating || !form.title || !form.slug || !(form.openrouter_key || defs?.key_set)}>
      {creating ? "Creating…" : "Create dataset"}
    </button>
  </p>
  <p class="muted">Creates a private GitHub repo in your account, stores your key as an
    Actions secret, and registers it in your personal index.</p>
</div>

<Catalog canFork={true} />

<style>
  .dslist { display: flex; flex-direction: column; }
  .row { display: flex; align-items: center; gap: 0.6rem; padding: 0.6rem 0.2rem; border-top: 1px solid var(--line); color: var(--ink); }
  .row:hover { text-decoration: none; background: var(--surface-2); }
  .row .sp { flex: 1; }
  .row .ttl { font-weight: 600; }
  .row .st { text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .row .go { font-family: var(--font-mono); color: var(--accent-ink); }
  .chks { display: flex; flex-wrap: wrap; gap: 0.35rem 0.9rem; margin: 0.2rem 0 0.3rem; }
  .chk { display: inline-flex; align-items: center; gap: 0.3rem; font-family: var(--font-mono); font-size: 0.78rem; text-transform: none; letter-spacing: 0; color: var(--ink); width: auto; margin: 0; }
  .chk input { width: auto; }
  .togg { background: none; border: 0; padding: 0 0 0 0.5rem; color: var(--muted); cursor: pointer; font-size: 0.8rem; }
  .togg:hover { color: var(--ink); background: none; }
  .drow { display: flex; align-items: center; gap: 0.6rem; }
</style>
