import { MessageEnvelope } from '../types'

export function normalizeWeb(body: { sessionId: string; text: string }): MessageEnvelope {
  return {
    channel: 'web',
    externalId: body.sessionId,
    text: body.text,
  }
}
