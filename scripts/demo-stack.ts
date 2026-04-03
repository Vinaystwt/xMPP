import { copyFile, access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const shouldSmoke = process.argv.includes('--smoke')
const commands = [
  ['pnpm', ['xmpp:facilitator']],
  ['pnpm', ['xmpp:services']],
  ['pnpm', ['xmpp:gateway']],
  ['pnpm', ['xmpp:dashboard']],
  ['pnpm', ['xmpp:mcp']],
] as const

async function ensureEnvFile() {
  const envPath = resolve(repoRoot, '.env')
  try {
    await access(envPath, constants.F_OK)
  } catch {
    await copyFile(resolve(repoRoot, '.env.example'), envPath)
    console.log('[xMPP demo] created .env from .env.example')
    console.log('[xMPP demo] run `pnpm xmpp:bootstrap -- --friendbot` before live testnet demo flows')
  }
}

async function main() {
  await ensureEnvFile()

  const children = commands.map(([command, args]) =>
    spawn(command, args, {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: false,
    }),
  )

  const cleanup = () => {
    for (const child of children) {
      child.kill('SIGTERM')
    }
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
  process.on('exit', cleanup)

  console.log('[xMPP demo] stack booting')
  console.log('[xMPP demo] gateway   http://localhost:4300')
  console.log('[xMPP demo] dashboard http://localhost:4310')
  console.log('[xMPP demo] facilitator http://localhost:4022')

  if (shouldSmoke) {
    await delay(4000)
    const smoke = spawn('pnpm', ['xmpp:smoke'], {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: false,
    })
    smoke.on('exit', (code) => {
      console.log(`[xMPP demo] smoke exited with code ${code ?? 0}`)
    })
  }

  await Promise.race(
    children.map(
      (child) =>
        new Promise((resolveChild) => {
          child.on('exit', (code) => resolveChild(code))
        }),
    ),
  )

  cleanup()
}

main().catch((error) => {
  console.error('[xMPP demo] failed to start', error)
  process.exit(1)
})
