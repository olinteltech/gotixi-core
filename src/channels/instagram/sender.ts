import axios from 'axios'

const BASE_URL = 'https://graph.facebook.com/v20.0'

export async function sendInstagram(recipientId: string, text: string): Promise<void> {
  const token = process.env.IG_PAGE_ACCESS_TOKEN

  if (!token) {
    console.warn('[Instagram] Missing IG_PAGE_ACCESS_TOKEN — skipping send')
    return
  }

  await axios.post(
    `${BASE_URL}/me/messages`,
    {
      recipient: { id: recipientId },
      message: { text },
      messaging_type: 'RESPONSE',
    },
    {
      params: { access_token: token },
      headers: { 'Content-Type': 'application/json' },
    }
  )
}
