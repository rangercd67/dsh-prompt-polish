/**
 * Field list and copy for the plugin's configuration page.
 *
 * The keys live in the plugin's own locale namespace (`NS`), prefixed with
 * `settings.` so they cannot collide with the composer copy. Keeping the field
 * order here means the page renders the schema in a deliberate order instead of
 * whatever key order the schema happens to have.
 * @module dsh-prompt-polish/client/settings-copy
 */

/** How one field is staged and rendered. */
export type SettingsFieldKind = 'boolean' | 'number' | 'text' | 'enum'

/** One configurable field of the host `Config` schema. */
export interface SettingsField {
  /** Key inside the `prompt-enhance` settings namespace. */
  key: string
  /** Control and conversion kind. */
  kind: SettingsFieldKind
  /** Accepted literals for an `enum` field. */
  values?: readonly string[]
}

/** Every field the page edits, in render order. */
export const SETTINGS_FIELDS: readonly SettingsField[] = [
  { key: 'enabled', kind: 'boolean' },
  { key: 'provider', kind: 'text' },
  { key: 'model', kind: 'text' },
  { key: 'temperature', kind: 'number' },
  { key: 'strategyMode', kind: 'enum', values: ['replace-default', 'extend-default'] },
  { key: 'systemPrompt', kind: 'text' },
  { key: 'shortcut', kind: 'text' },
  { key: 'maxOutputTokens', kind: 'number' },
  { key: 'maxInputChars', kind: 'number' },
  { key: 'timeoutMs', kind: 'number' },
  { key: 'maxConcurrent', kind: 'number' },
  { key: 'rateLimitPerMinute', kind: 'number' },
  { key: 'streaming', kind: 'boolean' },
  { key: 'contextAware', kind: 'boolean' },
  { key: 'contextMaxMessages', kind: 'number' },
  { key: 'contextMaxChars', kind: 'number' },
]

/** Chinese page copy. */
export const settingsZh = {
  'settings.summary': '配置 Prompt 增强：总开关、模型路由、采样参数、上下文窗口与快捷键。',
  'settings.unavailable': '宿主没有把 prompt-enhance 暴露为可配置命名空间，这里暂时无法编辑；请改用 profile 的 cordis.patch.yml。',
  'settings.readOnly': '本部署的设置为只读。',
  'settings.saveFailed': '宿主没有接受这些值，已保留供你修改。',
  'settings.save': '保存',
  'settings.saving': '保存中…',
  'settings.overridden': '已覆盖',
  'settings.reset': '恢复默认',
  'settings.invalid': '值不合法，请修正；留空表示恢复默认。',
  'settings.field.enabled.label': '总开关',
  'settings.field.enabled.hint': '关闭后隐藏输入框上的增强按钮，并停用全部触发方式。',
  'settings.field.provider.label': '模型 provider 覆盖',
  'settings.field.provider.hint': '与「模型」必须成对填写；两者都留空时跟随当前会话模型。',
  'settings.field.model.label': '模型 model 覆盖',
  'settings.field.model.hint': '与「模型 provider」必须成对填写；两者都留空时跟随当前会话模型。',
  'settings.field.temperature.label': '采样温度',
  'settings.field.temperature.hint': '0–1；低温改写更忠实原意。默认 0.3。',
  'settings.field.strategyMode.label': '自定义提示词的组合方式',
  'settings.field.strategyMode.hint': 'replace-default（整体替换内置策略，默认）或 extend-default（追加在内置策略之后，硬性约束继续生效）。',
  'settings.field.systemPrompt.label': '系统提示词',
  'settings.field.systemPrompt.hint': '留空使用内置的精简增强策略。',
  'settings.field.shortcut.label': '触发快捷键',
  'settings.field.shortcut.hint': '例如 ctrl+alt+e；留空禁用快捷键。',
  'settings.field.maxOutputTokens.label': '输出 token 上限',
  'settings.field.maxOutputTokens.hint': '256–32768。默认 6000；它约束单次调用的成本。',
  'settings.field.maxInputChars.label': '输入字数上限',
  'settings.field.maxInputChars.hint': '200–200000。默认 12000；超限拒绝而不截断，避免改变原意。',
  'settings.field.timeoutMs.label': '单次超时（毫秒）',
  'settings.field.timeoutMs.hint': '5000–600000。默认 60000。',
  'settings.field.maxConcurrent.label': '并发上限',
  'settings.field.maxConcurrent.hint': '1–16。默认 2；超出的请求返回 429。',
  'settings.field.rateLimitPerMinute.label': '每分钟次数上限',
  'settings.field.rateLimitPerMinute.hint': '1–600。默认 10；滑动窗口，超出返回 429。',
  'settings.field.streaming.label': '增量展示',
  'settings.field.streaming.hint': '模型边写边在面板显示；仅影响显示节奏，最终结果不变。',
  'settings.field.contextAware.label': '上下文感知',
  'settings.field.contextAware.hint': '读取当前会话近期对话，用于消解指代、补全省略；无历史时自动回退。',
  'settings.field.contextMaxMessages.label': '上下文窗口（条数）',
  'settings.field.contextMaxMessages.hint': '0–50。默认 8；0 表示不参考历史。',
  'settings.field.contextMaxChars.label': '上下文字数预算',
  'settings.field.contextMaxChars.hint': '0–100000。默认 4000；0 表示不参考历史。',
}

