import { generateText, generateObject, LanguageModelV1 } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'
import { ChatMessage } from '../crm/conversation'

export interface LLMConfig {
  provider: 'anthropic' | 'openai'
  model: string
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
}

function getModel(config: LLMConfig): LanguageModelV1 {
  if (config.provider === 'anthropic') {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    return anthropic(config.model)
  }
  if (config.provider === 'openai') {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
    return openai(config.model)
  }
  throw new Error(`Unknown LLM provider: ${config.provider}`)
}

export async function callLLM(
  messages: ChatMessage[],
  systemPrompt: string,
  config: LLMConfig = DEFAULT_LLM_CONFIG
): Promise<string> {
  const model = getModel(config)

  const { text } = await generateText({
    model,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    maxTokens: 1024,
  })

  return text
}

export async function callLLMStructured<T>(
  messages: ChatMessage[],
  systemPrompt: string,
  schema: z.ZodSchema<T>,
  config: LLMConfig = DEFAULT_LLM_CONFIG
): Promise<T> {
  const model = getModel(config)

  const { object } = await generateObject({
    model,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    schema,
    maxTokens: 2048,
  })

  return object
}
