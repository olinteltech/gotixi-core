import { FastifyInstance } from 'fastify'
import { prisma } from '../../db/client'

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      return reply.status(200).send({ status: 'ok', db: 'connected', ts: new Date().toISOString() })
    } catch {
      return reply.status(503).send({ status: 'error', db: 'disconnected', ts: new Date().toISOString() })
    }
  })
}
