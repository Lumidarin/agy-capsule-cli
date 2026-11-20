import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export const MODES = Object.freeze({
  standard: Object.freeze({
    contextLabel: true,
    context: true,
    capacity: true,
    cacheLabel: true,
    cache: true,
    quotaGroup: true,
    quota5hIcon: true,
    quota5h: true,
    reset5h: true,
    quotaWeeklyIcon: true,
    quotaWeekly: true,
    resetWeekly: true,
  }),
  compact: Object.freeze({
    contextLabel: false,
    context: true,
    capacity: true,
    cacheLabel: false,
    cache: false,
    quotaGroup: false,
    quota5hIcon: true,
    quota5h: true,
    reset5h: true,
    quotaWeeklyIcon: true,
    quotaWeekly: true,
    resetWeekly: true,
  }),
});

export const SHOW_KEYS = Object.freeze(Object.keys(MODES.standard));
export const TEXT_COLOR_MODES = Object.freeze(['inherit', 'fixed', 'muted', 'plain']);

export const DEFAULT_SETTINGS = Object.freeze({
  mode: 'standard',
  textColor: 'inherit',
  context: 'text',
  cache: 'dot',
  quota: 'dot',
  show: MODES.standard,
});

export const PALETTES = Object.freeze({
  light: Object.freeze({ body: [22, 22, 22], muted: [91, 107, 115], neutral: [138, 144, 151], amber: [152, 97, 0], red: [208, 42, 48] }),
  dark: Object.freeze({ body: [241, 243, 245], muted: [185, 195, 208], neutral: [185, 195, 208], amber: [255, 209, 102], red: [255, 133, 133] }),
});

export function readTheme({ home = homedir(), platform = process.platform, env = process.env,
  queryWindows = () => execFileSync('reg.exe', ['query',
    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', '/v', 'AppsUseLightTheme'],
  { encoding: 'utf8', windowsHide: true, timeout: 500, stdio: ['ignore', 'pipe', 'ignore'] }) } = {}) {
  try {
    const config = JSON.parse(readFileSync(join(home, '.gemini', 'antigravity-cli', 'settings.json'), 'utf8').replace(/^\uFEFF/, ''));
    const scheme = String(config.colorScheme || '').toLowerCase();
    if (scheme.includes('light')) return 'light';
    if (/dark|night/.test(scheme)) return 'dark';
  } catch { /* Use the terminal/system theme when AGY has no explicit scheme. */ }
  // Re-read on each host refresh so a long-running session follows day/night.
  if (platform === 'win32') {
    try {
      const value = /AppsUseLightTheme\s+REG_DWORD\s+0x([0-9a-f]+)/i.exec(queryWindows());
      if (value) return parseInt(value[1], 16) === 0 ? 'dark' : 'light';
    } catch { /* Theme detection must not disable the statusline. */ }
  }
  const background = Number(env.COLORFGBG?.split(';').at(-1));
  if (Number.isInteger(background) && background >= 0 && background <= 15) {
    return background === 7 || background >= 9 ? 'light' : 'dark';
  }
  return 'light';
}

export function normalizeSettings(value) {
  const mode = value?.mode && Object.hasOwn(MODES, value.mode)
    ? value.mode
    : value?.compact === true ? 'compact' : DEFAULT_SETTINGS.mode;
  const show = { ...MODES[mode] };
  // Backwards compatibility for legacy label/group keys.
  if (value?.contextLabel === 'off') show.contextLabel = false;
  if (value?.cacheLabel === 'off') show.cacheLabel = false;
  if (value?.quota5hLabel === 'off') show.quota5hIcon = false;
  if (value?.quotaWeeklyLabel === 'off') show.quotaWeeklyIcon = false;
  if (value?.show && typeof value.show === 'object' && !Array.isArray(value.show)) {
    if (typeof value.show.quota === 'boolean') {
      for (const k of ['quotaGroup', 'quota5hIcon', 'quota5h', 'reset5h', 'quotaWeeklyIcon', 'quotaWeekly', 'resetWeekly']) {
        show[k] = value.show.quota;
      }
    }
    if (typeof value.show.reset === 'boolean') {
      show.reset5h = value.show.reset;
      show.resetWeekly = value.show.reset;
    }
    for (const key of SHOW_KEYS) {
      if (typeof value.show[key] === 'boolean') show[key] = value.show[key];
    }
  }
  const result = {
    mode,
    textColor: TEXT_COLOR_MODES.includes(value?.textColor) ? value.textColor : DEFAULT_SETTINGS.textColor,
    context: DEFAULT_SETTINGS.context,
    cache: DEFAULT_SETTINGS.cache,
    quota: DEFAULT_SETTINGS.quota,
    show,
  };
  for (const key of ['context', 'cache', 'quota']) {
    const allowed = key === 'context' ? ['text', 'off'] : ['text', 'dot', 'off'];
    if (allowed.includes(value?.[key])) result[key] = value[key];
  }
  return result;
}

export function readSettings(path = new URL('./settings.json', import.meta.url)) {
  try { return normalizeSettings(JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))); }
  catch { return normalizeSettings(null); }
}

