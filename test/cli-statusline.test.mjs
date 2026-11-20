import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  renderStatusline, resetText, renderModelLine, responseCompletedAt, readLastResponseAt,
  DEFAULT_SETTINGS, MODES, normalizeSettings, readSettings, PALETTES, readTheme, displayWidth,
} from '../cli/statusline.mjs';
import { configure } from '../cli/install.mjs';

const samples = JSON.parse(readFileSync(new URL('./fixtures/cli-statusline-1.5.10.json', import.meta.url), 'utf8'));
const now = Date.parse('2026-11-17T12:30:00Z');
const plain = p => renderStatusline(p, { now });

test('compact mode (and legacy compact: true) hides labels, cache and extra state without moving or recoloring quota', () => {
  const p = { ...samples.cachedResponse, agent_state: 'working', terminal_width: 120 };
  for (const theme of ['light', 'dark']) {
    const opts = { now, theme, color: true };
    const full = renderStatusline(p, opts);
    const compact = renderStatusline(p, { ...opts, settings: { mode: 'compact' } });
    const legacyCompact = renderStatusline(p, { ...opts, settings: { compact: true } });
    assert.equal(compact, legacyCompact);
    const right = full.slice(full.lastIndexOf('\x1b[38;2;', full.indexOf('Gemini')));
    assert.match(compact, /^1\.5% \(1\.0M\) +\x1b/);
    assert.ok(compact.endsWith(right.replace('Gemini ', '')));
    assert.equal(displayWidth(compact.replace(/\x1b\[[\d;]+m/g, '')), 118);
    assert.doesNotMatch(compact, /Ctx|Cache|working/);
  }
});

test('all 12 per-item visibility switches and quota label modes work independently', () => {
  const p = { ...samples.cachedResponse, agent_state: 'working', terminal_width: 120 };
  // Hide context: cache starts at column 0 without leading spaces, and context alert never colors cache %
  const noCtxPayload = structuredClone(p);
  noCtxPayload.context_window.used_percentage = 79.6; // intentionally matches cache hit 79.6%
  const noCtx = renderStatusline(noCtxPayload, { now, color: true, settings: { show: { context: false } } });
  assert.match(noCtx, /^Cache 79\.6% /);
  assert.doesNotMatch(noCtx, /\x1b\[38;2;152;97;0m79\.6%/);
  assert.doesNotMatch(noCtx, /Ctx|\(1\.0M\)/);

  // Hide capacity only
  const noCap = renderStatusline(p, { now, settings: { show: { capacity: false } } });
  assert.match(noCap, /^Ctx 1\.5%  Cache 79\.6% ●/);
  assert.doesNotMatch(noCap, /\(1\.0M\)/);

  // contextLabel modes: en (Ctx), zh (上下文), off (hidden), plus legacy show.contextLabel
  const noCtxLabel = renderStatusline(p, { now, settings: { contextLabel: 'off' } });
  assert.match(noCtxLabel, /^1\.5% \(1\.0M\)  Cache 79\.6% ●/);
  const zhCtxLabel = renderStatusline(p, { now, settings: { contextLabel: 'zh' } });
  assert.match(zhCtxLabel, /^上下文 1\.5% \(1\.0M\)  Cache 79\.6% ●/);
  assert.equal(displayWidth(zhCtxLabel), 118);

  // cacheLabel modes: en (Cache), zh (缓存), off (hidden), plus legacy show.cacheLabel
  const noCacheLabel = renderStatusline(p, { now, settings: { cacheLabel: 'off' } });
  assert.match(noCacheLabel, /^Ctx 1\.5% \(1\.0M\)  79\.6% ● \| working/);
  assert.doesNotMatch(noCacheLabel, /Cache/);
  const zhCacheLabel = renderStatusline(p, { now, settings: { cacheLabel: 'zh' } });
  assert.match(zhCacheLabel, /^Ctx 1\.5% \(1\.0M\)  缓存 79\.6% ● \| working/);
  assert.equal(displayWidth(zhCacheLabel), 118);
  const legacyNoCacheLabel = renderStatusline(p, { now, settings: { show: { cacheLabel: false } } });
  assert.equal(legacyNoCacheLabel, noCacheLabel);

  // Full Chinese prefixes align cleanly to terminal width
  const allZh = renderStatusline(p, { now, settings: { contextLabel: 'zh', cacheLabel: 'zh', quota5hLabel: 'zh', quotaWeeklyLabel: 'zh' } });
  assert.match(allZh, /^上下文 1\.5% \(1\.0M\)  缓存 79\.6% ● \| working +● Gemini 5小时 97% \(3h 0m\) 周 19% \(4d 0h\)$/);
  assert.equal(displayWidth(allZh), 118);

  // Hide cache only in standard mode
  const noCache = renderStatusline(p, { now, settings: { show: { cache: false } } });
  assert.match(noCache, /^Ctx 1\.5% \(1\.0M\) \| working +● Gemini/);
  assert.doesNotMatch(noCache, /Cache/);

  // Enable cache on top of compact mode (cacheLabel defaults off in compact, can be set to en/zh)
  const compactWithCacheNoLabel = renderStatusline(p, { now, settings: { mode: 'compact', show: { cache: true } } });
  assert.match(compactWithCacheNoLabel, /^1\.5% \(1\.0M\)  79\.6% ● +● 🕔 97%/);
  const compactWithCacheLabel = renderStatusline(p, { now, settings: { mode: 'compact', cacheLabel: 'zh', show: { cache: true } } });
  assert.match(compactWithCacheLabel, /^1\.5% \(1\.0M\)  缓存 79\.6% ● +● 🕔 97%/);

  // Hide state only
  const noState = renderStatusline(p, { now, settings: { show: { state: false } } });
  assert.doesNotMatch(noState, /working/);
  assert.match(noState, /Cache 79\.6% ●/);

  // Independent 5h & weekly reset countdowns + legacy show.reset compatibility
  const noReset5h = renderStatusline(p, { now, settings: { show: { reset5h: false } } });
  assert.ok(noReset5h.endsWith('● Gemini 🕔 97% 📅 19% (4d 0h)'));
  const noResetWeekly = renderStatusline(p, { now, settings: { show: { resetWeekly: false } } });
  assert.ok(noResetWeekly.endsWith('● Gemini 🕔 97% (3h 0m) 📅 19%'));
  const legacyNoReset = renderStatusline(p, { now, settings: { show: { reset: false } } });
  assert.ok(legacyNoReset.endsWith('● Gemini 🕔 97% 📅 19%'));

  // Independent 5h & weekly quota toggles + dot tone ignores hidden window
  const only5h = renderStatusline(p, { now, settings: { show: { quotaWeekly: false } } });
  assert.ok(only5h.endsWith('● Gemini 🕔 97% (3h 0m)'));
  assert.doesNotMatch(only5h, /📅|19%/);
  const onlyWeekly = renderStatusline(p, { now, settings: { show: { quota5h: false } } });
  assert.ok(onlyWeekly.endsWith('● Gemini 📅 19% (4d 0h)'));
  assert.doesNotMatch(onlyWeekly, /🕔|97%/);

  const hiddenRedWeekly = structuredClone(p);
  hiddenRedWeekly.quota['gemini-weekly'].remaining_fraction = 0.05;
  const hiddenWeeklyColor = renderStatusline(hiddenRedWeekly, { now, color: true, settings: { show: { quotaWeekly: false } } });
  assert.doesNotMatch(hiddenWeeklyColor, /208;42;48/); // hidden red weekly does not redden dot

  // Both quota5h and quotaWeekly off -> right side hidden cleanly
  const noBuckets = renderStatusline(p, { now, settings: { show: { quota5h: false, quotaWeekly: false } } });
  assert.equal(noBuckets, 'Ctx 1.5% (1.0M)  Cache 79.6% ● | working');

  // Quota window label styles: short (5h / w), zh (5小时 / 周) with CJK displayWidth alignment, off
  const shortLabels = renderStatusline(p, { now, settings: { quota5hLabel: 'short', quotaWeeklyLabel: 'short' } });
  assert.ok(shortLabels.endsWith('● Gemini 5h 97% (3h 0m) w 19% (4d 0h)'));
  assert.equal(displayWidth(shortLabels), 118);

  const zhLabels = renderStatusline(p, { now, settings: { quota5hLabel: 'zh', quotaWeeklyLabel: 'zh' } });
  assert.ok(zhLabels.endsWith('● Gemini 5小时 97% (3h 0m) 周 19% (4d 0h)'));
  assert.equal(displayWidth(zhLabels), 118);

  const offLabels = renderStatusline(p, { now, settings: { quota5hLabel: 'off', quotaWeeklyLabel: 'off' } });
  assert.ok(offLabels.endsWith('● Gemini 97% (3h 0m) 19% (4d 0h)'));
  assert.equal(displayWidth(offLabels), 118);

  // Hide quotaGroup only
  const noGroup = renderStatusline(p, { now, settings: { show: { quotaGroup: false } } });
  assert.ok(noGroup.endsWith('● 🕔 97% (3h 0m) 📅 19% (4d 0h)'));

  // Hide quota completely: no trailing padding, fits narrow widths too
  const noQuota = renderStatusline(p, { now, settings: { show: { quota: false } } });
  assert.equal(noQuota, 'Ctx 1.5% (1.0M)  Cache 79.6% ● | working');
  const noQuotaNarrow = renderStatusline({ ...p, terminal_width: 14 }, { now, settings: { show: { quota: false } } });
  assert.ok(displayWidth(noQuotaNarrow) <= 12);

  // Hide context + cache, keep state + quota
  const stateOnlyLeft = renderStatusline(p, { now, settings: { show: { context: false, cache: false } } });
  assert.match(stateOnlyLeft, /^working +● Gemini/);

  // Hide everything -> empty line
  const allHidden = renderStatusline(p, { now, settings: { show: { context: false, cache: false, state: false, quota: false } } });
  assert.equal(allHidden, '');
});

test('textColor controls row-2 body color (inherit, fixed, muted, plain) while keeping row-1 muted', () => {
  const p = structuredClone(samples.cachedResponse);
  p.context_window.used_percentage = 92;
  // Row 1 stays muted in inherit/fixed/muted and only drops ANSI in plain
  assert.notEqual(renderModelLine(p, true, 'dark', 'inherit'), renderModelLine(p, true, 'light', 'inherit'));
  assert.equal(renderModelLine(p, true, 'light', 'inherit'), renderModelLine(p, true, 'light', 'fixed'));
  assert.equal(renderModelLine(p, true, 'light', 'inherit'), renderModelLine(p, true, 'light', 'muted'));
  assert.equal(renderModelLine(p, true, 'dark', 'plain'), renderModelLine(p));

  // inherit (default): row 2 body has no base RGB, alerts & neutral dots tint normally
  const inheritOut = renderStatusline(p, { now, color: true, settings: { textColor: 'inherit' } });
  assert.match(inheritOut, /^Ctx \x1b\[38;2;208;42;48m92\.0%\x1b\[0m \(1\.0M\)/);

  // fixed: row 2 body painted in fixed black (light) / white (dark), alerts preserved
  const fixedLight = renderStatusline(p, { now, color: true, theme: 'light', settings: { textColor: 'fixed' } });
  const fixedDark = renderStatusline(p, { now, color: true, theme: 'dark', settings: { textColor: 'fixed' } });
  assert.match(fixedLight, /^\x1b\[38;2;22;22;22mCtx \x1b\[38;2;208;42;48m92\.0%\x1b\[38;2;22;22;22m \(1\.0M\)/);
  assert.match(fixedDark, /^\x1b\[38;2;241;243;245mCtx /);
  assert.equal(fixedLight.replace(/\x1b\[[\d;]+m/g, ''), plain(p));

  // muted: row 2 body painted in muted gray, alerts preserved
  const mutedLight = renderStatusline(p, { now, color: true, theme: 'light', settings: { textColor: 'muted' } });
  assert.match(mutedLight, /^\x1b\[38;2;91;107;115mCtx \x1b\[38;2;208;42;48m92\.0%\x1b\[38;2;91;107;115m \(1\.0M\)/);
  assert.equal(mutedLight.replace(/\x1b\[[\d;]+m/g, ''), plain(p));

  // plain: zero ANSI codes even with red alerts
  const plainOut = renderStatusline(p, { now, color: true, lastResponseAtMs: now - 240000, settings: { textColor: 'plain' } });
  assert.doesNotMatch(plainOut, /\x1b/);
});

test('real 1.5.10 cached response: context, cache hit and only the current Gemini pool', () => {
  const text = plain({ ...samples.cachedResponse, terminal_width: 120 });
  assert.match(text, /Ctx 1\.5% \(1\.0M\)  Cache 79\.6% ●/);
  assert.match(text, /● Gemini 🕔 97% \(3h 0m\) 📅 19% \(4d 0h\)/);
  assert.doesNotMatch(text, /Argon|Claude|Left:|Last out|Cache read|3P|TTFT|tok\/s|Think|Expired/);
  // 2,171 + 8,456 is not the CLI's 15,205-token context occupancy.
  assert.notEqual(samples.cachedResponse.context_window.used_percentage,
    (2171 + 8456) / 1048576 * 100);
  assert.equal(text.split('\n').length, 1);
  assert.equal(displayWidth(text), 118);
  assert.ok(text.endsWith('📅 19% (4d 0h)'));
});

test('before first response and missing fields never invent latest usage or limits', () => {
  assert.match(plain(samples.initial), /Ctx 0\.0% \(--\)/);
  assert.doesNotMatch(plain(samples.initial), /Last out|Cache read/);
  assert.match(plain({}), /Ctx -- \(--\) +--$/);
  assert.match(plain({ context_window: { used_percentage: null, context_window_size: 0, current_usage: {} } }), /Cache --/);
  assert.match(plain({ context_window: { current_usage: { input_tokens: 0, cache_read_input_tokens: 0 } } }), /Cache --/);
  assert.match(plain(samples.firstResponse), /Cache 0\.0%/);
});

test('quota semantics retain real zero, disabled windows disappear, amounts are not percentages', () => {
  const text = plain({ model: { id: 'gemini' }, quota: {
    'gemini-5h': { remaining_fraction: 0 },
    'gemini-weekly': { remaining_fraction: 1, disabled: true },
    'new-pool': { remaining_amount: 1200 },
    'unreported': {},
  } });
  assert.match(text, /Gemini 🕔 0%/);
  assert.doesNotMatch(text, /📅|new-pool|unreported/);
  assert.match(plain({ model: { id: 'gemini' }, quota: { 'gemini-weekly': { remaining_amount: 1200 } } }), /Gemini 📅 1\.2K units/);
  assert.match(plain({ model: { id: 'gemini' }, quota: { 'gemini-weekly': {} } }), /Gemini 📅 --/);
});

test('model switches select Argon or Claude; unknown models do not borrow another pool', () => {
  const argon = plain({ ...samples.cachedResponse, model: { display_name: 'Gemini 4 Argon' } });
  assert.match(argon, /Argon 📅 16%/);
  assert.doesNotMatch(argon, /Gemini|Claude|🕔/);
  const claude = plain({ ...samples.cachedResponse, model: { id: 'claude-sonnet-4-6' } });
  assert.match(claude, /Claude 📅 0%/);
  assert.doesNotMatch(claude, /Gemini|Argon|🕔/);
  assert.doesNotMatch(plain({ ...samples.cachedResponse, model: { id: 'custom-model' } }), /Gemini|Argon|Claude/);
  const quota = { ...samples.cachedResponse.quota };
  delete quota['gemini-argon-wtu-weekly'];
  assert.match(plain({ ...samples.cachedResponse, quota, model: { id: 'gemini-argon' } }), /Gemini 🕔/);
});

test('narrow rendering removes details and countdowns, retaining quota values without overflow', () => {
  for (const width of [1, 12, 20, 30, 40, 60, 80, 120]) {
    const text = plain({ ...samples.cachedResponse, terminal_width: width });
    assert.ok(displayWidth(text) <= Math.max(1, width - 2), `${width}: ${text}`);
    assert.equal(text.split('\n').length, 1);
    assert.ok(text.isWellFormed());
    assert.equal(displayWidth(text), Math.max(1, width - 2));
    if (width >= 40) assert.match(text, /Gemini 🕔 97%/);
  }
  const narrow = plain({ ...samples.cachedResponse, terminal_width: 40 });
  assert.doesNotMatch(narrow, /~|Last out|Cache read/);
});

test('absolute reset time wins over stale relative countdown; expired data never claims full quota', () => {
  assert.equal(resetText({ reset_time: '2026-11-17T12:32:00Z', reset_in_seconds: 9999 }, now), ' (2m)');
  assert.equal(resetText({ reset_in_seconds: 30 }, now), ' (<1m)');
  assert.equal(resetText({ reset_time: '2026-11-17T12:29:00Z' }, now), ' (due)');
  assert.equal(resetText({}, now), '');
});

test('color is optional and only adds controls owned by the renderer', () => {
  const p = { context_window: { used_percentage: 101, context_window_size: 1000 }, quota: { '\x1b[2Jbad\nlabel': { remaining_fraction: 0 } } };
  const text = renderStatusline(p, { color: true, now });
  assert.match(text, /\x1b\[38;2;208;42;48m101\.0%/);
  assert.doesNotMatch(text, /\x1b\[2J/);
  assert.equal(text.replace(/\x1b\[[\d;]+m/g, ''), plain(p));
});

test('cache warning turns yellow at 3m, red at 4m, and unknown times remain neutral', () => {
  const p = samples.cachedResponse;
  const renderAge = age => renderStatusline(p, {
    color: true, now, lastResponseAtMs: age === null ? null : now - age,
  });
  for (const age of [null, 179999, -1]) {
    assert.match(renderAge(age), /Cache 79\.6% \x1b\[38;2;138;144;151m●/);
  }
  assert.match(renderAge(180000), /Cache 79\.6% \x1b\[38;2;152;97;0m●\x1b\[0m/);
  assert.match(renderAge(239999), /Cache 79\.6% \x1b\[38;2;152;97;0m●/);
  assert.match(renderAge(240000), /Cache 79\.6% \x1b\[38;2;208;42;48m●\x1b\[0m/);
  assert.equal(renderAge(240000).replace(/\x1b\[[\d;]+m/g, ''), plain(p));
});

test('one quota dot: weekly red overrides, otherwise follows 5h; numbers stay neutral', () => {
  for (const [five, weekly, rgb] of [[.96,.68,'138;144;151'],[.25,.68,'152;97;0'],[.10,.68,'208;42;48'],[.96,.08,'208;42;48'],[.96,.19,'138;144;151']]) {
    const p = structuredClone(samples.cachedResponse);
    p.quota['gemini-5h'].remaining_fraction = five;
    p.quota['gemini-weekly'].remaining_fraction = weekly;
    const text = renderStatusline(p, { now, color: true });
    assert.ok(text.includes(`\x1b[38;2;${rgb}m●\x1b[0m Gemini`));
    assert.doesNotMatch(text, /\x1b\[[\d;]+m\d+%/);
    assert.equal((text.match(/●/g) || []).length, 2);
  }
  const p = structuredClone(samples.cachedResponse);
  p.model = { id: 'gemini-argon' };
  p.quota['gemini-argon-wtu-weekly'].remaining_fraction = .19;
  assert.match(renderStatusline(p, { now, color: true }), /\x1b\[38;2;138;144;151m●\x1b\[0m Argon/);
  p.quota['gemini-argon-wtu-weekly'].remaining_fraction = .08;
  assert.match(renderStatusline(p, { now, color: true }), /\x1b\[38;2;208;42;48m●\x1b\[0m Argon/);
});

test('all 18 reminder combinations independently control text, dots and off without affecting alignment', () => {
  const p = structuredClone(samples.cachedResponse);
  p.terminal_width = 120;
  p.context_window.used_percentage = 92;
  p.quota['gemini-5h'].remaining_fraction = .25;
  p.quota['gemini-weekly'].remaining_fraction = .08;
  for (const context of ['text', 'off']) for (const cache of ['text', 'dot', 'off']) for (const quota of ['text', 'dot', 'off']) {
    const settings = { context, cache, quota };
    const output = renderStatusline(p, { now, color: true, lastResponseAtMs: now - 240000, settings });
    const stripped = output.replace(/\x1b\[[\d;]+m/g, '');
    assert.equal(displayWidth(stripped), 118);
    assert.equal(stripped.split('\n').length, 1);
    assert.equal(output.includes('\x1b[38;2;208;42;48m92.0%'), context === 'text');
    assert.equal(output.includes('\x1b[38;2;208;42;48mCache 79.6%'), cache === 'text');
    assert.equal(/Cache 79\.6% \x1b\[38;2;208;42;48m●/.test(output), cache === 'dot');
    assert.equal(output.includes('\x1b[38;2;152;97;0m25%'), quota === 'text');
    assert.equal(output.includes('\x1b[38;2;208;42;48m8%'), quota === 'text');
    assert.equal(output.includes('\x1b[38;2;208;42;48m●\x1b[0m Gemini'), quota === 'dot');
    assert.equal((output.match(/●/g) || []).length, Number(cache === 'dot') + Number(quota === 'dot'));
    assert.equal(stripped, renderStatusline(p, { now, settings }));
  }
});

test('settings reload on each read; missing or invalid fields fall back independently', t => {
  const { home } = temporaryHome(t);
  const path = join(home, 'display.json');
  assert.deepEqual(readSettings(path), DEFAULT_SETTINGS);
  writeFileSync(path, JSON.stringify({ context: 'off', cache: 'text', quota: 'off' }));
  assert.deepEqual(readSettings(path), { ...DEFAULT_SETTINGS, context: 'off', cache: 'text', quota: 'off', show: { ...MODES.standard } });
  writeFileSync(path, JSON.stringify({
    context: 'dot', cache: 'off', quota: 'bad', mode: 'compact',
    textColor: 'muted', contextLabel: 'zh', cacheLabel: 'bad', quota5hLabel: 'zh', quotaWeeklyLabel: 'invalid',
    show: { cache: true, reset: 'nope' },
  }));
  assert.deepEqual(readSettings(path), {
    mode: 'compact', textColor: 'muted', context: 'text', cache: 'off', quota: 'dot',
    contextLabel: 'zh', cacheLabel: 'off', quota5hLabel: 'zh', quotaWeeklyLabel: 'icon',
    show: { ...MODES.compact, cache: true },
  });
  writeFileSync(path, JSON.stringify({ compact: true }));
  assert.deepEqual(readSettings(path), {
    ...DEFAULT_SETTINGS, mode: 'compact', contextLabel: 'off', cacheLabel: 'off', show: { ...MODES.compact },
  });
  writeFileSync(path, '{broken');
  assert.deepEqual(readSettings(path), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
});

test('install creates display defaults, updates and uninstall keep user choices', t => {
  const { home } = temporaryHome(t);
  configure('install', { home });
  const path = join(home, '.gemini', 'config', 'agy-capsule', 'cli', 'settings.json');
  assert.deepEqual(readSettings(path), DEFAULT_SETTINGS);
  const custom = { mode: 'compact', textColor: 'muted', context: 'off', cache: 'text', quota: 'off', quota5hLabel: 'short', show: { cache: true } };
  writeFileSync(path, JSON.stringify(custom));
  const expected = normalizeSettings(custom);
  configure('install', { home });
  assert.deepEqual(readSettings(path), expected);
  configure('uninstall', { home });
  assert.deepEqual(readSettings(path), expected);
});

test('model row keeps name, effort and shortcut hint, without credits', () => {
  const row = renderModelLine(samples.cachedResponse);
  assert.match(row, /^\? for shortcuts +Gemini 4 Hydrogen · medium$/);
  assert.equal(row.length, 78);
  assert.doesNotMatch(row, /Credits|Out of credits/i);
});

test('cache time comes from the last completed model response, not later tool or running steps', async t => {
  const { DatabaseSync } = await import('node:sqlite');
  const { home } = temporaryHome(t);
  const id = '00000000-0000-0000-0000-000000000001';
  const dir = join(home, '.gemini', 'antigravity-cli', 'conversations');
  mkdirSync(dir, { recursive: true });
  const metadata = Buffer.from([0x0a, 2, 8, 9, 0x42, 2, 8, 1]);
  assert.equal(responseCompletedAt(metadata), 1000);
  assert.equal(responseCompletedAt(Buffer.from([0x42, 9, 8])), null);
  const db = new DatabaseSync(join(dir, id + '.db'));
  db.exec('CREATE TABLE steps (idx INTEGER PRIMARY KEY, step_type INTEGER, status INTEGER, metadata BLOB)');
  const insert = db.prepare('INSERT INTO steps VALUES (?, ?, ?, ?)');
  insert.run(1, 15, 3, metadata);
  insert.run(2, 20, 3, Buffer.from([0x42, 2, 8, 2]));
  insert.run(3, 15, 1, Buffer.from([0x42, 2, 8, 3]));
  db.close();
  assert.equal(await readLastResponseAt({ ...samples.cachedResponse, conversation_id: id }, home), 1000);
  assert.equal(await readLastResponseAt({ ...samples.cachedResponse, conversation_id: '../outside' }, home), null);
});

test('stdin entry point renders a real payload and survives malformed JSON', () => {
  for (const input of [JSON.stringify(samples.cachedResponse), '{bad']) {
    const result = spawnSync(process.execPath, ['cli/statusline.mjs', '--plain'], { cwd: resolve('.'), input, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Ctx /);
    assert.doesNotMatch(result.stdout, /\x1b/);
  }
});

function temporaryHome(t) {
  const home = mkdtempSync(join(tmpdir(), 'agy capsule test '));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const settingsPath = join(home, '.gemini', 'antigravity-cli', 'settings.json');
  mkdirSync(join(home, '.gemini', 'antigravity-cli'), { recursive: true });
  return { home, settingsPath, read: () => JSON.parse(readFileSync(settingsPath, 'utf8')) };
}

test('install and re-install preserve unrelated settings; uninstall restores original renderer', t => {
  const { home, settingsPath, read } = temporaryHome(t);
  const original = { model: 'keep-me', statusLine: { command: 'original', enabled: false }, other: { nested: true } };
  writeFileSync(settingsPath, JSON.stringify(original));
  configure('install', { home });
  configure('install', { home });
  assert.equal(read().model, 'keep-me');
  assert.equal(read().statusLine.stack_with_default, false);
  configure('uninstall', { home });
  assert.deepEqual(read(), original);
});

test('uninstall respects a subsequently selected renderer and absent original statusLine', t => {
  const { home, settingsPath, read } = temporaryHome(t);
  configure('install', { home });
  configure('uninstall', { home });
  assert.deepEqual(read(), {});
  configure('install', { home });
  writeFileSync(settingsPath, JSON.stringify({ ...read(), statusLine: { command: 'new-user-choice' } }));
  configure('uninstall', { home });
  assert.equal(read().statusLine.command, 'new-user-choice');
});

test('installed command works through the host shell with spaces in paths', t => {
  const { home, read } = temporaryHome(t);
  configure('install', { home });
  const command = read().statusLine.command;
  const windows = process.platform === 'win32';
  // Default Windows argv escaping reproduces the host's Go exec behavior.
  const result = spawnSync(windows ? process.env.ComSpec : '/bin/sh', windows ? ['/c', command] : ['-c', command], {
    input: JSON.stringify(samples.cachedResponse), encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Cache 79\.6%/);
});

test('theme follows Windows day/night on each refresh while explicit AGY schemes win', t => {
  const { home, settingsPath } = temporaryHome(t);
  writeFileSync(settingsPath, JSON.stringify({ colorScheme: 'terminal' }));
  let light = true;
  const options = { home, platform: 'win32', env: {}, queryWindows: () => `AppsUseLightTheme REG_DWORD 0x${light ? 1 : 0}` };
  assert.equal(readTheme(options), 'light');
  light = false;
  assert.equal(readTheme(options), 'dark');
  writeFileSync(settingsPath, JSON.stringify({ colorScheme: 'solarized light' }));
  assert.equal(readTheme({ ...options, queryWindows: () => { throw new Error('must not query'); } }), 'light');
  writeFileSync(settingsPath, JSON.stringify({ colorScheme: 'tokyo night' }));
  assert.equal(readTheme(options), 'dark');
  writeFileSync(settingsPath, '{}');
  assert.equal(readTheme({ ...options, queryWindows: () => { throw new Error('registry unavailable'); } }), 'light');
  assert.equal(readTheme({ home, platform: 'linux', env: { COLORFGBG: '15;0' } }), 'dark');
  assert.equal(readTheme({ home, platform: 'linux', env: { COLORFGBG: '0;15' } }), 'light');
});

test('both palettes keep alert text readable on the light and dark preview backgrounds', () => {
  const luminance = rgb => rgb.map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
  const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
  for (const [theme, bg] of [['light', [250,249,246]], ['dark', [40,44,52]]]) {
    for (const tone of ['muted', 'amber', 'red']) {
      assert.ok(contrast(PALETTES[theme][tone], bg) >= 4.5, `${theme} ${tone} text contrast`);
    }
    assert.ok(contrast(PALETTES[theme].neutral, bg) >= 3, `${theme} neutral dot contrast`);
  }
});

test('day/night changes only colors, retaining values, layout and reminder modes', () => {
  const strip = text => text.replace(/\x1b\[[\d;]+m/g, '');
  const p = structuredClone(samples.cachedResponse);
  p.context_window.used_percentage = 90;
  p.quota['gemini-weekly'].remaining_fraction = .08;
  for (const mode of ['text', 'dot', 'off']) {
    const options = { now, color: true, lastResponseAtMs: now - 240000,
      settings: { context: 'text', cache: mode, quota: mode } };
    const day = renderStatusline(p, { ...options, theme: 'light' });
    const night = renderStatusline(p, { ...options, theme: 'dark' });
    assert.equal(strip(day), strip(night));
    assert.notEqual(day, night);
    assert.match(night, /\x1b\[38;2;255;133;133m90\.0%/);
    if (mode === 'off') assert.doesNotMatch(night, /●|mCache/);
  }
  assert.equal(strip(renderModelLine(p, true, 'dark', 'muted')), renderModelLine(p));
  assert.notEqual(renderModelLine(p, true, 'dark', 'muted'), renderModelLine(p, true, 'light', 'muted'));
});

test('interactive configurator page, installation guide and release workflows exist for GitHub release', () => {
  assert.equal(existsSync(new URL('../docs/index.html', import.meta.url)), true);
  assert.equal(existsSync(new URL('../docs/install.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../.github/workflows/ci.yml', import.meta.url)), true);
  assert.equal(existsSync(new URL('../.github/workflows/release.yml', import.meta.url)), true);
  assert.equal(existsSync(new URL('../scripts/release.mjs', import.meta.url)), true);
  const html = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');
  assert.match(html, /\/capsule-guide /);
  for (const key of Object.keys(MODES.standard)) {
    assert.ok(html.includes(`data-show="${key}"`), `configurator missing switch for ${key}`);
  }
  for (const key of ['contextLabel', 'cacheLabel', 'quota5hLabel', 'quotaWeeklyLabel', 'textColor']) {
    assert.ok(html.includes(`data-select="${key}"`), `configurator missing selector for ${key}`);
  }
});
