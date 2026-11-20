import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { settingsCommand } from '../cli/settings.mjs';
import { configure, parseArgs } from '../cli/install.mjs';
import { skillPath } from '../cli/skill-install.mjs';
import { DEFAULT_SETTINGS, MODES } from '../cli/statusline.mjs';

function setup(t, opts = {}) {
  const home = mkdtempSync(join(tmpdir(), 'capsule portable '));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  configure('install', { home, ...opts });
  const dir = join(home, '.gemini', 'config', 'agy-capsule', 'cli');
  return { home, dir, path: join(dir, 'settings.json') };
}

test('settings helper views without writing, patches selected values, preserves extensions, resets', t => {
  const { dir, path } = setup(t);
  writeFileSync(path, '\uFEFF' + JSON.stringify({ mode: 'standard', context: 'off', cache: 'dot', quota: 'text', extra: 7 }));
  const before = readFileSync(path);
  const shown = settingsCommand(['show'], dir);
  assert.deepEqual(shown.settings, { ...DEFAULT_SETTINGS, mode: 'standard', context: 'off', cache: 'dot', quota: 'text', show: { ...MODES.standard } });
  assert.deepEqual(shown.overrides, {});
  assert.deepEqual(shown.defaultsUsed, []);
  assert.deepEqual(readFileSync(path), before);

  assert.deepEqual(settingsCommand(['set', 'cache', 'text', 'quota', 'off'], dir).settings,
    { ...DEFAULT_SETTINGS, mode: 'standard', context: 'off', cache: 'text', quota: 'off', show: { ...MODES.standard } });
  assert.equal(JSON.parse(readFileSync(path)).extra, 7);

  assert.deepEqual(settingsCommand(['reset'], dir).settings, DEFAULT_SETTINGS);
  assert.equal(JSON.parse(readFileSync(path)).extra, 7);
});

test('mode switching, 12 visibility toggles, quota labels, textColor and legacy compact migration work cleanly', t => {
  const { dir, path } = setup(t);
  // Legacy personal config with compact: true
  writeFileSync(path, JSON.stringify({ context: 'text', cache: 'dot', quota: 'dot', compact: true }));
  const legacyShown = settingsCommand(['show'], dir);
  assert.equal(legacyShown.settings.mode, 'compact');
  assert.deepEqual(legacyShown.settings.show, MODES.compact);
  assert.deepEqual(legacyShown.defaultsUsed, []);

  // Enable cache + quota-group on top of compact mode (also migrates legacy compact -> mode)
  const withCache = settingsCommand(['enable', 'cache', 'quota-group'], dir);
  assert.equal(withCache.settings.mode, 'compact');
  assert.equal(withCache.settings.show.cache, true);
  assert.equal(withCache.settings.show.quotaGroup, true);
  assert.deepEqual(withCache.overrides, { cache: true, quotaGroup: true });
  const savedDisk = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal('compact' in savedDisk, false);
  assert.deepEqual(savedDisk.show, { cache: true, quotaGroup: true });

  // Disabling back to preset default prunes overrides cleanly
  const backToCompact = settingsCommand(['disable', 'cache', 'quotaGroup'], dir);
  assert.deepEqual(backToCompact.overrides, {});
  assert.equal('show' in JSON.parse(readFileSync(path, 'utf8')), false);

  // Shorthand reset toggles both reset5h and resetWeekly
  const noReset = settingsCommand(['disable', 'reset'], dir);
  assert.equal(noReset.settings.show.reset5h, false);
  assert.equal(noReset.settings.show.resetWeekly, false);
  const onlyWeeklyReset = settingsCommand(['enable', 'reset-weekly'], dir);
  assert.equal(onlyWeeklyReset.settings.show.reset5h, false);
  assert.equal(onlyWeeklyReset.settings.show.resetWeekly, true);

  // Context & Cache label modes (en / zh / off) + quota window labels & textColor
  const styled = settingsCommand([
    'set', 'contextLabel', '上下文', 'cacheLabel', '缓存',
    'quota5hLabel', '5h', 'quotaWeeklyLabel', '周', 'textColor', 'muted',
  ], dir);
  assert.equal(styled.settings.contextLabel, 'zh');
  assert.equal(styled.settings.cacheLabel, 'zh');
  assert.equal(styled.settings.quota5hLabel, 'short');
  assert.equal(styled.settings.quotaWeeklyLabel, 'zh');
  assert.equal(styled.settings.textColor, 'muted');

  const bothLabels = settingsCommand(['set', 'quotaLabel', 'off'], dir);
  assert.equal(bothLabels.settings.quota5hLabel, 'off');
  assert.equal(bothLabels.settings.quotaWeeklyLabel, 'off');

  // Switch preset with mode command resets show overrides and contextLabel/cacheLabel, preserving alerts/quotaLabels/textColor
  const toStandard = settingsCommand(['mode', 'standard'], dir);
  assert.equal(toStandard.settings.mode, 'standard');
  assert.equal(toStandard.settings.contextLabel, 'en');
  assert.equal(toStandard.settings.cacheLabel, 'en');
  assert.equal(toStandard.settings.quota5hLabel, 'off');
  assert.equal(toStandard.settings.textColor, 'muted');
  assert.equal(toStandard.settings.show.reset5h, true);
  assert.deepEqual(toStandard.overrides, {});

  // Full idempotent configurator command round-trip
  const fromConfigurator = settingsCommand([
    'set', 'mode', 'compact', 'textColor', 'inherit', 'context', 'text', 'cache', 'dot', 'quota', 'text',
    'contextLabel', 'zh', 'cacheLabel', 'zh', 'quota5hLabel', 'short', 'quotaWeeklyLabel', 'short',
    'show.cache', 'on', 'show.resetWeekly', 'off', 'show.quotaWeekly', 'on',
  ], dir);
  assert.equal(fromConfigurator.settings.mode, 'compact');
  assert.equal(fromConfigurator.settings.textColor, 'inherit');
  assert.equal(fromConfigurator.settings.quota, 'text');
  assert.equal(fromConfigurator.settings.contextLabel, 'zh');
  assert.equal(fromConfigurator.settings.cacheLabel, 'zh');
  assert.equal(fromConfigurator.settings.quota5hLabel, 'short');
  assert.equal(fromConfigurator.settings.quotaWeeklyLabel, 'short');
  assert.equal(fromConfigurator.settings.show.cache, true);
  assert.equal(fromConfigurator.settings.show.resetWeekly, false);
  assert.deepEqual(fromConfigurator.overrides, { cache: true, resetWeekly: false });
});

