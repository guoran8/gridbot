# GridBot · 永续合约网格交易机器人

一个跑在自己机器上的永续合约网格交易机器人，同时对接多家去中心化永续交易所（Extended / Decibel / RISEx），配 React 面板实时监控。React + TS + Hono + Vite 重构自 [`3xx-wangge`](https://github.com/ZAIJIN88/3xx-wangge)。

> ⚠️ **风险提示**：本程序仅供学习研究。永续合约带高杠杆，可能全部亏损。**务必先在模拟盘（paper）充分测试**再考虑实盘。私钥安全是你自己的责任——见下方[安全须知](#安全须知)。盈亏自负。

## 现状

| 部分                                                | 状态                                                                        |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| 网格引擎（等差/等比、中性/做多/做空、均价成本记账） | ✅ 完成，单测覆盖                                                           |
| 模拟盘（paper）端到端                               | ✅ 可用：建 bot → 下网格 → 模拟价格震荡 → 成交/盈亏/成交额落库              |
| Hono API + SQLite 持久化 + 崩溃恢复                 | ✅                                                                          |
| React 面板（实时 SSE、图表、中英双语）              | ✅                                                                          |
| AI 顾问（Claude / DeepSeek / Gemini）               | ✅                                                                          |
| Telegram / Webhook 通知、代理                       | ✅                                                                          |
| **Extended 实盘**：行情/余额/挂单/撤单              | ✅ 读路径可用（testnet 默认）                                               |
| **Extended 下单签名**（Stark/SNIP-12，手写）        | ⚠️ **已实现但未验证**——默认拒绝下单，需 testnet 核对签名后显式开启          |
| **Decibel 实盘**（Aptos，官方 SDK 签名）            | ✅ 读路径可用；下单走官方 `@decibeltrade/sdk`，默认关，`ALLOW_LIVE=true` 开 |
| RISEx 实盘                                          | 🚧 stub（研究中）                                                           |

**除非你已在 testnet 核对过 Extended 签名，否则只跑 `tradingMode: "paper"`。** Extended 下单默认抛错，需要 `allowUnverifiedSigning` 才放行——见 `packages/exchanges/src/live/extended/sign.ts` 顶部的验证清单。

## 技术栈

- **版本管理**：mise（Node 24.14.1 + pnpm 11.4.0）
- **Monorepo**：pnpm workspaces + turbo
- **后端**：Hono + `@hono/node-server`，SSE 推送，better-sqlite3 + Drizzle
- **前端**：React 19 + Vite 7 + shadcn/ui（base registry）+ Tailwind v4，TanStack Router/Query/Form，图表用 shadcn Chart（recharts）
- **契约**：zod（前后端共享 `@gridbot/shared`）
- **Lint/Format**：oxlint + oxfmt

## 仓库结构

```
apps/
  api/           Hono 服务 + 网格引擎循环 + SQLite + SSE
  web/           React + Vite 面板
packages/
  shared/        zod 契约 + 类型（前后端共用）
  core/          纯网格引擎 + 指标 + 趋势（重单测，无 IO）
  exchanges/     交易所 adapter 接口 + paper 模拟器 + 三家实盘 stub
  services/      AI 顾问 + 通知 + 代理（副作用层，独立于 core）
```

## 快速开始

```bash
# 1. 装工具链（mise 读 mise.toml 里的 pin）
mise trust && mise install

# 2. 装依赖
pnpm install

# 3. 配置
cp .env.example .env        # 按需填写；只跑 paper 的话默认即可

# 4. 开发（两个终端）
pnpm api:dev                # API → http://localhost:8787
pnpm web:dev                # 面板 → http://localhost:3000
```

打开 `http://localhost:3000` → 「新建机器人」→ 交易所选 `paper` → 创建并启动，即可看到网格挂单和模拟成交。

### 常用命令

```bash
pnpm build          # turbo build
pnpm typecheck      # tsc --noEmit（全 workspace）
pnpm test           # vitest（core / exchanges / services / api）
pnpm lint           # oxlint
pnpm format         # oxfmt
```

## Docker

```bash
cp .env.example .env
docker compose up -d --build
# API  → http://localhost:8787
# 面板 → http://localhost:3000
```

SQLite 数据落在具名卷 `gridbot-data`。

## 配置（环境变量）

所有变量 `GRIDBOT_*` 前缀，见 `.env.example`。要点：

| 变量                                           | 说明                                                 |
| ---------------------------------------------- | ---------------------------------------------------- |
| `GRIDBOT_PORT` / `GRIDBOT_DB_PATH`             | API 端口 / SQLite 路径                               |
| `GRIDBOT_RECONCILE_MS`                         | 网格重报间隔（ms）；`0` = 关定时器（测试用）         |
| `GRIDBOT_{EXTENDED,DECIBEL,RISEX}_PRIVATE_KEY` | 各所私钥（实盘，Phase 6 才用；**绝不入库/日志**）    |
| `GRIDBOT_AI_PROVIDER` / `GRIDBOT_AI_API_KEY`   | AI 顾问，`anthropic`/`deepseek`/`gemini`，留空则关闭 |
| `GRIDBOT_TELEGRAM_*` / `GRIDBOT_WEBHOOK_URL`   | 成交/爆仓/异常通知                                   |
| `GRIDBOT_PROXY_URL`                            | 所有对外 HTTP 走代理                                 |

## API 速览

- `POST /v1/bots` 建 bot（body = 网格配置）· `GET /v1/bots` 列表 · `GET /v1/bots/:id`
- `POST /v1/bots/:id/{start|pause|resume|stop|flatten}` 控制
- `GET /v1/bots/:id/{orders,fills}` 本地账本
- `GET /v1/stream` SSE 实时状态
- `POST /v1/ai/advise` LLM 网格参数建议 · `GET /health` · `GET /logs`

## 安全须知

- **私钥只用于对应交易所签名**，用 `SecretString` 包裹，仅在签名边界 `.reveal()`，绝不进日志/响应/DB。
- 实盘请用**独立的、只放小额资金的钱包**，不要用主钱包私钥。
- 先跑 paper 跑通，再逐所小额实盘。
- 把 `.env` / `.env.local` 排除在 git 外（已在 `.gitignore`）。
- 上实盘前先算账：**预估手续费成本 vs 预估收益/空投价值**——决定是不是正 EV。

## 免责声明

学习研究用途。使用本程序产生的一切盈亏、资金损失、账户风险由使用者自行承担。
