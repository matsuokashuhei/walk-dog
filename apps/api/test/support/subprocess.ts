import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

export function sanitizedEnv(
  overrides: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      env[key] = value
    }
  }

  return env
}

export function runNode(
  args: string[],
  env: NodeJS.ProcessEnv = sanitizedEnv(),
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolveResult) => {
    const child = spawn(process.execPath, args, {
      cwd: apiRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('close', (status) => {
      resolveResult({ status, stdout, stderr })
    })
  })
}
