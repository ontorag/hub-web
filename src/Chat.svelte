<script>
  import Citations from "./Citations.svelte";
  import { api } from "./lib/api.js";

  export let slug;
  let q = "", msgs = [], busy = false, err = "";

  // One-shot endpoint overrides — applied to this chat only, never persisted.
  // Use them to try a different model or a local server without touching config.
  let showOv = false;
  let ov = { model: "", base_url: "", key: "" };
  $: ovActive = !!(ov.model || ov.base_url || ov.key);
  function clearOv() { ov = { model: "", base_url: "", key: "" }; }

  async function send() {
    if (!q.trim()) return;
    const question = q; q = ""; err = "";
    msgs = [...msgs, { role: "user", text: question }];
    busy = true;
    try {
      const r = await api.chat(slug, question, ov);
      msgs = [...msgs, { role: "bot", text: r.answer, citations: r.citations || [],
                         sparql: r.sparql, via: ovActive ? (ov.model || "override") : "" }];
    } catch (e) { err = e.message; } finally { busy = false; }
  }
  function onKey(e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }
</script>

<div class="chat">
  {#if !msgs.length}
    <p class="coord empty">ask about the entities and relationships in your graph — answers come with source citations.</p>
  {/if}
  {#each msgs as m}
    <div class="entry {m.role}">
      <div class="tag">{m.role === "user" ? "usr»" : "hub»"}</div>
      <div class="body">
        <p class="txt">{m.text}</p>
        {#if m.via}<div class="via">via {m.via}</div>{/if}
        <Citations citations={m.citations} />
        {#if m.sparql}<details class="sparql"><summary>sparql</summary><pre>{m.sparql}</pre></details>{/if}
      </div>
    </div>
  {/each}
  {#if busy}<div class="entry bot"><div class="tag">hub»</div><div class="body"><p class="txt muted">querying the graph…</p></div></div>{/if}
</div>
{#if err}<p class="err">{err}</p>{/if}
<div class="composer">
  <textarea rows="2" bind:value={q} on:keydown={onKey} placeholder="ask the knowledge graph…"></textarea>
  <button class="primary" on:click={send} disabled={busy || !q.trim()}>▸ send</button>
</div>

<div class="ov">
  <button class="togg" on:click={() => (showOv = !showOv)}>
    {showOv ? "▾" : "▸"} test endpoint{#if ovActive}<span class="dot"></span>{/if}
  </button>
  {#if ovActive && !showOv}<span class="muted sm">overriding: {[ov.model && "model", ov.base_url && "endpoint", ov.key && "key"].filter(Boolean).join(" · ")}</span>{/if}
  {#if showOv}
    <div class="ovbox">
      <p class="muted sm">Applies to this chat only — nothing is saved. Blank fields fall
        back to the dataset's config, then your defaults.</p>
      <label>Model</label>
      <input bind:value={ov.model} placeholder="inherit" />
      <label>Endpoint base URL</label>
      <input bind:value={ov.base_url} placeholder="inherit" />
      <label>API key</label>
      <input type="password" bind:value={ov.key} placeholder="inherit" />
      <div class="ovrow">
        <button class="ghost" on:click={clearOv} disabled={!ovActive}>Reset to inherited</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .chat { display: flex; flex-direction: column; max-height: 400px; overflow: auto; margin-bottom: var(--sp-4); }
  .empty { display: block; padding: var(--sp-4) 0; }
  .entry { display: grid; grid-template-columns: 46px 1fr; gap: var(--sp-3); padding: var(--sp-3) 0; border-top: 1px solid var(--line); }
  .entry:first-child { border-top: 0; }
  .tag { font-family: var(--font-mono); font-size: 0.68rem; color: var(--faint); padding-top: 2px; }
  .entry.bot .tag { color: var(--accent-ink); }
  .txt { margin: 0; white-space: pre-wrap; }
  .sparql { margin-top: var(--sp-2); }
  .sparql summary { font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); cursor: pointer; }
  .sparql pre { font-family: var(--font-mono); font-size: 0.76rem; background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--r); padding: 0.6rem; overflow: auto; margin-top: 0.4rem; }
  .composer { display: flex; gap: var(--sp-2); align-items: flex-end; }

  .via { font-family: var(--font-mono); font-size: 0.66rem; color: var(--faint); margin-top: 0.25rem; }
  .ov { margin-top: var(--sp-3); padding-top: var(--sp-2); border-top: 1px solid var(--line); }
  .sm { font-size: 0.76rem; }
  .togg { background: none; border: 0; padding: 0; color: var(--muted); font-family: var(--font-mono);
    font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; }
  .togg:hover { color: var(--ink); background: none; }
  .togg .dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%;
    background: var(--accent); margin-left: 0.4rem; vertical-align: middle; }
  .ovbox { max-width: 420px; margin-top: var(--sp-2); }
  .ovrow { margin-top: var(--sp-3); }
</style>
