import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  detectAIUsage,
  generatePatch,
  undoInstrumentation,
  shouldSkipFile,
  instrument,
} from '../src/cli/instrument'

describe('detectAIUsage', () => {
  test('detects OpenAI import', () => {
    const r = detectAIUsage(`import OpenAI from 'openai'\nconst client = new OpenAI()`)
    expect(r.hasOpenAI).toBe(true)
    expect(r.openAIVars).toContain('client')
  })

  test('detects Anthropic import', () => {
    const r = detectAIUsage(`import Anthropic from '@anthropic-ai/sdk'\nconst a = new Anthropic()`)
    expect(r.hasAnthropic).toBe(true)
  })

  test('detects already instrumented', () => {
    const r = detectAIUsage(`const c = pradvion.monitor(new OpenAI())`)
    expect(r.alreadyInstrumented).toBe(true)
  })

  test('no AI usage', () => {
    const r = detectAIUsage(`console.log('hello')`)
    expect(r.hasOpenAI).toBe(false)
    expect(r.hasAnthropic).toBe(false)
  })
})

describe('generatePatch', () => {
  test('adds pradvion import and monitor wrapper', () => {
    const content = `import OpenAI from 'openai'\nconst client = new OpenAI()\n`
    const detection = detectAIUsage(content)
    const patched = generatePatch(content, detection, true)
    expect(patched).toContain('pradvion')
    expect(patched).toContain('pradvion.monitor(')
  })

  test('returns null if already instrumented', () => {
    const content = `const c = pradvion.monitor(new OpenAI())\n`
    const detection = detectAIUsage(content)
    const patched = generatePatch(content, detection, true)
    expect(patched).toBeNull()
  })

  test('returns null if no AI usage', () => {
    const content = `console.log('hello')\n`
    const detection = detectAIUsage(content)
    const patched = generatePatch(content, detection, false)
    expect(patched).toBeNull()
  })
})

describe('shouldSkipFile', () => {
  test('skips non JS/TS files', () => {
    expect(shouldSkipFile('README.md')).toBe(true)
    expect(shouldSkipFile('style.css')).toBe(true)
  })

  test('allows JS/TS files', () => {
    expect(shouldSkipFile('app.ts')).toBe(false)
    expect(shouldSkipFile('server.js')).toBe(false)
  })

  test('skips config files', () => {
    expect(shouldSkipFile('jest.config.ts')).toBe(true)
    expect(shouldSkipFile('next.config.js')).toBe(true)
  })
})

describe('instrument', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'pradvion-cli-test-')
    )
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('dry run makes no changes', () => {
    const file = path.join(tmpDir, 'app.ts')
    fs.writeFileSync(
      file,
      `import OpenAI from 'openai'\nconst client = new OpenAI()\n`
    )
    const result = instrument({ target: tmpDir, dryRun: true, quiet: true })
    expect(result.filesChanged).toBe(1)
    expect(fs.readFileSync(file, 'utf-8')).not.toContain('pradvion')
  })

  test('instrument modifies file', () => {
    const file = path.join(tmpDir, 'app.ts')
    fs.writeFileSync(
      file,
      `import OpenAI from 'openai'\nconst client = new OpenAI()\n`
    )
    instrument({ target: tmpDir, quiet: true })
    expect(fs.readFileSync(file, 'utf-8')).toContain('pradvion')
  })

  test('skips already instrumented', () => {
    const file = path.join(tmpDir, 'app.ts')
    fs.writeFileSync(
      file,
      `const c = pradvion.monitor(new OpenAI())\n`
    )
    const result = instrument({ target: tmpDir, quiet: true })
    expect(result.filesSkipped).toBe(1)
    expect(result.filesChanged).toBe(0)
  })

  test('nonexistent path returns empty result', () => {
    const result = instrument({
      target: '/nonexistent/path',
      quiet: true
    })
    expect(result.filesFound).toBe(0)
  })
})
