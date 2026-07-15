# RISEx 上线清单（RISE Chain）

> ⚠️ **RISEx 下单目前不能安全上线。** 原因：RISEx 用 EIP-712 `VerifyWitness` permit 签名订单，但**这个 typed-data struct + nonce 方案官方还没公开**（API 明确标注 "under heavy development"）。
> 唯一有文档的下单路径是 permit 里的 `signer_private_key` 字段——**把私钥发给 RISEx 服务器代签**，这对真金是不可接受的。
> 所以 `placeOrder` 默认抛错；只有 `GRIDBOT_RISEX_ALLOW_INSECURE_SERVER_SIGNING=true`（**仅 testnet**）才放行。

## 现在能安全做什么

**读路径完全可用**，不碰私钥、不下单：

- [ ] 行情：`GET /v1/markets` → `mark_price` / `step_price` / `step_size`（`RisexClient.getMarkPrice`）
- [ ] 余额：`GET /v1/account/balance?account=<addr>&token=<usdc>`
- [ ] 价格/数量换算：`priceToTicks`（对齐 `step_price`）、`sizeToSteps`（向下取整到 `step_size`，不会超量）——已单测

配置（只读也要 account address）：

```bash
GRIDBOT_RISEX_PRIVATE_KEY=<EVM_SIGNER_KEY>          # 只读其实用不到，占位
GRIDBOT_RISEX_ACCOUNT_ADDRESS=<0x...>              # 余额查询用
GRIDBOT_RISEX_COLLATERAL_TOKEN=<USDC_TOKEN_ADDR>   # 可选
GRIDBOT_RISEX_ALLOW_INSECURE_SERVER_SIGNING=false  # 保持关
```

只读验证：建 `exchange: risex` 的 bot，确认 `markPrice` 有真实值、`symbol`（如 `BTC-PERP`）能在 `GET /v1/markets` 的 `display_name` 命中。**别 start 下单**（会抛错，符合预期）。

## testnet 试单（可选，仅测试，理解风险）

RISEx 提供了 `signer_private_key` 的 dev 路径。**只在 testnet、只用一次性小钱包**：

1. `GRIDBOT_RISEX_ALLOW_INSECURE_SERVER_SIGNING=true`，网络 testnet。
2. 观察下单请求是否被接受。**注意**：当前实现的 permit 里 **`nonce_anchor` / `nonce_bitmap_index` 没填**——RISEx 的 nonce 方案文档没写清，服务器很可能因缺 nonce 拒单。这是预期内的「未完成」，不是 bug。
3. 无论结果，**用完立刻关掉这个开关**，别把它带到主网。

## 要真正上线，需要等/补两件事

下单能安全上线的前提，是 RISEx 公开这两样（现在都没有）：

1. **EIP-712 `VerifyWitness` 的 typed-data struct**（domain + Order 字段/类型）——拿到后，用 `viem` 在**本地**签，把签名放进 `permit.signature`，**私钥永不离开本机**。
2. **permit nonce 方案**（`nonce_anchor` / `nonce_bitmap_index` 怎么取、怎么防重放）。

补齐后要做的改动（预留好了位置）：

- 给 `packages/exchanges` 加 `viem` 依赖；
- 在 `risex/sign.ts`（新建）里按公布的 struct 用 `viem` 的 `signTypedData` 出 `{r,s,v}` → EIP-2098 compact；
- `adapter.ts` 的 `placeOrder`/`cancelOrder` 改成填 `permit.signature`（删掉 `signer_private_key`），并去掉 `allowInsecureServerSigning` 门、换成正常的 `allowLive` 门；
- 参照 Extended 的做法：先和某个参考实现（若 RISEx 出官方 SDK）对签，再 testnet 真单往返，最后主网小额。

## 盯这几个地方（等它更新）

- 官方文档：https://docs.risechain.com/docs/risex
- API 参考：https://developer.rise.trade/reference/general-information
- **AI 友好全量文档**（最先更新，重点盯）：https://developer.rise.trade/llms.txt
- 合约部署地址（若转纯链上下单）：https://docs.risechain.com/docs/risex/contracts/deployments

一旦 `llms.txt` 里出现 `VerifyWitness` 的字段定义或官方 TS SDK，就能把 RISEx 从「只读」升到「可实盘」。
