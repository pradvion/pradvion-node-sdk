import * as crypto from 'crypto'
import { SignalPayload, SignalOptions } from './types'

export function createSignalPayload(
  options: SignalOptions
): SignalPayload {
  const {
    customerId,
    event,
    quantity = 1,
    value,
    project,
    feature,
    team,
    environment,
    metadata,
  } = options

  if (!event || event.trim() === '') {
    throw new Error('event name cannot be empty')
  }
  if (quantity < 0) {
    throw new Error('quantity must be >= 0')
  }
  if (value !== undefined && value < 0) {
    throw new Error('value must be >= 0')
  }

  const normalizedEvent = event.trim().toLowerCase()

  if (!/^[a-z0-9_]+$/.test(normalizedEvent)) {
    throw new Error(
      'event must contain only lowercase letters, ' +
      'digits, and underscores'
    )
  }

  const payload: SignalPayload = {
    type: 'signal',
    signal_id: crypto.randomUUID(),
    event: normalizedEvent,
    quantity,
    timestamp: new Date().toISOString(),
  }

  if (customerId) {
    payload.customer_id_hash = crypto
      .createHash('sha256')
      .update(String(customerId))
      .digest('hex')
  }
  if (value !== undefined) payload.value = value
  if (project) payload.project = project
  if (feature) payload.feature = feature
  if (team) payload.team = team
  if (environment) payload.environment = environment
  if (metadata && Object.keys(metadata).length > 0) {
    payload.metadata = metadata
  }

  return payload
}
