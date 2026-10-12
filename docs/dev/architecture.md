# Architecture and development

How **`dsh-prompt-polish`** is put together, and how to work on it. Behaviour lives in the [README](../README.md); this is the code map.

## Two halves, one package

The package follows the dsh plugin conventions: a Node (host) half exported as `"."`, and a browser half exported as `"./client"` and declared through `dsh.client` in [`package.json`](../../package.json).

- **Host half** — [`src/index.ts`](../../src/index.ts). Its `apply()` registers the prefix route and the slash command, and the settings namespace comes from the `Config` schema the package exports. `inject` names `llm` and `webServer` as required; `sessions`, `settings` and `commands` are optional and reached through `ctx.get`, degrading to `undefined` when absent.
- **Browser half** — [`src/client/index.tsx`](../../src/client/index.tsx). Its `apply()` hard-requires **no** service: `locale`, `configForms` and `slots` are all reached through optional `ctx.inject`, because a service named in the exported `inject` list would make the entry sit `pending` forever on a profile that lacks it — and dsh treats a pending entry as a boot failure that blanks the whole GUI. The cost of that choice is degradation, not breakage: no settings surface keeps the bundled default mirror, no locale service renders dictionary keys.

## Source tree

```
src/
├── index.ts            host apply(): route + command, live config reader
├── config.ts           schemastery schema, defaults, resolution/validation,
│                       volatile marking (what makes 0.2.x serve the namespace)
├── prompts.ts          built-in concise strategy + <raw_prompt> framing
│                       + the context rules (added only when context is supplied)
├── enhancer.ts         one ctx.llm call: route resolution, deadline racing,
│                       finish validation, structured errors + zh host render
├── enhance-routes.ts   POST /prompt-enhance/enhance + /enhance-stream:
│                       loopback fence, body cap, admission gate, effect-owned disposer
├── enhance-command.ts  /enhance slash command
├── orchestrate.ts      shared route resolution + context assembly for both entries
├── context.ts          bounded, neutralized <conversation_context> snippet
├── loopback.ts         peer-address + Host + Origin trust fence
├── http.ts             bounded JSON body reader / writer
├── sse.ts              backpressure-aware SSE frame writer
├── shared/             protocol types, input checks, output normalization,
│                       stream-text display normalization (imported by both halves)
└── client/             browser half
    ├── index.tsx       slot registration, settings mirror, shortcut, config page
    ├── EnhanceButton   conversation.input.right entry: guards + call orchestration
    ├── ResultPanel     overlay panel: compare / apply / copy / cancel / retry
    ├── UndoBar         conversation.input.dock entry: the restore affordance
    ├── SettingsCard    plugins.row.config entry: the configuration form
    ├── settings-copy   field list + zh/en page copy
    ├── ui-state.ts     external store shared by the components (panel, undo, sessions)
    ├── enhance-client  fetch client with abort + typed errors (SSE and one-shot)
    ├── undo-stack.ts   per-session LIFO (depth 3, global cap 60, LRU eviction)
    ├── session-key.ts  per-composer UI key (host sessionId, else a stable fallback)
    ├── settings.ts     client mirror of the settings namespace
    ├── shortcut.ts     pure combo parsing / matching
    ├── locales.ts      zh + en dictionaries (harness locale namespace)
    └── styles.ts       self-injected stylesheet (dsh-pe- prefixed classes)
```

The two convergence invariants worth keeping intact: **client guards and the host route must agree through `src/shared/`**, and **the HTTP route and `/enhance` must both go through `src/orchestrate.ts`** — otherwise their behaviour drifts.

## Build outputs

[`scripts/build.mjs`](../../scripts/build.mjs) produces both halves with esbuild:

- **`lib/index.js`** — the host half: ESM, `packages: 'external'`, so the dsh plugin loader resolves `@deepseek-ai/*` itself. A sourcemap sits next to it.
- **`lib/client.js`** — the browser half: CJS inside the envelope the dsh web shell expects, `window.__ModuleLoader__.load({ id, factory })`, with react and the `@deepseek-ai/dsh-client-*` packages satisfied by the shell's module registry.

