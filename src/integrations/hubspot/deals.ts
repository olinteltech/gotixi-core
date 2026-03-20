import axios from 'axios'
import { getHubSpotClient } from './client'
import { prisma } from '../../db/client'

const DEAL_STAGE_MAP: Record<string, string> = {
  planning: 'appointmentscheduled',
  priced: 'qualifiedtobuy',
  booked: 'closedwon',
}

export async function createDeal(tripId: string, userId: string): Promise<string | null> {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } })
  if (!trip) return null
  if (trip.hubspotDealId) return trip.hubspotDealId

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user?.hubspotContactId) return null

  const client = getHubSpotClient()

  const response = await client.crm.deals.basicApi.create({
    properties: {
      dealname: `${trip.destination} Trip — ${user.name ?? userId}`,
      dealstage: DEAL_STAGE_MAP[trip.status] ?? 'appointmentscheduled',
      pipeline: 'default',
      ...(trip.budget && { amount: String(trip.budget) }),
      ...(trip.startDate && { closedate: trip.startDate.toISOString() }),
      gotixi_trip_id: tripId,
    },
    associations: [],
  })

  const dealId = response.id

  // Associate deal → contact via REST (SDK association types vary by version)
  const token = process.env.HUBSPOT_ACCESS_TOKEN
  if (token) {
    await axios
      .put(
        `https://api.hubapi.com/crm/v3/objects/deals/${dealId}/associations/contacts/${user.hubspotContactId}/deal_to_contact`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      .catch((err) => console.warn('[HubSpot] Could not associate deal to contact:', err.message))
  }

  await prisma.trip.update({ where: { id: tripId }, data: { hubspotDealId: dealId } })

  return dealId
}

export async function updateDeal(tripId: string): Promise<void> {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } })
  if (!trip?.hubspotDealId) return

  const client = getHubSpotClient()

  await client.crm.deals.basicApi.update(trip.hubspotDealId, {
    properties: {
      dealstage: DEAL_STAGE_MAP[trip.status] ?? 'appointmentscheduled',
      ...(trip.budget && { amount: String(trip.budget) }),
    },
  })
}
