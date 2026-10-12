# dsh 0.2.x compatibility findings

Two upstream defects were found while adapting this plugin to the dsh **desktop**
runtime `0.2.0-rc.2`, plus one harness requirement that silently disables a
plugin's configuration. Each is recorded here with the code that decides the
behaviour, how to reproduce it, and what **`dsh-prompt-polish`** — the fork —
does instead. "This plugin" below means `dsh-prompt-polish`; the defects are in
**upstream `dsh-prompt-enhance` 0.2.7**, the base of this project's `1.0.0`.

The fork's answers are summarised in
[../history/release-1.0.0.md](../history/release-1.0.0.md); these notes are the
part worth reporting upstream, because they are not specific to this plugin.

## 1. `settings.installSection` no longer exists, and the compat probe hides it

**Where.** `0.2.7`'s `src/index.ts` registers its settings section by probing
the service:

```ts
ctx.inject(['settings'], (settingsCtx) => {
  const service = settingsCtx.settings
  if (typeof service?.installSection === 'function') { service.installSection(…) ; return }
  void import('@deepseek-ai/dsh-settings').then((mod) => {
    if (typeof mod.installSettingsSection === 'function') mod.installSettingsSection(…)
  }, () => {})
})
```

**What the harness exposes now.** `@deepseek-ai/dsh-settings` (`0.2.0-rc.2`)
exports exactly `{ SettingsConflictError, SettingsForms, redactSecrets }` and its
service class is `SettingsForms`. There is no `installSection` on the service and
no `installSettingsSection` module export, so **both branches no-op**: the
`ctx.inject` callback runs, finds nothing, and returns. Nothing is logged; the
entry still reports `active`.

**Consequence.** The plugin's documented "Settings → 插件配置, edited live" surface
does not exist on `0.2.x`, and no error says so.

## 2. A settings namespace exists only for volatile schema fields

**Where.** `SettingsForms.describe()` and every write path
(`@deepseek-ai/dsh-settings/lib/index.js`):

```js
const schema = this.schema(entry)                     // = entry.fiber.runtime.Config
if (schema === undefined || entry.fiber === undefined || entry.fiber.runtime === null || entry.fiber.state !== 2) return []
const form = volatileForm(schema)                     // keeps ONLY fields whose meta is volatile
if (form === undefined) return []                     // ← no volatile field: the entry is skipped entirely
```

`volatileForm()` returns `undefined` for an object schema with no volatile
member, and `write()` repeats the same test (plus `isVolatilePath()` per edited
path).

**Consequence for an unmarked plugin.** Its entry never appears in the
served-namespace directory, so *no* surface can read or write it — the Settings
section, the Plugins page's row form, and any companion package all see
"unavailable". This is why `0.2.7` is not configurable at all on `0.2.x`, and why
its README's `Settings → 插件配置` instructions cannot be followed.

**Reproduce.** Install `dsh-prompt-enhance@0.2.7` into a profile on `0.2.0-rc.2`;
in the Plugins page the row has a switch but no configure control, and a client
that calls `ctx.configForms.get('prompt-enhance')` gets
`status: 'unavailable'` even though the entry is active.

**Idiomatic fix.** Mark the schema fields volatile. dsh's own plugins use the
harness' schemastery fork:

```js
static Config = z.object({ provider: z.string().required().volatile(), … })
```

this package depends on the **public** `schemastery` (3.18.x has no such chain
method), so it sets the same bit through the schema's public `meta` object.

## 3. The prefix route leaks when the fiber stops, and the next mount fails

**Where.** `0.2.7`'s `src/enhance-routes.ts`:

```ts
const mountedContexts = new WeakSet<Context>()   // keyed by ctx

export function registerEnhanceRoute(ctx, readConfig) {
  const webserver = ctx.get('webServer')
  if (webserver === undefined) return
  if (mountedContexts.has(ctx)) return
  mountedContexts.add(ctx)
  webserver.register({ kind: 'prefix', path: '/prompt-enhance', handler })   // ← return value dropped
}
```

`register()` is documented as `register(route: WebRoute): () => void` — it hands
back the disposer that removes the route, and duplicate `(kind, path)` throws.

**What happens.**

1. The plugin's fiber stops (plugins-page switch, reload, re-link). The route is
   **not** disposed, because its disposer was thrown away, so `/prompt-enhance`
   survives the fiber that owned it.
2. The mount guard is a `WeakSet` keyed by the *context*, and a remount brings a
   new context, so the guard does not fire.
3. The new fiber calls `register()` again and dies:

```
prompt-enhance (dsh-prompt-enhance): Error: webserver: duplicate prefix route "/prompt-enhance"
    at Proxy.register (…/dsh-host-webserver/lib/index.js:179:36)
    at registerEnhanceRoute (…/dsh-prompt-enhance/lib/index.js:934:13)
```

The entry is left `failed`, and it **cannot be recovered inside that process** —
every further enable attempt hits the same duplicate; the leaked route even keeps
answering with the old fiber's closure. Only restarting the host clears the
registry. `dsh-hmr` cannot rescue it either: its default `ignored` is
`["**/node_modules", …]`, so the plugin's own files are not watched, and Node's
ESM cache would serve the same module URL anyway.

**Reproduce.** With the plugin active, toggle it off and on from the Plugins page
(or `setBundleEnabled(false/true)`). The second call reports
`1 entry did not activate` and the entry stays `failed` until the app restarts.

**Fix.** Hold the disposer in an effect and clear the guard when it runs:

```ts
ctx.effect(() => {
  const dispose = webserver.register({ kind: 'prefix', path: ENHANCE_PREFIX, handler })
  return () => { mountedContexts.delete(ctx); dispose() }
}, 'prompt-enhance: /enhance route')
```

## Bonus: a companion client page must register the row key

Not a defect, but the missing half of the same story: the Plugins page draws a
row's configure control only while something registers
`plugins.row.config` keyed `<package name>#<row id>`
(`ui-plugin-manager/lib/client.js`: `configure.has(row) → ledger.rows.has(...)`).
A row with no registration has no page, whatever the host serves. `dsh-prompt-polish`
registers its own key — `<package name>#prompt-enhance`, today
`dsh-prompt-polish#prompt-enhance` — from its client half, so no companion package
is needed.
