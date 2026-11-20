# Capsule CLI

[中文](./README.md) | **English**

**Experimental · 0.1.0-experimental.1**

A compact, zero-dependency statusline for Antigravity CLI (`agy`): Context and Cache hit on the left, current-model quota on the right — with **`standard` / `compact` presets**, **10 visibility toggles + 4 customizable prefix labels** (`Ctx`/`上下文`/off, `Cache`/`缓存`/off, `🕔`/`5h`/`5小时`/off, `📅`/`w`/`周`/off), and **independent alert styles**. Standalone from the desktop [agy-capsule](https://github.com/Lumidarin/agy-capsule) app.

> **Interactive Configurator (GitHub Pages)**: Open the [Web Configurator](https://lumidarin.github.io/agy-capsule-cli/) (or open [docs/index.html](docs/index.html) locally), toggle what you want with live day/night previews, and **one-click copy a `/capsule-guide ...` command for your Agent to apply**.

![Day/night × Standard/Compact preview](docs/preview.png)

Shows Standard and Compact presets on light and dark backgrounds (synthetic values, not a terminal screenshot). To explore alerts, models, narrow widths, and all 12 toggles interactively, open the [Web Configurator](https://lumidarin.github.io/agy-capsule-cli/).

## Install & Update

Requires **Node.js 22.13+** and AGY CLI; on Windows, `node` must be available on `PATH`. Verified on Windows, Node 22.23.2, and AGY CLI 1.5.10; macOS/Linux/WSL are not yet hardware-verified.

### Install with AI (Recommended)

Send this message in Antigravity (`agy`) to let the agent fetch the latest code and install both the statusline and the `/capsule-guide` skill:

```text
Please follow https://github.com/Lumidarin/agy-capsule-cli/blob/main/docs/install.md#english to install agy-capsule-cli for me.
```

See [Installation Guide](docs/install.md#english) for full AI assistant guardrails and troubleshooting. Restart `agy` after installation (or run `/skills reload` in an existing session for `/capsule-guide`).

### Manual Install

```sh
git clone https://github.com/Lumidarin/agy-capsule-cli.git ~/agy-capsule-cli
cd ~/agy-capsule-cli
node cli/install.mjs
```

Zero third-party runtime dependencies — no `npm install` or build step needed. By default, installing registers both the statusline and the `/capsule-guide` agent skill. Pass `--no-skill` (or run `npm run setup:no-skill`) to skip the skill:

```sh
node cli/install.mjs --no-skill
```

To update, pull the latest source and run `node cli/install.mjs` again. Your display preferences are preserved.

> This is not an `agy plugin install` package and is not published to npm; it registers directly with AGY's official `statusLine` command hook.

## Layout Modes

**Standard mode (`standard`, default):**

```text
? for shortcuts                                      Gemini 4 Hydrogen · medium
Ctx 14.2% (1.0M)  Cache 98.4% ●       ● Gemini 🕔 96% (2h 26m) 📅 19% (3d 23h)
```

**Compact mode (`compact`):**

```text
? for shortcuts                                      Gemini 4 Hydrogen · medium
14.2% (1.0M)                                 ● 🕔 96% (2h 26m) 📅 19% (3d 23h)
```

- Row 1 keeps the model name, reasoning effort, and shortcut hint; Row 2 is the single-row metrics bar.
- Sets `stack_with_default: false` and renders the model line itself (so native AI Credits are not shown).
- `Ctx` shows host-reported context usage percentage and window capacity (decimal K/M).
- `Cache` shows the latest turn's `cache_read_input_tokens / (input_tokens + cache_read_input_tokens)`. When `show.cache` is off (including default `compact` mode), local SQLite is not queried.
- Quota shows only the active model's pool: Gemini, Claude, or Argon's dedicated weekly pool. 5h and weekly windows, their prefix styles (`🕔`/`5h`/`5小时`/off and `📅`/`w`/`周`/off), and their reset countdowns can each be configured independently. Third-party pools are labeled `Claude` for Claude models; GPT models are not currently mapped.
- On narrow terminals, optional details degrade progressively to stay on one row.
- Missing values display `--`; disabled buckets are hidden while genuine `0%` is preserved. Past reset times show `(due)`.

## Configuration: Visual Configurator, Modes & Toggles

Preferences live in `~/.gemini/config/agy-capsule/cli/settings.json` and take effect on the next host statusline refresh.

### 1. Presets (`mode`) & Visibility Toggles (`show.*`)

| Side | Item | Key (`show.*`) | `standard` | `compact` | Notes |
| --- | --- | --- | --- | --- | --- |
| Left | Context block | `context` | `true` | `true` | Hides prefix & capacity when off |
| Left | Window capacity | `capacity` | `true` | `true` | `(1.0M)` |
| Left | Cache hit block | `cache` | `true` | `false` | Skips SQLite lookup when off |
| Left | Agent state | `state` | `true` | `false` | `\| working`, `\| tool_use` |
| Right | Quota block | `quota` | `true` | `true` | Entire right-side quota section |
| Right | Quota group name | `quotaGroup` | `true` | `false` | `Gemini` / `Claude` / `Argon` |
| Right | 5-hour quota | `quota5h` | `true` | `true` | Toggle 5h window independently |
| Right | Weekly quota | `quotaWeekly` | `true` | `true` | Toggle weekly window independently |
| Right | 5h reset countdown | `reset5h` | `true` | `true` | Toggle 5h `(2h 26m)` |
| Right | Weekly reset countdown | `resetWeekly` | `true` | `true` | Toggle weekly `(3d 23h)` |

> Shorthand & compatibility: `reset` toggles both `reset5h` and `resetWeekly`. Legacy `"compact": true` and `"show": { "reset": false }` remain supported.

### 2. Prefix Label Styles

| JSON key | Modes | Default (`standard` / `compact`) |
| --- | --- | --- |
| `contextLabel` | `en` (`Ctx`) · `zh` (`上下文`) · `off` | `en` / `off` |
| `cacheLabel` | `en` (`Cache`) · `zh` (`缓存`) · `off` | `en` / `off` |
| `quota5hLabel` | `icon` (`🕔`) · `short` (`5h`) · `zh` (`5小时`) · `off` | `icon` |
| `quotaWeeklyLabel` | `icon` (`📅`) · `short` (`w`) · `zh` (`周`) · `off` | `icon` |

Use `quotaLabel` in CLI commands to set both 5h and weekly prefixes at once.

### 3. Text Color (`textColor`) & Alert Modes

| Setting | JSON key | Values | Default |
| --- | --- | --- | --- |
| Metrics row body color | `textColor` | `inherit` (follows active terminal / color scheme foreground), `fixed` (black on light, white on dark), `muted` (soft gray; alerts stand out), `plain` (no ANSI; row-1 hint bar stays muted otherwise) | `inherit` |
| Ctx alert | `context` | `text` (colored text), `off` (no color alert) | `text` |
| Cache alert | `cache` | `text`, `dot` (colored dot), `off` | `dot` |
| Quota alert | `quota` | `text`, `dot`, `off` | `dot` |

`off` disables color alerts only — use `disable` or `show.<item> off` to hide an item.

### 4. Three Ways to Configure

**Option A: Interactive Configurator + `/capsule-guide`**

Open the [Web Configurator](https://lumidarin.github.io/agy-capsule-cli/), toggle what you want, click **Copy for Agent**, and paste into Antigravity. Or type naturally in AGY:

```text
/capsule-guide
/capsule-guide compact mode
/capsule-guide use 5h and w labels and hide weekly reset
/capsule-guide compact mode with cache enabled and no Cache label
/capsule-guide reset
```

**Option B: Terminal CLI Helper (Zero Model Calls)**

```sh
# View effective settings (read-only)
node "$HOME/.gemini/config/agy-capsule/cli/settings.mjs" show

# Switch preset (resets show.* overrides, keeps alert and label styles)
node "$HOME/.gemini/config/agy-capsule/cli/settings.mjs" mode compact
node "$HOME/.gemini/config/agy-capsule/cli/settings.mjs" mode standard

# Toggle individual items
node "$HOME/.gemini/config/agy-capsule/cli/settings.mjs" enable cache
node "$HOME/.gemini/config/agy-capsule/cli/settings.mjs" disable cacheLabel resetWeekly quotaGroup

# Change quota window prefix styles (icon | short | zh | off)
node "$HOME/.gemini/config/agy-capsule/cli/settings.mjs" set quota5hLabel short quotaWeeklyLabel short
node "$HOME/.gemini/config/agy-capsule/cli/settings.mjs" set quotaLabel zh

# Combine in one command
node "$HOME/.gemini/config/agy-capsule/cli/settings.mjs" set mode compact show.cache on show.cacheLabel off show.resetWeekly off quotaLabel short

# Restore defaults
node "$HOME/.gemini/config/agy-capsule/cli/settings.mjs" reset
```

**Option C: Edit `settings.json` Directly**

Edit `~/.gemini/config/agy-capsule/cli/settings.json` (only list `show` overrides that differ from `mode`):

```json
{
  "mode": "compact",
  "context": "text",
  "cache": "dot",
  "quota": "dot",
  "quota5hLabel": "short",
  "quotaWeeklyLabel": "short",
  "show": {
    "cache": true,
    "resetWeekly": false
  }
}
```

### Alert Thresholds

| Metric | Yellow | Red |
| --- | --- | --- |
| Context usage | ≥75% | ≥90% |
| Cache time since last completed model response | ≥3 min | ≥4 min |
| Remaining quota (rounded %) | ≤25% | ≤10% |

- The Cache dot sits right of the percentage. Elapsed-time alerts are heuristic and do not prove server-side cache eviction.
- Quota shares one dot left of the quota block reflecting visible windows only: red weekly overrides; otherwise follows 5h. Yellow weekly does not override 5h. In `text` mode, each visible percentage is colored independently.
- Set `NO_COLOR` or pass `--plain` to disable all ANSI colors. Light/dark themes adapt automatically.

## Data Sources

- Context, Cache hit, model, quota, and reset timers come solely from AGY's **stdin JSON payload** ([AGY statusline docs](https://antigravity.google/docs/cli/statusline/)).
- Only when `show.cache` is enabled and `cache` alerts are not `off` does the renderer read `~/.gemini/antigravity-cli/conversations/<conversation_id>.db` in **read-only** mode for the latest completed model response metadata timestamp (never message text, never file mtime).
- No network requests, no RPC, no background `/usage` calls, and no raw payload storage.

## Install Locations & Uninstall

| Path (`~` = user home) | Purpose |
| --- | --- |
| `~/.gemini/config/agy-capsule/cli/` | Renderer, settings helper, preferences, previous statusline backup |
| `~/.gemini/antigravity-cli/settings.json` | Updates `statusLine` only; preserves all other keys |
| `~/.gemini/skills/capsule-guide/SKILL.md` | Default `/capsule-guide` settings skill (skip with `--no-skill`; never overwrites unrelated skills) |

Uninstall and restore your previous statusline:

```sh
node cli/install.mjs uninstall
```

Re-installing keeps the original backup. Uninstalling won't overwrite a different statusline you later configured manually, and keeps your preferences and `/capsule-guide` skill for easy reinstall. Desktop Capsule settings are untouched.

## Development & Tests

```sh
node --test test/*.test.mjs
node scripts/preview.mjs
```

No dependency install step is required. The package is marked `private` to prevent accidental npm publishing while sharing source on GitHub.

[Installation Guide](docs/install.md#english) · [Interactive Configurator](https://lumidarin.github.io/agy-capsule-cli/) · [Related Projects (Chinese, 2026-11-17)](docs/related-projects.md) · [MIT License](LICENSE)
