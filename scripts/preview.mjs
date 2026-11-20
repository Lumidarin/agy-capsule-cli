import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderModelLine, renderStatusline } from '../cli/statusline.mjs';

const now = Date.parse('2026-11-17T12:00:00Z');
const base = {
  model: { id: 'gemini-hydrogen', display_name: 'Gemini 4 Hydrogen', effort: 'medium' },
  agent_state: 'idle', terminal_width: 96,
  context_window: { used_percentage: 14.2, context_window_size: 1048576,
    current_usage: { input_tokens: 160, cache_read_input_tokens: 9840 } },
  quota: { 'gemini-5h': { remaining_fraction: .96, reset_in_seconds: 8760 },
    'gemini-weekly': { remaining_fraction: .19, reset_in_seconds: 342000 } },
};
const escape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function htmlAnsi(text) {
  let opened = false;
  return escape(text).replace(/\x1b\[([0-9;]+)m/g, (_, code) => {
    const close = opened ? '</span>' : '';
    const color = code.startsWith('38;2;') ? `rgb(${code.slice(5).replaceAll(';', ',')})`
      : ({ 90: '#667b85', 33: '#986100', 31: '#d02a30' })[code];
    opened = !!color;
    return close + (color ? `<span style="color:${color}">` : '');
  }) + (opened ? '</span>' : '');
}
const settings = { mode: 'standard' };
const body = ['light', 'dark'].map(theme => {
  const p = structuredClone(base);
  const opts = { now, color: true, lastResponseAtMs: now - 60000, settings, theme };
  return `<section class="${theme}"><pre>${htmlAnsi(renderModelLine(p, true, theme))}\n${htmlAnsi(renderStatusline(p, opts))}</pre></section>`;
}).join('\n');

const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Capsule CLI preview</title>
<style>
  html,body{background:transparent;margin:0}
  body{padding:8px}
  main{width:max-content;margin:auto}
  section{border-radius:10px;margin:0 0 12px;padding:14px 20px}
  section:last-child{margin-bottom:0}
  section.light{background:#faf9f6;color:#161616;border:1px solid #dcd7ce}
  section.dark{background:#282c34;color:#f1f3f5;border:1px solid #404854}
  pre{font:16.5px/1.6 'Cascadia Mono',Consolas,monospace;margin:0;white-space:pre}
</style>
<main>${body}</main></html>`;

const output = new URL('../docs/preview.html', import.meta.url);
mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
writeFileSync(output, html);
console.log(fileURLToPath(output));
