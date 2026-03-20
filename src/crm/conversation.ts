import { Prisma } from '@prisma/client'
import { prisma } from '../db/client'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  ts?: string
}

const HISTORY_LIMIT = 20 // Keep last 20 messages per conversation

export async function saveMessage(
  userId: string,
  channel: string,
  message: Omit<ChatMessage, 'ts'>
): Promise<void> {
  const conv = await prisma.conversation.findFirst({
    where: { userId, channel },
    orderBy: { createdAt: 'desc' },
  })

  const newMessage: ChatMessage = { ...message, ts: new Date().toISOString() }

  if (!conv) {
    await prisma.conversation.create({
      data: { userId, channel, messages: [newMessage] as unknown as Prisma.InputJsonValue },
    })
    return
  }

  const messages = (conv.messages as unknown as ChatMessage[]).slice(-(HISTORY_LIMIT - 1))
  messages.push(newMessage)

  await prisma.conversation.update({
    where: { id: conv.id },
    data: { messages: messages as unknown as Prisma.InputJsonValue },
  })
}

export async function getHistory(userId: string, channel: string): Promise<ChatMessage[]> {
  const conv = await prisma.conversation.findFirst({
    where: { userId, channel },
    orderBy: { createdAt: 'desc' },
  })
  if (!conv) return []
  return (conv.messages as unknown as ChatMessage[]).slice(-HISTORY_LIMIT)
}
