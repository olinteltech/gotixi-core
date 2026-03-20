import { FastifyInstance } from 'fastify'
import { normalizeInstagram } from '../../../channels/instagram/adapter'
import { sendInstagram } from '../../../channels/instagram/sender'
import { orchestrate } from '../../../brain/orchestrator'
import { resolveUser } from '../../../crm/identity'
import { saveMessage, getHistory } from '../../../crm/conversation'
import { formatForChannel } from '../../../channels/types'

export async function instagramWebhookRoutes(fastify: FastifyInstance) {
  // Webhook verification
  fastify.get('/webhooks/instagram', async (req, reply) => {
    const query = req.query as Record<string, string>
    const mode = query['hub.mode']
    const token = query['hub.verify_token']
    const challenge = query['hub.challenge']

    if (mode === 'subscribe' && token === process.env.IG_WEBHOOK_VERIFY_TOKEN) {
      fastify.log.info('Instagram webhook verified')
      return reply.status(200).send(challenge)
    }
    return reply.status(403).send({ error: 'Forbidden' })
  })

  // Inbound messages
  fastify.post('/webhooks/instagram', async (req, reply) => {
    const body = req.body as Record<string, unknown>

    reply.status(200).send({ status: 'ok' })

    try {
      const envelopes = normalizeInstagram(body)
      for (const envelope of envelopes) {
        const user = await resolveUser(envelope.channel, envelope.externalId, envelope.metadata)
        await saveMessage(user.id, envelope.channel, { role: 'user', content: envelope.text })
        const history = await getHistory(user.id, envelope.channel)
        const result = await orchestrate({ user, channel: envelope.channel, history })
        await saveMessage(user.id, envelope.channel, { role: 'assistant', content: result.reply })

        const formatted = formatForChannel(result.reply, 'instagram')
        await sendInstagram(envelope.externalId, formatted)
      }
    } catch (err) {
      fastify.log.error({ err }, 'Error processing Instagram webhook')
    }
  })
}