/** English page copy (same key set). */
export const settingsEn: typeof settingsZh = {
  'settings.summary': 'Configure Prompt Enhance: master switch, model route, sampling, context window, and shortcut.',
  'settings.unavailable': 'The Host does not expose prompt-enhance as a configurable namespace, so it cannot be edited here; use the profile\'s cordis.patch.yml instead.',
  'settings.readOnly': 'This deployment stores settings read-only.',
  'settings.saveFailed': 'The deployment did not accept these values; they were left for you to correct.',
  'settings.save': 'Save',
  'settings.saving': 'Saving…',
  'settings.overridden': 'Overridden',
  'settings.reset': 'Reset to default',
  'settings.invalid': 'Invalid value — correct it, or leave the field blank to use the default.',
  'settings.field.enabled.label': 'Master switch',
  'settings.field.enabled.hint': 'Off hides the composer\'s enhance button and disables every trigger.',
  'settings.field.provider.label': 'Model provider override',
  'settings.field.provider.hint': 'Must be paired with Model; leave both blank to follow the current session\'s model.',
  'settings.field.model.label': 'Model override',
  'settings.field.model.hint': 'Must be paired with Model provider; leave both blank to follow the current session\'s model.',
  'settings.field.temperature.label': 'Temperature',
  'settings.field.temperature.hint': '0–1; lower stays closer to the original. Default 0.3.',
  'settings.field.strategyMode.label': 'Custom prompt composition',
  'settings.field.strategyMode.hint': 'replace-default (swap the built-in strategy out, default) or extend-default (append after it, keeping its rules).',
  'settings.field.systemPrompt.label': 'System prompt',
  'settings.field.systemPrompt.hint': 'Blank uses the built-in concise enhancement strategy.',
  'settings.field.shortcut.label': 'Shortcut',
  'settings.field.shortcut.hint': 'For example ctrl+alt+e; blank disables the shortcut.',
  'settings.field.maxOutputTokens.label': 'Max output tokens',
  'settings.field.maxOutputTokens.hint': '256–32768. Default 6000; it bounds one call\'s cost.',
  'settings.field.maxInputChars.label': 'Max input characters',
  'settings.field.maxInputChars.hint': '200–200000. Default 12000; over-length drafts are refused, never truncated.',
  'settings.field.timeoutMs.label': 'Timeout (ms)',
  'settings.field.timeoutMs.hint': '5000–600000. Default 60000.',
  'settings.field.maxConcurrent.label': 'Concurrency cap',
  'settings.field.maxConcurrent.hint': '1–16. Default 2; excess requests answer 429.',
  'settings.field.rateLimitPerMinute.label': 'Rate cap per minute',
  'settings.field.rateLimitPerMinute.hint': '1–600. Default 10; a sliding window, excess answers 429.',
  'settings.field.streaming.label': 'Stream the preview',
  'settings.field.streaming.hint': 'Show the rewrite as it is written; display only — the applied text is unchanged.',
  'settings.field.contextAware.label': 'Context aware',
  'settings.field.contextAware.hint': 'Ground the rewrite in the session\'s recent turns; falls back when there is no history.',
  'settings.field.contextMaxMessages.label': 'Context window (messages)',
  'settings.field.contextMaxMessages.hint': '0–50. Default 8; 0 admits no history.',
  'settings.field.contextMaxChars.label': 'Context budget (characters)',
  'settings.field.contextMaxChars.hint': '0–100000. Default 4000; 0 admits no history.',
}
