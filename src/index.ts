/**
 * Host half of the prompt-enhance plugin: the POST /prompt-enhance/enhance
 * route (LLM call through ctx.llm, route resolved by precedence: settings pair
 * → session request header → harness default model) and the /enhance slash
 * command. The browser half (exports "./client") contributes the composer
 * button, the preview panel, the undo bar, and the plugin's configuration page.
 *
 * Configuration lives in the `Config` schema this package exports: dsh 0.2.x
 * turns a plugin entry into a settings namespace from that schema, provided the
 * fields are marked volatile (see `src/config.ts`).
 * @module dsh-prompt-enhance
 */

import type { Context } from '@deepseek-ai/cordis'
import { DEFAULT_CONFIG, resolveConfig, type Config as PluginConfig } from './config'
import { registerEnhanceRoute } from './enhance-routes'
import { registerEnhanceCommand } from './enhance-command'

export const name = 'prompt-enhance'
export const inject = ['llm', 'webServer']

export { Config, DEFAULT_CONFIG, PROMPT_ENHANCE_NAMESPACE, resolveConfig } from './config'
export type { StrategyMode } from './config'
export { DEFAULT_SYSTEM_PROMPT, frameUserPrompt } from './prompts'
export { enhanceText, formatEnhanceError, resolveRoute, toEnhanceError } from './enhancer'
export type { EnhanceCallOptions, LlmStreamFace, RoutePair, UpstreamReason } from './enhancer'
export { normalizeOutput } from './shared/normalize'
export { checkInputText } from './shared/validate'
export { ENHANCE_ENDPOINT } from './shared/protocol'
export type { EnhanceError, EnhanceResult, EnhanceRequestBody, EnhanceResponse, EnhanceErrorCode } from './shared/protocol'

/**
 * Mount the host half.
 *
 * Besides the declared `inject` services (llm, webServer — both required),
 * the host half optionally reads three more through `ctx.get` with
 * `undefined` fallbacks, degrading gracefully when absent:
 * - `sessions` — the session's logged request route (model routing);
 * - `settings` — the harness default model (`agent-default-model`);
 * - `commands` — the `/enhance` slash command registration.
 * @param ctx - registrant context.
 * @param config - deployment configuration (schema defaults filled by the loader).
 */
export function apply(ctx: Context, config: PluginConfig = { ...DEFAULT_CONFIG }): void {
  // `config` is a live reference, not a snapshot: a settings write only touches
  // `Config` fields marked volatile, so the loader commits the new values into
  // this same object (`_commitVolatile`) instead of remounting the fiber.
  // Re-reading it per request is therefore what makes a saved change reach the
  // very next call. The pre-0.2 `settings.installSection` wiring this plugin
  // used for that purpose no longer exists in the harness, and nothing has to
  // replace it.
  const readConfig = (): PluginConfig => resolveConfig(config)
  registerEnhanceRoute(ctx, readConfig)
  registerEnhanceCommand(ctx, readConfig)
}
