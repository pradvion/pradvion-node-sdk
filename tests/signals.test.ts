import { createSignalPayload } from '../src/signals'

describe('createSignalPayload', () => {

  test('creates valid payload', () => {
    const p = createSignalPayload({
      customerId: 'samsung',
      event: 'email_sent',
      quantity: 5,
      value: 0.25,
    })
    expect(p.type).toBe('signal')
    expect(p.event).toBe('email_sent')
    expect(p.quantity).toBe(5)
    expect(p.value).toBe(0.25)
    expect(p.customer_id_hash).toBeDefined()
    expect(p.signal_id).toBeDefined()
    expect(p.timestamp).toBeDefined()
  })

  test('normalizes event name', () => {
    const p = createSignalPayload({
      customerId: 'x',
      event: '  Email_Sent  ',
    })
    expect(p.event).toBe('email_sent')
  })

  test('hashes customer id', () => {
    const p = createSignalPayload({
      customerId: 'test_customer',
      event: 'test_event',
    })
    expect(p.customer_id_hash).toHaveLength(64)
    expect(p.customer_id_hash).toMatch(/^[0-9a-f]+$/)
  })

  test('throws on empty event', () => {
    expect(() => createSignalPayload({
      customerId: 'x',
      event: '',
    })).toThrow('event name cannot be empty')
  })

  test('throws on negative quantity', () => {
    expect(() => createSignalPayload({
      customerId: 'x',
      event: 'test',
      quantity: -1,
    })).toThrow('quantity must be >= 0')
  })

  test('throws on negative value', () => {
    expect(() => createSignalPayload({
      customerId: 'x',
      event: 'test',
      value: -1,
    })).toThrow('value must be >= 0')
  })

  test('throws on invalid event chars', () => {
    expect(() => createSignalPayload({
      customerId: 'x',
      event: 'Email Sent',
    })).toThrow()
  })

  test('defaults quantity to 1', () => {
    const p = createSignalPayload({
      customerId: 'x',
      event: 'test_event',
    })
    expect(p.quantity).toBe(1)
  })

  test('includes metadata when provided', () => {
    const p = createSignalPayload({
      customerId: 'x',
      event: 'test_event',
      metadata: { type: 'monthly' },
    })
    expect(p.metadata).toEqual({ type: 'monthly' })
  })

  test('generates unique signal_ids', () => {
    const p1 = createSignalPayload({ customerId: 'x', event: 'a' })
    const p2 = createSignalPayload({ customerId: 'x', event: 'a' })
    expect(p1.signal_id).not.toBe(p2.signal_id)
  })
})
