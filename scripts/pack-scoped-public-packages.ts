import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const releaseDir = resolve(repoRoot, '.release-public')
const publicScope = '@vinaystwt'

type PublicPackage = {
  workspaceName: '@xmpp/core' | '@xmpp/mcp'
  directory: string
  embeddedTargets: Record<string, string>
}

const publicPackages: PublicPackage[] = [
  {
    workspaceName: '@xmpp/core',
    directory: 'packages/core',
    embeddedTargets: {
      '@xmpp/config': 'dist/config/src/index.js',
      '@xmpp/contract-runtime': 'dist/contract-runtime/src/index.js',
      '@xmpp/http-interceptor': 'dist/http-interceptor/src/index.js',
      '@xmpp/logger': 'dist/logger/src/index.js',
      '@xmpp/payment-adapters': 'dist/payment-adapters/src/index.js',
      '@xmpp/policy-engine': 'dist/policy-engine/src/index.js',
      '@xmpp/router': 'dist/router/src/index.js',
      '@xmpp/types': 'dist/types/src/index.js',
      '@xmpp/wallet': 'dist/wallet/src/index.js',
    },
  },
  {
    workspaceName: '@xmpp/mcp',
    directory: 'apps/mcp-server',
    embeddedTargets: {
      '@xmpp/config': 'dist/packages/config/src/index.js',
      '@xmpp/contract-runtime': 'dist/packages/contract-runtime/src/index.js',
      '@xmpp/http-interceptor': 'dist/packages/http-interceptor/src/index.js',
      '@xmpp/logger': 'dist/packages/logger/src/index.js',
      '@xmpp/payment-adapters': 'dist/packages/payment-adapters/src/index.js',
      '@xmpp/policy-engine': 'dist/packages/policy-engine/src/index.js',
      '@xmpp/router': 'dist/packages/router/src/index.js',
      '@xmpp/types': 'dist/packages/types/src/index.js',
      '@xmpp/wallet': 'dist/packages/wallet/src/index.js',
    },
  },
]

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

async function walkFiles(rootDir: string, files: string[] = []) {
  for (const entry of await readdir(rootDir)) {
    const fullPath = resolve(rootDir, entry)
    const entryStat = await stat(fullPath)
    if (entryStat.isDirectory()) {
      await walkFiles(fullPath, files)
      continue
    }

    files.push(fullPath)
  }

  return files
}

function createRelativeImport(sourceFile: string, targetFile: string) {
  let next = relative(dirname(sourceFile), targetFile).replaceAll('\\', '/')
  if (!next.startsWith('.')) {
    next = `./${next}`
  }
  return next
}

async function rewriteEmbeddedImports(stageDir: string, embeddedTargets: Record<string, string>) {
  const distDir = resolve(stageDir, 'dist')
  const files = await walkFiles(distDir)

  for (const file of files) {
    const isJavaScript = extname(file) === '.js'
    const isDeclaration = file.endsWith('.d.ts')
    if (!isJavaScript && !isDeclaration) {
      continue
    }

    let text = await readFile(file, 'utf8')
    let changed = false

    for (const [workspaceName, embeddedTarget] of Object.entries(embeddedTargets)) {
      const targetFile = resolve(stageDir, embeddedTarget)
      const relativeTarget = createRelativeImport(file, targetFile)

      const before = text
      text = text.replaceAll(`'${workspaceName}'`, `'${relativeTarget}'`)
      text = text.replaceAll(`"${workspaceName}"`, `"${relativeTarget}"`)
      if (text !== before) {
        changed = true
      }
    }

    if (changed) {
      await writeFile(file, text, 'utf8')
    }
  }
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

async function stagePackage(entry: PublicPackage) {
  const sourceDir = resolve(repoRoot, entry.directory)
  const stageDir = resolve(releaseDir, entry.workspaceName.split('/')[1])
  await mkdir(stageDir, { recursive: true })

  await cp(resolve(sourceDir, 'dist'), resolve(stageDir, 'dist'), { recursive: true })

  const packageJson = JSON.parse(await readFile(resolve(sourceDir, 'package.json'), 'utf8')) as {
    name: string
    version: string
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

    const nextEntries = Object.entries(packageJson[key]!).flatMap(([dependency, version]) => {
      if (dependency.startsWith('@xmpp/')) {
        return []
      }

      return [[dependency, typeof version === 'string' && version.startsWith('workspace:')
        ? versionByWorkspace.get(dependency) ?? '0.1.0'
        : version]]
    })

    if (nextEntries.length === 0) {
      delete packageJson[key]
      continue
    }

    packageJson[key] = Object.fromEntries(nextEntries)
  }

  await writeFile(resolve(stageDir, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8')
  await cp(resolve(repoRoot, 'LICENSE'), resolve(stageDir, 'LICENSE'))

  try {
    const readme = await readFile(resolve(sourceDir, 'README.md'), 'utf8')
    await writeFile(resolve(stageDir, 'README.md'), rewritePackageReferences(readme), 'utf8')
  } catch {
    // README is optional.
  }

  await rewriteEmbeddedImports(stageDir, entry.embeddedTargets)

  const tarball = await packStage(stageDir)
  return {
    workspaceName: entry.workspaceName,
    publishedName: packageJson.name,
    version: packageJson.version,
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
