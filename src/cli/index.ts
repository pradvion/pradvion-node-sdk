#!/usr/bin/env node

import { instrument } from './instrument'

const args = process.argv.slice(2)

if (args.includes('--version') || args.includes('-v')) {
  const { SDK_VERSION } = require('../version')
  console.log(`pradvion-instrument ${SDK_VERSION}`)
  process.exit(0)
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Pradvion Auto-Instrument

Usage:
  pradvion-instrument [target] [options]

Arguments:
  target        Directory or file to instrument (default: .)

Options:
  --dry-run     Preview changes without modifying files
  --undo        Remove existing Pradvion instrumentation
  --quiet, -q   Suppress output
  --version, -v Show version
  --help, -h    Show help
  `)
  process.exit(0)
}

const dryRun = args.includes('--dry-run')
const undo = args.includes('--undo')
const quiet = args.includes('--quiet') || args.includes('-q')
const target = args.find(
  a => !a.startsWith('-')
) ?? '.'

instrument({ target, dryRun, undo, quiet })