const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
// Payload labels are terminal text, never terminal control sequences.
const label = value => String(value ?? '').replace(/[^\x20-\x7e]/g, '').trim();
const knownBuckets = {
  'gemini-5h': ['Gemini', '5h'],
  'gemini-weekly': ['Gemini', 'weekly'],
  'gemini-argon-wtu-weekly': ['Argon', 'weekly'],
  '3p-5h': ['Claude', '5h'],
  '3p-weekly': ['Claude', 'weekly'],
};

function charWidth(ch) {
  const cp = ch.codePointAt(0);
  if (cp > 0xffff) return 2;
  if ((cp >= 0x2e80 && cp <= 0x9fff) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xff00 && cp <= 0xff60)) return 2;
  return 1;
}

export function displayWidth(text) {
  let w = 0;
  for (const ch of text) w += charWidth(ch);
  return w;
}

// Read only the protobuf fields needed for the recorded response completion.
function pbField(data, wanted) {
  const b = Buffer.from(data || []);
  let offset = 0;
  const varint = () => {
    let value = 0n;
    for (let shift = 0n; shift < 70n && offset < b.length; shift += 7n) {
      const byte = b[offset++];
      value |= BigInt(byte & 127) << shift;
      if (byte < 128) return Number(value);
    }
    throw new Error('Incomplete protobuf varint');
  };
  while (offset < b.length) {
    const tag = varint();
    const wire = tag & 7;
    let value;
    if (wire === 0) value = varint();
    else if (wire === 2) {
      const length = varint();
      if (length < 0 || offset + length > b.length) throw new Error('Incomplete protobuf field');
      value = b.subarray(offset, offset + length);
      offset += length;
    } else if (wire === 1 || wire === 5) offset += wire === 1 ? 8 : 4;
    else throw new Error('Unsupported protobuf wire type');
    if (tag >>> 3 === wanted) return value;
  }
  return undefined;
}

export function responseCompletedAt(metadata) {
  try {
    const stamp = pbField(metadata, 8);
    if (!Buffer.isBuffer(stamp)) return null;
    const seconds = number(pbField(stamp, 1));
    const nanos = number(pbField(stamp, 2) ?? 0);
    return seconds > 0 && nanos !== null ? seconds * 1000 + nanos / 1e6 : null;
  } catch { return null; }
}

export async function readLastResponseAt(payload, home = homedir()) {
  const id = payload?.conversation_id || payload?.session_id;
  if (!payload?.context_window?.current_usage || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id || '')) return null;
  let db;
  try {
    const { DatabaseSync } = await import('node:sqlite');
    db = new DatabaseSync(join(home, '.gemini', 'antigravity-cli', 'conversations', `${id}.db`), { readOnly: true });
    const row = db.prepare('SELECT metadata FROM steps WHERE step_type = 15 AND status = 3 ORDER BY idx DESC LIMIT 1').get();
    return row ? responseCompletedAt(row.metadata) : null;
  } catch { return null; }
  finally { db?.close(); }
}

export function renderModelLine(payload, color = false, theme = 'light', textColor = DEFAULT_SETTINGS.textColor) {
  const width = Math.max(1, Math.floor(number(payload?.terminal_width) || 80) - 2);
  const effort = label(payload?.model?.effort);
  const model = label(payload?.model?.display_name || payload?.model?.id || '--').replace(/\s*\((?:low|medium|high|xhigh|max)\)$/i, '');
  const right = (model + (effort ? ` · ${effort}` : '')).slice(0, width);
  let left = ['working', 'tool_use'].includes(payload?.agent_state) ? 'esc to cancel' : '? for shortcuts';
  if (left.length + 2 + right.length > width) left = '';
  const line = left + ' '.repeat(width - left.length - right.length) + right;
  return color && textColor !== 'plain' ? tint(line, 'muted', theme) : line;
}

