# OntoRAG Hub — web app

The web front end of the OntoRAG Hub: browse, explore and chat with
[OntoRAG](https://ontorag.org) datasets. It is a static site.

**Live:** https://hub.ontorag.org/

## Two modes

**Public mode** needs no backend and no account. Everything runs in your browser:

- **Catalog.** Datasets listed in [`public/catalog.json`](public/catalog.json). Their
  `manifest.json` is read from GitHub and marked *explorable* (it has a graph) or
  *servable* (it follows the [dataset format 0.1](https://ontorag.org/vocab/#format), so
  [ontorag-mcp](https://github.com/ontorag/ontorag-mcp) can serve it).
- **Explorer.** The dataset's graph is loaded into [Oxigraph](https://github.com/oxigraph/oxigraph)
  (WebAssembly) and queried locally: classes with counts, a guarded read-only SPARQL console,
  and citations for the rows. Provenance scaffolding (`orp:`, `oa:`, `prov:`) is hidden
  unless you tick *show provenance*.
- **Chat.** A question becomes one read-only SPARQL query, then a grounded answer
  with citations: quote, source, printed page and section, taken from the
  [provenance ontology](https://ontorag.org/provenance/). The model call goes from
  your browser straight to your provider. You can:
  - **Sign in with OpenRouter** (OAuth PKCE; you get a key scoped to your account);
  - paste a key;
  - point at any OpenAI-compatible endpoint, such as a local ollama.

  The key stays in your browser's local storage.

**Signed-in mode** is used when a Hub backend is configured and reachable. You sign
in with GitHub through the backend. You then get your own datasets: upload,
baselines, the governed pipeline in your GitHub Actions, schema review, publishing,
forks, and chat over your *private* datasets using the key stored by the backend.
Chat over public datasets still runs in the browser. The backend is a separate,
private service.

## Configuration

The deployed site reads `config.json` next to `index.html`:

```json
{ "apiBase": "https://your-hub-backend.example.org" }
```

`null` (the default) means public mode. The file is fetched at runtime, so the
backend can move without a rebuild. `VITE_HUB_API` sets a build-time fallback. The
backend must allow this origin in `HUB_CORS_ORIGINS`, and it must send GitHub
sign-in back here (`HUB_FRONTEND_URL=https://hub.ontorag.org`).

## Develop

```sh
npm ci
npm run dev        # http://localhost:5173/
npm test           # vitest: SPARQL guard, prompts, mentions query and chat loop against Oxigraph
npm run build      # → dist/
```

To use a local backend, put `{"apiBase": "http://localhost:8000"}` in
`public/config.json`, and don't commit it.

Pushing to `main` runs the tests, builds, and deploys to GitHub Pages
(`.github/workflows/pages.yml`).

## Keep in step

`src/lib/sparql.js` and `src/lib/chat.js` port the Hub backend's chat loop
(`app/chat.py`, `app/dialect.py`). `mentionsQuery` is a copy of the engine's
`SparqlBackend.mentions` ([ontorag](https://github.com/ontorag/ontorag),
`ontorag/mcp_backend.py`). Change them together.

## Licence

[Apache-2.0](LICENSE).
