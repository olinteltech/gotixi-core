import { Client } from '@hubspot/api-client'

let _client: Client | null = null

export function getHubSpotClient(): Client {
  if (!_client) {
    const token = process.env.HUBSPOT_ACCESS_TOKEN
    if (!token) throw new Error('HUBSPOT_ACCESS_TOKEN is not set')
    _client = new Client({ accessToken: token })
  }
  return _client
}
