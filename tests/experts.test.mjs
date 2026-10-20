import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { buildExperts } from '../scripts/build-experts.mjs';
import { markdownExport, personalCopy } from '../src/lib/prompt-model.ts';
import { parseIncoming } from '../src/lib/import.ts';
import { buildSkillMarkdown } from '../src/lib/skill-export.ts';
const manifest = JSON.parse(readFileSync(new URL('../content/experts/manifest.json', import.meta.url)));
const bundle = JSON.parse(readFileSync(new URL('../src-tauri/resources/experts.json', import.meta.url)));
test('eight bilingual experts build deterministically into the embedded bundle', () => {
  assert.deepEqual(buildExperts(manifest), bundle);
  assert.equal(bundle.prompts.length, 16);
  assert.equal(new Set(bundle.prompts.map(p => p.id)).size, 16);
  assert.deepEqual(buildExperts(manifest), buildExperts(manifest));
});
test('missing sections, duplicate identities and invalid versions fail the build', () => {
  assert.throws(() => buildExperts(manifest, () => '# Missing sections'), /Missing/);
  assert.throws(() => buildExperts({ ...manifest, experts: [manifest.experts[0], manifest.experts[0]] }), /duplicate/);
  assert.throws(() => buildExperts({ ...manifest, version: 'next' }), /Invalid/);
});
test('personal copies preserve lineage and do not claim the builtin package identity', () => {
  const source = bundle.prompts[0];
  const copy = personalCopy(source);
  assert.equal(copy.origin, 'user');
  assert.notEqual(copy.id, source.id);
  assert.equal(copy.derivedFromId, source.id);
  assert.equal(copy.baseVersion, source.contentVersion);
  assert.equal(copy.packageId, undefined);
  const [roundtrip] = parseIncoming('copy.md', markdownExport(copy));
  assert.equal(roundtrip.content, copy.content);
  assert.equal(roundtrip.derivedFromId, source.id);
  assert.equal(roundtrip.baseVersion, source.contentVersion);
});
test('JSON v2 and Markdown expert imports become stable personal records', () => {
  const source=bundle.prompts[0];
  for (const [path,text] of [['expert.md',markdownExport(source)],['export.json',JSON.stringify({schemaVersion:2,prompts:[source]})]]) {
    const [p]=parseIncoming(path,text);
    assert.equal(p.id,`imported:${source.id}`);
    assert.equal(p.origin,'user');
    assert.equal(p.packageId,undefined);
    assert.equal(p.derivedFromId,source.id);
    assert.equal(p.content,source.content);
  }
  assert.throws(() => parseIncoming('future.json',JSON.stringify({schemaVersion:99,prompts:[source]})), /版本/);
});
test('Skill export describes the expert version and retains complete instructions', () => {
  const source=bundle.prompts[0];
  const text=buildSkillMarkdown(source,'product-expert','产品需求分析');
  assert.ok(text.includes('source version: 1.0.0'));
  assert.ok(text.includes(source.content.trimEnd()));
});