export function formatTokens(value) {
  const n = number(value);
  if (n === null) return '--';
  if (n < 1000) return String(Math.round(n));
  return n < 999950 ? `${(n / 1000).toFixed(1)}K` : `${(n / 1000000).toFixed(1)}M`;
}

export function resetText(bucket, now) {
  const timestamp = typeof bucket.reset_time === 'string' ? Date.parse(bucket.reset_time) : NaN;
  const seconds = Number.isFinite(timestamp) ? (timestamp - now) / 1000 : number(bucket.reset_in_seconds);
  if (seconds === null) return '';
  if (seconds <= 0) return ' (due)'; // No promise that a stale bucket has actually reset.
  if (seconds < 60) return ' (<1m)';
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return ` (${minutes}m)`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return ` (${hours}h ${minutes % 60}m)`;
  return ` (${Math.floor(hours / 24)}d ${hours % 24}h)`;
}

function currentGroup(model, quota) {
  const name = `${model?.id || ''} ${model?.display_name || ''}`.toLowerCase();
  if (/claude|sonnet|opus|haiku/.test(name)) return 'Claude';
  if (name.includes('argon') && quota?.['gemini-argon-wtu-weekly']) return 'Argon';
  if (/gemini|hydrogen|argon/.test(name)) return 'Gemini';
  return null;
}

function quotaTone(payload, show = MODES.standard) {
  const selected = currentGroup(payload.model, payload.quota);
  let shortTone = 'neutral';
  for (const [id, bucket] of Object.entries(payload.quota || {})) {
    if (!bucket || bucket.disabled === true || knownBuckets[id]?.[0] !== selected) continue;
    const kind = knownBuckets[id]?.[1];
    if (kind === '5h' && !show.quota5h && !show.quota5hIcon && !show.reset5h) continue;
    if (kind === 'weekly' && !show.quotaWeekly && !show.quotaWeeklyIcon && !show.resetWeekly) continue;
    const fraction = number(bucket.remaining_fraction);
    if (fraction === null) continue;
    const percent = Math.round(fraction * 100);
    const tone = percent <= 10 ? 'red' : percent <= 25 ? 'amber' : 'neutral';
    if (kind === 'weekly' && tone === 'red') return 'red';
    if (kind === '5h') shortTone = tone;
  }
  return shortTone;
}

// Keep the approved daylight amber; use brighter colors against dark backgrounds.
function tint(text, tone, theme = 'light') {
  const rgb = (PALETTES[theme] || PALETTES.light)[tone].join(';');
  return `\x1b[38;2;${rgb}m${text}\x1b[0m`;
}

function paintBase(text, tone, theme = 'light') {
  if (!text) return text;
  const code = `\x1b[38;2;${(PALETTES[theme] || PALETTES.light)[tone].join(';')}m`;
  return code + text.replaceAll('\x1b[0m', code) + '\x1b[0m';
}

function quotaGroups(quota, model, now, countdown, showName = true, show = MODES.standard) {
  const selected = currentGroup(model, quota);
  if (!selected) return [];
  const groups = new Map();
  const entries = Object.entries(quota && typeof quota === 'object' ? quota : {});
  const order = Object.keys(knownBuckets);
  entries.sort(([a], [b]) => (order.indexOf(a) < 0 ? 999 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 999 : order.indexOf(b)) || a.localeCompare(b));
  for (const [id, bucket] of entries) {
    if (!bucket || typeof bucket !== 'object' || bucket.disabled === true) continue;
    const [group, kind] = knownBuckets[id] || [label(id) || 'Unknown', ''];
    if (group !== selected) continue;
    const fraction = number(bucket.remaining_fraction);
    const amount = number(bucket.remaining_amount);
    const value = fraction !== null ? `${Math.round(fraction * 100)}%` : amount !== null ? `${formatTokens(amount)} units` : '--';
    const parts = [];
    if (kind === '5h') {
      if (show.quota5hIcon) parts.push('🕔');
      if (show.quota5h) parts.push(value);
      if (countdown && show.reset5h) {
        const rt = resetText(bucket, now).trim();
        if (rt) parts.push(rt);
      }
    } else if (kind === 'weekly') {
      if (show.quotaWeeklyIcon) parts.push('📅');
      if (show.quotaWeekly) parts.push(value);
      if (countdown && show.resetWeekly) {
        const rt = resetText(bucket, now).trim();
        if (rt) parts.push(rt);
      }
    } else {
      parts.push(value);
      if (countdown && (show.reset5h || show.resetWeekly)) {
        const rt = resetText(bucket, now).trim();
        if (rt) parts.push(rt);
      }
    }
    if (!parts.length) continue;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(parts.join(' '));
  }
  if (!groups.size && showName) return [selected];
  return [...groups].map(([name, parts]) => `${showName ? name + ' ' : ''}${parts.join(' ')}`);
}

