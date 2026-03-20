import { z } from 'zod'
import { callLLMStructured, LLMConfig } from '../llm'
import { ChatMessage } from '../../crm/conversation'

const LLM_CONFIG: LLMConfig = { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' }

export const ItinerarySchema = z.object({
  destination: z.string(),
  totalDays: z.number().int().positive(),
  estimatedBudgetUSD: z.number().optional(),
  days: z.array(
    z.object({
      day: z.number().int().positive(),
      title: z.string(),
      activities: z.array(
        z.object({
          time: z.string(), // e.g. "09:00"
          description: z.string(),
          type: z.enum(['transport', 'accommodation', 'food', 'sightseeing', 'activity', 'other']),
          estimatedCostUSD: z.number().optional(),
        })
      ),
    })
  ),
})

export type Itinerary = z.infer<typeof ItinerarySchema>

const SYSTEM_PROMPT = `You are a world-class travel planner. Generate detailed, realistic itineraries.
For each day include: a catchy title, timed activities with type and estimated USD cost.
Be specific about places, neighborhoods, and logistics. Keep it achievable — don't pack too much.
Return ONLY valid JSON matching the schema. No commentary.`

export async function runItinerarySkill(history: ChatMessage[]): Promise<Itinerary> {
  return callLLMStructured(history, SYSTEM_PROMPT, ItinerarySchema, LLM_CONFIG)
}
