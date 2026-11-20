# Capsule CLI

**中文** | [English](./README.en.md)

给 Antigravity CLI (`agy`) 的 statusline，**每一项都能自己定**：显示什么、隐藏什么、用什么颜色，全部可自定义。

![浅色与深色预览](docs/preview.png)

## 👉 [打开在线配置器，调好发给 Agent 即可生效](https://lumidarin.github.io/agy-capsule-cli/)

## 安装

需要 Node.js 22.13+ 和 AGY CLI。在 `agy` 里发这一句，让 AI 代装：

```text
请按 https://github.com/Lumidarin/agy-capsule-cli/blob/main/docs/install.md 帮我安装 agy-capsule-cli。
```

或手动：

```sh
git clone https://github.com/Lumidarin/agy-capsule-cli.git ~/agy-capsule-cli
cd ~/agy-capsule-cli
node cli/install.mjs
```

装完重启 `agy`。更新时拉新代码再跑一次 `node cli/install.mjs`，设置保留；卸载用 `node cli/install.mjs uninstall`。

## 自定义

- **在线配置器**：最直观，见上。
- **自然语言**：`/capsule-guide 极简模式`、`/capsule-guide 隐藏图标和周倒计时`。
- **命令行**：`node ~/.gemini/config/agy-capsule/cli/settings.mjs show | mode | enable | disable | reset`。
- **直接改** `~/.gemini/config/agy-capsule/cli/settings.json`。

## 说明

数据只来自 AGY 传入的 stdin payload（Cache 提醒会只读本机会话 SQLite 的时间戳），不联网、不读消息正文。已验证 Windows + AGY CLI 1.5.10，其他系统未实机验证。

[安装指南](docs/install.md) · [MIT License](LICENSE)
