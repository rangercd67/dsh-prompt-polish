// @vitest-environment jsdom
/**
 * The configuration page's contract, which the boot suite cannot reach: that
 * one only applies against a context providing NOTHING. Here the context does
 * provide the two services the page rides, so the registration itself is
 * asserted — the row key the Plugins panel dispatches, the locale binding, the
 * injected store/actions, and the rendered controls.
 *
 * The harness primitives are stubbed with marker elements instead of the real
 * bundle (which drags the whole client platform and its CSS modules into the
 * test graph); what matters is how this plugin drives them. Rendering goes
 * through React, because that is where the component's hooks run.
 * @module tests/client-settings-page
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { render } from '@testing-library/react'
import { apply } from '../src/client/index'
import { SETTINGS_FIELDS } from '../src/client/settings-copy'
import { ROW_KEY, SETTINGS_NAMESPACE } from '../src/client/SettingsCard'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => {
  const { createElement: h } = await import('react')
  return {
    SettingsForm: (props: Record<string, unknown>) => h(
      'div',
      { 'data-kind': 'form', 'data-labels': JSON.stringify(props.labels), 'data-state': JSON.stringify(props.state) },
      props.children as never,
    ),
    SettingsValueField: (props: Record<string, unknown>) => h('input', {
      'data-kind': 'value',
      'data-id': props.id,
      'data-label': props.label,
      'data-hint': props.hint,
      'data-numeric': String(props.numeric ?? false),
      readOnly: true,
    }),
    Checkbox: (props: Record<string, unknown>) => h('input', {
      type: 'checkbox',
      'data-kind': 'checkbox',
      'data-label': props.label,
      checked: Boolean(props.checked),
      readOnly: true,
    }),
    SettingsFormModel: class {
      shell() {
        return { available: true, writable: true, dirty: false, invalid: false, saving: false, failed: false }
      }
      field() {
        return { text: '', overridden: false, invalid: false }
      }
      actions() {
        return { edit: vi.fn(), resetField: vi.fn(), save: vi.fn(), discard: vi.fn() }
      }
      dispose() {}
    },
    settingsNumberField: (field: string) => ({ field, format: () => '', parse: () => undefined }),
    settingsTextField: (field: string) => ({ field, format: () => '', parse: () => undefined }),
  }
})

/** A context that DOES provide the page's two services. */
function pageContext() {
  const registrations: Array<{ slot: string; value: unknown }> = []
  const scopesAsked: string[] = []
  const ctx = {
    effect(execute: () => unknown): () => void {
      execute()
      return () => {}
    },
    inject(deps: string[], callback: (ctx: unknown) => void): void {
      if (!deps.includes('configForms') || !deps.includes('slots')) return
      callback({
        configForms: {
          get: (ns: string) => {
            scopesAsked.push(ns)
            return {
              getSnapshot: () => ({ status: 'ready', value: { enabled: true }, writable: true }),
              subscribe: () => () => {},
              mutate: async () => true,
            }
          },
        },
        slots: {
          inject: (slot: string, register: () => unknown) => {
            registrations.push({ slot, value: register() })
            return () => {}
          },
          register: (options: unknown, Component: unknown) => ({ options, Component }),
        },
      })
    },
  }
  return { ctx, registrations, scopesAsked }
}

type PageRegistration = {
  Component: (props: Record<string, unknown>) => ReactNode
  options: { key: string; locale: string; inject: () => Record<string, unknown> }
}

let page: ReturnType<typeof pageContext>
let registration: PageRegistration

beforeEach(() => {
  page = pageContext()
  apply(page.ctx as never)
  registration = page.registrations.find((entry) => entry.slot === 'plugins.row.config')?.value as PageRegistration
})

describe('client configuration page', () => {
  it('edits the plugin entry namespace', () => {
    expect(page.scopesAsked).toContain(SETTINGS_NAMESPACE)
  })

  it('registers a page for its own row key', () => {
    expect(registration).toBeDefined()
    // The panel dispatches `<bundle package>#<row id>`; getting either half
    // wrong means the row never grows a configure control.
    expect(registration.options.key).toBe(ROW_KEY)
    expect(ROW_KEY).toBe('dsh-prompt-enhance#prompt-enhance')
    expect(registration.options.locale).toBe('prompt-enhance')
  })

  it('injects the staged store and the form actions', () => {
    const injected = registration.options.inject()
    expect(typeof injected.store).toBe('object')
    for (const action of ['save', 'discard', 'edit', 'resetField']) {
      expect(typeof injected[action], action).toBe('function')
    }
  })

  it('renders every schema field with localized copy', () => {
    const seen: string[] = []
    const { container } = render(createElement(registration.Component, {
      t: (key: string) => {
        seen.push(key)
        return key
      },
      view: 'page',
      ...registration.options.inject(),
    }) as never)

    expect(container.querySelectorAll('[data-kind="form"]')).toHaveLength(1)
    const values = container.querySelectorAll('[data-kind="value"]')
    const checkboxes = container.querySelectorAll('[data-kind="checkbox"]')
    expect(checkboxes).toHaveLength(3)
    expect(values).toHaveLength(SETTINGS_FIELDS.length - 3)

    // Every field contributes a label + hint lookup, and the chrome is asked for too.
    for (const field of SETTINGS_FIELDS) {
      expect(seen).toContain(`settings.field.${field.key}.label`)
      expect(seen).toContain(`settings.field.${field.key}.hint`)
    }
    expect(seen).toContain('settings.save')
    expect(seen).toContain('settings.unavailable')

    // The value controls carry the copy through, and numbers hint a numeric keypad.
    const numeric = [...values].filter((node) => node.getAttribute('data-numeric') === 'true')
    expect(numeric.length).toBe(SETTINGS_FIELDS.filter((field) => field.kind === 'number').length)
  })

  it('answers the panel summary view with one line', () => {
    const { container } = render(createElement(registration.Component, {
      t: (key: string) => key,
      view: 'summary',
      ...registration.options.inject(),
    }) as never)
    expect(container.textContent).toBe('settings.summary')
    expect(container.querySelectorAll('[data-kind="form"]')).toHaveLength(0)
  })
})
