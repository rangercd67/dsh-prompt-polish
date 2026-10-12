# Usage and configuration

The practical reference for using **`dsh-prompt-polish`** in a dsh web profile. For what the plugin is and why this fork exists, read the [README](../README.md); for the security model and the two disclosures, read its [Security & privacy](../README.md#security-privacy) section — they are not repeated here.

Everything below is checkable against [`src/config.ts`](../../src/config.ts) (defaults, ranges and the resolution/validation rules), [`src/client/settings-copy.ts`](../../src/client/settings-copy.ts) (the copy the form renders) and [`src/client/SettingsCard.tsx`](../../src/client/SettingsCard.tsx) (the page itself).

## Where the settings live

- **Namespace:** `prompt-enhance`. That string is the settings namespace key *and* the Loader row id in [`cordis.patch.yml`](../../cordis.patch.yml). It is deliberately permanent: a rename of the package must never change it, because every stored value and every existing profile patch addresses it.
- **The form:** this package registers its own configuration page. Open the **Plugins** page, find this plugin's row and use its configure control. The row key is `<package name>#prompt-enhance`, produced at build time — with the name this package is built under, today `dsh-prompt-polish#prompt-enhance`.
- **Alternatively:** on a profile that also bundles the harness' own settings surface, the same namespace appears under **Settings → 插件配置**.
- **Live:** the host reads the configuration per request, so a saved change applies to the very next polish call. No restart, no remount.
- **On `0.2.x` this works because** every field of the exported `Config` schema is marked volatile; the harness derives a plugin's settings namespace from that schema and keeps only volatile fields. See [the compatibility findings](../compat/dsh-0.2-findings.md) for the harness code that decides this.

Editing by hand is still possible — the values live in the profile's settings file under the `prompt-enhance` namespace, and a profile patch can seed them:

```yaml
# excerpt of a profile patch / settings file
prompt-enhance:
  enabled: true
  temperature: 0.3
  maxOutputTokens: 6000
```

## The fields

Sixteen fields. "Range" is the schema's accepted range; a value outside it is refused by `resolveConfig` with an explicit error rather than silently clamped.

| Field | Default | Range / values | Effect |
|---|---|---|---|
| `enabled` | `true` | boolean | Master switch. Off hides the composer button and disables every trigger (button, shortcut, `/enhance`, and the HTTP route answers `403` before reading a body) |
| `provider` | *(unset)* | non-empty string when set | Explicit model-route override. **Must be paired with `model`**: setting exactly one of the two is a configuration error, and a blank/whitespace value is normalized to "unset" |
| `model` | *(unset)* | non-empty string when set | The other half of the explicit override pair |
| `temperature` | `0.3` | `0`–`1` (step `0.05`) | Sampling temperature. Low keeps the rewrite faithful to the draft |
| `strategyMode` | `replace-default` | `replace-default` \| `extend-default` | How a non-empty `systemPrompt` combines with the built-in strategy. `replace-default` swaps the built-in strategy out entirely — its hard rules are **not** retained automatically; `extend-default` appends your text after the built-in strategy, keeping them in force. Any stored value other than the literal `extend-default` reads as `replace-default`, so older sections keep the behaviour they were saved under |
| `systemPrompt` | `''` | free text (textarea) | Your own strategy. Blank (the default) uses the built-in concise strategy |
| `shortcut` | `ctrl+alt+e` | shortcut spec | Global shortcut, e.g. `ctrl+alt+e`. Requires at least one of `ctrl` / `alt` / `meta` plus one alphanumeric or function key — a bare key or `shift`+letter is ignored, so normal typing can never be swallowed. Empty disables it |
| `maxOutputTokens` | `6000` | `256`–`32768` | Output token budget of one polish call. It is what bounds that call's cost, and hitting it is reported as `<reason: max-tokens>` with a hint to raise the cap or shorten the draft |
| `maxInputChars` | `12000` | `200`–`200000` | Input character cap, counted in **Unicode code points** (one emoji is one character). Over-length drafts are refused, never truncated |
| `timeoutMs` | `60000` | `5000`–`600000` | End-to-end deadline of one call, in milliseconds. On expiry the call is aborted and reported as a timeout |
| `maxConcurrent` | `2` | `1`–`16` | Concurrency cap **within one host process**. Excess requests answer `429` + code `concurrency-limit` (no `Retry-After`: a slot frees when an in-flight call settles). The browser UI admits one in-flight request per composer, so this mainly protects the `/enhance` command plane and multi-client callers |
| `rateLimitPerMinute` | `10` | `1`–`600` | Sliding-window rate cap per minute, **within one host process**, counting **successful calls only**. Excess answers `429` + code `rate-limit` with a `Retry-After` in seconds computed from the window |
| `streaming` | `true` | boolean | Show the model's output as it streams instead of waiting for the whole rewrite. **Display-only**: the text you apply is the normalized full result either way. The client falls back to the one-shot JSON endpoint when the host or network does not support `text/event-stream` |
| `contextAware` | `true` | boolean | Ground the rewrite in the current conversation's recent history. With no session, no history, or this switch off, the call degrades to the plain single-prompt polish — context is never a prerequisite. See the privacy note below |
| `contextMaxMessages` | `8` | `0`–`50` | Context breadth: how many recent `user`/`assistant` turns may be used. `0` admits none |
| `contextMaxChars` | `4000` | `0`–`100000` | Context depth: character budget of the assembled history snippet, spent newest-first, so the most recent turns win when the budget is tight. `0` admits none |

**Privacy, again, because it is a setting.** With `contextAware` on (the default) the plugin assembles up to `contextMaxMessages` recent turns and `contextMaxChars` characters of the current session's history and sends it to the configured model provider alongside the draft. If the session contains secrets you typed earlier, turn the switch off — or scope the session — before polishing. Credentials are not affected: the plugin stores none, and the call rides the harness LLM service.

## Model routing

The route of one polish call is resolved by precedence, first hit wins:

1. **The explicit settings pair** — `provider` + `model`, both non-empty.
2. **The current session's route** — the provider/model recorded in the session's logged request header (that is, the route its own messages used).
3. **The harness-wide default model.**

If none of the three names a route (a fresh session with no default model configured, say), the plugin answers `unconfigured` — HTTP `409`, browser copy `error.unconfigured` — instead of guessing. Pair `provider`/`model` in the settings, or send one message in the session first so it carries a route.

### What to put in `provider` / `model`

They must match the harness' own provider settings: each key under the provider settings (for example `zhipu`, `muyuu`) is a provider, and each `models[].id` under it (for example `glm-5.3-flash`) is a model. Example pair: `provider: zhipu` + `model: glm-5.3-flash`.

Any provider the harness serves works here, including the official DeepSeek route and OpenAI-compatible gateways — the plugin calls `ctx.llm`, not a vendor SDK.

## What happens on a call

1. **Local guards** (browser): empty / whitespace / invisible-only drafts, drafts over `maxInputChars`, images-only drafts, drafts containing command or file-reference chips, and a composer that is already busy are refused with a readable message and never leave the browser. Chips are refused because filling back would destroy them.
2. **The request:** `POST /prompt-enhance/enhance` (one JSON envelope) or `POST /prompt-enhance/enhance-stream` (SSE frames), on the shared webserver, loopback-fenced. The body cap is derived from `maxInputChars`.
3. **Host-side admission:** the rate window is trimmed, then the concurrency cap is checked. Both are per host process and in memory.
4. **The model call:** `ctx.llm.stream` with the built-in strategy (or yours, per `strategyMode`) and the `<raw_prompt>`-framed draft, plus the `<conversation_context>` snippet when `contextAware` produced one.
5. **Normalization:** the assembled text output is trimmed, a single wrapping code fence is stripped, runs of blank lines collapse, and an empty result is refused rather than applied.
6. **The result:** the panel shows original and polished text with the model name and elapsed time. **Apply** fills it back and pushes the original draft onto the session's undo stack; **Copy** copies it; **Cancel** discards it.

`/enhance <text>` takes the same host path but returns the text into the command plane instead: it is copyable, never enters the conversation history, and never touches the composer draft.

## Errors

The route answers structured errors, `{ code, message?, params? }`. The browser renders its localized primary line from `code` + `params`; `message`, when present, is an optional diagnostic detail (the provider's raw failure text, a config error) shown verbatim underneath. The `/enhance` command plane has no locale dictionary, so a host-side renderer of the same errors produces Chinese text directly.

| Code | HTTP | Meaning and recovery |
|---|---|---|
| `rejected` | 403 / 413 / 415 / 422 | Refused before any model call: disabled plugin, non-loopback peer, a body over the cap, a non-JSON content type, malformed JSON, a bad request shape, or text that fails the input check. With `{ count, max }` the browser reuses its "too long" copy |
| `rate-limit` | 429 | Per-minute window full. `params`: `{ limit, retryAfterSeconds }`; the response also carries a `Retry-After` header |
| `concurrency-limit` | 429 | `maxConcurrent` calls already in flight. `params`: `{ max }`. No `Retry-After` — the slot frees when a call settles |
| `timeout` | 504 | The call exceeded `timeoutMs`. `params`: `{ seconds }` |
| `unconfigured` | 409 | No model route could be resolved (see above), or the provider is unconfigured |
| `upstream` | 502 | The provider failed. `params.reason` selects a specific hint: `auth`, `invalid-credential`, `rate-limit`, `quota`, `empty`, `context-window`, `tool-call`, `max-tokens` |
| `internal` | 500 / 502 | Anything else, including a canceled call and an invalid stored configuration section |

Every failure is reported inside the plugin's own panel, and a failed call never modifies the composer draft.

## Troubleshooting

| Symptom | Check |
|---|---|
| The button is missing, the shortcut does nothing | The row's configure page: is `enabled` true? Is the plugin installed (`dsh plugin --profile web list`) and was `dsh web` restarted? Any apply error in the browser console? |
| The configure control does not appear on the Plugins row | The row key is `<package name>#prompt-enhance` and is injected at build time — a bundle built under a different name than the manifest will not register it. Rebuild (`npm run build`) and confirm `npm run rename -- --check` is OK |
| "No model resolved for the polish" | All three routing sources are empty. Pair `provider`/`model`, or send one message in the session first; check the harness' default-model settings section |
| Authentication failures | The `message` detail line carries the concrete cause (a 401, say). Check the provider's API key in the harness credential store; quota/balance problems surface as the `quota` hint |
| `429` right after a run of failures | Should not happen: the window counts successful calls only. Check for several mounted profiles/processes (each counts independently, and they stack up) or a very low `rateLimitPerMinute` |
| Poor rewrites: fabricated requirements, dropped constraints, broken formatting | With `strategyMode: replace-default`, a non-empty `systemPrompt` replaces the built-in strategy *including its hard rules*. Carry them into your own text, or use `extend-default` |
| The rewrite is cut off | The output reached `maxOutputTokens`. Raise the cap (it is a budget, not a target) or shorten the input |
| The streamed preview looks different from the applied text | It cannot be: the preview is display-only and the applied text is the normalized final body. If a real difference ever appears, that is a bug worth reporting with the request id from the host log |
| Settings do not stick | Confirm the save was accepted (the form reports a rejected write), and that the profile's settings store is writable — the form surface reports read-only deployments as such |

The host logs one line per call: request id, input/output character counts, the context flag and elapsed milliseconds. It never logs the prompt text or the route.

## Manual smoke checklist

After installing and restarting `dsh web`:

1. The plugin's row on the **Plugins** page has a configure control, and the form reads and writes all sixteen fields.
2. The ✨ button sits next to the send button; `Ctrl+Alt+E` triggers the same flow.
3. Empty input → refusal; a valid draft → preview with model info; Apply fills back; Undo restores; Copy works.
4. `/enhance <text>` renders a copyable result without touching model history.
5. All three routes work: the pinned settings pair, a session's model, and the harness default.
6. Toggle the bundle off and on in the Plugins page: it re-activates instead of failing on a duplicate route (the route-lifecycle fix).
7. Toggle `enabled` off in the form: the composer button disappears on the next render, without a page reload.
