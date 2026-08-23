import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const composePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../compose.yml')

test('worker preserves .env.local credentials and has local defaults', async () => {
  const compose = await readFile(composePath, 'utf8')
  const worker = compose.split('\n  api:')[0]

  assert.match(worker, /env_file: .env.local/)
  assert.doesNotMatch(worker, /environment:/)
  assert.match(worker, /- \/bin\/sh\n {6}- -c/)
  assert.match(worker, /AWS_ACCESS_KEY_ID="\$\$\{AWS_ACCESS_KEY_ID:-local\}"/)
  assert.match(worker, /AWS_SECRET_ACCESS_KEY="\$\$\{AWS_SECRET_ACCESS_KEY:-local\}"/)
})
