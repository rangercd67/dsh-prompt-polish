/**
 * The plugin's own configuration page on the dsh Plugins panel.
 *
 * A bundle's row gets a page only while something registers one: the panel
 * draws the row's configure control from its `plugins.row.config` ledger, and
 * the page lives as long as the row that registered the key (`ui-plugin-manager`
 * README, "配置页"). Registering it here — inside the bundle that declares the
 * row — is the documented shape for a bundle's own configuration, and it keeps
 * `prompt-enhance` self-contained: no companion package to install.
 *
 * The controls are the harness' shared settings machinery. `SettingsFormModel`
 * stages edits over the `prompt-enhance` namespace and writes them in one
 * revision-fenced save, so this page never touches the document itself and
 * gets conflict detection, the override/reset semantics, and the
 * unavailable/read-only states for free. Reading the mirrored value live is
 * what makes {@link import('./settings').setClientSettings} follow a save.
 * @module dsh-prompt-polish/client/SettingsCard
 */

import { useSyncExternalStore, type ReactNode } from 'react'
import {
  Checkbox,
  SettingsForm,
  SettingsFormModel,
  SettingsValueField,
  settingsNumberField,
  settingsTextField,
  type SettingsFieldSpec,
  type SettingsFieldState,
  type SettingsFormActions,
  type SettingsFormScope,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { SETTINGS_FIELDS, type SettingsField } from './settings-copy'
import type { TranslateNS } from '@deepseek-ai/dsh-client-locale/client'

/** Settings namespace (and Loader row id) this page edits. */
export const SETTINGS_NAMESPACE = 'prompt-enhance'

/** The dictionary key type of this bundle's locale namespace. */
type LocaleKey = Parameters<TranslateNS<'prompt-enhance'>>[0]

/**
 * Package name this client bundle was built under, injected by
 * `scripts/build.mjs` (`define`). The fallback keeps the source runnable
 * without the define — a test runner, or any consumer importing the module
 * directly — and matches the checked-in manifest.
 */
declare const __PROMPT_ENHANCE_PACKAGE_NAME__: string
const PACKAGE_NAME = typeof __PROMPT_ENHANCE_PACKAGE_NAME__ === 'string'
  ? __PROMPT_ENHANCE_PACKAGE_NAME__
  : 'dsh-prompt-polish'

/**
 * `plugins.row.config` key of the row this page configures: the bundle whose
 * patch declares the row, then the row id (`ui-plugin-manager` builds it the
 * same way). The row id is the settings namespace and stays `prompt-enhance`
 * across renames; the package half comes from the build.
 */
export const ROW_KEY = `${PACKAGE_NAME}#prompt-enhance`

/** The namespace section as it crosses the wire: only the schema keys matter here. */
export type SettingsSection = Record<string, unknown>

/** Words a boolean field accepts, so a typed draft is never silently rewritten. */
const TRUE_WORDS = ['true', '1', 'on', 'yes']
/** @see TRUE_WORDS */
const FALSE_WORDS = ['false', '0', 'off', 'no']

/**
 * The staged-edit conversion of one field. Numbers and free text use the shared
 * helpers; booleans and the strategy enum add the strict parsers the helpers do
 * not cover, so an unusable draft blocks the save instead of being coerced.
 * @param entry - one field entry.
 * @returns the spec `SettingsFormModel` stages edits through.
 */
function specFor(entry: SettingsField): SettingsFieldSpec {
  if (entry.kind === 'number') return settingsNumberField(entry.key)
  if (entry.kind === 'text') return settingsTextField(entry.key)
  if (entry.kind === 'boolean') {
    return {
      field: entry.key,
      format: (value) => (typeof value === 'boolean' ? String(value) : ''),
      parse: (text) => {
        const word = text.trim().toLowerCase()
        if (word === '') return { kind: 'clear' }
        if (TRUE_WORDS.includes(word)) return { kind: 'set', value: true }
        if (FALSE_WORDS.includes(word)) return { kind: 'set', value: false }
        return undefined
      },
    }
  }
  const values = entry.values ?? []
  return {
    field: entry.key,
    format: (value) => (typeof value === 'string' ? value : ''),
    parse: (text) => {
      const trimmed = text.trim()
      if (trimmed === '') return { kind: 'clear' }
      return values.includes(trimmed) ? { kind: 'set', value: trimmed } : undefined
    },
  }
}

/** The staged-edit specs, in render order. */
const SPECS: SettingsFieldSpec[] = SETTINGS_FIELDS.map(specFor)

/** Everything the card renders from: the shared shell plus one entry per field. */
export type SettingsCardSnapshot = Record<string, unknown>

/**
 * The card's staged form over the `prompt-enhance` namespace, published as a
 * plain `useSyncExternalStore` source.
 *
 * The model owns staging, validation, and the write; this class only turns its
 * reads into a cached snapshot, because a snapshot store must hand out the same
 * object until something actually changes.
 */
export class SettingsCardModel {
  private readonly form: SettingsFormModel<SettingsSection>
  private readonly listeners = new Set<() => void>()
  private readonly unsubscribe: () => void
  private snapshot: SettingsCardSnapshot

  /** @param scope - the shared configuration form of the `prompt-enhance` entry. */
  constructor(scope: SettingsFormScope<SettingsSection>) {
    this.form = new SettingsFormModel<SettingsSection>(scope, SPECS)
    this.snapshot = this.projection()
    this.unsubscribe = scope.subscribe(() => {
      this.snapshot = this.projection()
      for (const listener of this.listeners) listener()
    })
  }

  /** Build the card's state from the form's current reads. */
  private projection(): SettingsCardSnapshot {
    const state: SettingsCardSnapshot = { ...this.form.shell() }
    for (const entry of SETTINGS_FIELDS) state[entry.key] = this.form.field(entry.key)
    return state
  }

  /** Subscribe to snapshot replacements (the `useSyncExternalStore` source). */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** The current snapshot (stable until something changes). */
  readonly getSnapshot = (): SettingsCardSnapshot => this.snapshot

  /** The stage/save/discard actions the slot registration injects. */
  actions(): SettingsFormActions {
    return this.form.actions()
  }

  /** Release the scope subscription and the model. */
  dispose(): void {
    this.unsubscribe()
    this.form.dispose()
  }
}

/** Inline style of the per-field reset control a checkbox row draws itself. */
const RESET_STYLE = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  color: 'var(--dsw-alias-label-secondary)',
  cursor: 'pointer',
  textDecoration: 'underline',
} as const

