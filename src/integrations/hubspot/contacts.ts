import axios from 'axios'
import { getHubSpotClient } from './client'
import { prisma } from '../../db/client'

export async function createContact(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return null
  if (user.hubspotContactId) return user.hubspotContactId

  const client = getHubSpotClient()

  const response = await client.crm.contacts.basicApi.create({
    properties: {
      ...(user.email && { email: user.email }),
      ...(user.name && {
        firstname: user.name.split(' ')[0],
        lastname: user.name.split(' ').slice(1).join(' ') || '',
      }),
      ...(user.phone && { phone: user.phone }),
      gotixi_user_id: userId,
    },
    associations: [],
  })

  const contactId = response.id

  await prisma.user.update({ where: { id: userId }, data: { hubspotContactId: contactId } })

  return contactId
}

export async function updateContact(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user?.hubspotContactId) return

  const client = getHubSpotClient()

  await client.crm.contacts.basicApi.update(user.hubspotContactId, {
    properties: {
      ...(user.email && { email: user.email }),
      ...(user.name && {
        firstname: user.name.split(' ')[0],
        lastname: user.name.split(' ').slice(1).join(' ') || '',
      }),
      ...(user.phone && { phone: user.phone }),
    },
  })
}

/**
 * Merge two HubSpot contacts via the REST API directly.
 * The JS SDK v11 doesn't expose a first-class mergeApi — use axios.
 */
export async function mergeContacts(primaryId: string, secondaryId: string): Promise<void> {
  const [primary, secondary] = await Promise.all([
    prisma.user.findUnique({ where: { id: primaryId } }),
    prisma.user.findUnique({ where: { id: secondaryId } }),
  ])

  if (!primary?.hubspotContactId || !secondary?.hubspotContactId) return

  const token = process.env.HUBSPOT_ACCESS_TOKEN
  if (!token) return

  await axios.post(
    `https://api.hubapi.com/crm/v3/objects/contacts/merge`,
    {
      primaryObjectId: primary.hubspotContactId,
      objectIdToMerge: secondary.hubspotContactId,
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  )
}
