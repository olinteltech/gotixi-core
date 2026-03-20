import { Booking } from '@prisma/client'
import { prisma } from '../db/client'
import { updateTripStatus } from './trips'
import { enqueueHubSpotSync } from '../queue'

export async function createBooking(
  tripId: string,
  type: 'flight' | 'hotel',
  details: {
    provider?: string
    price?: number
    status?: string
  }
): Promise<Booking> {
  const booking = await prisma.booking.create({
    data: {
      tripId,
      type,
      provider: details.provider ?? null,
      price: details.price ?? null,
      status: details.status ?? 'pending',
    },
  })
  return booking
}

export async function confirmBooking(bookingId: string): Promise<Booking> {
  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: 'confirmed' },
  })

  // Transition trip to booked
  const trip = await prisma.trip.findUnique({ where: { id: booking.tripId } })
  if (trip && trip.status !== 'booked') {
    await updateTripStatus(booking.tripId, 'booked')
  }

  await enqueueHubSpotSync({
    event: 'BOOKING_CONFIRMED',
    bookingId: booking.id,
    tripId: booking.tripId,
    userId: trip?.userId,
  })

  return booking
}
