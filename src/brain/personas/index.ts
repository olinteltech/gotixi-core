import { Channel } from '../../channels/types'
import { whatsappPersona } from './whatsapp'
import { instagramPersona } from './instagram'
import { webPersona } from './web'

export interface Persona {
  systemPrompt: string
  leadCaptureModifier: string
}

export function loadPersona(channel: Channel): Persona {
  switch (channel) {
    case 'whatsapp':
      return whatsappPersona
    case 'instagram':
      return instagramPersona
    case 'web':
      return webPersona
    default:
      return webPersona
  }
}
