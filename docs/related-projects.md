# 同类项目调研

调研日期：2026-11-17。范围是三个 AGY CLI statusline 项目，依据公开 README、配置样例与指定 commit 的源码；**没有安装替换当前 statusline，也没有做性能或稳定性的横向实测**。下文的能力结论限于可核查功能，不把功能多等同于使用效果更好。

## 结论

`agy-powerline` 最值得继续研究的是无需模型参与的 live-preview 配置器与 quota pacing；`agy-hud` 值得看额度刷新及诊断；`weby-homelab` 值得看 PowerShell 和多行 badge 布局。我们不应再把“支持额度、Cache hit、只看当前组”称为独有功能。

Capsule 当前保留的是已经按用户反馈调整过的固定布局和提醒规则：指标单行、额度右对齐、Cache 3/4 分钟时间提醒、周额度红色优先的共用圆点。此次在三个项目的相关代码和配置中未发现完全相同的组合，但这不等于整个 GitHub 上没有。

## 1. wassim-azi/agy-powerline

快照：`1.11.4`，commit `bd1f0f353fbb5c4d0eff579bcefd1ca133a4c400`。[仓库](https://github.com/wassim-azi/agy-powerline)

- **设置方式**：`configure` 是实际终端交互界面，能改 widget、主题、布局并即时预览；另有浏览器配置器。不是通过 agent 改 JSON。提供 22 种主题，以及 pills、lines、classic 布局。[配置文档](https://github.com/wassim-azi/agy-powerline/blob/bd1f0f353fbb5c4d0eff579bcefd1ca133a4c400/docs/configuration.md)
- **额度**：Gemini 5h/周、第三方 5h/周、Argon 独立周池均有 widget；`quota` widget 根据当前模型选组，再挑该组最紧的额度。可同时铺开多个池，不只是当前组两项。[源码 session.js](https://github.com/wassim-azi/agy-powerline/blob/bd1f0f353fbb5c4d0eff579bcefd1ca133a4c400/src/lib/session.js)
- **Pacing（消耗节奏）**：用剩余额度与离 reset 的时间推算当前消耗是否领先于时间进度，并显示 pace marker。它是根据固定 5h/7d 窗口推算，不是服务端新增指标。[额度指南](https://github.com/wassim-azi/agy-powerline/blob/bd1f0f353fbb5c4d0eff579bcefd1ca133a4c400/docs/guides/antigravity-quota.md)
- **Cache**：命中率公式与我们相同，结果取整；lines 布局的 Cache hit 颜色按命中率分档（80%、50%），不是按距回复完成的时间。另有 cache-read/create widget。[计算](https://github.com/wassim-azi/agy-powerline/blob/bd1f0f353fbb5c4d0eff579bcefd1ca133a4c400/src/lib/session.js) · [显示](https://github.com/wassim-azi/agy-powerline/blob/bd1f0f353fbb5c4d0eff579bcefd1ca133a4c400/src/lib/layouts/lines.js)
- **扩展指标**：Git、成本、运行中 subagents、任务、会话 token；可选读取本地会话 SQLite 汇总当天/近七天 token。不要把这个 usage cache 和模型 prompt cache 混为一谈。[配置文档](https://github.com/wassim-azi/agy-powerline/blob/bd1f0f353fbb5c4d0eff579bcefd1ca133a4c400/docs/configuration.md)
- **安装门槛**：Node 20+，无第三方 runtime dependencies；跨会话 token 汇总要求 Node 22.13+。支持 npx 和 AGY plugin 安装路线。此处跨平台能力来自项目说明，未替它实测。[README](https://github.com/wassim-azi/agy-powerline/blob/bd1f0f353fbb5c4d0eff579bcefd1ca133a4c400/README.md)

**对我们有用的点**：真正不消耗模型调用的设置界面、设置项即时预览，以及可选 pacing。它已有简洁布局；不能仅凭我们默认信息少，就断言我们的简洁模式优于它。

## 2. franksde/agy-hud

快照：`0.1.17`，commit `624e7183d2d84015ff3bef4a0c3e396cdb0e3283`。[仓库](https://github.com/franksde/agy-hud)

- **显示与设置**：Context、当前模型额度、模型、目录、Git、agent state、成本等。JSON 可切单行/多行、图标、进度条、统一颜色开关；Context 可显示百分比，额度可切剩余或已用。没有在这个配置样例中看到我们的每项 text/dot/off 三态。[配置样例](https://github.com/franksde/agy-hud/blob/624e7183d2d84015ff3bef4a0c3e396cdb0e3283/config.example.json)
- **额度数据不只取 payload**：会合并有效的额度缓存与官方 bucket；旧版本可探测本地 `GetUserStatus`，较新 CLI 切到后台 `agy -p /usage --output-format json` 刷新。源码有子进程、锁与重试处理，所以不能把它描述成“只解析 stdin”。[额度合并](https://github.com/franksde/agy-hud/blob/624e7183d2d84015ff3bef4a0c3e396cdb0e3283/src/statusline.ts) · [后台刷新](https://github.com/franksde/agy-hud/blob/624e7183d2d84015ff3bef4a0c3e396cdb0e3283/src/main.ts) · [/usage 调用](https://github.com/franksde/agy-hud/blob/624e7183d2d84015ff3bef4a0c3e396cdb0e3283/src/usageCommand.ts)
- **Cache 含义**：它代码中的 `quota_cache` 是额度缓存。此次检查的 renderer/config 没有找到 prompt Cache hit 或 3/4 分钟时间提醒，不能看到单词 cache 就算它支持模型缓存指标。[renderer](https://github.com/franksde/agy-hud/blob/624e7183d2d84015ff3bef4a0c3e396cdb0e3283/src/statusline.ts)
- **诊断与宽度**：有 `doctor` 检查实际安装路径、配置和字体；使用 `string-width` 等处理可见列宽，单行/多行各有缩减策略。我们目前仍按固定字符长度处理这套有限符号，不能声称宽字符兼容更强。[doctor](https://github.com/franksde/agy-hud/blob/624e7183d2d84015ff3bef4a0c3e396cdb0e3283/src/doctor.ts) · [列宽工具](https://github.com/franksde/agy-hud/blob/624e7183d2d84015ff3bef4a0c3e396cdb0e3283/src/ansi.ts)
- **安装门槛**：Node 18+，下载包含 bundle 的 AGY plugin 包，不需用户 npm install；安装后还要用 `/statusline` 绑定。Windows 提供 cmd wrapper。README 仍提示带空格路径的 8.3 短路径方案，而我们这轮已通过实际 shell 测试验证编码 file URL 的带空格路径启动方式。[README](https://github.com/franksde/agy-hud/blob/624e7183d2d84015ff3bef4a0c3e396cdb0e3283/README.md)

**对我们有用的点**：可见列宽计算、安装路径诊断。如果用户确认宿主额度经常滞后，再考虑是否增加主动刷新；本次不引入后台 `/usage`。

## 3. weby-homelab/antigravity-cli-statusline

快照：changelog 最新条目 `0.3.3`，commit `daf4cb6e3f57bed21492a3d8a80b0ac7776049b8`。[仓库](https://github.com/weby-homelab/antigravity-cli-statusline)

- **布局**：Powerline header 加 boxed badges，按宽度贪心装行；窄窗口通常增加行数，不是保持一行指标。Classic 模式改为无框文字。支持隐藏整个 header，只留下 badges。[README](https://github.com/weby-homelab/antigravity-cli-statusline/blob/daf4cb6e3f57bed21492a3d8a80b0ac7776049b8/README.md)
- **信息**：Context、token totals/deltas、模型、Git、目录、任务、subagents、quota、账户、主机、电量等。不同平台字段并不完全一致；例如 Windows 没有渲染 CPU/RAM badge，`NoCost` 被接受也不意味着有 cost 指标。[README 字段说明](https://github.com/weby-homelab/antigravity-cli-statusline/blob/daf4cb6e3f57bed21492a3d8a80b0ac7776049b8/README.md)
- **额度取舍**：Windows 源码按 Gemini/第三方模型选择 5h+周池；当前组缺失时会借用另一组。该行为与我们“未知或缺失不借另一组”不同。此快照 Windows renderer 只读四个常规 bucket，未看到 Argon 独立周池或 prompt Cache hit 的实现。[PowerShell renderer](https://github.com/weby-homelab/antigravity-cli-statusline/blob/daf4cb6e3f57bed21492a3d8a80b0ac7776049b8/statusline.ps1)
- **设置方式**：主要给 statusline command 添加 `--no-*` / PowerShell `-No*` 隐藏开关；不是 live-preview 编辑器，也不是我们这种每项提醒模式。[README](https://github.com/weby-homelab/antigravity-cli-statusline/blob/daf4cb6e3f57bed21492a3d8a80b0ac7776049b8/README.md)
- **安装门槛**：Windows 为 PowerShell 5.1+；Linux/macOS 为 Bash+jq。无需 Node，但维护两套 renderer，行为和可选字段有差别。[README](https://github.com/weby-homelab/antigravity-cli-statusline/blob/daf4cb6e3f57bed21492a3d8a80b0ac7776049b8/README.md)

**对我们有用的点**：Windows 原生脚本安装经验与 legend 展示。但多行堆叠和跨组额度 fallback 不符合当前用户要求，本次不移植。

## 我们这版的实际边界

| 项目 | Capsule CLI 当前结果 |
| --- | --- |
| 已验证 | Windows / AGY 1.5.10；22 项本地测试 |
| 配置 | `/capsule` 经过 agent；直接 settings helper 不经过模型；暂无 native TUI |
| 数据 | 主体 stdin payload；Cache 时间只读当前会话 SQLite；不主动刷新额度 |
| 显示 | 模型提示行 + 单行指标；当前组额度右对齐；三个独立提醒设置 |
| 尚缺 | GPT 映射、跨平台实机验证、通用 Unicode 列宽、可调阈值、可视化配置器 |
| 发布状态 | 独立本地实验版；未上传 GitHub/npm，未封装为 AGY plugin manifest |

下一步有实际收益的候选是“不调用模型的配置 TUI”和“通用列宽计算”。这些是后续选项，不在本次独立打包中顺手扩张。
