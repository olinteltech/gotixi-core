import { User } from '@prisma/client'
import { Channel } from '../channels/types'
import { ChatMessage } from '../crm/conversation'
import { loadPersona } from './personas'
import { callLLM, DEFAULT_LLM_CONFIG } from './llm'
import { runItinerarySkill, Itinerary } from './skills/itinerary'
import { runLeadCaptureSkill, LeadData } from './skills/lead-capture'
import { runPointsOptimizerSkill } from './skills/points-optimizer'
import { createTrip, saveItineraryVersion } from '../trips/trips'

export type SkillName = 'itinerary' | 'lead_capture' | 'points' | 'general'

export interface OrchestratorInput {
  user: User
  channel: Channel
  history: ChatMessage[]
}

export interface OrchestratorResult {
  reply: string
  skill: SkillName
  data?: Itinerary | LeadData | string
}

const INTENT_SYSTEM_PROMPT = `You are an intent classifier for a travel concierge chatbot.
Classify the user's latest message into exactly one of these intents:
- "itinerary": user wants a trip plan, itinerary, or day-by-day schedule
- "lead_capture": user is sharing contact info or preferences that should be saved
- "points": user asks about miles, points, rewards, or credit card optimization
- "general": anything else (greeting, question, follow-up)

Respond with ONLY the intent string, nothing else.`

async function detectIntent(history: ChatMessage[]): Promise<SkillName> {
  const intent = await callLLM(history, INTENT_SYSTEM_PROMPT, {
    provider: 'openai',
    model: 'gpt-4o-mini',
  })
  const trimmed = intent.trim().toLowerCase() as SkillName
  const valid: SkillName[] = ['itinerary', 'lead_capture', 'points', 'general']
  return valid.includes(trimmed) ? trimmed : 'general'
}

function hasLeadData(user: User): boolean {
  return !!(user.name && (user.email || user.phone))
}

export async function orchestrate(input: OrchestratorInput): Promise<OrchestratorResult> {
  const { user, channel, history } = input
  const persona = loadPersona(channel)

  // Build system prompt — mix in lead capture modifier if user data is incomplete
  let systemPrompt = persona.systemPrompt
  if (!hasLeadData(user)) {
    systemPrompt += persona.leadCaptureModifier
  }

  // Detect intent from the latest exchange
  const skill = await detectIntent(history)

  switch (skill) {
    case 'itinerary': {
      const itinerary = await runItinerarySkill(history)

      // Auto-create a Trip record
      const trip = await createTrip(
        user.id,
        itinerary.destination,
        undefined,
        undefined,
        itinerary.estimatedBudgetUSD
      )
      await saveItineraryVersion(trip.id, itinerary)

      // Generate a conversational reply using the persona
      const summaryPrompt = `${systemPrompt}

The itinerary has been generated. Summarize it warmly in 3-5 lines for the user.
Destination: ${itinerary.destination}, ${itinerary.totalDays} days.
Day 1 highlights: ${itinerary.days[0]?.activities.map((a) => a.description).join(', ') ?? 'TBD'}`

      const reply = await callLLM(history, summaryPrompt, DEFAULT_LLM_CONFIG)
      return { reply, skill: 'itinerary', data: itinerary }
    }

    case 'lead_capture': {
      const lead = await runLeadCaptureSkill(user.id, history)
      const reply = await callLLM(history, systemPrompt, DEFAULT_LLM_CONFIG)
      return { reply, skill: 'lead_capture', data: lead }
    }

    case 'points': {
      const reply = await runPointsOptimizerSkill(history)
      return { reply, skill: 'points', data: reply }
    }

    default: {
      const reply = await callLLM(history, systemPrompt, DEFAULT_LLM_CONFIG)
      return { reply, skill: 'general' }
    }
  }
}
