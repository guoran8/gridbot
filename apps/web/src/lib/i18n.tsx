import { createContext, type ReactNode, useContext, useMemo, useState } from "react";

/** Minimal i18n with {param} interpolation. Chinese default, English fallback. */
export type Locale = "zh" | "en";

const dict = {
  zh: {
    "app.title": "GridBot 网格交易面板",
    "app.subtitle": "永续合约网格机器人 · 多交易所",
    "nav.overview": "总览",
    "nav.create": "新建机器人",
    "nav.venues": "交易所",
    "nav.logs": "日志",
    "lang.toggle": "EN",

    "venues.title": "实盘交易所（只读）",
    "venues.subtitle": "查看各交易所配置状态与实时余额/标记价。纯读取，不下单。",
    "venues.configured": "已配置",
    "venues.notConfigured": "未配置",
    "venues.liveOn": "实盘下单：开",
    "venues.liveOff": "实盘下单：关",
    "venues.balance": "可用余额",
    "venues.mark": "标记价",
    "venues.probe": "查询",
    "venues.probing": "查询中…",
    "venues.symbolPlaceholder": "交易对，如 BTC-USD",
    "venues.probeFailed": "查询失败",
    "venues.notConfiguredHint": "在 .env 里配置该交易所的私钥/地址后可用",
    "venues.openOrders": "当前挂单",
    "venues.noOpenOrders": "无挂单",

    "overview.empty": "还没有机器人，去新建一个吧。",
    "overview.totalPnl": "总净盈亏",
    "overview.totalVolume": "总成交额",
    "overview.activeBots": "运行中",

    "bot.status.idle": "空闲",
    "bot.status.running": "运行中",
    "bot.status.paused": "已暂停",
    "bot.status.stopping": "停止中",
    "bot.status.error": "错误",
    "bot.mode.neutral": "中性",
    "bot.mode.long": "做多",
    "bot.mode.short": "做空",

    "bot.mark": "标记价",
    "bot.netPnl": "净盈亏",
    "bot.volume": "成交额",
    "bot.matched": "完成套利",
    "bot.position": "持仓",
    "bot.fees": "手续费",
    "bot.flat": "无持仓",

    "action.start": "启动",
    "action.pause": "暂停",
    "action.resume": "继续",
    "action.stop": "停止",
    "action.flatten": "平仓",
    "action.recover": "区间外恢复",
    "action.delete": "删除",
    "action.confirmDelete": "确认删除该机器人？",
    "action.confirmRecover": "启动区间外恢复？将挂 reduce-only 阶梯逐步平仓，平完即停。",
    "adjust.title": "调整区间",
    "adjust.apply": "应用",
    "adjust.applied": "区间已调整",
    "adjust.failed": "调整失败",

    "create.title": "新建网格机器人",
    "create.exchange": "交易所",
    "create.symbol": "交易对",
    "create.mode": "网格方向",
    "create.tradingMode": "交易模式",
    "create.lower": "下限价格",
    "create.upper": "上限价格",
    "create.gridCount": "网格数量",
    "create.perGrid": "每格金额 (USD)",
    "create.leverage": "杠杆",
    "create.spacing": "间距方式",
    "create.spacing.arithmetic": "等差",
    "create.spacing.geometric": "等比",
    "create.submit": "创建",
    "create.creating": "创建中…",
    "create.success": "机器人已创建",
    "create.paperOnly": "实盘接入尚未开放，当前仅支持模拟盘(paper)。",
    "ai.suggest": "AI 建议参数",
    "ai.thinking": "AI 思考中…",
    "ai.disabled": "未配置 AI（设置 GRIDBOT_AI_PROVIDER + GRIDBOT_AI_API_KEY）",
    "ai.needPrice": "先填上下限价格，AI 会以中点为参考",
    "ai.applied": "已按 AI 建议填入参数",
    "ai.failed": "AI 建议失败",

    "tabs.orders": "挂单",
    "tabs.fills": "成交",
    "tabs.chart": "图表",
    "table.side": "方向",
    "table.price": "价格",
    "table.size": "数量",
    "table.status": "状态",
    "table.grid": "格号",
    "table.fee": "手续费",
    "table.time": "时间",
    "table.empty": "暂无数据",
    "side.buy": "买",
    "side.sell": "卖",

    "chart.gridBand": "网格区间与标记价",
    "logs.title": "系统日志",
  },
  en: {
    "app.title": "GridBot Dashboard",
    "app.subtitle": "Perp grid bot · multi-exchange",
    "nav.overview": "Overview",
    "nav.create": "New Bot",
    "nav.venues": "Venues",
    "nav.logs": "Logs",
    "lang.toggle": "中",

    "venues.title": "Live venues (read-only)",
    "venues.subtitle":
      "Config status + live balance / mark price per venue. Reads only, no orders.",
    "venues.configured": "Configured",
    "venues.notConfigured": "Not configured",
    "venues.liveOn": "Live trading: on",
    "venues.liveOff": "Live trading: off",
    "venues.balance": "Available balance",
    "venues.mark": "Mark price",
    "venues.probe": "Probe",
    "venues.probing": "Probing…",
    "venues.symbolPlaceholder": "Symbol, e.g. BTC-USD",
    "venues.probeFailed": "Probe failed",
    "venues.notConfiguredHint": "Configure this venue's keys/address in .env to enable",
    "venues.openOrders": "Open orders",
    "venues.noOpenOrders": "No open orders",

    "overview.empty": "No bots yet — create one.",
    "overview.totalPnl": "Total net PnL",
    "overview.totalVolume": "Total volume",
    "overview.activeBots": "Running",

    "bot.status.idle": "Idle",
    "bot.status.running": "Running",
    "bot.status.paused": "Paused",
    "bot.status.stopping": "Stopping",
    "bot.status.error": "Error",
    "bot.mode.neutral": "Neutral",
    "bot.mode.long": "Long",
    "bot.mode.short": "Short",

    "bot.mark": "Mark",
    "bot.netPnl": "Net PnL",
    "bot.volume": "Volume",
    "bot.matched": "Round-trips",
    "bot.position": "Position",
    "bot.fees": "Fees",
    "bot.flat": "Flat",

    "action.start": "Start",
    "action.pause": "Pause",
    "action.resume": "Resume",
    "action.stop": "Stop",
    "action.flatten": "Flatten",
    "action.recover": "Recover",
    "action.delete": "Delete",
    "action.confirmDelete": "Delete this bot?",
    "action.confirmRecover":
      "Start out-of-range recovery? Places a reduce-only ladder to unwind, then stops.",
    "adjust.title": "Adjust range",
    "adjust.apply": "Apply",
    "adjust.applied": "Range adjusted",
    "adjust.failed": "Adjust failed",

    "create.title": "New Grid Bot",
    "create.exchange": "Exchange",
    "create.symbol": "Symbol",
    "create.mode": "Grid mode",
    "create.tradingMode": "Trading mode",
    "create.lower": "Lower price",
    "create.upper": "Upper price",
    "create.gridCount": "Grid count",
    "create.perGrid": "Per-grid size (USD)",
    "create.leverage": "Leverage",
    "create.spacing": "Spacing",
    "create.spacing.arithmetic": "Arithmetic",
    "create.spacing.geometric": "Geometric",
    "create.submit": "Create",
    "create.creating": "Creating…",
    "create.success": "Bot created",
    "create.paperOnly": "Live venues are not enabled yet — paper mode only for now.",
    "ai.suggest": "AI suggest params",
    "ai.thinking": "AI thinking…",
    "ai.disabled": "AI not configured (set GRIDBOT_AI_PROVIDER + GRIDBOT_AI_API_KEY)",
    "ai.needPrice": "Fill lower/upper first — AI uses the midpoint as reference",
    "ai.applied": "Applied AI-suggested parameters",
    "ai.failed": "AI suggestion failed",

    "tabs.orders": "Orders",
    "tabs.fills": "Fills",
    "tabs.chart": "Chart",
    "table.side": "Side",
    "table.price": "Price",
    "table.size": "Size",
    "table.status": "Status",
    "table.grid": "Grid",
    "table.fee": "Fee",
    "table.time": "Time",
    "table.empty": "No data",
    "side.buy": "Buy",
    "side.sell": "Sell",

    "chart.gridBand": "Grid band & mark price",
    "logs.title": "System logs",
  },
} as const;

type Key = keyof (typeof dict)["zh"];

interface I18nCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: Key, params?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("zh");
  const value = useMemo<I18nCtx>(
    () => ({
      locale,
      setLocale,
      t: (key, params) => {
        let str: string = dict[locale][key] ?? dict.en[key] ?? key;
        if (params) {
          for (const [k, v] of Object.entries(params)) {
            str = str.replaceAll(`{${k}}`, String(v));
          }
        }
        return str;
      },
    }),
    [locale],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