/** Inline style of a checkbox row's hint line. */
const HINT_STYLE = {
  margin: '2px 0 0',
  fontSize: 12,
  lineHeight: '18px',
  color: 'var(--dsw-alias-label-tertiary)',
} as const

/** One row's props. */
interface FieldRowProps {
  entry: SettingsField
  state: SettingsFieldState
  disabled: boolean
  label: string
  hint: string
  overriddenLabel: string
  resetLabel: string
  invalidLabel: string
  onEdit: (text: string) => void
  onReset: () => void
}

/**
 * Render one field: the shared value control for text, number, and enum fields,
 * a labelled checkbox for booleans.
 * @param props - the field entry, its staged state, its copy, and the edit actions.
 * @returns the control row.
 */
function FieldRow(props: FieldRowProps): ReactNode {
  const { entry, state } = props
  if (entry.kind === 'boolean') {
    return (
      <div style={{ padding: '6px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Checkbox
            checked={state.text === 'true'}
            disabled={props.disabled}
            label={props.label}
            onChange={(next) => props.onEdit(next ? 'true' : 'false')}
          />
          {state.overridden
            ? (
                <button type="button" disabled={props.disabled} onClick={props.onReset} style={RESET_STYLE}>
                  {props.resetLabel}
                </button>
              )
            : null}
        </div>
        <p style={HINT_STYLE}>{props.hint}</p>
      </div>
    )
  }
  return (
    <div style={{ padding: '6px 0' }}>
      <SettingsValueField
        id={`prompt-enhance-${entry.key}`}
        label={props.label}
        hint={props.hint}
        numeric={entry.kind === 'number'}
        disabled={props.disabled}
        overriddenLabel={props.overriddenLabel}
        resetLabel={props.resetLabel}
        invalidLabel={props.invalidLabel}
        text={state.text}
        overridden={state.overridden}
        invalid={state.invalid}
        onEdit={props.onEdit}
        onReset={props.onReset}
      />
    </div>
  )
}

/** Props the panel owns, plus the store and actions this bundle injects. */
export interface SettingsCardProps extends SettingsFormActions {
  /** The bundle's locale reader, bound to its dictionary namespace. */
  t: TranslateNS<'prompt-enhance'>
  /** Which view the panel asks for; `page` draws the form. */
  view?: 'page' | 'summary'
  /** The staged form the registration injects. */
  store: SettingsCardModel
}

/**
 * Render the configuration page, or its one-liner where the panel asks for a
 * summary.
 * @param props - the view asked for, the locale reader, and the injected store and actions.
 * @returns the summary line or the settings form.
 */
export function SettingsCard(props: SettingsCardProps): ReactNode {
  const { t, view } = props
  const snapshot = useSyncExternalStore(props.store.subscribe, props.store.getSnapshot)
  if (view === 'summary') return t('settings.summary')
  const state = snapshot as {
    available: boolean
    writable: boolean
    dirty: boolean
    invalid: boolean
    saving: boolean
    failed: boolean
  }
  const disabled = !state.writable
  return (
    <SettingsForm
      labels={{
        unavailable: t('settings.unavailable'),
        readOnly: t('settings.readOnly'),
        saveFailed: t('settings.saveFailed'),
        save: t('settings.save'),
        saving: t('settings.saving'),
      }}
      state={state}
      onSave={props.save}
      onDiscard={props.discard}
    >
      {SETTINGS_FIELDS.map((entry) => (
        <FieldRow
          key={entry.key}
          entry={entry}
          state={snapshot[entry.key] as SettingsFieldState}
          disabled={disabled}
          // Both copy keys are generated from SETTINGS_FIELDS in
          // settings-copy.ts, so every field has them; the cast only bridges the
          // template literal's widened `string` to the dictionary's key union.
          label={t(`settings.field.${entry.key}.label` as LocaleKey)}
          hint={t(`settings.field.${entry.key}.hint` as LocaleKey)}
          overriddenLabel={t('settings.overridden')}
          resetLabel={t('settings.reset')}
          invalidLabel={t('settings.invalid')}
          onEdit={(text) => props.edit(entry.key, text)}
          onReset={() => props.resetField(entry.key)}
        />
      ))}
    </SettingsForm>
  )
}

/** The state fields every `SettingsForm` needs from a snapshot. */
export interface SettingsShellState {
  available: boolean
  writable: boolean
  dirty: boolean
  invalid: boolean
  saving: boolean
  failed: boolean
}
