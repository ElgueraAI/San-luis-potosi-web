// Internal link check over the built site (dist/). Every href/src that points
// inside the site must resolve to a file. External links are counted, not fetched.
//   node scripts/verify/links.mjs
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('dist');
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.html')) files.push(p);
  }
})(DIST);

const missing = new Map();
const external = new Set();
let checked = 0;
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  for (const m of html.matchAll(/(href|src|srcset)="([^"]+)"/g)) {
    const vals = m[1] === 'srcset' ? m[2].split(/,\s*/).map((s) => s.trim().split(/\s+/)[0]) : [m[2]];
    for (let u of vals) {
      if (/^(https?:|mailto:|tel:|data:|#|javascript:)/.test(u)) { if (/^https?:/.test(u)) external.add(u); continue; }
      u = u.split('#')[0].split('?')[0];
      if (!u) continue;
      checked++;
      const abs = u.startsWith('/') ? path.join(DIST, decodeURIComponent(u)) : path.join(path.dirname(f), decodeURIComponent(u));
      const ok = fs.existsSync(abs) && (fs.statSync(abs).isFile() || fs.existsSync(path.join(abs, 'index.html')));
      if (!ok) missing.set(u, (missing.get(u) ?? 0) + 1);
    }
  }
}
console.log(`${files.length} pages, ${checked} internal references checked, ${external.size} distinct external links`);
if (missing.size) {
  console.log('MISSING:');
  for (const [u, n] of missing) console.log(`  ${u}  (${n}x)`);
  process.exitCode = 1;
} else console.log('No broken internal links.');
