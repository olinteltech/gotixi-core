import { Worker, Job } from 'bullmq'
import { HubSpotEvent } from '../index'
import { createContact, updateContact, mergeContacts } from '../../integrations/hubspot/contacts'
import { createDeal, updateDeal } from '../../integrations/hubspot/deals'

function getConnectionConfig() {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379'
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

async function processJob(job: Job): Promise<void> {
  const data = job.data as HubSpotEvent

  switch (data.event) {
    case 'USER_CREATED':
      await createContact(data.userId)
      break

    case 'USER_UPDATED':
      await updateContact(data.userId)
      break

    case 'USER_MERGED':
      await mergeContacts(data.primaryId, data.secondaryId)
      break

    case 'TRIP_CREATED':
      await createDeal(data.tripId, data.userId)
      break

    case 'TRIP_UPDATED':
      await updateDeal(data.tripId)
      break

    case 'BOOKING_CONFIRMED':
      await updateDeal(data.tripId)
      break

    default:
      console.warn('[HubSpotWorker] Unknown event:', (data as HubSpotEvent).event)
  }
}

export function startHubSpotWorker(): Worker {
  const worker = new Worker('hubspot-sync', processJob, {
    connection: getConnectionConfig(),
    concurrency: 3,
  })

  worker.on('completed', (job) => {
    console.log(`[HubSpotWorker] Job ${job.id} (${job.name}) completed`)
  })

  worker.on('failed', (job, err) => {
    console.error(`[HubSpotWorker] Job ${job?.id} failed:`, err.message)
  })

  return worker
}
