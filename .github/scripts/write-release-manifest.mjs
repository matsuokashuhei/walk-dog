#!/usr/bin/env node
/**
 * openapiVersion is apps/api OpenAPI info.version (app version), not the
 * OpenAPI document number (for example 3.1.0).
 *
 * Usage:
 *   node .github/scripts/write-release-manifest.mjs \
 *     --commit-sha <sha> \
 *     --image-digest sha256:... \
 *     --openapi-json <path-or-> \
 *     --built-at <iso8601> \
 *     --out release-manifest.json
 *
 * --openapi-json - reads the OpenAPI document from stdin.
 * --openapi-version <string> may replace --openapi-json when the caller
 * already extracted info.version.
 */

import { readFileSync, writeFileSync } from 'node:fs'

const REQUIRED_KEYS = ['commitSha', 'imageDigest', 'openapiVersion', 'builtAt']

/**
 * @param {unknown} document
 * @returns {string}
 */
export function openapiVersionFromDocument(document) {
  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('OpenAPI document must be a JSON object')
  }
  const info = /** @type {{ info?: { version?: unknown } }} */ (document).info
  const version = info?.version
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error('OpenAPI document info.version must be a non-empty string')
  }
  return version
}

/**
 * @param {{
 *   commitSha: string
 *   imageDigest: string
 *   openapiVersion: string
 *   builtAt: string
 * }} input
 */
export function buildReleaseManifest(input) {
  const manifest = {
    commitSha: requireNonEmpty(input.commitSha, 'commitSha'),
    imageDigest: requireDigest(input.imageDigest),
    openapiVersion: requireNonEmpty(input.openapiVersion, 'openapiVersion'),
    builtAt: requireNonEmpty(input.builtAt, 'builtAt'),
  }
  for (const key of REQUIRED_KEYS) {
    if (!(key in manifest)) {
      throw new Error(`release manifest missing ${key}`)
    }
  }
  return manifest
}

/**
 * @param {string} value
 * @param {string} name
 */
function requireNonEmpty(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} must be a non-empty string`)
  }
  return value
}

/**
 * @param {string} value
 */
function requireDigest(value) {
  const digest = requireNonEmpty(value, 'imageDigest')
  if (!digest.startsWith('sha256:')) {
    throw new Error('imageDigest must start with sha256:')
  }
  return digest
}

/**
 * @param {string[]} argv
 * @returns {Record<string, string>}
 */
export function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) {
      throw new Error(`unexpected argument: ${arg}`)
    }
    const body = arg.slice(2)
    const eq = body.indexOf('=')
    if (eq >= 0) {
      out[body.slice(0, eq)] = body.slice(eq + 1)
      continue
    }
    const key = body
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      throw new Error(`missing value for --${key}`)
    }
    out[key] = next
    i += 1
  }
  return out
}

/**
 * @param {Record<string, string>} args
 */
export function resolveOpenapiVersion(args) {
  if (args['openapi-version'] !== undefined) {
    return requireNonEmpty(args['openapi-version'], 'openapi-version')
  }
  if (args['openapi-json'] === undefined) {
    throw new Error('pass --openapi-json <path|-> or --openapi-version <string>')
  }
  const raw =
    args['openapi-json'] === '-'
      ? readFileSync(0, 'utf8')
      : readFileSync(args['openapi-json'], 'utf8')
  return openapiVersionFromDocument(JSON.parse(raw))
}

/**
 * @param {string[]} argv
 * @param {{ writeFileSync?: typeof writeFileSync }} [io]
 */
export function main(argv, io = { writeFileSync }) {
  const args = parseArgs(argv)
  const outPath = requireNonEmpty(args.out ?? '', 'out')
  const manifest = buildReleaseManifest({
    commitSha: args['commit-sha'] ?? '',
    imageDigest: args['image-digest'] ?? '',
    openapiVersion: resolveOpenapiVersion(args),
    builtAt: args['built-at'] ?? '',
  })
  const write = io.writeFileSync ?? writeFileSync
  write(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  return manifest
}

const entry = process.argv[1] ?? ''
if (entry.endsWith('write-release-manifest.mjs')) {
  main(process.argv.slice(2))
}
