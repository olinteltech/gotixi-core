import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { orchestrate } from '../../brain/orchestrator'
import { resolveUser } from '../../crm/identity'
import { saveMessage, getHistory } from '../../crm/conversation'

const ChatBodySchema = z.object({
  channel: z.enum(['whatsapp', 'instagram', 'web']),
  externalId: z.string().min(1),
  message: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
})

export type ChatBody = z.infer<typeof ChatBodySchema>

export async function chatRoutes(fastify: FastifyInstance) {
  fastify.post('/chat', async (req, reply) => {
    const parsed = ChatBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() })
    }

    const { channel, externalId, message, metadata } = parsed.data

    try {
      // 1. Resolve (or create) the user
      const user = await resolveUser(channel, externalId, metadata)

      // 2. Save inbound message
      await saveMessage(user.id, channel, { role: 'user', content: message })

      // 3. Load conversation history
      const history = await getHistory(user.id, channel)

      // 4. Orchestrate: intent → skill → LLM
      const result = await orchestrate({ user, channel, history })

      // 5. Save assistant reply
      await saveMessage(user.id, channel, { role: 'assistant', content: result.reply })

      return reply.status(200).send({
        userId: user.id,
        reply: result.reply,
        skill: result.skill,
        data: result.data ?? null,
      })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error' })
    }
  })
}
