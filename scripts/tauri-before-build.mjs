import { spawn } from 'node:child_process'

if (process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || process.env.NDK_HOME) {
  console.log('Skipping frontend rebuild for Android packaging; using existing dist output.')
  process.exit(0)
}

const env = { ...process.env }

const command = process.platform === 'win32' ? 'cmd.exe' : 'npm'
const args =
  process.platform === 'win32'
    ? ['/d', '/c', 'npm run build:web']
    : ['run', 'build:web']

const child = spawn(command, args, {
  stdio: 'inherit',
  shell: false,
  env,
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})

child.on('error', (error) => {
  console.error(error)
  process.exit(1)
})
