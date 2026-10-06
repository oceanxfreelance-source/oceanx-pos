/** Regenerate docs/TRANSLATION-REVIEW.md from locales/review/dv.json: npx tsx packages/shared/scripts/review-md.ts */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReviewItem } from '../src/i18nCheck';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const items: ReviewItem[] = JSON.parse(readFileSync(path.join(root, 'packages/shared/locales/review/dv.json'), 'utf8'));
const esc = (s: string) => s.replaceAll('|', '\\|');
const rows = items
  .sort((a, b) => (a.status === b.status ? a.key.localeCompare(b.key) : a.status === 'needs_review' ? -1 : 1))
  .map((i) => `| \`${i.key}\` | ${esc(i.english)} | ${esc(i.suggested)} | ${i.status} | ${esc(i.notes)} |`);
const counts = items.reduce<Record<string, number>>((a, i) => ((a[i.status] = (a[i.status] ?? 0) + 1), a), {});
writeFileSync(
  path.join(root, 'docs/TRANSLATION-REVIEW.md'),
  `# Dhivehi translation review

Generated from \`packages/shared/locales/review/dv.json\` — edit that file, then run
\`npx tsx packages/shared/scripts/review-md.ts\`.

Status: ${Object.entries(counts)
    .map(([k, v]) => `**${k}**: ${v}`)
    .join(' · ')}

All other Dhivehi strings (\`packages/shared/locales/dv.json\`, 764 keys) are complete drafts using common Maldivian
business usage (English loanwords in Thaana for system terms such as ޕާސްވޯޑް, ސެޓިންގްސް, އިންވޮއިސް). A native
review of the whole file is still recommended before launch.

| Translation key | English | Suggested Dhivehi | Status | Notes |
| --- | --- | --- | --- | --- |
${rows.join('\n')}
`,
);
console.log(`Wrote ${items.length} items`);
