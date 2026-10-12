import { describe, expect, it, vi } from 'vitest'
import { apply } from '../src/index'
import { Config } from '../src/config'

/**
 * The host half's contract on dsh 0.2.x:
 *
 * - the exported `Config` schema carries volatile fields, because that is what
 *   makes the loader serve the entry as a settings namespace at all
 *   (`volatileForm()` in `@deepseek-ai/dsh-settings`);
 * - `apply()` registers the enhance route through an effect that disposes it,
 *   so stopping the fiber releases the prefix instead of leaking it (the leak
 *   that used to make a re-mount die on `duplicate prefix route`);
 * - nothing probes the `settings` service any more: `installSection` and the
 *   standalone helpers it used for that were removed from the harness.
 */

interface Stub {
  ctx: Record<string, unknown>
  effects: Array<() => void>
}

/** Minimal registrant context: named services answered from `overrides`. */
function stubContext(overrides: Record<string, unknown> = {}): Stub {
  const effects: Array<() => void> = []
  return {
    effects,
    ctx: {
      get: (name: string) => overrides[name],
      inject: () => {},
      effect: (fn: () => unknown) => {
        const dispose = fn()
        if (typeof dispose === 'function') effects.push(dispose as () => void)
        return () => {}
      },
    },
  }
}

describe('apply settings integration', () => {
  it('marks every Config field volatile so dsh 0.2.x serves the namespace', () => {
    const fields = Object.entries(Config.dict ?? {})
    expect(fields.length).toBeGreaterThan(0)
    for (const [name, field] of fields) {
      expect((field.meta as unknown as { volatile?: boolean }).volatile, `${name} must be volatile`).toBe(true)
    }
  })

  it('never touches the settings service (the 0.2.x API has no install entry point)', () => {
    const installSection = vi.fn()
    const { ctx } = stubContext({ settings: { installSection } })
    apply(ctx as never)
    expect(installSection).not.toHaveBeenCalled()
  })
})

describe('enhance route registration', () => {
  it('registers the prefix route and keeps its disposer in an effect', () => {
    const dispose = vi.fn()
    const register = vi.fn((_route: { kind: string; path: string }) => dispose)
    const { ctx, effects } = stubContext({ webServer: { register } })

    apply(ctx as never)

    expect(register).toHaveBeenCalledTimes(1)
    const [route] = register.mock.calls[0] ?? []
    expect(route).toMatchObject({ kind: 'prefix', path: '/prompt-enhance' })
    expect(effects).toHaveLength(1)
    effects[0]?.()
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('ignores a second mount on the same live context', () => {
    const register = vi.fn(() => vi.fn())
    const { ctx } = stubContext({ webServer: { register } })

    apply(ctx as never)
    apply(ctx as never)

    expect(register).toHaveBeenCalledTimes(1)
  })

  it('re-registers once the previous mount was disposed', () => {
    const register = vi.fn(() => vi.fn())
    const { ctx, effects } = stubContext({ webServer: { register } })

    apply(ctx as never)
    effects[0]?.()
    apply(ctx as never)

    expect(register).toHaveBeenCalledTimes(2)
  })

  it('is a silent no-op without a webserver', () => {
    const { ctx, effects } = stubContext()
    expect(() => apply(ctx as never)).not.toThrow()
    expect(effects).toHaveLength(0)
  })
})

describe('lib/index.js load-time surface', () => {
  it('no longer references the settings helpers removed from the harness', async () => {
    const { readFile } = await import('node:fs/promises')
    const { fileURLToPath } = await import('node:url')
    const path = fileURLToPath(new URL('../lib/index.js', import.meta.url))
    const source = await readFile(path, 'utf8')
    expect(source).not.toMatch(/installSettingsSection|settingsNamespace/)
  })
})
