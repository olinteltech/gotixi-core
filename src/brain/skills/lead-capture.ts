import { z } from 'zod'
import { callLLMStructured, LLMConfig } from '../llm'
import { ChatMessage } from '../../crm/conversation'
import { prisma } from '../../db/client'
import { enqueueHubSpotSync } from '../../queue'

const LLM_CONFIG: LLMConfig = { provider: 'openai', model: 'gpt-4o-mini' }

const LeadSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  destination: z.string().optional(),
  travelDates: z.string().optional(),
  groupSize: z.number().int().positive().optional(),
  budgetUSD: z.number().optional(),
  preferences: z.array(z.string()).optional(),
})

export type LeadData = z.infer<typeof LeadSchema>

const SYSTEM_PROMPT = `Extract structured lead information from this conversation.
Return only fields that are clearly stated by the user — do NOT infer or guess.
If a field is not mentioned, omit it from the response.`

export async function runLeadCaptureSkill(
  userId: string,
  history: ChatMessage[]
): Promise<LeadData> {
  const lead = await callLLMStructured(history, SYSTEM_PROMPT, LeadSchema, LLM_CONFIG)

  // Upsert user with any newly extracted data
  const updates: Record<string, unknown> = {}
  if (lead.name) updates.name = lead.name
  if (lead.email) updates.email = lead.email
  if (lead.phone) updates.phone = lead.phone

  if (Object.keys(updates).length > 0) {
    await prisma.user.update({ where: { id: userId }, data: updates }).catch(() => {
      // Ignore unique constraint errors (email/phone already taken by merged user)
    })
    await enqueueHubSpotSync({ event: 'USER_UPDATED', userId })
  }

  return lead
}
