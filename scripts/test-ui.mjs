import { execFile, spawn } from 'node:child_process'
import http from 'node:http'

const PORT = 1420
const HOST = '127.0.0.1'
const URL = `http://${HOST}:${PORT}`
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const quoteArg = (value) => {
  if (!/[\s"&()<>^|]/.test(value)) return value
  return `"${value.replace(/"/g, '\\"')}"`
}

const spawnCommand = (command, args, options = {}) => {
  if (process.platform === 'win32') {
    return spawn('cmd.exe', ['/d', '/s', '/c', [command, ...args].map(quoteArg).join(' ')], {
      windowsHide: true,
      ...options,
    })
  }

  return spawn(command, args, options)
}

const runCommand = (command, args, options = {}) => new Promise((resolve, reject) => {
  const child = spawnCommand(command, args, {
    stdio: 'inherit',
    ...options,
  })

  child.on('error', reject)
  child.on('exit', (code, signal) => {
    if (signal) {
      reject(new Error(`${command} ${args.join(' ')} was terminated by ${signal}`))
      return
    }
    resolve(code ?? 0)
  })
})

const execShell = (command) => new Promise((resolve) => {
  execFile(
    process.platform === 'win32' ? 'cmd.exe' : 'sh',
    process.platform === 'win32' ? ['/d', '/s', '/c', command] : ['-c', command],
    { windowsHide: true },
    () => resolve(),
  )
})

const killProcessTree = async (pid) => {
  if (!pid) return
  if (process.platform === 'win32') {
    await execShell(`taskkill /PID ${pid} /T /F >NUL 2>NUL`)
    return
  }

  try {
    process.kill(-pid, 'SIGTERM')
  } catch {
    try { process.kill(pid, 'SIGTERM') } catch {}
  }
}

const killPort = async () => {
  if (process.platform !== 'win32') return

  const command = `for /f "tokens=5" %a in ('netstat -ano -p tcp ^| findstr /R /C:":${PORT} .*LISTENING"') do taskkill /PID %a /F >NUL 2>NUL`
  await execShell(command)
}

const probeServer = () => new Promise((resolve) => {
  const request = http.get(URL, { timeout: 2_000 }, (response) => {
    response.resume()
    resolve(Boolean(response.statusCode && response.statusCode >= 200 && response.statusCode < 500))
  })

  request.on('timeout', () => {
    request.destroy()
    resolve(false)
  })

  request.on('error', () => resolve(false))
})

const waitForServer = async () => {
  const deadline = Date.now() + 45_000
  while (Date.now() < deadline) {
    if (await probeServer()) return
    await delay(500)
  }

  throw new Error(`Vite dev server did not become ready on ${URL}.`)
}

await killPort()

const server = spawnCommand('npm', ['run', 'dev', '--', '--host', HOST], {
  stdio: 'inherit',
  detached: process.platform !== 'win32',
})

let serverExited = false
let shuttingDown = false
server.on('exit', (code, signal) => {
  serverExited = true
  if (shuttingDown) return

  if (code !== 0 && code !== null) {
    console.error(`Vite dev server exited early with code ${code}.`)
  }
  if (signal) {
    console.error(`Vite dev server exited early with signal ${signal}.`)
  }
})

try {
  await waitForServer()
  if (serverExited) throw new Error('Vite dev server exited before Playwright started.')

  const playwrightArgs = ['playwright', 'test', ...process.argv.slice(2)]
  const exitCode = await runCommand('npx', playwrightArgs, {
    env: { ...process.env, CLAUDE_ISLAND_EXTERNAL_SERVER: '1' },
  })
  if (exitCode !== 0) process.exitCode = exitCode
} finally {
  shuttingDown = true
  await killProcessTree(server.pid)
  await killPort()
}
