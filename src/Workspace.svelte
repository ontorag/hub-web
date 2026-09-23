<script>
  import { onMount, onDestroy } from "svelte";
  import { api } from "./lib/api.js";
  import Icon from "./Icon.svelte";
  import SchemaPanel from "./SchemaPanel.svelte";
  import Baselines from "./Baselines.svelte";
  import Settings from "./Settings.svelte";
  import Chat from "./Chat.svelte";

  export let slug;
  const STAGES = ["created", "corpus", "baselined", "proposed", "validated", "extracted", "published"];
  const idxOf = (s) => STAGES.indexOf(s);

  const NAV = [
    { id: "corpus", label: "Corpus", icon: "file", min: "created", done: (d) => idxOf(d.state) >= idxOf("corpus") },
    { id: "baselines", label: "Baselines", icon: "layers", min: "created", done: (d) => (d.baselines?.length || 0) > 0 },
    { id: "model", label: "Model", icon: "model", min: "proposed", done: (d) => idxOf(d.state) >= idxOf("validated") },
    { id: "extract", label: "Extract", icon: "database", min: "validated", done: (d) => idxOf(d.state) >= idxOf("extracted") },
    { id: "chat", label: "Chat", icon: "chat", min: "extracted", done: () => false },
  ];

  let ds = null, err = "", run = null, busy = false, poll = null, files = [], view = null;

  const defaultView = (s) => idxOf(s) >= idxOf("extracted") ? "chat" : idxOf(s) >= idxOf("proposed") ? "model" : "corpus";

  async function load({ retries = 0 } = {}) {
    for (let i = 0; ; i++) {
      try { ds = await api.dataset(slug); if (view === null) view = defaultView(ds.state); return; }
      catch (e) {
        if (i >= retries) { err = e.message; return; }
        await new Promise((r) => setTimeout(r, 1500));  // fork just queued — give GitHub a moment
      }
    }
  }
  async function refresh() {
    try {
      const s = await api.status(slug); run = s.run;
      if (ds && s.state !== ds.state) {
        const from = ds.state; await load();
        if (from !== "proposed" && idxOf(s.state) >= idxOf("proposed") && view === "corpus") view = "model";
        if (from !== "extracted" && idxOf(s.state) >= idxOf("extracted") && view === "extract") view = "chat";
      }
    } catch {}
  }
  onMount(() => { load({ retries: 4 }); poll = setInterval(refresh, 5000); });
  onDestroy(() => clearInterval(poll));

  $: idx = ds ? idxOf(ds.state) : -1;
  $: forked = !!ds?.forked;   // read-only: authoring lives upstream, we just explore + chat

  async function doUpload() { if (!files.length) return; busy = true; err = ""; try { await api.upload(slug, files); files = []; await load(); } catch (e) { err = e.message; } finally { busy = false; } }
  async function runStage(stage) { busy = true; err = ""; try { await api.run(slug, stage); run = { status: "queued" }; } catch (e) { err = e.message; } finally { busy = false; } }
  async function publish() { busy = true; try { await api.publish(slug); await load(); } catch (e) { err = e.message; } finally { busy = false; } }
  function onFiles(e) { files = Array.from(e.target.files); }
</script>

