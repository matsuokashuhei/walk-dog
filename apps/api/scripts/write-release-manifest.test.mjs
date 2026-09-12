import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  buildReleaseManifest,
  main,
  openapiVersionFromDocument,
  parseArgs,
} from './write-release-manifest.mjs'

const openapiFixture = {
  openapi: '3.1.0',
  info: { title: 'walk / dog API', version: '0.1.0' },
  paths: {},
}

test('openapiVersionFromDocument reads info.version, not openapi document number', () => {
  assert.equal(openapiVersionFromDocument(openapiFixture), '0.1.0')
  assert.notEqual(openapiVersionFromDocument(openapiFixture), openapiFixture.openapi)
})

test('openapiVersionFromDocument rejects missing info.version', () => {
  assert.throws(
    () => openapiVersionFromDocument({ openapi: '3.1.0', info: { title: 'x' } }),
    /info\.version/,
  )
})

test('buildReleaseManifest emits required keys', () => {
  const manifest = buildReleaseManifest({
    commitSha: 'abc123',
    imageDigest: 'sha256:deadbeef',
    openapiVersion: '0.1.0',
    builtAt: '2026-09-12T00:00:00Z',
  })
  assert.deepEqual(Object.keys(manifest).sort(), [
    'builtAt',
    'commitSha',
    'imageDigest',
    'openapiVersion',
  ])
  assert.deepEqual(manifest, {
    commitSha: 'abc123',
    imageDigest: 'sha256:deadbeef',
    openapiVersion: '0.1.0',
    builtAt: '2026-09-12T00:00:00Z',
  })
})

test('buildReleaseManifest rejects digests without sha256 prefix', () => {
  assert.throws(
    () =>
      buildReleaseManifest({
        commitSha: 'abc123',
        imageDigest: 'deadbeef',
        openapiVersion: '0.1.0',
        builtAt: '2026-09-12T00:00:00Z',
      }),
    /sha256:/,
  )
})

test('parseArgs accepts --key=value and --key value', () => {
  assert.deepEqual(parseArgs(['--commit-sha=abc', '--out', 'm.json']), {
    'commit-sha': 'abc',
    out: 'm.json',
  })
})

test('main writes release-manifest.json from --openapi-json fixture', () => {
  const dir = mkdtempSync(join(tmpdir(), 'release-manifest-'))
  const openapiPath = join(dir, 'openapi.json')
  const outPath = join(dir, 'release-manifest.json')
  writeFileSync(openapiPath, `${JSON.stringify(openapiFixture)}\n`)
  try {
    main([
      '--commit-sha',
      'abc123',
      '--image-digest',
      'sha256:deadbeef',
      '--openapi-json',
      openapiPath,
      '--built-at',
      '2026-09-12T00:00:00Z',
      '--out',
      outPath,
    ])
    assert.deepEqual(JSON.parse(readFileSync(outPath, 'utf8')), {
      commitSha: 'abc123',
      imageDigest: 'sha256:deadbeef',
      openapiVersion: '0.1.0',
      builtAt: '2026-09-12T00:00:00Z',
    })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
