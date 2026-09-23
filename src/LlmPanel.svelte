<script>
  // Where natural-language questions go: the user's own OpenRouter account (PKCE
  // sign-in), a pasted key, or a custom OpenAI-compatible endpoint (e.g. ollama).
  import { createEventDispatcher } from "svelte";
  import { DEFAULT_MODEL, getLlm, llmReady, setLlm, signOutLlm, startOpenRouterSignIn } from "./lib/llm.js";

  const dispatch = createEventDispatcher();
  let cfg = getLlm();
  let editing = !llmReady(cfg);
  let custom = !!cfg.baseUrl;
  let err = "";

  function save() {
    cfg = { ...cfg, model: cfg.model || DEFAULT_MODEL, baseUrl: custom ? cfg.baseUrl : "",
            via: custom ? "custom" : cfg.key ? (cfg.via === "openrouter" ? "openrouter" : "key") : "" };
    setLlm(cfg); editing = !llmReady(cfg); dispatch("change", cfg);
  }
  function signOut() { signOutLlm(); cfg = getLlm(); editing = true; dispatch("change", cfg); }
  async function signIn() {
    err = "";
    try { await startOpenRouterSignIn(); } catch (e) { err = e.message; }
  }
  $: status = cfg.via === "openrouter" ? "Signed in with OpenRouter"
    : cfg.baseUrl ? `Custom endpoint · ${cfg.baseUrl}` : cfg.key ? "Using your key" : "";
</script>

<div class="llm">
  {#if !editing && llmReady(cfg)}
    <p class="muted status">
      <span class="dot"></span>{status} · model <code>{cfg.model}</code> ·
      <button class="linkish" on:click={() => (editing = true)}>change</button> ·
      <button class="linkish" on:click={signOut}>sign out</button>
    </p>
  {:else}
    <div class="choices">
      <button class="primary" on:click={signIn}>Sign in with OpenRouter</button>
      <span class="muted or">or</span>
      <label class="inline"><input type="checkbox" bind:checked={custom} /> custom endpoint</label>
    </div>
    <div class="fields">
      {#if custom}
        <input bind:value={cfg.baseUrl} placeholder="OpenAI-compatible base URL, e.g. http://localhost:11434/v1" />
      {/if}
      <input type="password" bind:value={cfg.key}
        placeholder={custom ? "API key (optional for ollama)" : "or paste an OpenRouter key"} />
      <input bind:value={cfg.model} placeholder={DEFAULT_MODEL} aria-label="model" />
      <button class="ghost sm" on:click={save} disabled={!(cfg.key || (custom && cfg.baseUrl))}>Use</button>
    </div>
    {#if err}<p class="err">{err}</p>{/if}
  {/if}
  <p class="muted note">Questions go from this browser straight to your model provider. Your key
    stays in this browser (local storage) — it is never sent to OntoRAG.</p>
</div>

<style>
  .llm { margin-top: var(--sp-3); }
  .choices { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; }
  .or { font-size: 0.8rem; }
  .inline { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.82rem; color: var(--muted); margin: 0; }
  .inline input { width: auto; }
  .fields { display: grid; grid-template-columns: 1fr; gap: 0.5rem; margin-top: var(--sp-2); }
  @media (min-width: 640px) { .fields { grid-template-columns: 2fr 1.3fr auto; } .fields input:first-child:nth-last-child(4) { grid-column: 1 / -1; } }
  .note { font-size: 0.78rem; margin-top: var(--sp-2); }
  .status { display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem; font-size: 0.82rem; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); display: inline-block; }
  code { font-family: var(--font-mono); font-size: 0.76rem; }
  .linkish { background: none; border: 0; padding: 0; color: var(--accent-ink); font: inherit; font-weight: 600; cursor: pointer; }
  .linkish:hover { text-decoration: underline; }
  button.sm { padding: 0.3rem 0.6rem; font-size: 0.78rem; }
</style>
