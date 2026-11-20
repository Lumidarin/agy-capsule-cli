import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DEFAULT_SETTINGS } from './statusline.mjs';
import { installSkill } from './skill-install.mjs';

const source = dirname(fileURLToPath(import.meta.url));
const readJson = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const writeJson = (path, data) => writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
const INITIAL_SETTINGS = Object.freeze({
  mode: DEFAULT_SETTINGS.mode,
  context: DEFAULT_SETTINGS.context,
  cache: DEFAULT_SETTINGS.cache,
  quota: DEFAULT_SETTINGS.quota,
});
export const USAGE = 'Usage: node cli/install.mjs [install [--no-skill] | uninstall]';

export function parseArgs(argv = []) {
  let action = null;
  let withSkill = true;
  let sawSkillFlag = false;
  for (const arg of argv) {
    if (arg === '--no-skill') { withSkill = false; sawSkillFlag = true; }
    else if (arg === '--with-skill') { withSkill = true; sawSkillFlag = true; }
    else if (arg === '--help' || arg === '-h') return { action: 'help', withSkill: true };
    else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}\n${USAGE}`);
    else if (!action) action = arg;
    else throw new Error(`Unexpected argument: ${arg}\n${USAGE}`);
  }
  action ||= 'install';
  if (action !== 'install' && action !== 'uninstall') throw new Error(USAGE);
  if (action === 'uninstall' && sawSkillFlag) throw new Error('--no-skill / --with-skill can only be used with install.');
  return { action, withSkill };
}

export function commandFor(executable, script, platform = process.platform) {
  if (platform === 'win32') {
    // AGY 1.5.10's Go exec + cmd /c escapes double quotes differently from an
    // interactive shell. An encoded file URL avoids quotes, spaces, % and & in
    // the path, and PATH lookup avoids persisting an ephemeral fnm node shim.
    const url = Buffer.from(pathToFileURL(script).href).toString('base64');
    return `node -e import(Buffer.from('${url}','base64').toString()).then(function(m){m.main()})`;
  }
  const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
  return `${quote(executable)} ${quote(script)}`;
}

export function configure(action, { home = homedir(), executable = realpathSync(process.execPath), platform = process.platform, withSkill = true } = {}) {
  const settingsPath = join(home, '.gemini', 'antigravity-cli', 'settings.json');
  const installDir = join(home, '.gemini', 'config', 'agy-capsule', 'cli');
  const script = join(installDir, 'statusline.mjs');
  const backupPath = join(installDir, 'previous-statusline.json');
  const settings = existsSync(settingsPath) ? readJson(settingsPath) : {};
  const backup = existsSync(backupPath) ? readJson(backupPath) : null;
  if (action === 'uninstall') {
    if (!backup) return 'CLI statusline is not installed by this installer.';
    if (settings.statusLine?.command === backup.installedCommand) {
      if (backup.hadStatusLine) settings.statusLine = backup.statusLine;
      else delete settings.statusLine;
      writeJson(settingsPath, settings);
    }
    // Keep display preferences and the /capsule-guide skill; never remove agent links.
    if (existsSync(script)) unlinkSync(script);
    const helper = join(installDir, 'settings.mjs');
    if (existsSync(helper)) unlinkSync(helper);
    unlinkSync(backupPath);
    return 'Removed CLI statusline; restored its previous setting if still selected. Display settings and /capsule-guide skill were kept. Restart agy.';
  }
  if (action !== 'install') throw new Error(USAGE);
  if (withSkill) installSkill(home);
  const command = commandFor(executable, script, platform);
  mkdirSync(installDir, { recursive: true });
  mkdirSync(dirname(settingsPath), { recursive: true });
  // Re-install keeps the original backup unless the user selected another renderer.
  const previous = backup && settings.statusLine?.command === backup.installedCommand
    ? backup : { hadStatusLine: Object.hasOwn(settings, 'statusLine'), statusLine: settings.statusLine ?? null };
  copyFileSync(join(source, 'statusline.mjs'), script);
  copyFileSync(join(source, 'settings.mjs'), join(installDir, 'settings.mjs'));
  const displaySettingsPath = join(installDir, 'settings.json');
  if (!existsSync(displaySettingsPath)) writeJson(displaySettingsPath, INITIAL_SETTINGS);
  writeJson(backupPath, { ...previous, installedCommand: command });
  settings.statusLine = { type: 'command', command, enabled: true, stack_with_default: false };
  writeJson(settingsPath, settings);
  return withSkill
    ? `Installed CLI statusline at ${script} and /capsule-guide skill. Restart agy; use /skills reload in an existing session. Display preferences are preserved.`
    : `Installed CLI statusline at ${script} (without agent skill). Display preferences are preserved. Restart agy.`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { action, withSkill } = parseArgs(process.argv.slice(2));
    console.log(action === 'help' ? USAGE : configure(action, { withSkill }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
