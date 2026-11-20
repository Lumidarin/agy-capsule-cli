# 安装指南 / Installation Guide

[中文](#中文) | [English](#english)

---

## 中文

本指南包含安装、更新、卸载与排查 **Capsule CLI (`agy-capsule-cli`)** 的全部步骤。

> **想让 AI 代装？** 在 Antigravity (`agy`) 里新开一个对话，把这句话发给它：
>
> ```text
> 请按 https://github.com/Lumidarin/agy-capsule-cli/blob/main/docs/install.md 帮我安装 agy-capsule-cli。
> ```
>
> 它会完成下载与安装（默认一并注册 `/capsule-guide` 配置向导 skill）。完成后你只需要**重启 `agy`** 即可看到新底栏（已有会话可先运行 `/skills reload` 加载 `/capsule-guide`）。AI 不会也不能替你重启当前的 `agy` 进程。

### 给 AI 助手的说明

如果你是替用户安装的 AI 助手，请按以下要求操作：

1. **检查运行环境**：
   - 运行 `node -v`，确认 Node.js 版本为 **22.13.0 或更高**，且 `node` 可直接从 `PATH` 调用。
   - 若未安装 Node.js 或版本过低，请停下来把当前版本与要求告诉用户，**不要**擅自帮用户安装或升级 Node.js。
2. **准备最新版代码**：
   - 如果用户已有 `agy-capsule-cli` 的 git 文件夹，只有同时满足以下条件才复用它：`git remote get-url origin` 指向 `https://github.com/Lumidarin/agy-capsule-cli`（含 `.git` 或 SSH 同仓库地址）、当前在 `main` 分支、`git status --porcelain` 无输出。满足就运行 `git pull --ff-only origin main`，再确认 `git rev-parse HEAD` 与 `git rev-parse FETCH_HEAD` 输出相同；不同说明本地有额外提交，请改用下一条的新目录，**不要**重置用户的分支。
   - 不满足或没有现成文件夹时，将仓库 `git clone` 到一个新的空目录（例如 Windows 用 `$env:USERPROFILE\agy-capsule-cli`，macOS/Linux/WSL 用 `~/agy-capsule-cli`；目录已被占用就换个名字）。不要改动用户原有的文件夹。
   - 没有 git 时，下载 `main` 分支的最新 ZIP 并解压到新目录；不要复用「下载」目录里可能过期的旧解压文件夹。
   - 拿不到最新代码时停下来，把报错原样告诉用户，不要用旧代码安装。
3. **运行安装脚本（无交互）**：
   - 在项目根目录运行：
     ```sh
     node cli/install.mjs
     ```
   - 默认会同时安装 statusline 与 `/capsule-guide` skill。只有当用户明确表示不要安装 skill 时，才改为运行 `node cli/install.mjs --no-skill`。
   - 根据实际 stdout / stderr 确认输出包含 `Installed CLI statusline`；若因本机已存在无关同名 `capsule-guide` skill 而报错，不要覆盖该文件，将报错原样转告用户并提示可用 `--no-skill`。
4. **边界与收尾**：
   - 不需要执行 `npm install` 或构建（零第三方运行依赖）。
   - 不要修改项目源码、AGY 安装目录或其他无关 AGY 设置，不要自行安装其他软件。
   - 不要退出或重启 `agy`。完成后用用户的语言告知：重启 `agy` 生效；已有会话可用 `/skills reload` 加载 `/capsule-guide`；也可打开[在线配置页](https://lumidarin.github.io/agy-capsule-cli/)勾选显示项后复制指令发给 Agent 调整。
   - 若任意步骤失败，将报错原样告知用户。

### 手动安装

需要 **Node.js 22.13+** 与 AGY CLI（Windows 下 `node` 需在 `PATH` 中）。已实机验证 Windows、Node 22.23.2、AGY CLI 1.5.10；macOS/Linux/WSL 尚未实机验证。

#### 第 1 步：获取源码

任选一种方式：

- **使用 git**（推荐，后续更新方便）：
  ```powershell
  # Windows (PowerShell)
  git clone https://github.com/Lumidarin/agy-capsule-cli.git $env:USERPROFILE\agy-capsule-cli
  cd $env:USERPROFILE\agy-capsule-cli
  ```
  ```sh
  # macOS / Linux / WSL
  git clone https://github.com/Lumidarin/agy-capsule-cli.git ~/agy-capsule-cli
  cd ~/agy-capsule-cli
  ```
- **下载压缩包**：打开[仓库主页](https://github.com/Lumidarin/agy-capsule-cli)，点击 **Code → Download ZIP** 并解压，进入解压后的目录。

#### 第 2 步：执行安装

```sh
node cli/install.mjs
```

如需跳过 `/capsule-guide` skill，可运行：

```sh
node cli/install.mjs --no-skill
```

#### 第 3 步：重启 `agy`

首次安装后重启 `agy` 即可在底栏看到新 statusline。已有会话可用 `/skills reload` 加载 `/capsule-guide`。

### 更新与卸载

| 操作 | 命令（在仓库目录执行） | 说明 |
| --- | --- | --- |
| 更新 | `git pull` 后运行 `node cli/install.mjs` | 保留原有显示偏好与初始 statusline 备份 |
| 卸载 | `node cli/install.mjs uninstall` | 恢复安装前的 statusline（若用户后来切了其他 renderer 则不覆盖）；保留显示偏好与 `/capsule-guide` skill |

### 常见排查

- **底栏没变化**：确认已重启 `agy`，且 `~/.gemini/antigravity-cli/settings.json` 中 `statusLine.enabled` 为 `true`。
- **Windows 下找不到 `node`**：确认在新的命令提示符（`cmd.exe`）中 `node -v` 可用且版本 ≥ 22.13.0。
- **已有同名 `capsule-guide` skill 报错**：安装器不会覆盖非本项目托管的 skill；可先备份/重命名旧 skill，或使用 `node cli/install.mjs --no-skill` 仅安装 statusline。

---

## English

This guide covers installing, updating, uninstalling, and troubleshooting **Capsule CLI (`agy-capsule-cli`)**.

> **Prefer AI-assisted installation?** Start a new Antigravity (`agy`) chat and send:
>
> ```text
> Please follow https://github.com/Lumidarin/agy-capsule-cli/blob/main/docs/install.md#english to install agy-capsule-cli for me.
> ```
>
> The assistant will download and install the statusline (and the `/capsule-guide` skill by default). Afterward, simply **restart `agy`** to see the new statusline (or run `/skills reload` in an existing session for `/capsule-guide`).

### Instructions for AI Assistants

If you are an AI assistant installing this for the user, follow these rules:

1. **Check prerequisites**:
   - Run `node -v` and confirm Node.js is **22.13.0 or newer** and reachable on `PATH`.
   - If Node.js is missing or too old, stop and tell the user; do **not** install or upgrade Node.js automatically.
2. **Fetch the latest `main` code safely**:
   - Reuse an existing `agy-capsule-cli` git directory only if `git remote get-url origin` points to `Lumidarin/agy-capsule-cli`, the current branch is `main`, and `git status --porcelain` is empty. If so, run `git pull --ff-only origin main` and verify `git rev-parse HEAD` equals `git rev-parse FETCH_HEAD`. Otherwise clone to a fresh directory instead of resetting user branches.
   - If no clean checkout exists, run `git clone https://github.com/Lumidarin/agy-capsule-cli.git` into a new empty folder (e.g. `$env:USERPROFILE\agy-capsule-cli` on Windows, `~/agy-capsule-cli` on macOS/Linux/WSL).
   - Without git, download the latest `main` ZIP archive and extract it into a fresh directory (do not reuse an old Downloads extraction).
   - If fetching the latest code fails, stop and report the error verbatim.
3. **Run the installer (non-interactive)**:
   - From the repository root, run:
     ```sh
     node cli/install.mjs
     ```
   - This installs both the statusline and the `/capsule-guide` skill by default. Only pass `--no-skill` if the user explicitly opts out of the skill.
   - Verify the output contains `Installed CLI statusline`. If installation fails due to an existing unrelated `capsule-guide` skill, do not overwrite it — report the error and mention `--no-skill`.
4. **Boundaries & wrap-up**:
   - No `npm install` or build step is required (zero runtime dependencies).
   - Do not modify source files, unrelated AGY settings, or install other software.
   - Do not kill or restart `agy`. Tell the user in their language to restart `agy` (and optionally run `/skills reload` in an existing session), and mention the [interactive configurator](https://lumidarin.github.io/agy-capsule-cli/) for customizing display toggles.
   - Report any error verbatim.

### Manual Installation

Requires **Node.js 22.13+** and AGY CLI (`node` on `PATH` on Windows). Verified on Windows, Node 22.23.2, and AGY CLI 1.5.10; macOS/Linux/WSL are not yet hardware-verified.

```sh
git clone https://github.com/Lumidarin/agy-capsule-cli.git ~/agy-capsule-cli
cd ~/agy-capsule-cli
node cli/install.mjs
```

Pass `--no-skill` if you prefer not to register `/capsule-guide`. Restart `agy` after installing.

### Update & Uninstall

| Action | Command (from repo root) | Notes |
| --- | --- | --- |
| Update | `git pull` then `node cli/install.mjs` | Preserves display preferences and original statusline backup |
| Uninstall | `node cli/install.mjs uninstall` | Restores previous statusline if still active; keeps preferences and `/capsule-guide` skill |
