<script>
  import { onMount } from "svelte";
  import { api } from "./lib/api.js";

  export let slug;
  export let onSaved = () => {};

  let card = null, approved = false, err = "", busy = false, dirty = false, ok = false, mode = "graph";

  // lazy-load the graph editor (Cytoscape) as a separate chunk — only when needed
  let GraphEditor = null;
  $: if (mode === "graph" && !GraphEditor) import("./GraphEditor.svelte").then((m) => (GraphEditor = m.default));

  async function load() {
    try { const s = await api.schema(slug); card = s.schema_card; approved = s.approved; dirty = false; }
    catch (e) { err = e.message; }
  }
  onMount(load);

  async function save() {
    busy = true; err = ""; ok = false;
    try { await api.approve(slug, card); dirty = false; ok = true; approved = true; onSaved(); }
    catch (e) { err = e.message; } finally { busy = false; }
  }

  const touch = () => (dirty = true);

  // group properties under their domain class
  function propsOf(name) {
    const obj = (card.object_properties || []).filter((p) => p.domain === name).map((p) => ({ ...p, kind: "obj" }));
    const dt = (card.datatype_properties || []).filter((p) => p.domain === name).map((p) => ({ ...p, kind: "dt" }));
    return [...obj, ...dt];
  }
  $: classNames = new Set((card?.classes || []).map((c) => c.name));
  $: unassigned = !card ? [] : [
    ...(card.object_properties || []).filter((p) => !classNames.has(p.domain)).map((p) => ({ ...p, kind: "obj" })),
    ...(card.datatype_properties || []).filter((p) => !classNames.has(p.domain)).map((p) => ({ ...p, kind: "dt" })),
  ];

  function dropClass(i) { card.classes.splice(i, 1); card = card; touch(); }
  function clearSub(c) { delete c.subclass_of; card = card; touch(); }
  function dropProp(p) {
    const key = p.kind === "obj" ? "object_properties" : "datatype_properties";
    card[key] = (card[key] || []).filter((x) => !(x.name === p.name && x.domain === p.domain && x.range === p.range));
    card = card; touch();
  }
</script>

{#if err}<p class="err">{err}</p>{/if}
{#if card}
  <div class="hd">
    <div class="tabs">
      <button class:active={mode === "graph"} on:click={() => (mode = "graph")}>Graph</button>
      <button class:active={mode === "table"} on:click={() => (mode = "table")}>Table</button>
    </div>
    <span class="sp"></span>
    {#if ok}<span class="muted">Saved ✓</span>{/if}
    <button class="primary" on:click={save} disabled={busy || !dirty}>
      {busy ? "Saving…" : approved ? "Save changes" : "Approve model"}</button>
  </div>

  {#if mode === "graph"}
    {#if GraphEditor}<svelte:component this={GraphEditor} {card} on:change={touch} />
    {:else}<p class="muted">Loading graph…</p>{/if}
  {:else}
    <div class="tbl">
      {#each card.classes || [] as c, ci}
        <div class="cls">
          <div class="cls-hd">
            <span class="nm">{c.name}</span>
            {#if c.subclass_of}
              <span class="sub">⊂ {c.subclass_of}<button class="mini" title="remove subClassOf" on:click={() => clearSub(c)}>✕</button></span>
            {/if}
            <span class="sp"></span>
            <button class="mini del" title="delete class" on:click={() => dropClass(ci)}>✕</button>
          </div>
          <input class="desc" bind:value={c.description} on:input={touch} placeholder="description" />
          {#each propsOf(c.name) as p}
            <div class="prop">
              <span class="rel {p.kind}">{p.kind === "obj" ? "→" : "·"}</span>
              <span class="pn">{p.name}</span>
              <span class="pr">{p.range}</span>
              <span class="sp"></span>
              <button class="mini" title="delete property" on:click={() => dropProp(p)}>✕</button>
            </div>
          {/each}
        </div>
      {/each}
      {#if unassigned.length}
        <div class="cls misc">
          <div class="cls-hd"><span class="nm muted">Unassigned properties</span></div>
          {#each unassigned as p}
            <div class="prop">
              <span class="rel {p.kind}">{p.kind === "obj" ? "→" : "·"}</span>
              <span class="pn">{p.name}</span>
              <span class="pr muted">{p.domain} → {p.range}</span>
              <span class="sp"></span>
              <button class="mini" on:click={() => dropProp(p)}>✕</button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
{:else}
  <p class="muted">Loading schema…</p>
{/if}

<style>
  .hd { display: flex; align-items: center; gap: 0.5rem; margin-bottom: var(--sp-4); }
  .hd .sp { flex: 1; }
  .tabs { display: inline-flex; border: 1px solid var(--line-strong); border-radius: var(--r-sm); overflow: hidden; }
  .tabs button { border: 0; border-radius: 0; background: transparent; color: var(--muted); padding: 0.32rem 0.85rem; }
  .tabs button + button { border-left: 1px solid var(--line); }
  .tabs button.active { background: var(--accent); color: var(--on-accent); }

  .tbl { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--sp-3); }
  .cls { border: 1px solid var(--line); border-radius: var(--r); padding: 0.7rem 0.8rem; background: var(--surface); }
  .cls.misc { grid-column: 1 / -1; background: var(--surface-2); }
  .cls-hd { display: flex; align-items: center; gap: 0.4rem; }
  .cls-hd .nm { font-family: var(--font-mono); font-size: 0.9rem; font-weight: 500; }
  .cls-hd .sp { flex: 1; }
  .sub { display: inline-flex; align-items: center; gap: 0.2rem; font-family: var(--font-mono); font-size: 0.68rem; color: var(--accent-ink); }
  .desc { font-size: 0.84rem; margin: 0.4rem 0 0.5rem; padding: 0.3rem 0.4rem; }
  .prop { display: flex; align-items: center; gap: 0.4rem; padding: 0.2rem 0; font-size: 0.82rem; }
  .prop + .prop { border-top: 1px solid var(--line); }
  .rel { font-family: var(--font-mono); width: 0.9rem; text-align: center; }
  .rel.obj { color: var(--accent-ink); }
  .rel.dt { color: var(--faint); }
  .pn { font-family: var(--font-mono); font-size: 0.78rem; color: var(--ink); }
  .pr { font-family: var(--font-mono); font-size: 0.76rem; color: var(--muted); }
  .mini { border: 0; background: transparent; color: var(--faint); cursor: pointer; padding: 0 0.15rem; font-size: 0.78rem; line-height: 1; }
  .mini:hover { color: var(--ink); background: transparent; }
  .mini.del:hover { color: light-dark(oklch(0.52 0.19 27), oklch(0.72 0.17 27)); }
</style>