**Both are committed**, so a GitHub install needs no build step. CI fails when `lib/` differs from `src/`, so always run `npm run build` before pushing.

### The injected package name

The client bundle carries the package name it was built under:

```js
// excerpt of the generated lib/client.js
window.__ModuleLoader__.load({
  id: "dsh-prompt-polish",
  factory: (require) => { /* … */ }
})
// …and inside:
var PACKAGE_NAME = true ? "dsh-prompt-polish" : "dsh-prompt-enhance";
var ROW_KEY = `${PACKAGE_NAME}#prompt-enhance`;
```

Two things depend on it, and both fail quietly if it is wrong:

1. the module-loader envelope `id` must equal the Loader row's `name:` in [`cordis.patch.yml`](../../cordis.patch.yml), or the shell never attaches the browser half to the row;
2. the `plugins.row.config` key is `<package name>#<row id>`, so a mismatch means the Plugins row silently has no configure control.

`scripts/build.mjs` reads the name from `package.json` and injects it (`define`), and [`vitest.config.ts`](../../vitest.config.ts) applies the same define so tests exercise the built name rather than the source fallback. The **row id** `prompt-enhance` is never derived from the package name: it is the settings namespace and must stay fixed.

### Renaming

```bash
node scripts/rename-package.mjs --name @scope/new-name [--repo <git url>]
npm run rename -- --check     # package.json name vs cordis.patch.yml row name
```

`--check` compares the two name-bearing files and prints `OK` or `MISMATCH`; it cannot check the bundle, which is why a rename is always followed by `npm run build`.

## Tests

```bash
npm test                 # vitest run — 21 files, 216 tests
npx vitest run --reporter=dot
npm run test:watch
```

Coverage by area: input validation and output normalization; the enhancer against stubbed `ctx.llm` streams (normal path, terminal failures, empty output, hung stream timeout, pre-aborted caller, route precedence); a real `node:http` route suite (loopback and Host fence, method guard, malformed body, structured error envelopes, disconnect abort, SSE end to end, disabled switch); the loopback fence units; prompt framing; configuration resolution; the undo stack; shortcut parsing; the client settings decoder; the configuration page; and React component tests locking the polish → apply → undo flow, including rendering under a host input state that omits fields the plugin expects.

Prefer a regression test alongside any bug fix. Component tests use jsdom + React Testing Library with a fake input store; host-route tests use a real `node:http` server with a stubbed `ctx.llm`.

## Development loop

```bash
npm install
npm run typecheck        # tsc, no emit
npm test
npm run build            # typecheck + both halves
npm run watch            # esbuild watch for both halves
```

To debug inside a real GUI, install the checkout as a link and keep the watcher running — see [CONTRIBUTING.md](../../CONTRIBUTING.md) for the exact commands. Two environment facts worth knowing:

- **A host-half change needs a restart.** Node caches ESM by URL and `dsh-hmr` ignores `**/node_modules`, so re-composing the entry or toggling the bundle re-imports the same URL and keeps the old module. The browser half is served over HTTP with a content revision, so it does reload — after a rebuild.
- **The plugin must survive a barer host than you expect.** Two of the defects this fork inherits were only visible when installed into a real host (a slot host that omits snapshot fields, a profile without the optional settings surface), and both were render/boot failures rather than feature degradations. Tests that lock "the host is stingier than documented" are first-class here.

## CI

[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) runs on pushes to `main` and on pull requests: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, then fails if `git diff --quiet lib/` reports a difference — the committed build must match `src/`. The Node version is `22.19`, the floor of the declared `engines` range. There is **no publish step** anywhere in CI.

## Releasing

The step-by-step operator checklist — including the two disclosures that must stay in the docs, the tarball review, and the post-publish verification — is [../publish/checklist.md](../publish/checklist.md). Versioning note: this project's line is independent of upstream's, and `prepublishOnly` runs `npm run build && npm test` so a broken or unbuilt tree cannot ship.
