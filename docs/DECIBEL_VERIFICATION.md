# Decibel 实盘上线清单（Aptos）

> Decibel 的下单/撤单**由官方 `@decibeltrade/sdk` 签名并提交 Aptos 交易**——不是我们手写的签名，所以比 Extended 安全得多。
> 但下单会**真上链**（花 gas + 动真金），所以默认关闭（`GRIDBOT_DECIBEL_ALLOW_LIVE=false`）。走完本清单再开。

## 三层账户模型（先理解，否则配错地址）

Decibel 是「主钱包 → API 钱包 → 交易账户(Subaccount)」三层：

| 层             | 是什么                                                           | 我们要的                                            |
| -------------- | ---------------------------------------------------------------- | --------------------------------------------------- |
| Primary Wallet | 你 UI 登录的主钱包                                               | —                                                   |
| **API Wallet** | 在 `app.decibel.trade/api` 生成的独立 Ed25519 钱包，**代签交易** | 它的**私钥** → `GRIDBOT_DECIBEL_PRIVATE_KEY`        |
| **Subaccount** | 真正持有 USDC 保证金的交易账户对象地址                           | 它的**地址** → `GRIDBOT_DECIBEL_SUBACCOUNT_ADDRESS` |

> API Wallet 私钥泄露 ≤ 只能在你的 Subaccount 上下单（不能提走主钱包资产），但仍要当私钥保管。用独立小额账户。

## 前置准备

1. **testnet**：先在 Decibel testnet（`app.decibel.trade` 切 testnet）建 API Wallet + Subaccount，领测试网 USDC 充进 Subaccount。
2. 拿 **Aptos node API key**（geomi.dev，用于 REST 读/限流）→ `GRIDBOT_DECIBEL_NODE_API_KEY`。
3. 配置（`.env.local`，勿提交）：
   ```bash
   GRIDBOT_DECIBEL_PRIVATE_KEY=<API_WALLET_ED25519_KEY>
   GRIDBOT_DECIBEL_SUBACCOUNT_ADDRESS=<SUBACCOUNT_OBJECT_ADDR>
   GRIDBOT_DECIBEL_NODE_API_KEY=<GEOMI_KEY>
   GRIDBOT_DECIBEL_ALLOW_LIVE=false   # 先关
   ```

## 第一步：只读验证（不花钱，先跑通）

`ALLOW_LIVE=false` 时读路径已可用。建一个 `exchange: decibel` 的 bot（**先别 start**，或 start 后它会读价、但下单会抛错），确认：

- [ ] `GET /v1/bots/:id` 里 `markPrice` 有真实值（来自 `read.marketPrices.getByName`）
- [ ] 日志无 `no price for <symbol>` —— 说明 `symbol`（如 `BTC-USD`）在 Decibel 的 `market_name` 里存在
  - 若报找不到市场：跑一次 `GET /v1/markets` 看真实 `market_name`（分隔符 `/` vs `-` 各页文档不一致），用真实名建 bot
- [ ] 余额能读到（`accountOverview.getByAddr` → `perp_equity_balance`，应等于你充进 Subaccount 的 USDC）

只读全绿 → 说明地址/网络/市场名都对了。

## 第二步：testnet 真单（小额）

1. `GRIDBOT_DECIBEL_ALLOW_LIVE=true`，网络保持 testnet。
2. 建 `exchange: decibel` 的 bot，参数：
   - `symbol` 用第一步确认过的真实市场名
   - 价格区间**极窄、贴近但不穿盘口**，`perGridSizeUsd` 用市场最小下单量对应值（低于 `min_size` 会被拒）
   - `gridCount` 小（比如 4），避免一次铺太多
3. start，观察：
   - [ ] 挂单成功：日志有 `bot started`，无 `placeOrder failed`；`tx_hash` 上链
   - [ ] 在 Decibel UI 或 `read.userOpenOrders.getByAddr` 能看到挂单，**方向/价格/数量正确**
   - [ ] 撤单成功（stop bot → `cancel_order_to_subaccount` 成功）
   - [ ] 若成交，`read.userPositions` 持仓**方向正确**（buy → 多头）
   - [ ] gas 扣在 API Wallet 上，金额合理
4. 任何一项不符 → `ALLOW_LIVE=false`，排查：
   - 价格/数量换算：SDK 内部按市场 `px_decimals`（USDC 计价固定 6）/`sz_decimals`（每市场不同）缩放，我们传的是**十进制**，SDK 负责取整到 `tick_size`/`lot_size`。若被拒多半是 `perGridSizeUsd` 低于 `min_size` 或价格没对齐 `tick_size`。

## 第三步：上主网

- testnet 全绿后，把 `registry.ts` / manager 里 Decibel 的 `network` 从 `"testnet"` 改 `"mainnet"`（现在硬编码 testnet），或加一个 `GRIDBOT_DECIBEL_NETWORK` 配置项。
- 主网首单仍**极小额 + 立即撤**，再确认方向/价格。
- 注意 Decibel「Amps」积分：按真实交易活动计，**有反刷保护，不是纯看量**——窄网格高频未必最优，别为刷量硬冲。

## 风险点小结（Decibel 特有）

- **市场名分隔符不统一**（`BTC/USD` vs `BTC-USD`）——务必用 `GET /v1/markets` 的真实 `market_name`。
- **decimals 别硬编码**——SDK 已按市场读取，我们只传十进制值；但 `perGridSizeUsd` 要 ≥ `min_size`。
- **API Wallet ≠ 主钱包**——配错地址会「地址不存在/无权限」。
- 每笔下单/撤单都是**一笔 Aptos 交易，花 gas**——窄网格高频会持续消耗 API Wallet 的 APT，记得留足 gas。

## 参考

- 官方 SDK：https://github.com/decibeltrade/sdk （`DecibelWriteDex` / `DecibelReadDex`）
- 快速开始（三层账户）：https://docs.decibel.trade/quickstart/typescript-starter-kit
- 下单/撤单 Move 函数：https://docs.decibel.trade/developer-hub/on-chain/order-management/place-order
- 市场参数（decimals/tick/min-size）：https://docs.decibel.trade/developer-hub/on-chain/overview/market-parameters
- Amps 积分：https://app.decibel.trade/points
