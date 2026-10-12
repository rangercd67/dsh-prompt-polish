import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

/**
 * The client half needs the package name it is built under (the Plugins page
 * keys a row's configure control by `<package name>#<row id>`), injected by
 * `scripts/build.mjs`. The test run compiles the source directly, so the same
 * define is applied here: without it the tests would exercise the source's
 * fallback constant instead of the name a published bundle would carry.
 */
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { name: string }

export default defineConfig({
  define: { __PROMPT_ENHANCE_PACKAGE_NAME__: JSON.stringify(pkg.name) },
})
