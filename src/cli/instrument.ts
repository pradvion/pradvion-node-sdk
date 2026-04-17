import * as fs from 'fs'
import * as path from 'path'

const SKIP_DIRS = new Set([
  '.git', 'node_modules', '.next', 'dist', 'build',
  '.cache', 'coverage', '.turbo', '.vercel',
  'tests', 'test', '__tests__',
])

const SKIP_FILES = new Set([
  'jest.config.js', 'jest.config.ts',
  'jest.setup.js', 'jest.setup.ts',
  'webpack.config.js', 'next.config.js',
  'next.config.ts', 'vite.config.ts',
  'vite.config.js',
])

const JS_EXTENSIONS = new Set([
  '.js', '.ts', '.mjs', '.mts', '.cjs', '.cts',
])

const OPENAI_PATTERNS = [
  /from ['"]openai['"]/,
  /require\(['"]openai['"]\)/,
  /new OpenAI\(/,
  /new AsyncOpenAI\(/,
]

const ANTHROPIC_PATTERNS = [
  /from ['"]@anthropic-ai\/sdk['"]/,
  /require\(['"]@anthropic-ai\/sdk['"]\)/,
  /new Anthropic\(/,
]

const ALREADY_INSTRUMENTED = /pradvion\.monitor\s*\(/
const ALREADY_INIT = /pradvion\.init\s*\(/

export function shouldSkipFile(filePath: string): boolean {
  const name = path.basename(filePath)
  if (SKIP_FILES.has(name)) return true
  if (!JS_EXTENSIONS.has(path.extname(filePath))) return true
  return false
}

export function shouldSkipDir(dirName: string): boolean {
  return SKIP_DIRS.has(dirName)
}

export function findFiles(root: string): string[] {
  const files: string[] = []

  if (fs.statSync(root).isFile()) {
    if (!shouldSkipFile(root)) files.push(root)
    return files
  }

  function walk(dir: string): void {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue

      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        if (!shouldSkipDir(entry.name)) {
          walk(fullPath)
        }
      } else if (entry.isFile()) {
        if (!shouldSkipFile(fullPath)) {
          files.push(fullPath)
        }
      }
    }
  }

  walk(root)
  return files
}

export interface Detection {
  hasOpenAI: boolean
  hasAnthropic: boolean
  alreadyInstrumented: boolean
  alreadyInit: boolean
  openAIVars: string[]
  anthropicVars: string[]
}

export function detectAIUsage(content: string): Detection {
  const hasOpenAI = OPENAI_PATTERNS.some(p => p.test(content))
  const hasAnthropic = ANTHROPIC_PATTERNS.some(p => p.test(content))
  const alreadyInstrumented = ALREADY_INSTRUMENTED.test(content)
  const alreadyInit = ALREADY_INIT.test(content)

  const openAIVars = [
    ...content.matchAll(/(\w+)\s*=\s*new\s+(?:Async)?OpenAI\s*\(/g)
  ].map(m => m[1])

  const anthropicVars = [
    ...content.matchAll(/(\w+)\s*=\s*new\s+Anthropic\s*\(/g)
  ].map(m => m[1])

  return {
    hasOpenAI,
    hasAnthropic,
    alreadyInstrumented,
    alreadyInit,
    openAIVars: [...new Set(openAIVars)],
    anthropicVars: [...new Set(anthropicVars)],
  }
}

export function generatePatch(
  content: string,
  detection: Detection,
  isTypeScript: boolean,
): string | null {
  if (detection.alreadyInstrumented) return null
  if (!detection.hasOpenAI && !detection.hasAnthropic) return null

  let patched = content

  if (!patched.includes('pradvion-node')) {
    const importLine = isTypeScript
      ? `import pradvion from 'pradvion-node'\n`
      : `const pradvion = require('pradvion-node')\n`

    const lastImportMatch = [
      ...patched.matchAll(/^(?:import|const\s+\w+\s*=\s*require)[^\n]+\n/gm)
    ]
    if (lastImportMatch.length > 0) {
      const last = lastImportMatch[lastImportMatch.length - 1]
      const pos = last.index! + last[0].length
      patched = patched.slice(0, pos) + importLine + patched.slice(pos)
    } else {
      patched = importLine + patched
    }
  }

  if (!detection.alreadyInit) {
    const initBlock = [
      '',
      '// Pradvion: AI cost tracking',
      '// Get your API key at https://pradvion.com',
      `pradvion.init({ apiKey: process.env.PRADVION_API_KEY ?? '' })`,
      '',
    ].join('\n')

    const funcMatch = patched.match(
      /\n((?:async\s+)?function|class|const\s+\w+\s*=\s*(?:async\s+)?\(|module\.exports)/
    )
    if (funcMatch?.index !== undefined) {
      patched =
        patched.slice(0, funcMatch.index) +
        initBlock +
        patched.slice(funcMatch.index)
    } else {
      patched += initBlock
    }
  }

  for (const varName of detection.openAIVars) {
    const pattern = new RegExp(
      `(${escapeRegex(varName)}\\s*=\\s*)` +
      `(new\\s+(?:Async)?OpenAI\\s*\\([^)]*\\))`,
      'g'
    )
    patched = patched.replace(
      pattern,
      `$1pradvion.monitor($2)`
    )
  }

  for (const varName of detection.anthropicVars) {
    const pattern = new RegExp(
      `(${escapeRegex(varName)}\\s*=\\s*)` +
      `(new\\s+Anthropic\\s*\\([^)]*\\))`,
      'g'
    )
    patched = patched.replace(
      pattern,
      `$1pradvion.monitor($2)`
    )
  }

  return patched === content ? null : patched
}

export function undoInstrumentation(
  content: string
): string | null {
  if (!content.includes('pradvion')) return null

  let result = content
    .replace(/import pradvion from 'pradvion-node'\n/g, '')
    .replace(/const pradvion = require\('pradvion-node'\)\n/g, '')
    .replace(/\n\/\/ Pradvion: AI cost tracking\n/g, '')
    .replace(/\n\/\/ Get your API key at https:\/\/pradvion\.com\n/g, '')
    .replace(/\npradvion\.init\([^)]*\)\n/g, '\n')
    .replace(/pradvion\.monitor\((\w+\s*=\s*new\s+[^)]+\))\)/g, '$1')

  return result === content ? null : result
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export interface InstrumentResult {
  filesFound: number
  filesChanged: number
  filesSkipped: number
  changes: string[]
}

export function instrument(options: {
  target?: string
  dryRun?: boolean
  undo?: boolean
  quiet?: boolean
}): InstrumentResult {
  const {
    target = '.',
    dryRun = false,
    undo = false,
    quiet = false,
  } = options

  if (!fs.existsSync(target)) {
    if (!quiet) console.log(`Error: path not found: ${target}`)
    return {
      filesFound: 0, filesChanged: 0,
      filesSkipped: 0, changes: []
    }
  }

  const files = findFiles(target)

  if (files.length === 0) {
    if (!quiet) console.log('No JavaScript/TypeScript files found.')
    return {
      filesFound: 0, filesChanged: 0,
      filesSkipped: 0, changes: []
    }
  }

  if (!quiet) {
    const mode = dryRun ? ' (dry run)' : ''
    const action = undo ? 'Undoing' : 'Instrumenting'
    console.log(`\nPradvion Auto-Instrument${mode}`)
    console.log(`${action} ${files.length} file(s) in ${path.resolve(target)}`)
  }

  let filesChanged = 0
  let filesSkipped = 0
  const changes: string[] = []

  for (const filePath of files) {
    let content: string
    try {
      content = fs.readFileSync(filePath, 'utf-8')
    } catch {
      filesSkipped++
      continue
    }

    const isTypeScript = ['.ts', '.mts', '.cts'].includes(
      path.extname(filePath)
    )

    let patched: string | null

    if (undo) {
      patched = undoInstrumentation(content)
    } else {
      const detection = detectAIUsage(content)
      if (detection.alreadyInstrumented) {
        if (!quiet) {
          console.log(`  Already instrumented: ${path.basename(filePath)}`)
        }
        filesSkipped++
        continue
      }
      patched = generatePatch(content, detection, isTypeScript)
    }

    if (patched === null) {
      filesSkipped++
      continue
    }

    if (!quiet) {
      showDiff(content, patched, filePath)
    }

    if (!dryRun) {
      fs.writeFileSync(filePath, patched, 'utf-8')
    }

    filesChanged++
    changes.push(filePath)
  }

  if (!quiet) {
    console.log('\n' + '─'.repeat(60))
    if (dryRun) {
      console.log(`  Dry run: ${filesChanged} file(s) would be changed.`)
      console.log('  Run without --dry-run to apply.')
    } else if (undo) {
      console.log(`  Removed instrumentation from ${filesChanged} file(s).`)
    } else {
      console.log(`  Instrumented ${filesChanged} file(s).`)
      if (filesChanged > 0) {
        console.log(
          '\n  Next: set your API key:\n' +
          '  export PRADVION_API_KEY=nx_live_...\n\n' +
          '  Get yours at https://pradvion.com'
        )
      }
    }
    console.log('─'.repeat(60) + '\n')
  }

  return { filesFound: files.length, filesChanged, filesSkipped, changes }
}

function showDiff(
  original: string,
  patched: string,
  filePath: string,
): void {
  const origLines = original.split('\n')
  const patchLines = patched.split('\n')
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${filePath}`)
  console.log('─'.repeat(60))

  const maxLines = Math.max(origLines.length, patchLines.length)
  let shown = 0
  for (let i = 0; i < maxLines && shown < 20; i++) {
    const o = origLines[i] ?? ''
    const p = patchLines[i] ?? ''
    if (o !== p) {
      if (o) console.log(`\x1b[31m- ${o}\x1b[0m`)
      if (p) console.log(`\x1b[32m+ ${p}\x1b[0m`)
      shown++
    }
  }
}
