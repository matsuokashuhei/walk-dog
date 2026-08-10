import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';

const catalogFile = 'skills-catalog.json';
const skillsDirectory = '.agents/skills';

export function validateCatalog(catalog) {
  const diagnostics = [];
  const ids = new Set();

  if (catalog?.version !== 1 || !Array.isArray(catalog.skills)) {
    return ['catalog must contain version 1 and a skills array'];
  }

  for (const skill of catalog.skills) {
    if (!skill?.id || !skill?.canonicalPath) {
      diagnostics.push('skill entries require id and canonicalPath');
      continue;
    }
    if (ids.has(skill.id)) {
      diagnostics.push(`duplicate skill ID: ${skill.id}`);
      continue;
    }
    ids.add(skill.id);
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

function readCatalog(repositoryRoot) {
  return JSON.parse(readFileSync(resolve(repositoryRoot, catalogFile), 'utf8'));
}

function skillDirectories(directory) {
  if (!existsSync(directory)) return [];
  const directories = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = resolve(directory, entry.name);
    if (existsSync(resolve(path, 'SKILL.md'))) {
      directories.push(path);
    } else {
      directories.push(...skillDirectories(path));
    }
  }
  return directories;
}

export function catalogFromLibrary(repositoryRoot) {
  const library = resolve(repositoryRoot, '.agents/skill-library');
  const lockPath = resolve(repositoryRoot, 'skills-lock.json');
  const lockedSkills = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, 'utf8')).skills ?? {} : {};
  const skills = skillDirectories(library)
    .map((directory) => {
      const canonicalPath = relative(repositoryRoot, directory).replaceAll('\\', '/');
      const [, , category] = canonicalPath.split('/');
      const id = skillName(directory);
      const locked = lockedSkills[id];
      return {
        id,
        category,
        canonicalPath,
        computedHash: hashSkill(directory),
        ...(locked && {
          source: locked.source,
          sourceType: locked.sourceType,
          sourceSkillPath: locked.skillPath,
        }),
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  return { version: 1, skills };
}

export function lockFromCatalog(catalog) {
  return {
    version: 1,
    skills: Object.fromEntries(catalog.skills
      .filter((skill) => skill.source)
      .map((skill) => [skill.id, {
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

  const viewDirectory = resolve(repositoryRoot, skillsDirectory);
  const expectedIds = new Set(catalog.skills.map(({ id }) => id));

  for (const skill of catalog.skills) {
    const canonicalDirectory = resolve(repositoryRoot, skill.canonicalPath);
    const skillFile = resolve(canonicalDirectory, 'SKILL.md');
    if (!existsSync(skillFile)) {
      diagnostics.push(`missing SKILL.md: ${skill.id}`);
      continue;
    }
    if (skillName(canonicalDirectory) !== skill.id) {
      diagnostics.push(`frontmatter name does not match catalog ID: ${skill.id}`);
    }
    if (skill.computedHash && hashSkill(canonicalDirectory) !== skill.computedHash) {
      diagnostics.push(`hash mismatch: ${skill.id}`);
    }
    const viewPath = resolve(viewDirectory, skill.id);
    if (!existsSync(viewPath)) {
      diagnostics.push(`missing discovery link: ${skill.id}`);
    } else if (!lstatSync(viewPath).isSymbolicLink()) {
      diagnostics.push(`discovery entry is not a link: ${skill.id}`);
    } else if (resolve(dirname(viewPath), readlinkSync(viewPath)) !== canonicalDirectory) {
      diagnostics.push(`stale discovery link: ${skill.id}`);
    }
  }

  if (existsSync(viewDirectory)) {
    for (const name of readdirSync(viewDirectory)) {
      if (!expectedIds.has(name)) diagnostics.push(`unlisted discovery entry: ${name}`);
    }
  }
  return diagnostics;
}

export function syncSkills(catalog, repositoryRoot) {
  const diagnostics = validateCatalog(catalog);
  if (diagnostics.length > 0) return diagnostics;

  const viewDirectory = resolve(repositoryRoot, skillsDirectory);
  if (existsSync(viewDirectory)) {
    for (const name of readdirSync(viewDirectory)) {
      const viewPath = resolve(viewDirectory, name);
      if (!lstatSync(viewPath).isSymbolicLink()) {
        diagnostics.push(`discovery entry is not a link: ${name}`);
      }
    }
  }
  if (diagnostics.length > 0) return diagnostics;

  mkdirSync(viewDirectory, { recursive: true });
  for (const name of existsSync(viewDirectory) ? readdirSync(viewDirectory) : []) {
    rmSync(resolve(viewDirectory, name));
  }
  for (const skill of catalog.skills) {
    const viewPath = resolve(viewDirectory, skill.id);
    const canonicalDirectory = resolve(repositoryRoot, skill.canonicalPath);
    symlinkSync(relative(dirname(viewPath), canonicalDirectory), viewPath);
  }
  return checkSkills(catalog, repositoryRoot);
}

function main() {
  const [command] = process.argv.slice(2);
  const root = process.cwd();
  if (command === 'inventory') {
    console.log(JSON.stringify(catalogFromLibrary(root), null, 2));
    return;
  }
  const catalog = readCatalog(root);
  if (command === 'lock') {
    console.log(JSON.stringify(lockFromCatalog(catalog), null, 2));
    return;
  }
  const diagnostics = command === 'sync' ? syncSkills(catalog, root) : checkSkills(catalog, root);
  if (command === 'list') {
    for (const skill of catalog.skills) console.log(`${skill.id}\t${skill.canonicalPath}`);
    return;
  }
  if (command !== 'sync' && command !== 'check') {
    throw new Error('Usage: node scripts/agent-skills.mjs <sync|check|list>');
  }
  if (diagnostics.length > 0) {
    console.error(diagnostics.join('\n'));
    process.exitCode = 1;
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) main();
