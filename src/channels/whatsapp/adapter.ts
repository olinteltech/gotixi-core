import { MessageEnvelope } from '../types'

/**
 * Parse a raw Meta WhatsApp Cloud API webhook payload into MessageEnvelopes.
 * Handles standard text messages; ignores status updates and non-text events.
 */
export function normalizeWhatsApp(body: Record<string, unknown>): MessageEnvelope[] {
  const envelopes: MessageEnvelope[] = []

  const entry = body?.entry as Array<Record<string, unknown>> | undefined
  if (!entry) return envelopes

  for (const e of entry) {
    const changes = e?.changes as Array<Record<string, unknown>> | undefined
    if (!changes) continue

    for (const change of changes) {
      const value = change?.value as Record<string, unknown> | undefined
      if (!value) continue

      const messages = value?.messages as Array<Record<string, unknown>> | undefined
      if (!messages) continue

      for (const msg of messages) {
        if (msg.type !== 'text') continue

        const from = msg.from as string
        const textObj = msg.text as Record<string, string> | undefined
        const text = textObj?.body ?? ''

        if (!from || !text) continue

        envelopes.push({
          channel: 'whatsapp',
          externalId: from,
          text,
          metadata: {
            messageId: msg.id,
            timestamp: msg.timestamp,
            phoneNumberId: (value.metadata as Record<string, string> | undefined)?.phone_number_id,
          },
        })
      }
    }
  }

  return envelopes
}
