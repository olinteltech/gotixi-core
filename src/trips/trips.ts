import { Trip, Prisma } from '@prisma/client'
import { prisma } from '../db/client'
import { enqueueHubSpotSync } from '../queue'

export async function createTrip(
  userId: string,
  destination: string,
  startDate?: Date,
  endDate?: Date,
  budget?: number
): Promise<Trip> {
  const trip = await prisma.trip.create({
    data: {
      userId,
      destination,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      budget: budget ?? null,
      status: 'planning',
    },
  })

  await enqueueHubSpotSync({ event: 'TRIP_CREATED', tripId: trip.id, userId })

  return trip
}

export async function updateTripStatus(
  tripId: string,
  status: 'planning' | 'priced' | 'booked'
): Promise<Trip> {
  const trip = await prisma.trip.update({
    where: { id: tripId },
    data: { status },
  })

  await enqueueHubSpotSync({ event: 'TRIP_UPDATED', tripId: trip.id, userId: trip.userId })

  return trip
}

export async function saveItineraryVersion(
  tripId: string,
  data: Record<string, unknown>
): Promise<void> {
  const latest = await prisma.itineraryVersion.findFirst({
    where: { tripId },
    orderBy: { version: 'desc' },
  })
  const nextVersion = (latest?.version ?? 0) + 1

  await prisma.itineraryVersion.create({
    data: { tripId, version: nextVersion, data: data as Prisma.InputJsonValue },
  })
}
