import * as crypto from 'crypto'

export function newConversationId(): string {
  const hex = crypto.randomBytes(6).toString('hex')
  return `conv_${hex}`
}
