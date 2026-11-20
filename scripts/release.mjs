import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: opts.capture ? 'pipe' : 'inherit' });
}

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const rawTag = argv.find(a => !a.startsWith('-')) || `v${pkg.version}`;
const tag = rawTag.startsWith('v') ? rawTag : `v${rawTag}`;

if (!/^v\d+\.\d+\.\d+(?:[-.][0-9A-Za-z.]+)?$/.test(tag)) {
  console.error(`Invalid release tag: ${tag}`);
  process.exit(1);
}

const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { capture: true }).trim();
if (branch !== 'main') {
  console.error(`Release must be run from main (current branch: ${branch}).`);
  process.exit(1);
}

const dirty = run('git', ['status', '--porcelain'], { capture: true }).trim();
if (dirty) {
  console.error('Working tree is not clean. Commit or stash changes first.');
  process.exit(1);
}

console.log('Running tests...');
run(process.execPath, ['--test', 'test/*.test.mjs']);

const existingTags = run('git', ['tag', '--list', tag], { capture: true }).trim();
if (dryRun) {
  console.log(`[dry-run] Would ${existingTags ? 'reuse' : 'create'} tag ${tag} and push main + ${tag} to origin.`);
  process.exit(0);
}

if (!existingTags) run('git', ['tag', '-a', tag, '-m', `Release ${tag}`]);
run('git', ['push', 'origin', 'main']);
run('git', ['push', 'origin', tag]);
console.log(`Pushed ${tag}. GitHub Actions will build and publish the Release automatically.`);
