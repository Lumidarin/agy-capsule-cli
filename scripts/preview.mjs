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
const rows = [
  { title: 'Standard · 通用模式 (mode: standard)', settings: { mode: 'standard' } },
  { title: 'Compact · 极简模式 (mode: compact)', settings: { mode: 'compact' } },
];
const body = ['light', 'dark'].map(theme => `<div class="group ${theme}"><h2>${theme === 'light' ? 'Day / 浅色背景' : 'Night / 深色背景'}</h2>` + rows.map(row => {
  const p = structuredClone(base);
  const opts = { now, color: true, lastResponseAtMs: now - 60000, settings: row.settings, theme };
  return `<section><h3>${escape(row.title)}</h3><pre>${htmlAnsi(renderModelLine(p, true, theme, row.settings.textColor))}\n${htmlAnsi(renderStatusline(p, opts))}</pre></section>`;
}).join('\n') + '</div>').join('\n');

const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Capsule CLI preview</title>
<style>
  body{background:#eeeae4;color:#161616;margin:0;padding:28px 32px;font:15px system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
  main{max-width:1120px;margin:auto}
  header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px}
  h1{font-size:24px;margin:0}
  header span{color:#59646a;font-size:13px}
  .group{margin-top:16px}
  .group>h2{font-size:12px;font-weight:650;color:#68747b;margin:0 0 8px;text-transform:uppercase;letter-spacing:.03em}
  section{background:#faf9f6;border:1px solid #dcd7ce;border-radius:10px;margin:10px 0;padding:15px 20px}
  h3{font-size:12.5px;font-weight:600;color:#68747b;margin:0 0 10px}
  pre{font:16.5px/1.6 'Cascadia Mono',Consolas,monospace;margin:0;white-space:pre}
  .dark section{background:#282c34;color:#f1f3f5;border-color:#404854}
  .dark section h3{color:#b9c3d0}
  footer{font-size:12px;color:#68747b;margin-top:14px}
</style>
<main><header><h1>Capsule CLI</h1><span>Standard vs Compact · Day &amp; Night</span></header>${body}<footer>Synthetic values rendered by cli/statusline.mjs. Explore alerts, 12 toggles &amp; label styles in the interactive configurator (docs/index.html).</footer></main></html>`;

const output = new URL('../docs/preview.html', import.meta.url);
mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
writeFileSync(output, html);
console.log(fileURLToPath(output));
