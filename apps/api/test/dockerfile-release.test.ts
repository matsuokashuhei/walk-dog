import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const dockerfile = readFileSync(join(apiRoot, 'Dockerfile'), 'utf8')

test('release Dockerfile is multi-stage with a production runtime CMD', () => {
  assert.match(dockerfile, /AS build/)
  assert.match(dockerfile, /FROM node:24-alpine AS runtime/)
  assert.match(dockerfile, /RUN npm ci/)
  assert.match(dockerfile, /RUN npm run build/)
  assert.match(dockerfile, /CMD \["npm", "start"\]/)
})

test('release runtime keeps dist, drizzle, and migrate tooling without src or test trees', () => {
  assert.match(dockerfile, /COPY --from=build \/app\/dist \.\/dist/)
  assert.match(dockerfile, /COPY drizzle \.\/drizzle/)
  assert.match(dockerfile, /COPY drizzle\.config\.ts \.\//)
  assert.match(dockerfile, /npm install drizzle-kit@0\.31\.10 --omit=dev/)
  assert.doesNotMatch(dockerfile, /AS runtime[\s\S]*COPY(?: --from=\w+)? src /)
  assert.doesNotMatch(dockerfile, /AS runtime[\s\S]*COPY(?: --from=\w+)? test /)
})

test('local compose can still target a development stage with tsx watch', () => {
  assert.match(dockerfile, /FROM node:24-alpine AS development/)
  assert.match(dockerfile, /CMD \["npm", "run", "dev"\]/)
})
