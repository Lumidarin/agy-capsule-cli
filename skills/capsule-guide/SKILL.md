---
name: capsule-guide
description: View or change the AGY CLI Capsule statusline's layout mode, per-item visibility toggles, quota window labels, and context/cache/quota alerts. Use for /capsule-guide or requests to adjust these CLI display preferences, not desktop Capsule settings.
---

<!-- agy-capsule-cli: managed skill -->

# Capsule CLI Guide & Settings

This skill configures the standalone Capsule CLI statusline, not the desktop app. Reply in the user's language. Do not change project files, documentation, AGY's main settings, or alert thresholds.

## Find the installed helper

Use the current environment's user home (Node `os.homedir()`). The helper is:

`<home>/.gemini/config/agy-capsule/cli/settings.mjs`

Resolve an absolute path and quote it for the current shell. Do not assume a username, repository location or working directory. On Windows, PowerShell's `$HOME` is suitable; on macOS/Linux/WSL use the native home. WSL and Windows are separate installations: do not silently edit the other environment's settings. If the helper is missing, say the standalone Capsule CLI needs to be installed or updated; do not install it automatically.

## View or change

With no requested change, run `node "<helper>" show` and present a short table of current values (layout mode, visibility toggles, quota labels, alert styles) and available choices. `defaultsUsed` lists missing/invalid entries that the renderer treats as defaults; mention that only when present. Viewing does not write anything.

If the user pastes a command from the web configurator (for example `/capsule-guide set mode compact show.cache on quota5hLabel short ...` or `/capsule-guide reset`), pass the subcommand and arguments directly to `node "<helper>" ...`.

### 1. Layout presets (`mode`)

| Preset | Description |
| --- | --- |
| `standard` (default) | Full view: all 12 display switches on |
| `compact` | Minimal view: hides `Ctx` prefix, Cache (`cache` & `cacheLabel`), agent state, and quota group name; keeps context %, capacity, 5h/weekly quota %, and countdowns |

Switching presets resets per-item `show.*` overrides to that preset while preserving alert styles and quota label styles.

### 2. Per-item visibility (`show.*`, 10 switches)

| Item | Key | `standard` | `compact` |
| --- | --- | --- | --- |
| Context block (`Ctx 14.2% (1.0M)`) | `context` | on | on |
| Window capacity (`(1.0M)`) | `capacity` | on | on |
| Cache hit block (`Cache 98.4% ●`) | `cache` | on | off |
| Agent state (`\| working`) | `state` | on | off |
| Right-side quota block | `quota` | on | on |
| Quota group name (`Gemini`/`Claude`/`Argon`) | `quotaGroup` | on | off |
| 5h quota item | `quota5h` | on | on |
| Weekly quota item | `quotaWeekly` | on | on |
| 5h reset countdown | `reset5h` | on | on |
| Weekly reset countdown | `resetWeekly` | on | on |

`reset` is accepted as a shorthand for both `reset5h` and `resetWeekly`.

### 3. Prefix labels (`contextLabel`, `cacheLabel`, `quota5hLabel`, `quotaWeeklyLabel`)

| Key | Options | Default (`standard` / `compact`) |
| --- | --- | --- |
| `contextLabel` | `en` (`Ctx`) · `zh` (`上下文`) · `off` (hidden) | `en` / `off` |
| `cacheLabel` | `en` (`Cache`) · `zh` (`缓存`) · `off` (hidden) | `en` / `off` |
| `quota5hLabel` | `icon` (`🕔`) · `short` (`5h`) · `zh` (`5小时`) · `off` | `icon` |
| `quotaWeeklyLabel` | `icon` (`📅`) · `short` (`w`) · `zh` (`周`) · `off` | `icon` |

`quotaLabel` sets both `quota5hLabel` and `quotaWeeklyLabel` at once. `enable`/`disable contextLabel|cacheLabel` toggles between `en` and `off`.

### 4. Text color (`textColor`)

Applies to Row 2 body text (Row 1 shortcut/model bar stays calmly muted unless `plain`):

| Key | `inherit` (default) | `fixed` | `muted` | `plain` |
| --- | --- | --- | --- | --- |
| `textColor` | Follows active terminal / color scheme foreground | Fixed black on light, white on dark (ignores colorful schemes) | Soft muted gray on Row 2 (only yellow/red alerts stand out) | No ANSI color codes at all |

### 5. Alert modes

| Display | Key | Allowed values | Default |
| --- | --- | --- | --- |
| Ctx | `context` | `text` text alerts / 文字变色; `off` no alerts / 不提醒 | `text` |
| Cache | `cache` | `text`; `dot` dot alerts / 圆点变色; `off` | `dot` |
| Current model quota / 当前组额度 | `quota` | `text`; `dot`; `off` | `dot` |

`off` removes color alerts, not the metric itself; use `disable` or `show.<item> off` to hide an item.

### Helper commands

```text
node "<helper>" show
node "<helper>" mode compact
node "<helper>" mode standard
node "<helper>" enable cache cacheLabel
node "<helper>" disable state resetWeekly quotaWeekly
node "<helper>" set quota5hLabel short quotaWeeklyLabel short
node "<helper>" set quotaLabel zh
node "<helper>" set textColor muted
node "<helper>" set cache text quota off
node "<helper>" set mode compact show.cache on show.cacheLabel off show.resetWeekly off
node "<helper>" reset
```

Use `reset` only when the user asks to restore defaults. Translate natural language and shorthand to helper arguments (for example `/capsule-guide 极简模式`, `/capsule-guide 图标换成 5h 和 w`, `/capsule-guide 图标换成中文`, `/capsule-guide 只留 5h 倒计时，关掉周倒计时`, `/capsule-guide 隐藏 Cache 前缀`). Ask which value only if the request is unclear. Ctx has no dot alert mode.

The helper validates values, preserves unrelated keys and returns the saved settings after readback. Report the actual result; if it fails, report the error without overwriting the file manually. Changes appear on the next AGY statusline refresh; an idle session may not refresh immediately.

## Explain alerts only when needed

- Ctx: yellow at 75% used, red at 90%.
- Cache: yellow 3 minutes after the latest completed model response, red after 4 minutes. This is an elapsed-time reminder, not proof of cache eviction. The dot is right of the percentage. When `show.cache` is off, local SQLite is not queried.
- Quota: yellow at rounded remaining percentage ≤25%, red at ≤10%. The shared dot sits left of the quota block and reflects only visible windows: a red weekly quota overrides; otherwise it follows 5h. A yellow week does not override 5h. Text mode colors each percentage separately.

Examples: `/capsule-guide`, `/capsule-guide 极简模式`, `/capsule-guide 图标换成 5h w`, `/capsule-guide 关闭周重置倒计时`, `/capsule-guide reset`.
