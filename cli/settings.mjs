import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SETTINGS, MODES, SHOW_KEYS, TEXT_COLOR_MODES, normalizeSettings } from './statusline.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ALERT_KEYS = ['context', 'cache', 'quota'];
const MODE_NAMES = Object.keys(MODES);

const SHOW_ALIASES = Object.freeze({
  contextlabel: ['contextLabel'],
  'context-label': ['contextLabel'],
  context_label: ['contextLabel'],
  context: ['context'],
  capacity: ['capacity'],
  cachelabel: ['cacheLabel'],
  'cache-label': ['cacheLabel'],
  cache_label: ['cacheLabel'],
  cache: ['cache'],
  quotagroup: ['quotaGroup'],
  'quota-group': ['quotaGroup'],
  quota_group: ['quotaGroup'],
  quota5hicon: ['quota5hIcon'],
  'quota-5h-icon': ['quota5hIcon'],
  quota_5h_icon: ['quota5hIcon'],
  quota5h: ['quota5h'],
  'quota-5h': ['quota5h'],
  quota_5h: ['quota5h'],
  reset5h: ['reset5h'],
  'reset-5h': ['reset5h'],
  reset_5h: ['reset5h'],
  quotaweeklyicon: ['quotaWeeklyIcon'],
  'quota-weekly-icon': ['quotaWeeklyIcon'],
  quota_weekly_icon: ['quotaWeeklyIcon'],
  quotaweekly: ['quotaWeekly'],
  'quota-weekly': ['quotaWeekly'],
  quota_weekly: ['quotaWeekly'],
  resetweekly: ['resetWeekly'],
  'reset-weekly': ['resetWeekly'],
  reset_weekly: ['resetWeekly'],
  reset: ['reset5h', 'resetWeekly'],
  quota: ['quotaGroup', 'quota5hIcon', 'quota5h', 'reset5h', 'quotaWeeklyIcon', 'quotaWeekly', 'resetWeekly'],
});

const TEXT_COLOR_ALIASES = Object.freeze({
  inherit: 'inherit',
  default: 'inherit',
  body: 'inherit',
  fixed: 'fixed',
  black: 'fixed',
  white: 'fixed',
  bw: 'fixed',
  muted: 'muted',
  gray: 'muted',
  grey: 'muted',
  plain: 'plain',
  mono: 'plain',
  none: 'plain',
});

export const USAGE = [
  'Usage: node settings.mjs <command>',
  '',
  'Commands:',
  '  show                              Show effective settings (read-only)',
  `  mode <${MODE_NAMES.join('|')}>           Switch layout preset (alias: preset)`,
  `  enable <item...>                  Show items (${SHOW_KEYS.join(', ')})`,
  '  disable <item...>                 Hide display items',
  '  set <key> <value> [...]           Set mode, textColor (inherit|fixed|muted|plain),',
  '                                    alerts (context|cache|quota), or show.<item> (on|off)',
  '  reset                             Restore default mode, visibility and alerts',
].join('\n');

function resolveShowKeys(name) {
  return SHOW_ALIASES[String(name || '').toLowerCase()] || null;
}

function parseToggle(value) {
  const normalized = String(value || '').toLowerCase();
  if (['on', 'true', '1', 'show'].includes(normalized)) return true;
  if (['off', 'false', '0', 'hide'].includes(normalized)) return false;
  return null;
}

function computeOverrides(mode, show) {
  const base = MODES[mode];
  const overrides = {};
  for (const key of SHOW_KEYS) {
    if (show[key] !== base[key]) overrides[key] = show[key];
  }
  return overrides;
}

function computeDefaultsUsed(raw, effective) {
  const used = [];
  if (raw.mode !== effective.mode && !(raw.mode === undefined && raw.compact === true)) used.push('mode');
  if (Object.hasOwn(raw, 'textColor') && !TEXT_COLOR_MODES.includes(raw.textColor)) used.push('textColor');
  for (const key of ALERT_KEYS) {
    if (raw[key] !== effective[key]) used.push(key);
  }
  if (raw.show !== undefined) {
    if (!raw.show || typeof raw.show !== 'object' || Array.isArray(raw.show)) used.push('show');
    else {
      if (Object.hasOwn(raw.show, 'reset') && typeof raw.show.reset !== 'boolean') used.push('show.reset');
      for (const key of SHOW_KEYS) {
        if (Object.hasOwn(raw.show, key) && typeof raw.show[key] !== 'boolean') used.push(`show.${key}`);
      }
    }
  }
  return used;
}

