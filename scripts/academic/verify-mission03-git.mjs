// Verify the index (default) or an immutable commit with --ref <commit>.
// Export only Git input blobs into isolation; private raw is a read-only ETL input
// supplied by a temporary junction, never added to Git or copied into outputs.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { canonicalText } from './etl-mission03.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ref = process.argv[2] === '--ref' ? process.argv[3] : '';
const blob = (name) => execFileSync('git', ['show', `${ref}:${name}`], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(blob('research/curated/mission03/manifest.json'));
const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'slp-m03-git-'));
const rawLink = path.join(isolated, 'research/raw');
try {
  const baselineHashes = [];
  for (const input of manifest.inputs) {
    const gitBytes = blob(input.path);
    const working = fs.readFileSync(path.join(root, input.path));
    const represent = (b) => input.representation === 'original_bytes_immutable' ? b : canonicalText(b);
    assert.equal(sha(represent(gitBytes)), input.sha256, input.path + ': Git hash');
    assert.equal(sha(represent(working)), input.sha256, input.path + ': work hash');
    assert.equal(represent(gitBytes).length, input.bytes, input.path + ': bytes');
    if (input.representation === 'original_bytes_immutable') {
      assert.deepEqual(gitBytes, working, input.path);
      baselineHashes.push({ path: input.path, sha256: input.sha256 });
    }
    const target = path.resolve(isolated, input.path);
    assert.ok(target.startsWith(isolated + path.sep));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, gitBytes);
  }
  fs.symlinkSync(path.join(root, 'research/raw'), rawLink, process.platform === 'win32' ? 'junction' : 'dir');
  const { buildMission03 } = await import(pathToFileURL(path.join(isolated, 'scripts/academic/etl-mission03.mjs')).href);
  const result = buildMission03({ root: isolated, write: false });
  for (const [name, product] of Object.entries(result.products)) {
    assert.deepEqual(Buffer.from(JSON.stringify(product, null, 2) + '\n'), blob('research/curated/mission03/' + name), name);
  }
  console.log(JSON.stringify({ git_source: ref || 'index', run_id: manifest.run_id, input_hashes_verified: manifest.inputs.length, outputs_identical: Object.keys(result.products).length, accepted: result.report.accepted_rows, quarantined: result.report.quarantined_rows, historical_evidence: baselineHashes, private_raw: 'external original bytes verified; not part of Git export' }, null, 2));
} finally {
  if (fs.existsSync(rawLink)) fs.unlinkSync(rawLink);
  assert.equal(path.dirname(isolated), path.resolve(os.tmpdir()));
  assert.ok(path.basename(isolated).startsWith('slp-m03-git-'));
  fs.rmSync(isolated, { recursive: true, force: true });
}
