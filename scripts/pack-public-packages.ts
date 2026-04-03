import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const releaseDir = resolve(repoRoot, '.release')

const publicPackages = [
  '@xmpp/types',
  '@xmpp/logger',
  '@xmpp/config',
  '@xmpp/router',
  '@xmpp/contract-runtime',
  '@xmpp/wallet',
  '@xmpp/payment-adapters',
  '@xmpp/policy-engine',
  '@xmpp/http-interceptor',
  '@xmpp/core',
  '@xmpp/mcp',
]

async function packPackage(packageName: string) {
  const before = new Set(await readdir(releaseDir))

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(
      'pnpm',
      ['--filter', packageName, 'pack', '--pack-destination', releaseDir, '--json'],
      {
        cwd: repoRoot,
        stdio: ['ignore', 'ignore', 'inherit'],
        shell: false,
      },
    )

    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise()
        return
      }

      rejectPromise(new Error(`pnpm pack failed for ${packageName} with ${code ?? 1}`))
    })
  })

  const after = await readdir(releaseDir)
  const tarball = after.find((entry) => entry.endsWith('.tgz') && !before.has(entry)) ?? ''

  return {
    packageName,
    tarball,
  }
}

async function main() {
  await rm(releaseDir, { recursive: true, force: true })
  await mkdir(releaseDir, { recursive: true })

  const tarballs = []
  for (const packageName of publicPackages) {
    tarballs.push(await packPackage(packageName))
  }

  await writeFile(
    resolve(releaseDir, 'manifest.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), tarballs }, null, 2),
    'utf8',
  )

  console.log(`[xMPP release] packed ${tarballs.length} public packages into ${releaseDir}`)
}

main().catch((error) => {
  console.error('[xMPP release] failed', error)
  process.exit(1)
})