{#if ds}
  <div class="ws fade-in">
    <aside class="rail">
      <a href="#/" class="back"><Icon name="back" size={14} /> Datasets</a>
      <div class="dsname">{ds.title}</div>
      <a class="repo" href={"https://github.com/" + ds.repo} target="_blank" rel="noreferrer">
        <Icon name="external" size={12} /> {ds.repo}</a>
      {#if forked}
        <div class="forkline">
          <Icon name="fork" size={12} />
          forked{#if ds.source} from <a href={"https://github.com/" + ds.source} target="_blank" rel="noreferrer">{ds.source}</a>{/if}
        </div>
      {/if}
      {#if run}
        <div class="runline">
          <span class="dot {run.conclusion || run.status}"></span>{run.status}{run.conclusion ? " · " + run.conclusion : ""}
          {#if run.html_url}· <a href={run.html_url} target="_blank" rel="noreferrer">log</a>{/if}
        </div>
      {/if}

      <nav>
        {#each NAV as it}
          {@const av = idx >= idxOf(it.min)}
          <button class="navi {view === it.id ? 'active' : ''}" disabled={!av} on:click={() => (view = it.id)}>
            <Icon name={it.icon} size={15} /><span class="lb">{it.label}</span>
            {#if av && it.done(ds)}<span class="mk done"><Icon name="check" size={12} /></span>{/if}
          </button>
        {/each}
        <button class="navi {view === 'settings' ? 'active' : ''}" on:click={() => (view = 'settings')}>
          <Icon name="settings" size={15} /><span class="lb">Settings</span></button>
      </nav>
    </aside>

    <section class="main">
      {#if err}<p class="err">{err}</p>{/if}

      {#if view === "corpus"}
        <div class="pane">
          <div class="hd"><Icon name="file" /><h2>Corpus</h2><span class="sp"></span><span class="coord">{ds.sources?.length || 0} files</span></div>
          {#if ds.sources?.length}
            <div class="chips">{#each ds.sources as s}<span class="chip"><Icon name="file" size={11} /> {s}</span>{/each}</div>
          {:else}<p class="muted">No files yet.</p>{/if}
          <div class="uploader">
            <input type="file" multiple on:change={onFiles} />
            <button class="ghost" on:click={doUpload} disabled={busy || !files.length}>
              <Icon name="upload" size={14} /> {files.length ? `Add ${files.length} file(s)` : "Add files"}</button>
          </div>
          <p class="muted">A corpus can be many documents (PDF · Markdown · EPUB…) — add more at any time.</p>
          {#if forked}
            <p class="muted">This is a forked dataset — its corpus and model are maintained upstream and read-only here.</p>
          {:else if idx < idxOf("proposed")}
            <div class="runbar">
              <button class="primary" on:click={() => runStage("propose")} disabled={busy}><Icon name="run" size={13} /> Propose model</button>
              <span class="muted">Ingest → induce → align → build, in your repo's Actions.</span>
            </div>
          {:else}
            <div class="runbar">
              <span class="muted">Added files? Re-run to include them:</span>
              <button on:click={() => runStage("propose")} disabled={busy}><Icon name="refresh" size={13} /> Re-propose</button>
              <button on:click={() => runStage("extract")} disabled={busy}><Icon name="refresh" size={13} /> Re-extract</button>
            </div>
          {/if}
        </div>

      {:else if view === "baselines"}
        <div class="pane">
          <div class="hd"><Icon name="layers" /><h2>Baselines</h2></div>
          <Baselines {slug} current={ds.baselines} onChanged={load} />
        </div>

      {:else if view === "model"}
        <div class="pane wide">
          <div class="hd"><Icon name="model" /><h2>{ds.state === "proposed" ? "Validate model" : "Model"}</h2></div>
          <SchemaPanel {slug} onSaved={load} />
        </div>

      {:else if view === "extract"}
        <div class="pane">
          <div class="hd"><Icon name="database" /><h2>Extract</h2></div>
          {#if forked}
            <p class="muted">Extracted ✓ upstream — this forked graph is read-only. Head to Chat to query it.</p>
          {:else if idx < idxOf("extracted")}
            <p class="muted">Extract entities and properties against your approved model.</p>
            <div class="runbar"><button class="primary" on:click={() => runStage("extract")} disabled={busy}><Icon name="run" size={13} /> Run extract</button></div>
          {:else}
            <p class="muted">Extracted ✓ — re-run to refresh after corpus or schema changes.</p>
            <div class="runbar"><button on:click={() => runStage("extract")} disabled={busy}><Icon name="refresh" size={13} /> Re-extract</button></div>
          {/if}
        </div>

      {:else if view === "chat"}
        <div class="pane wide">
          <div class="hd"><Icon name="chat" /><h2>Chat</h2><span class="sp"></span>
            {#if idx < idxOf("published") && !forked}<button class="ghost" on:click={publish} disabled={busy}>Publish</button>{/if}</div>
          {#if forked}
            <p class="muted">Forked datasets ship without an LLM key — add your own in
              <button class="linkish" on:click={() => (view = "settings")}>Settings</button> to enable chat.</p>
          {/if}
          <Chat {slug} />
        </div>

      {:else if view === "settings"}
        <div class="pane">
          <div class="hd"><Icon name="settings" /><h2>Settings</h2></div>
          <Settings {slug} {ds} onSaved={load} embedded />
        </div>
      {/if}
    </section>
  </div>
{:else if err}
  <main class="wrap"><p class="err">{err}</p></main>
{:else}
  <main class="wrap"><p class="coord">Loading…</p></main>
{/if}

<style>
  .ws { display: flex; align-items: flex-start; gap: clamp(1.2rem, 3vw, 2.4rem);
    max-width: 1500px; margin: 0 auto; padding: clamp(1rem, 2.5vw, 2rem); }

  .rail { flex: none; width: 236px; position: sticky; top: 68px; }
  .back { display: inline-flex; align-items: center; gap: 0.35rem; color: var(--muted); font-size: 0.84rem; }
  .dsname { font-family: var(--font-display); font-weight: 700; font-size: 1.15rem; margin: 0.7rem 0 0.2rem; line-height: 1.1; }
  .repo { display: inline-flex; align-items: center; gap: 0.3rem; font-family: var(--font-mono); font-size: 0.72rem; color: var(--muted); word-break: break-all; }
  .repo:hover { color: var(--accent-ink); }
  .forkline { display: flex; align-items: center; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.5rem; font-size: 0.74rem; color: var(--muted); }
  .forkline :global(svg) { color: var(--accent-ink); }
  .linkish { background: none; border: 0; padding: 0; color: var(--accent-ink); font: inherit; font-weight: 600; cursor: pointer; }
  .linkish:hover { text-decoration: underline; }
  .runline { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.6rem; font-size: 0.76rem; color: var(--muted); }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--faint); }
  .dot.in_progress, .dot.queued { background: var(--accent); }
  .dot.success { background: light-dark(oklch(0.6 0.16 145), oklch(0.75 0.18 145)); }
  .dot.failure { background: light-dark(oklch(0.55 0.19 27), oklch(0.7 0.17 27)); }

  nav { display: flex; flex-direction: column; gap: 2px; margin-top: var(--sp-6); }
  .navi { width: 100%; justify-content: flex-start; background: transparent; border: 0; border-radius: var(--r-sm);
    padding: 0.5rem 0.6rem; color: var(--muted); font-weight: 500; font-size: 0.9rem; }
  .navi:hover:not(:disabled) { background: var(--surface-2); color: var(--ink); }
  .navi.active { background: var(--accent-tint); color: var(--ink); font-weight: 600; }
  .navi.active :global(svg) { color: var(--accent-ink); }
  .navi:disabled { opacity: 0.4; }
  .navi .lb { flex: 1; text-align: left; }
  .navi .mk.done { color: light-dark(oklch(0.6 0.15 145), oklch(0.75 0.18 145)); }

  .main { flex: 1; min-width: 0; }
  .pane { max-width: 720px; }
  .pane.wide { max-width: none; }
  .hd { display: flex; align-items: center; gap: 0.55rem; margin-bottom: var(--sp-4); }
  .hd :global(svg) { color: var(--accent-ink); }
  .hd h2 { font-size: 1.3rem; }
  .hd .sp { flex: 1; }

  .chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: var(--sp-4); }
  .uploader { display: flex; gap: 0.6rem; align-items: center; }
  .uploader input { flex: 1; }
  .runbar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; margin-top: var(--sp-6);
    padding-top: var(--sp-4); border-top: 1px solid var(--line); }

  @media (max-width: 820px) {
    .ws { flex-direction: column; }
    .rail { position: static; width: 100%; }
    nav { flex-direction: row; flex-wrap: wrap; }
    .navi { width: auto; }
  }
</style>
