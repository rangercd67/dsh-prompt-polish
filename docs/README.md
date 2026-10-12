# Documentation

Everything in this directory documents **`dsh-prompt-polish`** — a derivative of upstream [`dsh-prompt-enhance`](https://github.com/rongxingda/dsh-prompt-enhance) (Apache-2.0), based on upstream 0.2.7. Where a document describes the *upstream* project it says so explicitly, and the upstream name is kept for it.

The two READMEs — [English](../README.md) and [简体中文](../README.zh-CN.md) — are the front door: what the plugin is, how to install it, the full configuration table, the security disclosures. Start there.

## index

| Document | What it covers |
|---|---|
| [guide/usage-and-configuration.md](./guide/usage-and-configuration.md) | Every configured field with its range and effect, where the form lives, model routing precedence, error codes, troubleshooting, and the manual smoke checklist |
| [dev/architecture.md](./dev/architecture.md) | The source tree and module responsibilities, the two build outputs (and the package name injected into the client bundle), the test suites, and the development loop |
| [compat/dsh-0.2-findings.md](./compat/dsh-0.2-findings.md) | The `0.2.x` defects this fork works around, with the harness code that decides each behaviour, how to reproduce it, and the fix — the part worth reporting upstream |
| [publish/checklist.md](./publish/checklist.md) | Operator checklist for publishing this fork: name and metadata, the load-bearing row key, licence and attribution duties, tarball review, post-publish verification |
| [history/release-1.0.0.md](./history/release-1.0.0.md) | This project's first release: what changed against upstream 0.2.7, how it was verified, install and rollback |
| [history/](./history/) | The upstream project's own release notes (0.2.3 – 0.2.7) and its 0.2.2 code review, kept as history |

### Category layout

```
docs/
├── README.md                          ← this index
├── evidence-prompt-enhance-panel.png  ← the screenshot the READMEs embed
├── guide/                             using and configuring the plugin
├── dev/                               architecture and development
├── compat/                            harness-compatibility findings
├── publish/                           publishing checklist
└── history/                           upstream release notes + the fork's 1.0.0 notes
```

## A note on `history/`

The files in `history/` were written for the **upstream** project and are kept verbatim as its record:

- `release-0.2.3.md` … `release-0.2.7.md` are upstream's GitHub Release notes for those versions. They describe upstream's `src/` at those versions; some of what they call a current state was changed by this fork's `1.0.0` (notably the built-in strategy, the `maxOutputTokens` default, and the configuration surface).
- `code-review-upstream-0.2.2.md` is upstream's own code-review report (in Chinese) for `dsh-prompt-enhance@0.2.2`. Its directory tree and its "no `@module`/`docs`" details are upstream's, not this fork's.
- `release-1.0.0.md` is **this** project's release note — the only entry in `history/` that describes `dsh-prompt-polish`.

For the current behaviour always read the READMEs and this project's [CHANGELOG.md](../CHANGELOG.md); the history files are there so the provenance of the code is checkable.
