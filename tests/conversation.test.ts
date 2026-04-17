import { newConversationId } from '../src/conversation'

describe('newConversationId', () => {
  test('returns string starting with conv_', () => {
    const id = newConversationId()
    expect(id).toMatch(/^conv_[0-9a-f]{12}$/)
  })

  test('generates unique IDs', () => {
    const ids = new Set(
      Array.from({ length: 100 }, () => newConversationId())
    )
    expect(ids.size).toBe(100)
  })
})
