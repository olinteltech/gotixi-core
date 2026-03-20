import { describe, it, expect } from 'vitest'
import { normalizeWhatsApp } from '../src/channels/whatsapp/adapter'
import { normalizeInstagram } from '../src/channels/instagram/adapter'
import { formatForChannel } from '../src/channels/types'

describe('normalizeWhatsApp', () => {
  it('extracts text message from valid WA webhook payload', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: '15551234567',
                    type: 'text',
                    id: 'msg-001',
                    timestamp: '1700000000',
                    text: { body: 'I want to visit Bali' },
                  },
                ],
                metadata: { phone_number_id: 'pn-001' },
              },
            },
          ],
        },
      ],
    }
    const envelopes = normalizeWhatsApp(payload)
    expect(envelopes).toHaveLength(1)
    expect(envelopes[0].externalId).toBe('15551234567')
    expect(envelopes[0].text).toBe('I want to visit Bali')
    expect(envelopes[0].channel).toBe('whatsapp')
  })

  it('ignores non-text message types', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  { from: '15551234567', type: 'image', id: 'msg-002', timestamp: '1700000001' },
                ],
              },
            },
          ],
        },
      ],
    }
    expect(normalizeWhatsApp(payload)).toHaveLength(0)
  })

  it('returns empty array for missing entry', () => {
    expect(normalizeWhatsApp({})).toHaveLength(0)
  })
})

describe('normalizeInstagram', () => {
  it('extracts DM from IG webhook payload', () => {
    const payload = {
      entry: [
        {
          messaging: [
            {
              sender: { id: 'ig-user-001' },
              message: { mid: 'mid-001', text: 'Hi, tell me about Tokyo' },
              timestamp: 1700000000,
            },
          ],
        },
      ],
    }
    const envelopes = normalizeInstagram(payload)
    expect(envelopes).toHaveLength(1)
    expect(envelopes[0].externalId).toBe('ig-user-001')
    expect(envelopes[0].text).toBe('Hi, tell me about Tokyo')
    expect(envelopes[0].channel).toBe('instagram')
  })

  it('ignores echo messages', () => {
    const payload = {
      entry: [
        {
          messaging: [
            {
              sender: { id: 'ig-user-001' },
              message: { mid: 'mid-002', text: 'echo', is_echo: true },
              timestamp: 1700000001,
            },
          ],
        },
      ],
    }
    expect(normalizeInstagram(payload)).toHaveLength(0)
  })
})

describe('formatForChannel', () => {
  it('strips markdown for whatsapp', () => {
    const text = '**Bold** and *italic* and `code`'
    expect(formatForChannel(text, 'whatsapp')).toBe('Bold and italic and code')
  })

  it('truncates to 5 lines for whatsapp', () => {
    const text = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`).join('\n')
    const result = formatForChannel(text, 'whatsapp')
    const lines = result.split('\n')
    expect(lines[5]).toBe('...')
  })

  it('passes through text unchanged for web', () => {
    const text = '**Bold** heading\n\nParagraph'
    expect(formatForChannel(text, 'web')).toBe(text)
  })
})
