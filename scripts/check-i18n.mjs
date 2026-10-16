// Fails (exit 1) when messages/*.json files drift apart: missing keys, extra keys,
// or ICU placeholders ({name}, {count, plural, ...}) that do not match the English source.
// Runs automatically before `npm run build`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'messages');
const SOURCE = 'en';

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, String(v)]],
  );

// variable names used by a message, ignoring plural/select branch text
const placeholders = (msg) => {
  const names = new Set();
  const re = /\{\s*([a-zA-Z_][\w]*)\s*[,}]/g;
  let m;
  while ((m = re.exec(msg))) names.add(m[1]);
  return [...names].sort().join(',');
};

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
const load = (f) => new Map(flatten(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))));
const source = load(`${SOURCE}.json`);
let errors = 0;

for (const f of files) {
  if (f === `${SOURCE}.json`) continue;
  const lang = load(f);
  for (const [k, v] of source) {
    if (!lang.has(k)) { console.error(`[${f}] missing key: ${k}`); errors++; continue; }
    if (placeholders(v) !== placeholders(lang.get(k))) {
      console.error(`[${f}] placeholder mismatch in ${k}: "${placeholders(v)}" vs "${placeholders(lang.get(k))}"`);
      errors++;
    }
    if (!lang.get(k).trim()) { console.error(`[${f}] empty value: ${k}`); errors++; }
  }
  for (const k of lang.keys()) if (!source.has(k)) { console.error(`[${f}] unknown key: ${k}`); errors++; }
}

if (errors) { console.error(`\ni18n check failed: ${errors} problem(s)`); process.exit(1); }
console.log(`i18n OK: ${files.length} languages, ${source.size} keys each`);
