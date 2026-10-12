# Publishing this fork

Operator checklist for putting this fork on npm under your own name. Reviewed
against the tree at commit `e3cf5b1` (version `0.3.0`).

## Verdict: do not publish as-is

Three things make `npm publish` either impossible or wrong today:

1. **The name is not available.** `package.json` still says
   `"name": "dsh-prompt-enhance"`, which belongs to the upstream author. An
   unscoped publish of that exact name is rejected; publishing under a scope
   (`@you/dsh-prompt-enhance`) or a distinct name is the only way.
2. **The package metadata points at upstream.** `repository.url` is
   `git+https://github.com/rongxingda/dsh-prompt-enhance.git`, so npm would
   advertise someone else's repo for your build (and provenance attestation,
   if you enable it, must match the publishing repo).
3. **The package name is load-bearing in the client code.** The Plugins page
   dispatches a row's configure control by `<package name>#<row id>`; this fork
   hardcodes `dsh-prompt-enhance#prompt-enhance` in `src/client/SettingsCard.tsx`
   (`ROW_KEY`). Rename the package without changing that string and the
   configuration page silently never appears.

## Safety review (what the package can actually do)

| Check | Result |
|---|---|
| Secrets, tokens, private keys in the tree | none found (`git grep` over the working tree) |
| Local absolute paths / operator traces | none found |
| Filesystem or subprocess capability in the host half | none — `node:http` appears as **type-only** imports; no `fs`, no `child_process`, no `net` |
| Outbound network from the browser half | none — the only `fetch()` calls target the plugin's own route (`ENHANCE_ENDPOINT`, `ENHANCE_STREAM_ENDPOINT`, same origin) |
| Prompt content in logs | not logged: `console.info` records request id, input/output **character counts**, context flag and elapsed ms |
| CI | `ci.yml` runs typecheck/build/tests on push and PR; **no publish step, no secrets referenced** |
| Build freshness | rebuilding leaves the tree clean, so `lib/` matches `src/` |
| Tarball | `npm pack --dry-run`: 46 files, ~839 kB packed (lib, src, docs, `cordis.patch.yml`, README, LICENSE; no tests, no `node_modules`) |
| Licence file | Apache-2.0 text present. **No `NOTICE` and no "changed files" statement** — see below |

### Two things to disclose, not fix

- **The loopback HTTP route is unauthenticated by design.** Any local process
  can `POST /prompt-enhance/enhance` and spend the user's model quota. The
  guards are: loopback peer address, trusted `Host`, no `Forwarded`/
  `X-Forwarded-For`, trusted `Origin` when present, a body cap derived from
  `maxInputChars`, a sliding-window rate limit (`rateLimitPerMinute`, default
  10) and a concurrency cap (default 2). Say so in the README, and say that
  per-caller authentication is not attempted.
- **Draft text leaves the machine.** The enhancement call sends the composer
  draft, and with `contextAware` on up to `contextMaxMessages` recent
  turns/`contextMaxChars` characters of the session, to the configured model
  provider through the harness LLM service. Credentials stay in the harness
  (the plugin stores none), but the text does not. Disclose it.

## Before publishing (P0)

- [ ] **Rename.** `"name": "@yourscope/dsh-prompt-enhance"` (or a distinct
      unscoped name), with `publishConfig.access: "public"` for a scope.
- [ ] **Update `repository`, `bugs`, `homepage`** to your fork.
- [ ] **Keep the row id `prompt-enhance`** in `cordis.patch.yml` (it *is* the
      settings namespace key, and any existing profile patch targets it), but
      update that file's `name:` to the new package name.
- [ ] **Update `ROW_KEY`**, or better: inject it at build time so a rename can
      never desync it — add to `scripts/build.mjs`'s client options
      `define: { __PKG_NAME__: JSON.stringify(pkg.name) }` and use
      `` `${__PKG_NAME__}#prompt-enhance` `` in `SettingsCard.tsx`. (Offered but
      not applied; it is a two-line change plus a `declare const`.)
- [ ] **Tighten the peer floor**: `"@deepseek-ai/dsh-llm": ">=0.2.0-rc.2"`.
      This fork drops the pre-0.2 settings wiring, so claiming 0.1.x support is
      wrong, and the harness compatibility gate prefers a current floor.
- [ ] **Pick your own version line.** `0.3.0` invites confusion with upstream
      releases; use e.g. `0.3.0-dsh02.1` or start at `1.0.0`.
- [ ] **Apache-2.0 compliance.** Keep `LICENSE`, add a `NOTICE` naming the
      upstream project and author and stating that this is a modified,
      unofficial fork, and keep the change list in `CHANGELOG.md` (already
      written). Do not imply endorsement by the upstream author.

## Publish

```powershell
npm login                       # 2FA or a granular read/write token
npm run build; npm test         # prepublishOnly runs both anyway
npm pack --dry-run              # read the file list, then confirm the exit code
npm publish                     # scoped: --access public (publishConfig sets it)
```

`prepublishOnly` already runs `npm run build && npm test`, so a publish cannot
ship an unbuilt or failing tree. For repeat releases, prefer **npm trusted
publishing** (GitHub Actions OIDC, `id-token: write`) over a long-lived token;
the repo already has `.github/workflows/ci.yml` to extend.

## After publishing — verify the published artifact, not the checkout

In a scratch profile:

1. `install_bundle <name>@<version>`; confirm the loader reports the entry
   `active` (not `failed`);
2. the client slot ledger has `plugins.row.config` keyed
   `<new package name>#prompt-enhance`;
3. the Plugins page row opens the form and all sixteen fields read/write;
4. an enhancement returns the concise shape (no `(待补充：…)` placeholders, no
   acceptance-criteria section);
5. toggling the bundle off and on re-activates it (this is the route-leak fix —
   the published build is the one that must survive it).

## Never publish

- `.asar-dump/` — extracted `app.asar` contents and DSH first-party code, plus
  operator scripts. It is outside this repo; keep it that way.
- `dsh-prompt-enhance-settings/` — the earlier companion package, now
  superseded by the in-package page.
- Your profile, credentials, session logs, or anything under `.dsh/`.
