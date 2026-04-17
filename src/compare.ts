import { ComparisonResult } from './types'

const PRICING: Record<string, [number, number]> = {
  'openai/gpt-4o':           [0.0000025,  0.00001],
  'openai/gpt-4o-mini':      [0.00000015, 0.0000006],
  'openai/gpt-4-turbo':      [0.00001,    0.00003],
  'openai/gpt-3.5-turbo':    [0.0000005,  0.0000015],
  'openai/o1':               [0.000015,   0.00006],
  'openai/o1-mini':          [0.0000011,  0.0000044],
  'openai/o3-mini':          [0.0000011,  0.0000044],
  'anthropic/claude-3-5-sonnet-20241022': [0.000003,  0.000015],
  'anthropic/claude-3-haiku-20240307':    [0.00000025,0.00000125],
  'anthropic/claude-3-opus-20240229':     [0.000015,  0.000075],
}

export function compareCost(options: {
  inputTokens: number
  outputTokens: number
  providers?: string[]
  models?: string[]
}): ComparisonResult {
  const { inputTokens, outputTokens, providers, models } = options

  if (inputTokens < 0) throw new Error('inputTokens must be >= 0')
  if (outputTokens < 0) throw new Error('outputTokens must be >= 0')

  const costs: Record<string, number> = {}

  for (const [key, [inRate, outRate]] of Object.entries(PRICING)) {
    const [provider] = key.split('/')

    if (providers && !providers.includes(provider)) continue
    if (models && !models.includes(key)) continue

    costs[key] = inRate * inputTokens + outRate * outputTokens
  }

  return _buildResult(costs, inputTokens, outputTokens)
}

export function addCustomPricing(
  provider: string,
  model: string,
  inputCostPerToken: number,
  outputCostPerToken: number,
): void {
  PRICING[`${provider}/${model}`] = [
    inputCostPerToken,
    outputCostPerToken,
  ]
}

function _buildResult(
  costs: Record<string, number>,
  inputTokens: number,
  outputTokens: number,
): ComparisonResult {
  const entries = Object.entries(costs)
  const cheapest = entries.length
    ? entries.reduce((a, b) => a[1] < b[1] ? a : b)[0]
    : ''
  const mostExpensive = entries.length
    ? entries.reduce((a, b) => a[1] > b[1] ? a : b)[0]
    : ''

  const maxSavingsPct = cheapest && mostExpensive &&
    costs[mostExpensive] > 0
    ? ((costs[mostExpensive] - costs[cheapest]) /
       costs[mostExpensive]) * 100
    : 0

  return {
    costs,
    inputTokens,
    outputTokens,
    cheapest,
    mostExpensive,
    maxSavingsPct: Math.round(maxSavingsPct * 10) / 10,

    sortedByCost() {
      return Object.entries(this.costs)
        .sort((a, b) => a[1] - b[1])
    },

    savingsVs(current: string, compare: string) {
      const curr = this.costs[current]
      const comp = this.costs[compare]
      if (curr === undefined || comp === undefined) return null
      if (curr === 0) return 0
      return Math.round(((curr - comp) / curr) * 1000) / 10
    },

    formatTable() {
      const lines = [
        `Cost comparison (${inputTokens} input, ` +
        `${outputTokens} output tokens)`,
        '─'.repeat(55),
      ]
      for (const [model, cost] of this.sortedByCost()) {
        const marker = model === cheapest ? ' ← cheapest' : ''
        lines.push(
          `  ${model.padEnd(45)} $${cost.toFixed(6)}${marker}`
        )
      }
      lines.push('─'.repeat(55))
      lines.push(
        `  Max savings: ${maxSavingsPct.toFixed(1)}% ` +
        `(${mostExpensive} → ${cheapest})`
      )
      return lines.join('\n')
    }
  }
}
