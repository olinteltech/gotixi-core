import 'dotenv/config'
import Fastify from 'fastify'
import { healthRoutes } from './routes/health'
import { chatRoutes } from './routes/chat'
import { whatsappWebhookRoutes } from './routes/webhooks/whatsapp'
import { instagramWebhookRoutes } from './routes/webhooks/instagram'

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
  genReqId: () => crypto.randomUUID(),
})

// Add request ID to response headers
fastify.addHook('onSend', async (req, reply) => {
  reply.header('x-request-id', req.id)
})

// Routes
fastify.register(healthRoutes)
fastify.register(chatRoutes)
fastify.register(whatsappWebhookRoutes)
fastify.register(instagramWebhookRoutes)

const start = async () => {
  try {
    const port = Number(process.env.PORT ?? 3000)
    await fastify.listen({ port, host: '0.0.0.0' })
    fastify.log.info(`GoTixi COS running on port ${port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()

export { fastify }
