import { describe, expect, it, vi } from "vitest";
import { NotifierRegistry } from "../src/notify/registry.js";
import { TelegramNotifier } from "../src/notify/telegram.js";
import { WebhookNotifier } from "../src/notify/webhook.js";
import type { Notification } from "../src/notify/types.js";

const note: Notification = { title: "Fill", body: "buy 1 @ 100", level: "info" };

describe("NotifierRegistry", () => {
  it("fans out to every sink", async () => {
    const a = { name: "a", send: vi.fn(async () => {}) };
    const b = { name: "b", send: vi.fn(async () => {}) };
    const reg = new NotifierRegistry().add(a).add(b);
    await reg.notify(note);
    expect(a.send).toHaveBeenCalledWith(note);
    expect(b.send).toHaveBeenCalledWith(note);
  });

  it("isolates a failing sink and reports via onError", async () => {
    const err = new Error("boom");
    const bad = {
      name: "bad",
      send: vi.fn(async () => {
        throw err;
      }),
    };
    const good = { name: "good", send: vi.fn(async () => {}) };
    const onError = vi.fn();
    const reg = new NotifierRegistry(onError).add(bad).add(good);
    await reg.notify(note);
    expect(good.send).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("bad", err);
  });
});

describe("TelegramNotifier", () => {
  it("posts a markdown message to the bot API", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("{}", { status: 200 }),
    ) as unknown as typeof fetch;
    const notifier = new TelegramNotifier({ botToken: "T", chatId: "42", fetchImpl });
    await notifier.send({ title: "Error", body: "liquidated", level: "error" });
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/botT/sendMessage");
    const payload = JSON.parse((init as RequestInit).body as string);
    expect(payload.chat_id).toBe("42");
    expect(payload.text).toContain("liquidated");
  });

  it("throws on a non-ok response", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("nope", { status: 403 }),
    ) as unknown as typeof fetch;
    const notifier = new TelegramNotifier({ botToken: "T", chatId: "42", fetchImpl });
    await expect(notifier.send(note)).rejects.toThrow(/telegram send failed/);
  });
});

describe("WebhookNotifier", () => {
  it("posts the notification json", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(null, { status: 204 }),
    ) as unknown as typeof fetch;
    const notifier = new WebhookNotifier({ url: "https://hook.test/x", fetchImpl });
    await notifier.send(note);
    const [url] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://hook.test/x");
  });
});
