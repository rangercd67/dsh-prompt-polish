# Publishing checklist

Operator checklist for publishing **`dsh-prompt-polish`** to npm under its own
name. Reviewed against this tree at version `1.0.0`. Nothing in this repository
publishes automatically, and CI has no publish step.

This is a derivative work: `dsh-prompt-polish` modifies
[`dsh-prompt-enhance`](https://github.com/rongxingda/dsh-prompt-enhance)
(Apache-2.0, upstream 0.2.7). The licence and attribution duties below are not
optional.

## State of the tree

| Item | Status |
|---|---|
| `package.json` `name` | `dsh-prompt-polish` |
| `repository` / `bugs` / `homepage` | `https://github.com/rangercd67/dsh-prompt-polish` — this project's own repo, not upstream's |
| Loader row `name:` in `cordis.patch.yml` | `dsh-prompt-polish`, equal to the package name (`npm run rename -- --check` reports `OK`) |
| Loader row `id:` | `prompt-enhance` — **unchanged and must stay unchanged**; it is the settings namespace key and every existing profile patch targets it |
| Package name in the client bundle | injected at build time by `scripts/build.mjs` (`define`), so a rename cannot desync it as long as the tree is rebuilt |
| Version | `1.0.0`, this project's own line — deliberately not a `0.3.x` number, which would read as a continuation of upstream's |
| Licence | Apache-2.0, `LICENSE` retained verbatim from upstream |
| Attribution | `NOTICE` names the upstream project and author, states that this is a modified, unofficial derivative, lists the changed files, and disclaims endorsement; `NOTICE` is in the published `files` list |
| Peer floor | `@deepseek-ai/dsh-llm >=0.2.0-rc.2`, marked optional (it is a runtime module supplied by the dsh host, not an npm install) |
| `dsh.engines.dsh` | `>=0.2.0-rc.2 <0.3.0` — this project drops pre-0.2 support, so claiming `0.1.x` would be wrong |
| Disclosures | both are in the READMEs (and repeated in the guide): the unauthenticated loopback route, and the draft/context leaving the machine |
| `prepublishOnly` | `npm run build && npm test`, so a publish cannot ship an unbuilt or failing tree |
| `publishConfig.access` | `public` |

## Safety review (what the package can actually do)

| Check | Result |
|---|---|
| Secrets, tokens, private keys in the tree | none found (`git grep` over the working tree) |
| Local absolute paths / operator traces | none found in tracked files |
| Filesystem or subprocess capability in the host half | none — `node:http` imports are type-only; no `fs`, no `child_process`, no `net` |
| Outbound network from the browser half | none beyond the plugin's own loopback route (`ENHANCE_ENDPOINT`, `ENHANCE_STREAM_ENDPOINT`, same origin) |
| Prompt content in logs | never logged: one line per call carries a request id, input/output **character counts**, the context flag and elapsed milliseconds |
| Dynamic code execution | none; the two bundles are plain ESM/CJS with every package import external |
| Build freshness | `npm run build` leaves the tree clean, so `lib/` matches `src/` |
| CI | `ci.yml` runs typecheck, tests and build on push and PR and fails on `lib/` drift; **no publish step, no secrets referenced** |
| Tarball | run `npm pack --dry-run` and read the file list before publishing (see below) |

### Two things to disclose, not fix

Both are deliberate; they must stay in the READMEs.

- **The loopback HTTP route is unauthenticated by design.** Any local process
  can `POST /prompt-enhance/enhance` and spend the user's model quota. The
  guards are: loopback peer address, trusted `Host`, no `Forwarded` /
  `X-Forwarded-For`, trusted `Origin` when present, a body cap derived from
  `maxInputChars`, a sliding-window rate limit (`rateLimitPerMinute`, default
  10, counting successful calls only) and a concurrency cap (default 2).
  Per-caller authentication is not attempted.
- **Draft text leaves the machine.** The call sends the composer draft, and with
  `contextAware` on up to `contextMaxMessages` recent turns / `contextMaxChars`
  characters of the session, to the configured model provider through the
  harness LLM service. Credentials stay in the harness — the plugin stores none
  — but the text does not.

## Before publishing (P0)

- [ ] **Confirm the name is available.** `npm view dsh-prompt-polish` should
      return 404 until the first publish. If it is taken, rename with
      `node scripts/rename-package.mjs --name <new name> --repo <git url>` and
      then `npm run build && npm test`, because the client bundle must carry the
      new name.
- [ ] **Confirm `repository` / `bugs` / `homepage`** still point at
      `rangercd67/dsh-prompt-polish` (a rename-script run with `--repo` rewrites
      all three; a run without `--repo` leaves them).
- [ ] **Keep the row id `prompt-enhance`** in `cordis.patch.yml`; only its
      `name:` may ever follow the package name.
- [ ] **Rebuild after any metadata change**: `npm run build`, then
      `git status --porcelain` must not list `lib/`.
- [ ] **Licence and attribution.** Keep `LICENSE` verbatim, keep `NOTICE`
      naming the upstream project and author and stating that this is a
      modified, unofficial derivative, keep the changed-file list current, and
      never imply endorsement by the upstream author or by DeepSeek.
- [ ] **Version it in this project's line.** `npm version patch|minor|major` —
      not a `0.3.x`, which belongs to upstream.
- [ ] **Read the tarball.** `npm pack --dry-run`; expect `lib/`, `src`,
      `cordis.patch.yml`, `NOTICE`, `LICENSE`, both READMEs and `docs/`, and no
      tests and no `node_modules`.

## Publish

```powershell
npm login                       # 2FA, or a granular read/write token
npm run build; npm test          # prepublishOnly runs both anyway
npm pack --dry-run               # read the file list, then confirm the exit code
npm publish                      # --access public is set via publishConfig
```

For repeat releases prefer **npm trusted publishing** (GitHub Actions OIDC with
`id-token: write`) over a long-lived token; `.github/workflows/ci.yml` is the
workflow to extend. Note that provenance attestation must refer to the
publishing repository — another reason the metadata above has to point at this
project, not upstream.

## After publishing — verify the published artifact, not the checkout

In a scratch profile:

1. install the published version and confirm the loader reports the entry
   `active` (not `failed`);
2. confirm the client slot ledger has `plugins.row.config` keyed
   `<published package name>#prompt-enhance`;
3. open the Plugins page row and read/write all sixteen fields;
4. run one polish and confirm the concise shape (no `(待补充：…)` placeholder, no
   acceptance-criteria section);
5. toggle the bundle off and on and confirm it re-activates instead of failing
   on a duplicate route — that is the route-lifecycle fix, and the published
   build is the one that has to survive it.

## Never publish

- `.asar-dump/` — extracted `app.asar` contents and DSH first-party code, plus
  operator scripts. It lives outside this repo; keep it that way.
- `dsh-prompt-enhance-settings/` — the earlier companion settings package of the
  upstream project, superseded by the in-package configuration page.
- Your profile, credentials, session logs, or anything under `.dsh/`.
