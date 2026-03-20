import { FastifyInstance } from 'fastify'
import { normalizeWhatsApp } from '../../../channels/whatsapp/adapter'
import { sendWhatsApp } from '../../../channels/whatsapp/sender'
import { orchestrate } from '../../../brain/orchestrator'
import { resolveUser } from '../../../crm/identity'
import { saveMessage, getHistory } from '../../../crm/conversation'
import { formatForChannel } from '../../../channels/types'

export async function whatsappWebhookRoutes(fastify: FastifyInstance) {
  // Webhook verification
  fastify.get('/webhooks/whatsapp', async (req, reply) => {
    const query = req.query as Record<string, string>
    const mode = query['hub.mode']
    const token = query['hub.verify_token']
    const challenge = query['hub.challenge']

    if (mode === 'subscribe' && token === process.env.WA_WEBHOOK_VERIFY_TOKEN) {
      fastify.log.info('WhatsApp webhook verified')
      return reply.status(200).send(challenge)
    }
    return reply.status(403).send({ error: 'Forbidden' })
  })

  // Inbound messages
  fastify.post('/webhooks/whatsapp', async (req, reply) => {
    const body = req.body as Record<string, unknown>

    // Acknowledge immediately (Meta requires <5s response)
    reply.status(200).send({ status: 'ok' })

    try {
      const envelopes = normalizeWhatsApp(body)
      for (const envelope of envelopes) {
        const user = await resolveUser(envelope.channel, envelope.externalId, envelope.metadata)
        await saveMessage(user.id, envelope.channel, { role: 'user', content: envelope.text })
        const history = await getHistory(user.id, envelope.channel)
        const result = await orchestrate({ user, channel: envelope.channel, history })
        await saveMessage(user.id, envelope.channel, { role: 'assistant', content: result.reply })

        const formatted = formatForChannel(result.reply, 'whatsapp')
        await sendWhatsApp(envelope.externalId, formatted)
      }
    } catch (err) {
      fastify.log.error({ err }, 'Error processing WhatsApp webhook')
    }
  })
}
