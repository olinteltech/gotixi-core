export type Channel = 'whatsapp' | 'instagram' | 'web'

export interface MessageEnvelope {
  channel: Channel
  externalId: string   // sender's platform user ID
  text: string
  metadata?: Record<string, unknown>
}

export interface ChannelResponse {
  text: string
  channel: Channel
}

/**
 * Transform a brain reply into a channel-safe string.
 * WhatsApp / Instagram: plain text, max 5 lines, strip markdown.
 */
export function formatForChannel(text: string, channel: Channel): string {
  if (channel === 'web') return text

  // Strip markdown bold/italic/headers
  let out = text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`{1,3}([\s\S]*?)`{1,3}/g, '$1')

  // Collapse to max 5 non-empty lines
  const lines = out.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length > 5) {
    out = lines.slice(0, 5).join('\n') + '\n...'
  } else {
    out = lines.join('\n')
  }

  return out.trim()
}
