import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const releaseDir = resolve(repoRoot, '.release-public')
const publicScope = '@vinaystwt'

const publicPackages = [
  { workspaceName: '@xmpp/types', directory: 'packages/types' },
  { workspaceName: '@xmpp/logger', directory: 'packages/logger' },
  { workspaceName: '@xmpp/config', directory: 'packages/config' },
  { workspaceName: '@xmpp/router', directory: 'packages/router' },
  { workspaceName: '@xmpp/contract-runtime', directory: 'packages/contract-runtime' },
  { workspaceName: '@xmpp/wallet', directory: 'packages/wallet' },
  { workspaceName: '@xmpp/payment-adapters', directory: 'packages/payment-adapters' },
  { workspaceName: '@xmpp/policy-engine', directory: 'packages/policy-engine' },
  { workspaceName: '@xmpp/http-interceptor', directory: 'packages/http-interceptor' },
  { workspaceName: '@xmpp/core', directory: 'packages/core' },
  { workspaceName: '@xmpp/mcp', directory: 'apps/mcp-server' },
] as const

const publishedNameByWorkspace = new Map(
  publicPackages.map(({ workspaceName }) => [
    workspaceName,
    `${publicScope}/xmpp-${workspaceName.split('/')[1]}`,
  ]),
)

const versionByWorkspace = new Map<string, string>()

function rewritePackageReferences(text: string) {
  let next = text
  for (const [workspaceName, publishedName] of publishedNameByWorkspace.entries()) {
    next = next.replaceAll(workspaceName, publishedName)
  }
  return next
}

async function packStage(stageDir: string) {
  const before = new Set(await readdir(releaseDir))

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn('npm', ['pack', stageDir, '--pack-destination', releaseDir, '--json'], {
      cwd: repoRoot,
      stdio: ['ignore', 'ignore', 'inherit'],
      shell: false,
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise()
        return
      }

      rejectPromise(new Error(`npm pack failed for ${stageDir} with ${code ?? 1}`))
    })
  })

  const after = await readdir(releaseDir)
  return after.find((entry) => entry.endsWith('.tgz') && !before.has(entry)) ?? ''
}

async function stagePackage(entry: (typeof publicPackages)[number]) {
  const sourceDir = resolve(repoRoot, entry.directory)
  const stageDir = resolve(releaseDir, entry.workspaceName.split('/')[1])
  await mkdir(stageDir, { recursive: true })

  await cp(resolve(sourceDir, 'dist'), resolve(stageDir, 'dist'), { recursive: true })

  const packageJson = JSON.parse(await readFile(resolve(sourceDir, 'package.json'), 'utf8')) as {
    name: string
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
    optionalDependencies?: Record<string, string>
  } & Record<string, unknown>

  packageJson.name = publishedNameByWorkspace.get(entry.workspaceName) ?? packageJson.name

  for (const key of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ] as const) {
    if (!packageJson[key]) {
      continue
    }

    packageJson[key] = Object.fromEntries(
      Object.entries(packageJson[key]!).map(([dependency, version]) => [
        publishedNameByWorkspace.get(dependency) ?? dependency,
        typeof version === 'string' && version.startsWith('workspace:')
          ? versionByWorkspace.get(dependency) ?? '0.1.0'
          : version,
      ]),
    )
  }

  await writeFile(resolve(stageDir, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8')
  await cp(resolve(repoRoot, 'LICENSE'), resolve(stageDir, 'LICENSE'))

  try {
    const readme = await readFile(resolve(sourceDir, 'README.md'), 'utf8')
    await writeFile(resolve(stageDir, 'README.md'), rewritePackageReferences(readme), 'utf8')
  } catch {
    // README is optional for the lower-level packages.
  }

  const tarball = await packStage(stageDir)
  return {
    workspaceName: entry.workspaceName,
    publishedName: packageJson.name,
    stageDir,
    tarball,
  }
}

async function main() {
  for (const entry of publicPackages) {
    const sourceDir = resolve(repoRoot, entry.directory)
    const packageJson = JSON.parse(await readFile(resolve(sourceDir, 'package.json'), 'utf8')) as {
      version: string
    }
    versionByWorkspace.set(entry.workspaceName, packageJson.version)
  }

  await rm(releaseDir, { recursive: true, force: true })
  await mkdir(releaseDir, { recursive: true })

  const tarballs = []
  for (const entry of publicPackages) {
    tarballs.push(await stagePackage(entry))
  }

  await writeFile(
    resolve(releaseDir, 'manifest.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        scope: publicScope,
        tarballs,
      },
      null,
      2,
    ),
    'utf8',
  )

  console.log(`[xMPP release] packed ${tarballs.length} scoped public packages into ${releaseDir}`)
}

main().catch((error) => {
  console.error('[xMPP release] failed', error)
  process.exit(1)
})
