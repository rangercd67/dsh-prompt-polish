/**
 * Rename this fork for its own npm release.
 *
 * The package name is load-bearing in three places, and getting one of them
 * wrong fails quietly rather than loudly:
 *
 * - `package.json` name/repository/bugs/homepage — what npm publishes;
 * - `cordis.patch.yml`'s row `name:` — the module the Loader resolves, which
 *   must equal the package name (the client module system attaches a package's
 *   browser half to the row whose module name is exactly the package name);
 * - the client's `plugins.row.config` key, `<package name>#<row id>` — already
 *   injected at build time by `scripts/build.mjs`, so a rename cannot desync it
 *   as long as the tree is rebuilt.
 *
 * The row *id* (`prompt-enhance`) is deliberately NOT touched: it is the
 * settings namespace, and every existing profile patch targets it.
 *
 * Usage:
 *   node scripts/rename-package.mjs --name @you/dsh-prompt-enhance [--repo <git url>]
 *   node scripts/rename-package.mjs --check
 *
 * `--check` reports whether the three name-bearing places agree, without
 * writing anything.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const readFlag = (flag) => {
  const index = argv.indexOf(flag)
  return index === -1 ? undefined : argv[index + 1]
}

const manifestPath = resolve(root, 'package.json')
const patchPath = resolve(root, 'cordis.patch.yml')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const patch = readFileSync(patchPath, 'utf8')
const patchName = /^\s*name:\s*(\S+)\s*$/m.exec(patch)?.[1]

if (argv.includes('--check')) {
  const ok = patchName === manifest.name
  console.log(`package.json name : ${manifest.name}`)
  console.log(`cordis.patch.yml  : ${patchName}`)
  console.log(ok ? 'OK: the row name matches the package name' : 'MISMATCH: the Loader would not resolve this bundle')
  console.log('client row key    : injected at build time from package.json (rebuild after any rename)')
  process.exit(ok ? 0 : 1)
}

const name = readFlag('--name')
const repo = readFlag('--repo')
if (name === undefined || name.trim() === '') {
  console.error('usage: node scripts/rename-package.mjs --name @scope/dsh-prompt-enhance [--repo <git url>]')
  process.exit(2)
}

const nextName = name.trim()
const nextManifest = { ...manifest, name: nextName }
if (repo !== undefined) {
  const url = repo.trim()
  nextManifest.repository = { ...(manifest.repository ?? {}), type: 'git', url }
  nextManifest.homepage = url.replace(/^git\+/, '').replace(/\.git$/, '#readme')
  nextManifest.bugs = { url: `${url.replace(/^git\+/, '').replace(/\.git$/, '')}/issues` }
}

writeFileSync(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`)
writeFileSync(patchPath, patch.replace(/^(\s*name:\s*)\S+\s*$/m, `$1${nextName}`))

console.log(`renamed to ${nextName}`)
if (repo !== undefined) console.log(`repository/homepage/bugs -> ${repo}`)
console.log('next: npm run build && npm test, then node scripts/rename-package.mjs --check')
console.log('reminder: the row id stays "prompt-enhance" — it is the settings namespace.')
