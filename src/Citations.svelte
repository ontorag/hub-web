<script>
  // Citation contract: {quote, source, chunk_id, page?, section?}
  export let citations = [];
  const where = (c) => [c.source, c.page ? `p. ${c.page}` : "", c.section].filter(Boolean).join(" · ");
</script>

{#if citations?.length}
  <div class="cites">
    {#each citations as c, i}
      <div class="cite">
        <span class="ref">[{i + 1}]</span>
        <span class="q">{c.quote}</span>
        {#if where(c)}<span class="src">{where(c)}</span>{/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .cites { margin-top: var(--sp-3); display: flex; flex-direction: column; gap: var(--sp-2); }
  .cite { display: grid; grid-template-columns: 24px 1fr; gap: 0.4rem; align-items: start;
    background: var(--accent-tint); border: 1px solid var(--line); border-radius: var(--r);
    padding: 0.4rem 0.55rem; font-size: 0.86rem; }
  .ref { font-family: var(--font-mono); font-size: 0.7rem; color: var(--accent-ink); }
  .q { color: var(--ink); overflow-wrap: anywhere; }
  .src { grid-column: 2; font-family: var(--font-mono); font-size: 0.68rem; color: var(--muted); overflow-wrap: anywhere; }
</style>
