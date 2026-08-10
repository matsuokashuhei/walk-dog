import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';

const catalogFile = 'skills-catalog.json';
const skillsDirectory = '.agents/skills';
const libraryDirectory = '.agents/skill-library';

function isSafeCategory(category) {
  return typeof category === 'string'
    && category.split('/').every((segment) => segment && segment !== '.' && segment !== '..');
}

export function validateCatalog(catalog) {
  const diagnostics = [];
  const ids = new Set();
  if (catalog?.version !== 1 || !Array.isArray(catalog.skills)) {
    return ['catalog must contain version 1 and a skills array'];
  }
  for (const skill of catalog.skills) {
    if (!skill?.id || !skill?.category || !skill?.canonicalPath) {
      diagnostics.push('skill entries require id, category, and canonicalPath');
      continue;
    }
    if (ids.has(skill.id)) diagnostics.push(`duplicate skill ID: ${skill.id}`);
    ids.add(skill.id);
    if (!isSafeCategory(skill.category)) diagnostics.push(`category must be a relative path: ${skill.category}`);
    if (skill.canonicalPath !== `${skillsDirectory}/${skill.id}`) {
      diagnostics.push(`canonical path must be ${skillsDirectory}/${skill.id}`);
    }
  }
  return diagnostics;
}

function skillName(skillDirectory) {
  const contents = readFileSync(resolve(skillDirectory, 'SKILL.md'), 'utf8');
  return contents.match(/^name:\s*([^\s#]+)\s*$/m)?.[1];
}

function hashSkill(skillDirectory) {
  return createHash('sha256').update(readFileSync(resolve(skillDirectory, 'SKILL.md'))).digest('hex');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readCatalog(repositoryRoot) {
  return readJson(resolve(repositoryRoot, catalogFile));
}

function directSkillDirectories(repositoryRoot) {
  const directory = resolve(repositoryRoot, skillsDirectory);
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(resolve(directory, entry.name, 'SKILL.md')))
    .map((entry) => resolve(directory, entry.name));
}

function libraryEntries(directory, prefix = '') {
  if (!existsSync(directory)) return [];
  const entries = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) entries.push(...libraryEntries(path, name));
    else entries.push({ name, path, isSymbolicLink: entry.isSymbolicLink() });
  }
  return entries;
}

function categoryFromLibraryPath(path, id) {
  const prefix = `${libraryDirectory}/`;
  if (!path?.startsWith(prefix)) return undefined;
  const segments = path.slice(prefix.length).split('/');
  const index = segments.indexOf(id);
  return index > 0 ? segments.slice(0, index).join('/') : undefined;
}

export function catalogFromSkills(repositoryRoot, existingCatalog = { version: 1, skills: [] }) {
  const existing = new Map(existingCatalog.skills?.map((skill) => [skill.id, skill]) ?? []);
  const lockPath = resolve(repositoryRoot, 'skills-lock.json');
  const lockedSkills = existsSync(lockPath) ? readJson(lockPath).skills ?? {} : {};
  const skills = directSkillDirectories(repositoryRoot).map((directory) => {
    const id = skillName(directory);
    const previous = existing.get(id);
    const locked = lockedSkills[id];
    const recoveredCategory = categoryFromLibraryPath(previous?.canonicalPath, id)
      ?? categoryFromLibraryPath(previous?.sourceSkillPath, id);
    const category = recoveredCategory ?? previous?.category ?? 'unclassified';
    return {
      id,
      category,
      canonicalPath: `${skillsDirectory}/${id}`,
      computedHash: hashSkill(directory),
      ...((previous?.source || locked?.source) && {
        source: previous?.source ?? locked.source,
        sourceType: previous?.sourceType ?? locked.sourceType,
      }),
    };
  }).sort((left, right) => left.id.localeCompare(right.id));
  return { version: 1, skills };
}

export function lockFromCatalog(catalog) {
  return {
    version: 1,
    skills: Object.fromEntries(catalog.skills.filter((skill) => skill.source).map((skill) => [skill.id, {
      source: skill.source,
      sourceType: skill.sourceType,
      skillPath: `${skill.canonicalPath}/SKILL.md`,
      computedHash: skill.computedHash,
    }])),
  };
}

export function checkSkills(catalog, repositoryRoot) {
  const diagnostics = validateCatalog(catalog);
  if (diagnostics.length > 0) return diagnostics;
  const expectedIds = new Set(catalog.skills.map(({ id }) => id));
  const library = resolve(repositoryRoot, libraryDirectory);

  for (const skill of catalog.skills) {
    const canonicalDirectory = resolve(repositoryRoot, skill.canonicalPath);
    const canonicalFile = resolve(canonicalDirectory, 'SKILL.md');
    if (!existsSync(canonicalFile) || !lstatSync(canonicalDirectory).isDirectory()) {
      diagnostics.push(`missing SKILL.md: ${skill.id}`);
      continue;
    }
    if (skillName(canonicalDirectory) !== skill.id) diagnostics.push(`frontmatter name does not match catalog ID: ${skill.id}`);
    if (skill.computedHash && hashSkill(canonicalDirectory) !== skill.computedHash) diagnostics.push(`hash mismatch: ${skill.id}`);
    const link = resolve(library, skill.category, skill.id);
    try {
      if (!lstatSync(link).isSymbolicLink() || resolve(dirname(link), readlinkSync(link)) !== canonicalDirectory) {
        diagnostics.push(`stale library link: ${skill.id}`);
      }
    } catch {
      diagnostics.push(`missing library link: ${skill.id}`);
    }
  }

  for (const directory of directSkillDirectories(repositoryRoot)) {
    if (!expectedIds.has(skillName(directory))) diagnostics.push(`unlisted canonical skill: ${skillName(directory)}`);
  }
  for (const entry of libraryEntries(library)) {
    if (!entry.isSymbolicLink) {
      diagnostics.push(`library entry is not a link: ${entry.name}`);
      continue;
    }
    const id = entry.name.split('/').at(-1);
    const expected = catalog.skills.find((skill) => skill.id === id && skill.category === entry.name.slice(0, -id.length - 1));
    if (!expected) diagnostics.push(`unlisted library entry: ${entry.name}`);
  }
  return diagnostics;
}

export function syncSkills(catalog, repositoryRoot) {
  const diagnostics = validateCatalog(catalog);
  if (diagnostics.length > 0) return diagnostics;
  const library = resolve(repositoryRoot, libraryDirectory);
  for (const entry of libraryEntries(library)) rmSync(entry.path);
  for (const skill of catalog.skills) {
    const link = resolve(library, skill.category, skill.id);
    const canonicalDirectory = resolve(repositoryRoot, skill.canonicalPath);
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(relative(dirname(link), canonicalDirectory), link);
  }
  return checkSkills(catalog, repositoryRoot);
}

function main() {
  const [command] = process.argv.slice(2);
  const root = process.cwd();
  const previous = existsSync(resolve(root, catalogFile)) ? readCatalog(root) : { version: 1, skills: [] };
  if (command === 'inventory') {
    console.log(JSON.stringify(catalogFromSkills(root, previous), null, 2));
    return;
  }
  if (command === 'sync') {
    const catalog = catalogFromSkills(root, previous);
    const diagnostics = syncSkills(catalog, root);
    if (diagnostics.length > 0) throw new Error(diagnostics.join('\n'));
    writeFileSync(resolve(root, catalogFile), `${JSON.stringify(catalog, null, 2)}\n`);
    writeFileSync(resolve(root, 'skills-lock.json'), `${JSON.stringify(lockFromCatalog(catalog), null, 2)}\n`);
    return;
  }
  const catalog = readCatalog(root);
  if (command === 'lock') {
    console.log(JSON.stringify(lockFromCatalog(catalog), null, 2));
    return;
  }
  if (command === 'list') {
    for (const skill of catalog.skills) console.log(`${skill.id}\t${skill.category}`);
    return;
  }
  if (command !== 'check') throw new Error('Usage: node scripts/agent-skills.mjs <sync|check|inventory|lock|list>');
  const diagnostics = checkSkills(catalog, root);
  if (diagnostics.length > 0) {
    console.error(diagnostics.join('\n'));
    process.exitCode = 1;
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) main();
