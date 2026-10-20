import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const hash = text => createHash('sha256').update(text).digest('hex');
export function buildExperts(manifest, read = path => readFileSync(resolve(root, path), 'utf8')) {
  if (manifest.schemaVersion !== 1 || manifest.id !== 'promptpad-experts' ||
      !/^\d+\.\d+\.\d+$/.test(manifest.version) || !/^[a-f0-9]{40}$/.test(manifest.sourceCommit) ||
      !Number.isFinite(Date.parse(manifest.releasedAt))) throw new Error('Invalid expert manifest');
  const seen = new Set();
  const prompts = manifest.experts.flatMap(expert => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(expert.key) || seen.has(expert.key) ||
        expert.path !== `skills/promptpad-experts/references/${expert.key}.md` ||
        !/^\d+\.\d+\.\d+$/.test(expert.version) || !expert.domain) throw new Error('Invalid or duplicate expert');
    seen.add(expert.key);
    const source = read(expert.path).replace(/\r\n/g, '\n');
    const sections = source.match(/^# [^\n]+\n+## 中文\n([\s\S]+?)\n## English\n([\s\S]+)$/);
    if (!sections) throw new Error(`Missing bilingual sections: ${expert.path}`);
    return ['zh-CN', 'en'].map((locale, index) => {
      const content = sections[index + 1].trim() + '\n';
      const label = locale === 'zh-CN' ? '适用' : 'Use for';
      const description = content.match(new RegExp(`^\\*\\*${label}[：:]\\*\\*\\s*(.+)`, 'm'))?.[1];
      if (!expert.title[locale]?.trim() || !description || !content.includes(locale === 'zh-CN' ? '**交付：**' : '**Deliver:**')) {
        throw new Error(`Incomplete expert: ${expert.key}/${locale}`);
      }
      return {
        id: `builtin:${expert.key}:${locale}`, title: expert.title[locale], content,
        tags: [expert.domain, expert.key], variables: [], favorite: false, pinned: false,
        createdAt: manifest.releasedAt, updatedAt: manifest.releasedAt,
        origin: 'builtin', expertKey: expert.key, locale, domain: expert.domain,
        description, useWhen: description, packageId: manifest.id,
        contentVersion: expert.version, contentHash: hash(content),
        sourcePath: expert.path, sourceCommit: manifest.sourceCommit,
      };
    });
  });
  if (!prompts.length) throw new Error('Empty expert package');
  return { schemaVersion: 1, id: manifest.id, version: manifest.version, prompts };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(readFileSync(resolve(root, 'content/experts/manifest.json'), 'utf8'));
  const output = JSON.stringify(buildExperts(manifest), null, 2) + '\n';
  const target = resolve(root, 'src-tauri/resources/experts.json');
  if (process.argv.includes('--check')) {
    if (readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== output) throw new Error('Expert package is stale; run pnpm experts:build');
  } else writeFileSync(target, output);
  console.log(`Validated ${manifest.experts.length} experts / ${JSON.parse(output).prompts.length} language records`);
}
