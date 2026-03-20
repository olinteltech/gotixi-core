import { User, Prisma } from '@prisma/client'
import { prisma } from '../db/client'
import { enqueueHubSpotSync } from '../queue'

/**
 * Resolve (or create) a User from a channel + externalId pair.
 *
 * Logic:
 * 1. Find Identity by (channel, externalId) → return linked user
 * 2. If not found, check phone/email match on User → link new identity
 * 3. Else create new User + Identity
 */
export async function resolveUser(
  channel: string,
  externalId: string,
  metadata?: Record<string, unknown>
): Promise<User> {
  // 1. Existing identity
  const existing = await prisma.identity.findUnique({
    where: { channel_externalId: { channel, externalId } },
    include: { user: true },
  })
  if (existing) return existing.user

  // 2. Phone match from metadata
  const phone = metadata?.phone as string | undefined
  const email = metadata?.email as string | undefined

  let user: User | null = null

  if (phone) {
    user = await prisma.user.findUnique({ where: { phone } })
  }
  if (!user && email) {
    user = await prisma.user.findUnique({ where: { email } })
  }

  if (user) {
    // Link new identity to existing user
    await prisma.identity.create({
      data: {
        userId: user.id,
        channel,
        externalId,
        metadata: (metadata ?? {}) as Prisma.InputJsonValue,
      },
    })
    return user
  }

  // 3. Create new user + identity
  const newUser = await prisma.user.create({
    data: {
      phone: phone ?? null,
      email: email ?? null,
      identities: {
        create: {
          channel,
          externalId,
          metadata: (metadata ?? {}) as Prisma.InputJsonValue,
        },
      },
    },
  })

  await enqueueHubSpotSync({ event: 'USER_CREATED', userId: newUser.id })

  return newUser
}

/**
 * Merge secondaryId into primaryId.
 * Moves all identities, conversations, and trips to primary.
 * Sets mergedIntoId on secondary to flag as inactive.
 */
export async function mergeUsers(primaryId: string, secondaryId: string): Promise<void> {
  if (primaryId === secondaryId) return

  await prisma.$transaction(async (tx) => {
    await tx.identity.updateMany({ where: { userId: secondaryId }, data: { userId: primaryId } })
    await tx.conversation.updateMany({ where: { userId: secondaryId }, data: { userId: primaryId } })
    await tx.trip.updateMany({ where: { userId: secondaryId }, data: { userId: primaryId } })

    const secondary = await tx.user.findUnique({ where: { id: secondaryId } })
    const primary = await tx.user.findUnique({ where: { id: primaryId } })

    // Copy over missing fields from secondary to primary
    const updates: Partial<User> = {}
    if (!primary?.phone && secondary?.phone) updates.phone = secondary.phone
    if (!primary?.email && secondary?.email) updates.email = secondary.email
    if (!primary?.name && secondary?.name) updates.name = secondary.name

    if (Object.keys(updates).length > 0) {
      await tx.user.update({ where: { id: primaryId }, data: updates })
    }

    await tx.user.update({ where: { id: secondaryId }, data: { mergedIntoId: primaryId } })
  })

  await enqueueHubSpotSync({ event: 'USER_MERGED', primaryId, secondaryId })
}
