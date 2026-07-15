# Extended 实盘签名验证清单

> ⚠️ **在完成本清单前，Extended 的 `placeOrder` 会拒绝下单**（默认 `allowUnverifiedSigning=false`）。
> 这是有意的：`packages/exchanges/src/live/extended/sign.ts` 的 SNIP-12 / Poseidon 签名是**从二手资料（官方文档 + `x10xchange/examples` 仓库）实现的，未经实盘往返验证**。签错一个字段 = 下错单 = 丢钱。
> 走完下面每一步、确认签名正确后，再把 `GRIDBOT_EXTENDED_ALLOW_UNVERIFIED_SIGNING=true` 打开。

## 为什么要验证（两个未确认点）

`sign.ts` 里有两处**载重**细节，二手资料无法确认，必须实盘核对：

1. **买卖方向的金额符号约定**（`scaleAmounts`）：现在实现的是「buy → `base_amount` 为正（收到 synthetic）、`quote_amount` 为负（付出 collateral）；sell 镜像」。研究时两份资料对此**互相矛盾**。
2. **有符号 `i64` 金额与 asset id 的 felt 编码**（`toFelt` / `computeOrderHash` 里元素顺序）。

SNIP-12 外层信封（domain hash + `"StarkNet Message"` 包裹）遵循公开标准，相对安全；**风险集中在订单结构体本身**。

## 前置准备

1. **注册 Extended testnet**（Starknet Sepolia）：`https://api.starknet.sepolia.extended.exchange` 对应的测试环境。领测试网 USDC。
2. 在 Extended UI 的 **API Management** 页拿到：
   - `API_KEY`
   - `STARK_PRIVATE_KEY`（hex）
   - `VAULT_ID`（= collateral position id）
3. 本仓库配置（**用 `.env.local`，不要提交**）：
   ```bash
   GRIDBOT_EXTENDED_PRIVATE_KEY=<STARK_PRIVATE_KEY>
   GRIDBOT_EXTENDED_API_KEY=<API_KEY>
   GRIDBOT_EXTENDED_VAULT_ID=<VAULT_ID>
   # 先保持 false，验证通过前不要打开
   GRIDBOT_EXTENDED_ALLOW_UNVERIFIED_SIGNING=false
   ```

## 方案 A（推荐）：和官方 Python SDK 交叉对签

最可靠——用官方带 Rust signer 的 Python SDK 对**同一笔订单**签名，比对哈希/签名是否一致。

1. 装官方 SDK：
   ```bash
   pip install x10-python-trading   # github.com/x10xchange/python_sdk
   ```
2. 用 Python SDK 对一组**固定输入**（固定 market / side / qty / price / salt / expiration / vault）构造并签名一笔限价单，打印它内部计算的：
   - 缩放后的 `collateral_amount` / `synthetic_amount` / `fee_amount`（StarkEx 整数）
   - `base_amount` / `quote_amount` 的**符号**
   - order hash、message hash、`{r, s}`、stark public key
3. 在本仓库写一个临时脚本，用**同一组固定输入**调 `scaleAmounts` + `signOrder`（见下方片段），打印同样的值。
4. **逐项比对**：
   - [ ] `syntheticAmount` 整数一致
   - [ ] `collateralAmount` 整数一致（含 buy 向上/ sell 向下取整）
   - [ ] `feeAmount` 一致（向上取整）
   - [ ] `base_amount` / `quote_amount` **符号一致**（这是最容易错的）
   - [ ] order hash 一致
   - [ ] message hash 一致
   - [ ] `starkKey` 一致
   - [ ] `{r, s}` 一致（ECDSA 有 `k`，若不一致但 message hash 一致，用双方各自 verify 同一 hash 即可）
5. 若哈希/符号对不上 → 按 Python SDK 的实际做法修 `sign.ts`（`ORDER_TYPE_STRING`、元素顺序、符号约定、felt 编码），重比，直到全绿。

本地对签脚本骨架（放 `scratch/`，勿提交）：

```ts
import { scaleAmounts, signOrder } from "@gridbot/exchanges";

const l2 = {
  collateralId: "0x…",
  collateralResolution: 1_000_000,
  syntheticId: "0x…",
  syntheticResolution: 1_000_000_000,
};
const info = { name: "Extended", version: "1", chainId: "SN_SEPOLIA", revision: "1" }; // 用 GET /api/v1/info/starknet 的真实值
const amounts = scaleAmounts("buy", 0.001, 50000, 0.0005, l2);
console.log("amounts", amounts);
const signed = signOrder(process.env.STARK_PRIVATE_KEY!, info, {
  positionId: process.env.VAULT_ID!,
  amounts,
  l2,
  expirationSeconds: 1_800_000_000,
  salt: 1n,
});
console.log("signed", signed);
```

> `l2` 和 `info` 的真实值分别来自 `GET /api/v1/info/markets?market=BTC-USD` 的 `l2Config` 和 `GET /api/v1/info/starknet`。

## 方案 B：testnet 真单往返

若不方便跑 Python SDK，直接在 testnet 试真单（**小额、testnet-only**）：

1. 临时把 `GRIDBOT_EXTENDED_ALLOW_UNVERIFIED_SIGNING=true`，`network` 保持 `testnet`。
2. 建一个 paper→不，建 `exchange: extended` 的 bot，参数用**极窄、远离盘口**的价格，`perGridSizeUsd` 设成最小下单量对应值，启动。
3. 观察结果：
   - [ ] `POST /api/v1/user/order` 返回 200 + `{ id, externalId }`（不是 4xx 签名错误）
   - [ ] `GET /api/v1/user/orders?market=…` 里能看到这笔挂单，**方向/价格/数量与预期一致**
   - [ ] 撤单 `DELETE /api/v1/user/orders/{id}` 成功
   - [ ] 若真成交，`GET /api/v1/user/positions` 的持仓**方向正确**（buy → 多头）
4. 任何一项不符 → 关掉开关，回方案 A 精确对签。

## 通过之后

- 全部 ✅ 后，才在**实盘**（`network: mainnet`，需改 `registry.ts` / 加 network 配置）把 `GRIDBOT_EXTENDED_ALLOW_UNVERIFIED_SIGNING=true`。
- 实盘首单仍建议**极小额 + 立即撤**，再确认一次方向/价格。
- 把方案 A 里那组固定输入的 `{amounts, orderHash, messageHash, r, s}` 记成一个**真实测试向量**，替换 `test/extended-sign.test.ts` 里的「仅确定性」断言——这样以后任何改动都能被这条真向量守住（符合仓库 fixture-realism 规矩：向量来自真实签名，不是编的）。

## 参考

- 官方 API 文档：https://api.docs.extended.exchange/
- 官方 TS 示例（订单构造 + 签名 ground truth）：https://github.com/x10xchange/examples
- 官方 Python SDK（带 Rust signer，对签基准）：https://github.com/x10xchange/python_sdk
- 签名 wrapper npm：https://github.com/x10xchange/stark-crypto-wrapper-js
