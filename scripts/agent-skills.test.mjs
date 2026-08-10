import assert from 'node:assert/strict';
import { lstatSync, mkdtempSync, mkdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import { catalogFromSkills, checkSkills, lockFromCatalog, syncSkills, validateCatalog } from './agent-skills.mjs';

function writeSkill(root, id) {
  const directory = resolve(root, '.agents/skills', id);
  mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, 'SKILL.md'), `---\nname: ${id}\ndescription: Use when testing skills.\n---\n`);
  return directory;
}

test('rejects duplicate skill IDs', () => {
  assert.deepEqual(validateCatalog({
    version: 1,
    skills: [
      { id: 'expo-router', category: 'mobile/expo', canonicalPath: '.agents/skills/expo-router' },
      { id: 'expo-router', category: 'mobile/expo', canonicalPath: '.agents/skills/expo-router' },
    ],
  }), ['duplicate skill ID: expo-router']);
});

test('rejects canonical paths and categories outside the generated views', () => {
  assert.deepEqual(validateCatalog({
    version: 1,
    skills: [
      { id: 'example', category: '../outside', canonicalPath: '.agents/skill-library/example' },
    ],
  }), [
    'category must be a relative path: ../outside',
    'canonical path must be .agents/skills/example',
  ]);
});

test('creates a categorized library link without replacing a canonical skill', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'agent-skills-'));
  try {
    const canonical = writeSkill(root, 'expo-router');
    const catalog = {
      version: 1,
      skills: [{ id: 'expo-router', category: 'mobile/expo', canonicalPath: '.agents/skills/expo-router' }],
    };

    assert.deepEqual(syncSkills(catalog, root), []);
    assert.equal(readlinkSync(resolve(root, '.agents/skill-library/mobile/expo/expo-router')), '../../../skills/expo-router');
    assert.equal(lstatSync(canonical).isDirectory(), true);
    assert.equal(readFileSync(resolve(canonical, 'SKILL.md'), 'utf8').includes('expo-router'), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('keeps existing categories and assigns unclassified to new installed skills', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'agent-skills-'));
  try {
    writeSkill(root, 'expo-router');
    writeSkill(root, 'new-skill');
    const existing = {
      version: 1,
      skills: [{ id: 'expo-router', category: 'mobile/expo', canonicalPath: '.agents/skills/expo-router' }],
    };

    const catalog = catalogFromSkills(root, existing);
    assert.deepEqual(catalog.skills.map(({ id, category }) => ({ id, category })), [
      { id: 'expo-router', category: 'mobile/expo' },
      { id: 'new-skill', category: 'unclassified' },
    ]);
    assert.equal(catalogFromSkills(root, catalog).skills.find((skill) => skill.id === 'new-skill').category, 'unclassified');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('recovers a nested category from a legacy library path', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'agent-skills-'));
  try {
    writeSkill(root, 'expo-router');
    const existing = {
      version: 1,
      skills: [{
        id: 'expo-router',
        category: 'mobile',
        canonicalPath: '.agents/skill-library/mobile/expo/expo-router',
        sourceSkillPath: '.agents/skill-library/mobile/expo/expo-router/SKILL.md',
      }],
    };

    assert.equal(catalogFromSkills(root, existing).skills[0].category, 'mobile/expo');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('detects missing canonical skills, stale links, hash mismatches, and unlisted links', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'agent-skills-'));
  try {
    writeSkill(root, 'example');
    const catalog = {
      version: 1,
      skills: [{ id: 'example', category: 'workflow', canonicalPath: '.agents/skills/example', computedHash: 'wrong' }],
    };
    mkdirSync(resolve(root, '.agents/skill-library/workflow'), { recursive: true });
    symlinkSync('../../skills/missing', resolve(root, '.agents/skill-library/workflow/example'));
    symlinkSync('../../skills/example', resolve(root, '.agents/skill-library/workflow/unlisted'));

    assert.deepEqual(checkSkills(catalog, root), [
      'hash mismatch: example',
      'stale library link: example',
      'unlisted library entry: workflow/unlisted',
    ]);
    assert.deepEqual(checkSkills({
      version: 1,
      skills: [{ id: 'missing', category: 'unclassified', canonicalPath: '.agents/skills/missing' }],
    }, root), ['missing SKILL.md: missing', 'unlisted canonical skill: example', 'unlisted library entry: workflow/example', 'unlisted library entry: workflow/unlisted']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects a regular file in the generated library view', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'agent-skills-'));
  try {
    writeSkill(root, 'example');
    const catalog = {
      version: 1,
      skills: [{ id: 'example', category: 'workflow', canonicalPath: '.agents/skills/example' }],
    };
    assert.deepEqual(syncSkills(catalog, root), []);
    writeFileSync(resolve(root, '.agents/skill-library/workflow/note.txt'), 'manual file');

    assert.deepEqual(checkSkills(catalog, root), ['library entry is not a link: workflow/note.txt']);
    assert.deepEqual(syncSkills(catalog, root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('writes lock entries only for upstream catalog skills', () => {
  assert.deepEqual(lockFromCatalog({
    version: 1,
    skills: [
      { id: 'expo-router', canonicalPath: '.agents/skills/expo-router', source: 'expo/skills', sourceType: 'github', sourceSkillPath: 'plugins/expo/skills/expo-router/SKILL.md', computedHash: 'hash' },
      { id: 'run-dev-session', canonicalPath: '.agents/skills/run-dev-session', computedHash: 'local' },
    ],
  }), {
    version: 1,
    skills: {
      'expo-router': { source: 'expo/skills', sourceType: 'github', skillPath: '.agents/skills/expo-router/SKILL.md', computedHash: 'hash' },
    },
  });
});
