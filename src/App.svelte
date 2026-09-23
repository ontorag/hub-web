<script>
  import { onMount } from "svelte";
  import { api, getToken, setToken, logout } from "./lib/api.js";
  import { config, loadConfig } from "./lib/config.js";
  import { completeOpenRouterSignIn } from "./lib/llm.js";
  import Datasets from "./Datasets.svelte";
  import Workspace from "./Workspace.svelte";
  import Catalog from "./Catalog.svelte";
  import Explorer from "./Explorer.svelte";

  let authed = false;
  let user = null;
  let route = "";
  let ready = false;
  let backend = false;          // signed-in features available (config.json apiBase reachable)
  let notice = "";

  function parseHash() {
    const h = location.hash.replace(/^#/, "");
    if (h.startsWith("token=")) { setToken(h.slice(6)); location.hash = ""; return ""; }
    return h.startsWith("/") ? h.slice(1) : h;
  }
  async function boot() {
    route = parseHash();
    try { if (await completeOpenRouterSignIn()) notice = "Signed in with OpenRouter — you can ask questions now."; }
    catch (e) { notice = e.message; }
    route = parseHash();
    await loadConfig();
    backend = config.backend;
    if (backend && getToken()) { try { user = (await api.me()).user; authed = true; } catch { authed = false; } }
    ready = true;
  }
  onMount(() => { boot(); window.addEventListener("hashchange", () => (route = parseHash())); });
  $: slug = route.startsWith("ds/") ? route.slice(3) : null;
  $: exploreRepo = route.startsWith("explore/") ? route.slice(8) : null;
</script>

<header class="appbar">
  <a href="#/" class="brand"><span class="mark">◈</span> OntoRAG <span class="thin">Hub</span></a>
  <span class="sp"></span>
  {#if authed}
    <span class="usr">{user?.login}</span>
    <button class="ghost" on:click={logout}>Sign out</button>
  {/if}
</header>

{#if notice}<p class="notice" role="status">{notice} <button class="ghost sm" on:click={() => (notice = "")}>dismiss</button></p>{/if}

{#if !ready}
  <main class="wrap"><p class="coord">Loading…</p></main>
{:else if exploreRepo}
  <Explorer repo={exploreRepo} />
{:else if !authed}
  <main class="wrap fade-in">
    <section class="landing">
      <p class="kicker">Ontology-first RAG</p>
      <h1>Build a governed knowledge graph from your corpus.</h1>
      <p class="lede">Upload documents, compose baseline ontologies, and let the system
        <em>propose</em> a semantic model. You validate it, extract entities and properties
        against the approved model, then query the result as an API and a citing chatbot —
        your data living in your own GitHub repos.</p>
      {#if backend}
        <p><a class="btn lg" href={api.loginUrl}>Sign in with GitHub</a></p>
      {:else}
        <p class="muted">Explore and chat with public datasets below, right in your browser.
          Building your own datasets needs the Hub service, which is not connected here —
          see <a href="https://ontorag.org/tools/#hub">ontorag.org</a>.</p>
      {/if}
      <dl class="facts">
        <div><dt>Runner</dt><dd>Your GitHub Actions · BYO key</dd></div>
        <div><dt>Storage</dt><dd>Your repos · git = audit trail</dd></div>
        <div><dt>Serve</dt><dd>SPARQL · MCP · citing chat</dd></div>
      </dl>
    </section>
    <section class="catalog-wrap">
      <Catalog canFork={false} />
    </section>
  </main>
{:else if slug}
  <Workspace {slug} />
{:else}
  <main class="wrap fade-in"><Datasets /></main>
{/if}

<style>
  .appbar {
    display: flex; align-items: center; gap: 0.7rem;
    padding: 0.6rem clamp(1rem, 3vw, 2rem);
    background: var(--surface); border-bottom: 1px solid var(--line);
    position: sticky; top: 0; z-index: 20;
  }
  .brand { color: var(--ink); font-weight: 700; font-size: 0.98rem; letter-spacing: -0.01em; }
  .brand:hover { text-decoration: none; }
  .brand .mark { color: var(--accent-ink); }
  .brand .thin { color: var(--muted); font-weight: 500; }
  .appbar .sp { flex: 1; }
  .usr { font-family: var(--font-mono); font-size: 0.78rem; color: var(--muted); }

  .wrap { max-width: 1040px; margin: clamp(1.5rem, 4vw, 3.5rem) auto; padding: 0 clamp(1rem, 3vw, 2rem); }

  .landing { max-width: 720px; }
  .kicker { font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent-ink); margin: 0 0 var(--sp-4); }
  .landing h1 { margin-bottom: var(--sp-6); }
  .lede { font-size: 1.1rem; line-height: 1.6; max-width: 62ch; margin-bottom: var(--sp-6); }
  .lede em { font-style: normal; color: var(--accent-ink); font-weight: 600; }
  .btn.lg { font-size: 0.95rem; padding: 0.65rem 1.15rem; }
  .facts { margin-top: var(--sp-12); display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--sp-4); }
  .facts > div { border: 1px solid var(--line); border-radius: var(--r); padding: var(--sp-4); }
  .facts dt { font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  .facts dd { margin: 0.3rem 0 0; font-family: var(--font-mono); font-size: 0.8rem; color: var(--ink); }

  .catalog-wrap { margin-top: var(--sp-16); }
  .notice { margin: var(--sp-3) auto 0; max-width: 1040px; padding: 0.5rem clamp(1rem, 3vw, 2rem);
    font-size: 0.86rem; color: var(--ink); display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
  button.sm { padding: 0.25rem 0.55rem; font-size: 0.75rem; }
</style>
