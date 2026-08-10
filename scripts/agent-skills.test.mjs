import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import { catalogFromLibrary, checkSkills, lockFromCatalog, syncSkills, validateCatalog } from './agent-skills.mjs';

test('rejects duplicate skill IDs', () => {
  const diagnostics = validateCatalog({
    version: 1,
    skills: [
      { id: 'expo-router', canonicalPath: '.agents/skill-library/mobile/expo/expo-router' },
      { id: 'expo-router', canonicalPath: '.agents/skill-library/mobile/expo/expo-router-copy' },
    ],
  });

  assert.deepEqual(diagnostics, ['duplicate skill ID: expo-router']);
});

test('synchronizes a flat discovery view and rejects an unlisted entry', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'agent-skills-'));
  try {
    const canonical = resolve(root, '.agents/skill-library/workflow/example');
    mkdirSync(canonical, { recursive: true });
    writeFileSync(resolve(canonical, 'SKILL.md'), '---\nname: workflow-example\ndescription: Use when testing shared skills.\n---\n');
    const catalog = {
      version: 1,
      skills: [{ id: 'workflow-example', canonicalPath: '.agents/skill-library/workflow/example' }],
    };

    assert.deepEqual(syncSkills(catalog, root), []);
    assert.equal(readlinkSync(resolve(root, '.agents/skills/workflow-example')), '../skill-library/workflow/example');

    symlinkSync('../skill-library/workflow/example', resolve(root, '.agents/skills/unlisted'));
    assert.deepEqual(checkSkills(catalog, root), ['unlisted discovery entry: unlisted']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('builds catalog entries from categorized canonical skills', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'agent-skills-'));
  try {
    const canonical = resolve(root, '.agents/skill-library/data/zod/defining-zod-schemas');
    mkdirSync(canonical, { recursive: true });
    writeFileSync(resolve(canonical, 'SKILL.md'), '---\nname: defining-zod-schemas\ndescription: Use when defining Zod schemas.\n---\n');

    assert.deepEqual(catalogFromLibrary(root), {
      version: 1,
      skills: [{
        id: 'defining-zod-schemas',
        category: 'data',
        canonicalPath: '.agents/skill-library/data/zod/defining-zod-schemas',
        computedHash: '9ef4364f597e70367e840631923f6f006b8e0579f7b02ecdcaec78478485c10d',
      }],
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('preserves upstream provenance from the existing lock', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'agent-skills-'));
  try {
    const canonical = resolve(root, '.agents/skill-library/mobile/expo/expo-router');
    mkdirSync(canonical, { recursive: true });
    writeFileSync(resolve(canonical, 'SKILL.md'), '---\nname: expo-router\ndescription: Use when routing Expo apps.\n---\n');
    writeFileSync(resolve(root, 'skills-lock.json'), JSON.stringify({
      version: 1,
      skills: { 'expo-router': { source: 'expo/skills', sourceType: 'github', skillPath: 'plugins/expo/skills/expo-router/SKILL.md' } },
    }));

    const [skill] = catalogFromLibrary(root).skills;
    assert.equal(skill.source, 'expo/skills');
    assert.equal(skill.sourceType, 'github');
    assert.equal(skill.sourceSkillPath, 'plugins/expo/skills/expo-router/SKILL.md');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('writes lock entries only for upstream catalog skills', () => {
  assert.deepEqual(lockFromCatalog({
    version: 1,
    skills: [
      { id: 'expo-router', canonicalPath: '.agents/skill-library/mobile/expo/expo-router', source: 'expo/skills', sourceType: 'github', sourceSkillPath: 'plugins/expo/skills/expo-router/SKILL.md', computedHash: 'hash' },
      { id: 'run-dev-session', computedHash: 'local' },
    ],
  }), {
    version: 1,
    skills: {
      'expo-router': { source: 'expo/skills', sourceType: 'github', skillPath: '.agents/skill-library/mobile/expo/expo-router/SKILL.md', computedHash: 'hash' },
    },
  });
});