function persistSettings(raw, mode, textColor, alerts, show) {
  const next = { ...raw, mode, ...alerts };
  for (const legacy of ['compact', 'contextLabel', 'cacheLabel', 'quota5hLabel', 'quotaWeeklyLabel']) {
    delete next[legacy];
  }
  if (textColor !== DEFAULT_SETTINGS.textColor) next.textColor = textColor;
  else delete next.textColor;
  const overrides = computeOverrides(mode, show);
  if (Object.keys(overrides).length) next.show = overrides;
  else delete next.show;
  return next;
}

export function settingsCommand(args = [], directory = here) {
  const [action = 'show', ...rest] = args;
  if (['help', '--help', '-h'].includes(action)) return { usage: USAGE };
  if (!existsSync(join(directory, 'statusline.mjs'))) throw new Error('Capsule CLI is not installed here.');
  const path = join(directory, 'settings.json');
  const raw = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')) : {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('settings.json must contain a JSON object.');
  const effective = normalizeSettings(raw);

  if (action === 'show' && !rest.length) {
    return {
      settings: effective,
      overrides: computeOverrides(effective.mode, effective.show),
      defaultsUsed: computeDefaultsUsed(raw, effective),
    };
  }

  let mode = effective.mode;
  let textColor = effective.textColor;
  const alerts = { context: effective.context, cache: effective.cache, quota: effective.quota };
  let show = { ...effective.show };

  if (action === 'reset' && !rest.length) {
    mode = DEFAULT_SETTINGS.mode;
    textColor = DEFAULT_SETTINGS.textColor;
    alerts.context = DEFAULT_SETTINGS.context;
    alerts.cache = DEFAULT_SETTINGS.cache;
    alerts.quota = DEFAULT_SETTINGS.quota;
    show = { ...MODES[mode] };
  } else if ((action === 'mode' || action === 'preset') && rest.length === 1) {
    const target = rest[0];
    if (!Object.hasOwn(MODES, target)) throw new Error(`mode: choose ${MODE_NAMES.join(', ')}`);
    mode = target;
    show = { ...MODES[mode] };
  } else if ((action === 'enable' || action === 'disable') && rest.length) {
    const flag = action === 'enable';
    for (const item of rest) {
      const keys = resolveShowKeys(item);
      if (!keys) throw new Error(`Unknown display item: ${item}. Choose ${SHOW_KEYS.join(', ')}`);
      for (const key of keys) show[key] = flag;
    }
  } else if (action === 'set' && rest.length && rest.length % 2 === 0) {
    for (let i = 0; i < rest.length; i += 2) {
      const [key, value] = rest.slice(i, i + 2);
      const lowerKey = key.toLowerCase();
      if (key === 'mode' || key === 'preset') {
        if (!Object.hasOwn(MODES, value)) throw new Error(`mode: choose ${MODE_NAMES.join(', ')}`);
        mode = value;
        show = { ...MODES[mode] };
      } else if (['textcolor', 'text-color', 'text_color'].includes(lowerKey)) {
        const parsed = TEXT_COLOR_ALIASES[String(value || '').toLowerCase()];
        if (!parsed) throw new Error(`textColor: choose ${TEXT_COLOR_MODES.join(', ')}`);
        textColor = parsed;
      } else if (ALERT_KEYS.includes(key)) {
        const allowed = key === 'context' ? ['text', 'off'] : ['text', 'dot', 'off'];
        if (!allowed.includes(value)) throw new Error(`${key}: choose ${allowed.join(', ')}`);
        alerts[key] = value;
      } else if (key.startsWith('show.')) {
        const keys = resolveShowKeys(key.slice(5));
        if (!keys) throw new Error(`Unknown setting: ${key}`);
        const parsed = parseToggle(value);
        if (parsed === null) throw new Error(`${key}: choose on, off`);
        for (const target of keys) show[target] = parsed;
      } else {
        throw new Error(`Unknown setting: ${key}`);
      }
    }
  } else {
    throw new Error(USAGE);
  }

  const next = persistSettings(raw, mode, textColor, alerts, show);
  writeFileSync(path, JSON.stringify(next, null, 2) + '\n', 'utf8');
  const saved = normalizeSettings(JSON.parse(readFileSync(path, 'utf8')));
  return {
    settings: saved,
    overrides: computeOverrides(saved.mode, saved.show),
    saved: true,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = settingsCommand(process.argv.slice(2));
    console.log(result.usage ?? JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
