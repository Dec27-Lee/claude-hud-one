import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const manifestPath = join(root, 'src-tauri', 'Cargo.toml')
const builtExe = join(root, 'src-tauri', 'target', 'release', 'examples', 'hud-bridge.exe')
const resourceExe = join(root, 'src-tauri', 'resources', 'hud-bridge.exe')

const result = spawnSync(
  'cargo',
  ['build', '--manifest-path', manifestPath, '--example', 'hud-bridge', '--release'],
  { stdio: 'inherit', shell: false },
)
if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

if (!existsSync(builtExe) || statSync(builtExe).size <= 0) {
  throw new Error(`Native hud-bridge build did not produce ${builtExe}`)
}

mkdirSync(dirname(resourceExe), { recursive: true })
copyFileSync(builtExe, resourceExe)
console.log(`Copied native hud-bridge resource: ${resourceExe}`)
