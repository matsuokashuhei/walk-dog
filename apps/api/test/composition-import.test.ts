import assert from 'node:assert/strict'
import test from 'node:test'
import { runNode, sanitizedEnv } from './support/subprocess.js'

test('importing index.ts does not construct production resources', async () => {
  const result = await runNode(
    [
      '--import',
      'tsx',
      '-e',
      `
        import { createApplication } from './src/index.ts'
        console.log('IMPORT_OK')
        console.log(typeof createApplication)
      `,
    ],
    sanitizedEnv(),
  )

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /IMPORT_OK/)
  assert.match(result.stdout, /function/)
})

