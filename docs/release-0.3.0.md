# 0.3.0 — dsh desktop / `0.2.0-rc.2` fork

Branch `dsh-desktop-0.2`. Makes the plugin *configurable* and restart-safe on the
`0.2.x` runtime, shortens the rewrite, and moves the configuration page into the
package itself. The incompatibilities behind these changes are documented in
[dsh-0.2-compat-findings.md](./dsh-0.2-compat-findings.md).

## What changed

### Configuration exists now

dsh `0.2.x` serves a plugin's settings namespace only when the exported `Config`
schema carries **volatile** fields (`volatileForm()` in `@deepseek-ai/dsh-settings`
filters on it in `describe()` and in every write); an entry with none is skipped
outright. This package marked none, and the `installSection` /
`installSettingsSection` wiring it used instead no longer exists in the harness —
so the plugin was not configurable anywhere on `0.2.x`, silently.

- every `Config` field is now marked volatile through the schema's `meta`
  (the public `schemastery` this package depends on has no `.volatile()` chain
  method; dsh's own plugins use the harness fork, which does);
- the dead compatibility probe is gone;
- the host half reads the composition config **by reference** — a volatile-only
  settings write is committed into the running reference by the loader
  (`_commitVolatile`), so no `setSource` hook is needed for a change to reach the
  next call.

### The plugin ships its own configuration page

A `plugins.row.config` entry keyed `dsh-prompt-enhance#prompt-enhance`, rendered
with the harness' shared `SettingsForm` / `SettingsFormModel` /
`SettingsValueField` / `Checkbox` primitives: all sixteen fields, zh/en copy,
override badges, per-field reset, conflict-fenced save, and the
unavailable/read-only states. Because the page lives in the bundle that declares
the row, **no companion package is required** to make the entry editable.

The client settings mirror also moved from the removed `settingsScope` service to
`configForms`. Before this, the mirror silently kept its bundled defaults on
`0.2.x`: turning the master switch off never hid the composer button, and a
shortcut change never took effect.

### Route lifecycle

`webserver.register()` returns the disposer that removes the route; the plugin
dropped it, so `/prompt-enhance` outlived its fiber and the next mount died on
`duplicate prefix route` — leaving the entry `failed` until the host restarted.
The disposer is now held in an effect, and the per-context mount guard is cleared
when it runs, so a reused context registers afresh instead of keeping a dead
route.

### Shorter rewrites

- `DEFAULT_SYSTEM_PROMPT` is the concise strategy: one line of goal plus the
  steps the task actually needs, constraints under a short lead-in, no mandatory
  acceptance-criteria / boundary-condition / role sections, **no `(待补充：…)`
  style placeholders** (an unknown detail is omitted; only a detail that blocks
  execution becomes one closing question), and a 1x–2x length target.
- `maxOutputTokens` default `2048 → 6000`. A Chinese long rewrite is already
  ~1k tokens and reasoning shares that budget, which is what produced
  `重写结果达到输出上限 (maxOutputTokens)`.

### 0.2.x API adaptations

Client slot types come from `ui-renderer`, `sessionId` from `ui-session`, the
row-config slot from `ui-plugin-manager`; the enhancement call declares its own
`MessageSourceMap` kind (`plugin` was removed from the harness vocabulary);
`dsh.engines.dsh` is `>=0.2.0-rc.2 <0.3.0`; devDeps pin the 0.2.0-rc.2 client
line.

## Install

```powershell
# from the profile (managed by the desktop app):
#   install_bundle  target = file:<this checkout>
# pnpm installs it as a copy; the registry version is replaced, same bundle name,
# same row id, so an existing profile patch for `prompt-enhance` keeps applying.
```

A host-half change needs an application restart to take effect: Node caches ESM
by URL, and `dsh-hmr` ignores `**/node_modules`, so re-composing the entry — or
toggling the bundle — re-imports the *same* URL and keeps the old module. The
browser half is served over HTTP with a content revision, so it does reload.

## Verify

1. `include:prompt-enhance` is `active` (not `failed`);
2. the client slot ledger has `plugins.row.config` key
   `dsh-prompt-enhance#prompt-enhance`;
3. the Plugins page row grows a `›` control and the form reads/writes all
   sixteen fields;
4. an enhancement returns the concise shape (no placeholders, no acceptance
   section) — `POST /prompt-enhance/enhance {"text":"…"}`, loopback only;
5. toggling the bundle off and on re-activates it instead of failing on a
   duplicate route.

`npm test` covers 1–2 and 5's registration/disposal behaviour in-process
(21 files, 216 tests), plus the concise prompt contract and the page's fields.

## Rollback

`install_bundle dsh-prompt-enhance@0.2.7` restores the published build (then
restart, for the same ESM-cache reason).
