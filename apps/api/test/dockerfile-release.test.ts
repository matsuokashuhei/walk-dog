import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const dockerfile = readFileSync(join(apiRoot, 'Dockerfile'), 'utf8')
const stages = dockerfile
  .split(/^FROM /m)
  .slice(1)
  .map((stage) => `FROM ${stage}`)
const runtime = stages.at(-1) ?? ''

test('release Dockerfile builds with npm ci and npm run build then starts with npm start', () => {
  assert.ok(stages.length >= 2)
  assert.match(dockerfile, /RUN npm ci/)
  assert.match(dockerfile, /RUN npm run build/)
  assert.match(runtime, /FROM node:24-alpine AS runtime/)
  assert.match(runtime, /CMD \["npm", "start"\]/)
})

test('runtime copies dist, drizzle, drizzle.config.ts, and lockfile node_modules, not src or test', () => {
  assert.match(runtime, /COPY --from=build \/app\/dist \.\/dist/)
  assert.match(runtime, /COPY drizzle \.\/drizzle/)
  assert.match(runtime, /COPY drizzle\.config\.ts \.\//)
  assert.match(runtime, /COPY --from=deps \/app\/node_modules \.\/node_modules/)
  assert.doesNotMatch(runtime, /COPY(?: --from=\w+)? src /)
  assert.doesNotMatch(runtime, /COPY(?: --from=\w+)? test /)
})

test('development stage keeps npm run dev for local compose target', () => {
  assert.match(dockerfile, /AS development/)
  assert.match(dockerfile, /CMD \["npm", "run", "dev"\]/)
})
