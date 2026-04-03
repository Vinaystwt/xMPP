import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../packages/config/src/index.js'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))

async function main() {
  if (!config.mpp.feeSponsorship.chargeEnabled && !config.mpp.feeSponsorship.sessionEnabled) {
    throw new Error(
      'Enable XMPP fee sponsorship for at least one MPP route before running the dedicated fee-sponsored smoke flow.',
    )
  }

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn('pnpm', ['exec', 'tsx', 'scripts/live-smoke.ts'], {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: false,
    })
    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise()
        return
      }

      rejectPromise(new Error(`fee-sponsored smoke exited with ${code ?? 1}`))
    })
  })
}

main().catch((error) => {
  console.error('[xMPP fee-sponsored smoke] failed', error)
  process.exit(1)
})
