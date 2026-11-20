import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const marker = '<!-- agy-capsule-cli: managed skill -->';
const source = fileURLToPath(new URL('../skills/capsule-guide/SKILL.md', import.meta.url));

export function skillPath(home) {
  return join(home, '.gemini', 'skills', 'capsule-guide', 'SKILL.md');
}

export function checkSkill(home) {
  const path = skillPath(home);
  if (existsSync(path) && !readFileSync(path, 'utf8').includes(marker)) {
    throw new Error(`Existing unrelated capsule-guide skill; not overwritten: ${path}`);
  }
}

export function installSkill(home) {
  checkSkill(home);
  const path = skillPath(home);
  mkdirSync(dirname(path), { recursive: true });
  // Write in place so any user-managed hard links remain intact.
  writeFileSync(path, readFileSync(source));
  return path;
}
