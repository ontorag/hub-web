<script>
  import { onMount, onDestroy, createEventDispatcher } from "svelte";
  import cytoscape from "cytoscape";
  import edgehandles from "cytoscape-edgehandles";
  import fcose from "cytoscape-fcose";
  import dagre from "cytoscape-dagre";
  cytoscape.use(edgehandles);
  cytoscape.use(fcose);
  cytoscape.use(dagre);

  export let card;
  const dispatch = createEventDispatcher();
  let container, cy, eh, mq;
  let selected = null, drawMode = false, showAll = false;
  let nameField = "", descField = "";

  const isLocal = (c) => { const o = (c.origin || "").toLowerCase(); return o === "" || o === "induced" || !!c.subclass_of; };
  const classByName = (n) => (card.classes || []).find((c) => c.name === n);
  const isLocalName = (n) => { const c = classByName(n); return !!c && isLocal(c); };

  function elements() {
    const classes = card.classes || [];
    const byName = new Map(classes.map((c) => [c.name, c]));
    const localSet = new Set(classes.filter(isLocal).map((c) => c.name));
    const ops = (card.object_properties || []).filter((p) => p.domain && p.range && (
      showAll || ["", "induced"].includes((p.origin || "").toLowerCase()) || localSet.has(p.domain) || localSet.has(p.range)));
    const shown = new Set(showAll ? classes.map((c) => c.name) : [...localSet]);
    if (!showAll) {
      for (const c of classes) if (localSet.has(c.name) && c.subclass_of) shown.add(c.subclass_of);
      for (const p of ops) { shown.add(p.domain); shown.add(p.range); }
    }
    const els = [];
    for (const name of shown) {
      const c = byName.get(name);
      els.push({ data: { id: name, label: name, kind: c && isLocal(c) ? "local" : "baseline", description: c?.description || "" } });
    }
    for (const c of classes)
      if (shown.has(c.name) && c.subclass_of && shown.has(c.subclass_of))
        els.push({ data: { id: "sc::" + c.name, source: c.name, target: c.subclass_of, label: "⊂", kind: "subclass" } });
    for (const p of ops)
      if (shown.has(p.domain) && shown.has(p.range))
        els.push({ data: { id: "op::" + p.name, source: p.domain, target: p.range, label: p.name, kind: "objprop" } });
    return els;
  }

  // resolve a CSS token to a concrete color (custom props with light-dark() don't
  // resolve via getPropertyValue, so read a real computed `color` off a probe)
  function v(name) {
    const p = document.createElement("span");
    p.style.cssText = "display:none;color:var(" + name + ")";
    document.body.appendChild(p);
    const c = getComputedStyle(p).color;
    p.remove();
    return c;
  }
  function graphStyle() {
    const ink = v("--ink"), surface = v("--surface"), paper = v("--paper"),
      accent = v("--accent"), accentInk = v("--accent-ink"), line = v("--line-strong"),
      muted = v("--muted"), onAccent = v("--on-accent"), faint = v("--faint");
    return [
      { selector: "node", style: { label: "data(label)", "font-family": "Martian Mono, monospace", "font-size": 9,
          "text-valign": "center", "text-halign": "center", width: "label", height: "label", padding: "10px",
          shape: "rectangle", "text-wrap": "wrap", "text-max-width": "150px", "border-width": 1, color: ink,
          "background-color": surface, "border-color": line } },
      { selector: "node[kind='local']", style: { "background-color": paper, "border-color": accentInk, "border-width": 1.5, color: ink } },
      { selector: "node[kind='baseline']", style: { "background-color": surface, "border-style": "dashed", "border-color": muted, color: muted } },
      { selector: "edge", style: { "curve-style": "bezier", "target-arrow-shape": "triangle",
          "arrow-scale": 0.85, width: 1.1, "line-color": line, "target-arrow-color": line,
          label: "data(label)", "font-family": "Martian Mono, monospace", "font-size": 8, color: muted,
          "text-background-color": paper, "text-background-opacity": 1, "text-background-padding": "2px" } },
      { selector: "edge[kind='subclass']", style: { "line-style": "dashed", "line-color": muted, "target-arrow-color": muted, "target-arrow-shape": "triangle-tee", color: faint } },
      { selector: "edge[kind='objprop']", style: { "line-color": accentInk, "target-arrow-color": accentInk } },
      { selector: "node:selected", style: { "border-color": accent, "border-width": 2, "background-color": paper } },
      { selector: "edge:selected", style: { "line-color": accent, "target-arrow-color": accent, width: 2 } },
      { selector: ".eh-handle", style: { "background-color": accent, "border-color": accent, width: 10, height: 10, shape: "rectangle" } },
      { selector: ".eh-ghost-edge, .eh-preview", style: { "line-color": accent, "target-arrow-color": accent } },
    ];
  }

  let layoutMode = "fcose";
  function runLayout(mode = layoutMode) {
    layoutMode = mode;
    const opts = mode === "dagre"
      ? { name: "dagre", rankDir: "BT", nodeSep: 34, rankSep: 78, edgeSep: 14, animate: false, fit: true, padding: 34 }
      : { name: "fcose", quality: "proof", animate: false, randomize: true, packComponents: true,
          nodeSeparation: 135, idealEdgeLength: 125, nodeRepulsion: 6000, gravity: 0.28,
          gravityRange: 3.2, numIter: 2500, fit: true, padding: 36 };
    cy.layout(opts).run();
  }
  const markDirty = () => dispatch("change");

  function rebuild() {
    const pos = {}; cy.nodes().forEach((n) => (pos[n.id()] = n.position()));
    cy.elements().remove(); cy.add(elements());
    let missing = false;
    cy.nodes().forEach((n) => { pos[n.id()] ? n.position(pos[n.id()]) : (missing = true); });
    if (missing) runLayout();
    selected = null;
  }

  onMount(() => {
    cy = cytoscape({ container, elements: elements(), style: graphStyle(), wheelSensitivity: 0.2 });
    runLayout();
    eh = cy.edgehandles({ snap: true, canConnect: (s, t) => !s.same(t) });
    mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", () => cy.style(graphStyle()));
    cy.on("tap", (e) => { if (e.target === cy) selected = null; });
    cy.on("select", "node", (e) => (selected = { kind: "node", data: e.target.data() }));
    cy.on("select", "edge", (e) => (selected = { kind: "edge", data: e.target.data() }));
    cy.on("unselect", () => (selected = null));
    cy.on("ehcomplete", (evt, s, t, added) => {
      added.remove();
      const name = (window.prompt(`object property  ${s.id()} → ${t.id()}\nname:`, "relatesTo") || "").trim();
      if (!name) return;
      (card.object_properties = card.object_properties || []).push({ name, domain: s.id(), range: t.id(), origin: "induced" });
      cy.add({ data: { id: "op::" + name, source: s.id(), target: t.id(), label: name, kind: "objprop" } });
      markDirty();
    });
  });
  onDestroy(() => cy && cy.destroy());

  function toggleDraw() { drawMode = !drawMode; drawMode ? eh.enableDrawMode() : eh.disableDrawMode(); }
  function toggleShowAll() { showAll = !showAll; rebuild(); runLayout(); }

  function addClass() {
    const name = (window.prompt("new class name:", "") || "").trim();
    if (!name) return;
    if (classByName(name)) return alert("that class already exists");
    (card.classes = card.classes || []).push({ name, description: "", origin: "induced" });
    cy.add({ data: { id: name, label: name, kind: "local", description: "" } });
    cy.getElementById(name).position(cy.extent().x1 + 70, cy.extent().y1 + 70);
    markDirty();
  }

  function deleteSelected() {
    if (!selected) return;
    if (selected.kind === "node") {
      const name = selected.data.id;
      if (!isLocalName(name)) return alert("baseline classes can't be deleted");
      card.classes = card.classes.filter((c) => c.name !== name);
      card.object_properties = (card.object_properties || []).filter((p) => p.domain !== name && p.range !== name);
      cy.getElementById(name).remove();
    } else {
      const d = selected.data;
      if (d.kind === "objprop") card.object_properties = (card.object_properties || []).filter((p) => p.name !== d.label);
      else if (d.kind === "subclass") { const c = classByName(d.source); if (c) delete c.subclass_of; }
      cy.getElementById(d.id).remove();
    }
    selected = null; markDirty();
  }

  $: if (selected?.kind === "node") { nameField = selected.data.id; descField = selected.data.description || ""; }

  function saveName() {
    const c = classByName(selected.data.id); const nn = nameField.trim();
    if (!c || !nn || nn === c.name) return;
    if (classByName(nn)) return alert("name already exists");
    const old = c.name; c.name = nn;
    for (const p of card.object_properties || []) { if (p.domain === old) p.domain = nn; if (p.range === old) p.range = nn; }
    for (const x of card.classes || []) if (x.subclass_of === old) x.subclass_of = nn;
    rebuild(); markDirty();
  }
  function saveDesc() { const c = classByName(selected.data.id); if (c) { c.description = descField; cy.getElementById(c.name).data("description", descField); markDirty(); } }
