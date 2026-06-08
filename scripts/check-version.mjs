import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'))
const readText = (path) => readFileSync(resolve(root, path), 'utf8')

const packageVersion = readJson('package.json').version
const tauriVersion = readJson('src-tauri/tauri.conf.json').version
const cargoText = readText('src-tauri/Cargo.toml')
const cargoMatch = cargoText.match(/^version\s*=\s*"([^"]+)"/m)

if (!cargoMatch) {
  console.error('Cargo version not found in src-tauri/Cargo.toml')
  process.exit(1)
}

const cargoVersion = cargoMatch[1]
const versions = {
  'package.json': packageVersion,
  'src-tauri/Cargo.toml': cargoVersion,
  'src-tauri/tauri.conf.json': tauriVersion,
}

const uniqueVersions = new Set(Object.values(versions))
if (uniqueVersions.size !== 1) {
  console.error('Version mismatch detected:')
  for (const [file, version] of Object.entries(versions)) {
    console.error(`- ${file}: ${version}`)
  }
  process.exit(1)
}

console.log(`Version check passed: ${packageVersion}`)
