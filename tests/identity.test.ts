import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolveUser, mergeUsers } from '../src/crm/identity'
import { prisma } from '../src/db/client'

// These are integration tests — they hit a real PostgreSQL database.
// Run: DATABASE_URL=... npm test

describe('resolveUser', () => {
  const cleanup: string[] = []

  afterEach(async () => {
    if (cleanup.length > 0) {
      await prisma.identity.deleteMany({ where: { userId: { in: cleanup } } })
      await prisma.conversation.deleteMany({ where: { userId: { in: cleanup } } })
      await prisma.trip.deleteMany({ where: { userId: { in: cleanup } } })
      await prisma.user.deleteMany({ where: { id: { in: cleanup } } })
      cleanup.length = 0
    }
  })

  it('creates a new user+identity on first call', async () => {
    const user = await resolveUser('whatsapp', 'test-wa-001')
    cleanup.push(user.id)

    expect(user.id).toBeTruthy()

    const identity = await prisma.identity.findUnique({
      where: { channel_externalId: { channel: 'whatsapp', externalId: 'test-wa-001' } },
    })
    expect(identity?.userId).toBe(user.id)
  })

  it('returns the same user on repeated calls', async () => {
    const u1 = await resolveUser('whatsapp', 'test-wa-002')
    cleanup.push(u1.id)
    const u2 = await resolveUser('whatsapp', 'test-wa-002')

    expect(u1.id).toBe(u2.id)
  })

  it('links instagram identity to existing user with same phone', async () => {
    const phone = '+15550001234'
    const waUser = await resolveUser('whatsapp', 'test-wa-003', { phone })
    cleanup.push(waUser.id)

    const igUser = await resolveUser('instagram', 'test-ig-003', { phone })

    expect(igUser.id).toBe(waUser.id)
  })
})

describe('mergeUsers', () => {
  afterEach(async () => {
    await prisma.identity.deleteMany({ where: { externalId: { startsWith: 'merge-test-' } } })
    const users = await prisma.user.findMany({ where: { phone: { startsWith: '+1555999' } } })
    const ids = users.map((u) => u.id)
    if (ids.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: ids } } })
    }
  })

  it('moves identities and marks secondary as merged', async () => {
    const primary = await resolveUser('whatsapp', 'merge-test-primary', { phone: '+15559991001' })
    const secondary = await resolveUser('instagram', 'merge-test-secondary', { phone: '+15559991002' })

    await mergeUsers(primary.id, secondary.id)

    const sec = await prisma.user.findUnique({ where: { id: secondary.id } })
    expect(sec?.mergedIntoId).toBe(primary.id)

    const identities = await prisma.identity.findMany({ where: { userId: primary.id } })
    const channels = identities.map((i) => i.channel)
    expect(channels).toContain('whatsapp')
    expect(channels).toContain('instagram')
  })
})