test('invalid settings edits and malformed JSON leave the file unchanged', t => {
  const { dir, path } = setup(t);
  for (const args of [
    ['set', 'cache', 'off', 'context', 'dot'],
    ['set', 'unknown', 'text'],
    ['set', 'mode', 'ultra'],
    ['set', 'textColor', 'rainbow'],
    ['set', 'quota5hLabel', 'bogus'],
    ['set', 'show.cache', 'maybe'],
    ['set', 'show.unknown', 'on'],
    ['mode', 'ultra'],
    ['enable', 'unknown'],
    ['disable'],
    ['reset', 'extra'],
  ]) {
    const before = readFileSync(path);
    assert.throws(() => settingsCommand(args, dir));
    assert.deepEqual(readFileSync(path), before);
  }
  writeFileSync(path, '{broken');
  assert.throws(() => settingsCommand(['reset'], dir));
  assert.equal(readFileSync(path, 'utf8'), '{broken');
});

test('default install registers /capsule-guide skill without creating .codex; --no-skill skips skill', t => {
  const { home, dir, path } = setup(t);
  const targetSkill = skillPath(home);
  assert.equal(existsSync(targetSkill), true);
  assert.equal(existsSync(join(home, '.codex')), false);
  assert.equal(existsSync(join(dir, 'settings.mjs')), true);
  assert.match(readFileSync(targetSkill, 'utf8'), /<!-- agy-capsule-cli: managed skill -->/);
  assert.match(readFileSync(targetSkill, 'utf8'), /^name: capsule-guide$/m);

  // Re-install succeeds (owned by us)
  const msg = configure('install', { home });
  assert.match(msg, /\/capsule-guide skill/);

  // Uninstall keeps display preferences and skill
  settingsCommand(['set', 'cache', 'off'], dir);
  configure('uninstall', { home });
  assert.equal(existsSync(join(dir, 'settings.mjs')), false);
  assert.equal(JSON.parse(readFileSync(path)).cache, 'off');
  assert.equal(existsSync(targetSkill), true);
  assert.throws(() => settingsCommand(['show'], dir), /not installed/);

  // --no-skill install leaves skill directories alone
  const homeNoSkill = mkdtempSync(join(tmpdir(), 'capsule noskill '));
  t.after(() => rmSync(homeNoSkill, { recursive: true, force: true }));
  const noSkillMsg = configure('install', { home: homeNoSkill, withSkill: false });
  assert.match(noSkillMsg, /without agent skill/);
  assert.equal(existsSync(skillPath(homeNoSkill)), false);
});

test('an unrelated capsule-guide skill blocks default install and stays untouched with --no-skill', t => {
  const home = mkdtempSync(join(tmpdir(), 'capsule conflict '));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const targetSkill = skillPath(home);
  mkdirSync(join(home, '.gemini', 'skills', 'capsule-guide'), { recursive: true });
  writeFileSync(targetSkill, 'someone else owns this skill');

  // Default install refuses to overwrite unrelated skill
  assert.throws(() => configure('install', { home }), /not overwritten/);
  assert.equal(readFileSync(targetSkill, 'utf8'), 'someone else owns this skill');

  // --no-skill skips skill check and leaves unrelated skill untouched
  configure('install', { home, withSkill: false });
  assert.equal(readFileSync(targetSkill, 'utf8'), 'someone else owns this skill');
});

test('install CLI argument parsing handles default skill, --no-skill, uninstall, help and invalid options', () => {
  assert.deepEqual(parseArgs([]), { action: 'install', withSkill: true });
  assert.deepEqual(parseArgs(['install']), { action: 'install', withSkill: true });
  assert.deepEqual(parseArgs(['--no-skill']), { action: 'install', withSkill: false });
  assert.deepEqual(parseArgs(['install', '--no-skill']), { action: 'install', withSkill: false });
  assert.deepEqual(parseArgs(['uninstall']), { action: 'uninstall', withSkill: true });
  assert.deepEqual(parseArgs(['--help']), { action: 'help', withSkill: true });
  assert.throws(() => parseArgs(['uninstall', '--no-skill']));
  assert.throws(() => parseArgs(['uninstall', '--with-skill']));
  assert.throws(() => parseArgs(['--bogus']));
  assert.throws(() => parseArgs(['unknown']));
});
