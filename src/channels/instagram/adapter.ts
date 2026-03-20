import { MessageEnvelope } from '../types'

/**
 * Parse a raw Instagram Graph API webhook payload into MessageEnvelopes.
 */
export function normalizeInstagram(body: Record<string, unknown>): MessageEnvelope[] {
  const envelopes: MessageEnvelope[] = []

  const entry = body?.entry as Array<Record<string, unknown>> | undefined
  if (!entry) return envelopes

  for (const e of entry) {
    const messaging = e?.messaging as Array<Record<string, unknown>> | undefined
    if (!messaging) continue

    for (const event of messaging) {
      const message = event?.message as Record<string, unknown> | undefined
      if (!message || message.is_echo) continue

      const senderId = (event.sender as Record<string, string> | undefined)?.id
      const text = message.text as string | undefined

      if (!senderId || !text) continue

      envelopes.push({
        channel: 'instagram',
        externalId: senderId,
        text,
        metadata: {
          messageId: message.mid,
          timestamp: event.timestamp,
        },
      })
    }
  }

  return envelopes
}