</script>

<div class="ge">
  <div class="toolbar">
    <button class="ghost" on:click={addClass}>+ class</button>
    <button class="ghost {drawMode ? 'on' : ''}" on:click={toggleDraw}>{drawMode ? "drawing… drag node→node" : "＋ draw property"}</button>
    <button class="ghost" on:click={deleteSelected} disabled={!selected}>delete</button>
    <span class="div"></span>
    <button class="ghost {layoutMode === 'fcose' ? 'on' : ''}" on:click={() => runLayout('fcose')}>arrange</button>
    <button class="ghost {layoutMode === 'dagre' ? 'on' : ''}" on:click={() => runLayout('dagre')}>hierarchy</button>
    <label class="showall"><input type="checkbox" checked={showAll} on:change={toggleShowAll} /> baseline vocab</label>
  </div>
  <div class="stage">
    <div class="canvas" bind:this={container}></div>
    {#if selected}
      <div class="inspector">
        {#if selected.kind === "node"}
          {#if isLocalName(selected.data.id)}
            <label>class</label>
            <input class="mono" bind:value={nameField} on:change={saveName} />
            <label>description</label>
            <textarea rows="5" bind:value={descField} on:input={saveDesc}></textarea>
            <button class="ghost" on:click={deleteSelected}>delete class</button>
          {:else}
            <p class="coord">baseline anchor</p>
            <p class="mono nm">{selected.data.id}</p>
            <p class="muted">From a registered ontology — read-only.</p>
          {/if}
        {:else}
          <p class="coord">{selected.data.kind}</p>
          <p class="mono nm">{selected.data.label}</p>
          <p class="coord">{selected.data.source} → {selected.data.target}</p>
          <button class="ghost" on:click={deleteSelected}>delete edge</button>
        {/if}
      </div>
    {/if}
  </div>
  <p class="coord legend">▪ your concepts &nbsp; ▫ baseline &nbsp; → object property &nbsp; ⊰ subClassOf &nbsp;·&nbsp; draw: drag one class onto another</p>
</div>

<style>
  .toolbar { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; margin-bottom: 0.5rem; }
  .toolbar .on { background: var(--accent-tint); color: var(--ink); border-color: var(--accent-ink); }
  .toolbar .div { width: 1px; height: 18px; background: var(--line); margin: 0 0.2rem; }
  .showall { display: inline-flex; align-items: center; gap: 0.3rem; width: auto; margin: 0 0 0 0.3rem; color: var(--muted); text-transform: uppercase; }
  .showall input { width: auto; }
  .stage { position: relative; }
  .canvas {
    width: 100%; height: 480px; border: 1px solid var(--line); border-radius: var(--r);
    background-color: var(--paper);
    background-image: linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px);
    background-size: 20px 20px;
  }
  .inspector {
    position: absolute; top: 10px; right: 10px; z-index: 5;
    width: 232px; max-width: calc(100% - 20px);
    border: 1px solid var(--line-strong); border-radius: var(--r); padding: var(--sp-4);
    background: var(--surface);
    box-shadow: 0 6px 20px light-dark(oklch(0.2 0.02 258 / 0.14), oklch(0 0 0 / 0.45));
  }
  .inspector .nm { font-size: 0.9rem; color: var(--ink); margin: 0.1rem 0 0.5rem; word-break: break-word; }
  .legend { display: block; margin-top: 0.5rem; }
</style>