function clipText(text, budget) {
  let clipped = '';
  let used = 0;
  // Keep terminal text intact when the window is extremely narrow.
  for (const char of text) {
    const w = charWidth(char);
    if (used + w > budget) break;
    clipped += char;
    used += w;
  }
  return clipped;
}

function fallbackStatusline(settings) {
  const { show } = normalizeSettings(settings);
  const ctxParts = [];
  if (show.contextLabel) ctxParts.push('Ctx');
  if (show.context) ctxParts.push('--');
  if (show.capacity) ctxParts.push('(--)');
  const cacheParts = [];
  if (show.cacheLabel) cacheParts.push('Cache');
  if (show.cache) cacheParts.push('--');
  const parts = [ctxParts.join(' '), cacheParts.join(' ')].filter(Boolean);
  if (!parts.length && (show.quota5h || show.quotaWeekly)) parts.push('--');
  return parts.join('  ');
}

export function renderStatusline(payload = {}, { now = Date.now(), color = false, lastResponseAtMs = null, settings = DEFAULT_SETTINGS, theme = 'light' } = {}) {
  const prefs = normalizeSettings(settings);
  const { show } = prefs;
  const p = payload && typeof payload === 'object' ? payload : {};
  const width = Math.max(1, Math.floor(number(p.terminal_width) || 80) - 2);
  const context = p.context_window || {};
  const percentage = number(context.used_percentage);
  const size = number(context.context_window_size);
  const pct = percentage === null ? '--' : `${percentage.toFixed(1)}%`;
  const capStr = `(${size > 0 ? formatTokens(size) : '--'})`;
  const usage = context.current_usage;
  let cacheHit = null;
  if (usage && width >= 30) {
    const input = number(usage.input_tokens);
    const cached = number(usage.cache_read_input_tokens);
    cacheHit = input !== null && cached !== null && input + cached > 0
      ? `${(cached / (input + cached) * 100).toFixed(1)}%` : '--';
  }

  const buildLeft = ({ withContext = true, withCapacity = true, withCache = true, shortContext = false } = {}) => {
    const ctxParts = [];
    if (withContext && show.contextLabel) ctxParts.push(shortContext ? 'C' : 'Ctx');
    if (withContext && show.context) ctxParts.push(pct);
    if (withCapacity && show.capacity) ctxParts.push(capStr);
    const cacheParts = [];
    if (withCache && cacheHit !== null) {
      if (show.cacheLabel) cacheParts.push('Cache');
      if (show.cache) cacheParts.push(cacheHit);
      if (cacheParts.length && prefs.cache === 'dot') cacheParts.push('●');
    }
    return [ctxParts.join(' '), cacheParts.join(' ')].filter(Boolean).join('  ');
  };

  const anyRightEnabled = show.quotaGroup || show.quota5hIcon || show.quota5h || show.reset5h || show.quotaWeeklyIcon || show.quotaWeekly || show.resetWeekly;
  const buildRight = (countdown, showName = show.quotaGroup) => {
    if (!anyRightEnabled) return '';
    const text = quotaGroups(p.quota, p.model, now, countdown, showName, show).join(' | ');
    if (text) return `${prefs.quota === 'dot' ? '● ' : ''}${text}`;
    return !currentGroup(p.model, p.quota) && (show.quota5h || show.quotaWeekly) ? '--' : '';
  };

  let leftOpts = { withContext: true, withCapacity: true, withCache: true, shortContext: false };
  let left = buildLeft(leftOpts);
  let right = buildRight(width >= 70, show.quotaGroup);
  const fits = () => displayWidth(left) + (left && right ? 2 : 0) + displayWidth(right) <= width;

  // Keep one row: reduce optional detail before sacrificing context or quotas.
  if (!fits()) right = buildRight(false, show.quotaGroup);
  if (!fits() && (show.context || show.contextLabel || show.capacity)) { leftOpts = { ...leftOpts, withCache: false }; left = buildLeft(leftOpts); }
  if (!fits() && (show.context || show.contextLabel)) { leftOpts = { ...leftOpts, withCapacity: false }; left = buildLeft(leftOpts); }
  if (!fits()) right = buildRight(false, false);
  if (!fits()) {
    if (right) {
      leftOpts = { withContext: width >= 12 && (show.context || show.contextLabel), withCapacity: false, withCache: false, shortContext: true };
      left = buildLeft(leftOpts);
      const budget = Math.max(1, width - displayWidth(left) - (left ? 1 : 0));
      right = clipText(right, budget);
    } else {
      leftOpts = { ...leftOpts, withCache: (show.context || show.contextLabel) ? false : leftOpts.withCache, shortContext: true };
      left = buildLeft(leftOpts);
      if (!fits()) left = clipText(left, width);
    }
  }

  // Compute padding before adding ANSI controls; quota ends at the right edge.
  const padding = right ? ' '.repeat(Math.max(0, width - displayWidth(left) - displayWidth(right))) : '';
  const useColor = color && prefs.textColor !== 'plain';
  const baseTone = prefs.textColor === 'fixed' ? 'body' : prefs.textColor === 'muted' ? 'muted' : null;
  if (useColor) {
    const age = number(lastResponseAtMs) !== null ? now - lastResponseAtMs : null;
    const cacheTone = age !== null && age >= 240000 ? 'red' : age !== null && age >= 180000 ? 'amber' : 'neutral';
    if (left) {
      const ctxParts = [];
      if (leftOpts.withContext && show.contextLabel) ctxParts.push(leftOpts.shortContext ? 'C' : 'Ctx');
      if (leftOpts.withContext && show.context) {
        const pctColored = prefs.context === 'text' && percentage !== null && percentage >= 75
          ? tint(pct, percentage >= 90 ? 'red' : 'amber', theme) : pct;
        ctxParts.push(pctColored);
      }
      if (leftOpts.withCapacity && show.capacity) ctxParts.push(capStr);

      let cacheColored = '';
      if (leftOpts.withCache && cacheHit !== null) {
        const cacheParts = [];
        if (show.cacheLabel) cacheParts.push('Cache');
        if (show.cache) cacheParts.push(cacheHit);
        if (cacheParts.length) {
          cacheColored = cacheParts.join(' ');
          if (prefs.cache === 'dot') cacheColored += ` ${tint('●', cacheTone, theme)}`;
          else if (prefs.cache === 'text' && cacheTone !== 'neutral') cacheColored = tint(cacheColored, cacheTone, theme);
        }
      }
      const coloredLeft = [ctxParts.join(' '), cacheColored].filter(Boolean).join('  ');
      if (coloredLeft.replace(/\x1b\[[\d;]+m/g, '') === left) left = coloredLeft;
      if (baseTone) left = paintBase(left, baseTone, theme);
    }
    if (right) {
      if (prefs.quota === 'dot') right = right.replace('●', tint('●', quotaTone(p, show), theme));
      else if (prefs.quota === 'text') right = right.replace(/\b(\d+)%/g, (text, percent) => Number(percent) <= 25 ? tint(text, Number(percent) <= 10 ? 'red' : 'amber', theme) : text);
      if (baseTone) right = paintBase(right, baseTone, theme);
    }
  }
  return left + padding + right;
}

export async function main() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const settings = readSettings();
  try {
    const payload = JSON.parse(input);
    const color = !('NO_COLOR' in process.env) && !process.argv.includes('--plain') && settings.textColor !== 'plain';
    const theme = color ? readTheme() : 'light';
    const lastResponseAtMs = (settings.show.cache || settings.show.cacheLabel) && color && settings.cache !== 'off' ? await readLastResponseAt(payload) : null;
    const modelLine = renderModelLine(payload, color, theme, settings.textColor);
    const statusLine = renderStatusline(payload, { color, lastResponseAtMs, settings, theme });
    process.stdout.write(statusLine ? `${modelLine}\n${statusLine}\n` : `${modelLine}\n`);
  } catch {
    // A missing or malformed update should not disable the CLI's statusline.
    const fallback = fallbackStatusline(settings);
    process.stdout.write(fallback ? `${fallback}\n` : '\n');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
