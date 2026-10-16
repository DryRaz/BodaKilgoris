// Generates docs/SWAHILI_REVIEW.md: every Swahili string next to its English source, so a
// native speaker can review them in one pass. Re-run after changing messages/*.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (f) => JSON.parse(fs.readFileSync(path.join(root, 'messages', f), 'utf8'));
const en = load('en.json');
const sw = load('sw.json');

const flatten = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? flatten(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

const SECTION_NOTES = {
  geo: 'Legal-ish consent text. Please check it is clear and complete: people must understand what is shared and with whom.',
  errors: 'Shown to people when something fails: must be short and not blaming.',
  ride: 'Ride status words appear as small badges: they must stay short.',
  admin: 'Used only by the admin: lower priority, but numbers/terms should be consistent.',
};

const flatSw = new Map(flatten(sw));
const sections = new Map();
for (const [key, value] of flatten(en)) {
  const section = key.split('.')[0];
  if (!sections.has(section)) sections.set(section, []);
  sections.get(section).push([key, value, flatSw.get(key)]);
}

let out = `# Swahili translations to review (à relire)

**Status: every string below is a machine-assisted first draft and has NOT been reviewed by a native speaker.**
The goal was simple, everyday spoken Swahili (as used in Kilgoris / western Kenya), not literary Swahili.

How to review: edit \`messages/sw.json\` directly (keep the \`{placeholders}\` exactly as they are), then run
\`npm run i18n:check\` and \`npm run i18n:review\` to refresh this file.

## Terms worth a second opinion

| Concept | Used | Alternatives to consider |
|---|---|---|
| Boda rider | dereva wa Boda | mwendesha boda, bodaboda |
| Client / passenger | mteja | abiria |
| Ride request | ombi la safari | oda ya safari |
| "I am available" | Niko tayari | Nipo, Nipo kazini |
| "I am not available" | Siko tayari | Sipo, Sipo kazini |
| Pick-up point (client side) | Mahali pa kuchukuliwa | Kituo cha kuchukuliwa |
| Pick-up point (Boda side) | Mahali pa kumchukua mteja | Mahali pa kuchukua abiria |
| Confirm the ride | Thibitisha safari | Kubali safari imefanyika |
| Suspect (flagged ride) | Ina mashaka | Inatiliwa shaka |
| Cash | pesa taslimu | cash (many people just say "cash") |
| Plate number | Nambari ya pikipiki | Namba ya pikipiki |

Total strings: ${flatten(en).length}

`;

for (const [section, rows] of sections) {
  out += `## ${section}\n\n`;
  if (SECTION_NOTES[section]) out += `_${SECTION_NOTES[section]}_\n\n`;
  out += '| Key | English | Kiswahili (à relire) |\n|---|---|---|\n';
  for (const [key, e, s] of rows) out += `| \`${key}\` | ${esc(e)} | ${esc(s)} |\n`;
  out += '\n';
}

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs', 'SWAHILI_REVIEW.md'), out);
console.log(`docs/SWAHILI_REVIEW.md written (${flatten(en).length} strings)`);
