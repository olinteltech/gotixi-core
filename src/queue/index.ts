import { Queue } from 'bullmq'

export type HubSpotEvent =
  | { event: 'USER_CREATED'; userId: string }
  | { event: 'USER_UPDATED'; userId: string }
  | { event: 'USER_MERGED'; primaryId: string; secondaryId: string }
  | { event: 'TRIP_CREATED'; tripId: string; userId: string }
  | { event: 'TRIP_UPDATED'; tripId: string; userId: string }
  | { event: 'BOOKING_CONFIRMED'; bookingId: string; tripId: string; userId?: string }

// BullMQ bundles its own ioredis — pass the URL directly via connection config
function getConnectionConfig() {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379'
  // Parse host/port from URL for BullMQ's connection object
  try {
    const parsed = new URL(url)
    return {
      host: parsed.hostname,
      port: Number(parsed.port) || 6379,
      password: parsed.password || undefined,
    }
  } catch {
    return { host: 'localhost', port: 6379 }
  }
}

let _queue: Queue | null = null

export function getHubSpotQueue(): Queue {
  if (!_queue) {
    _queue = new Queue('hubspot-sync', {
      connection: getConnectionConfig(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    })
  }
  return _queue
}

export async function enqueueHubSpotSync(data: HubSpotEvent): Promise<void> {
  try {
    const queue = getHubSpotQueue()
    await queue.add(data.event, data)
  } catch (err) {
    // Queue failures should never crash the main request
    console.error('[Queue] Failed to enqueue HubSpot sync:', err)
  }
}
