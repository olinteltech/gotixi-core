import axios from 'axios'

const BASE_URL = 'https://graph.facebook.com/v20.0'

export async function sendWhatsApp(to: string, text: string): Promise<void> {
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID
  const token = process.env.WA_ACCESS_TOKEN

  if (!phoneNumberId || !token) {
    console.warn('[WhatsApp] Missing WA_PHONE_NUMBER_ID or WA_ACCESS_TOKEN — skipping send')
    return
  }

  await axios.post(
    `${BASE_URL}/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )
}
