import { describe, expect, it, vi } from "vitest";
import { deliverBatch } from "../src/webhook_worker.ts";

describe("webhook delivery decision", () => {
  it("acknowledges success and leaves a rejected delivery for retry", async () => {
    const ack = vi.fn(async (_messageId: string) => undefined);
    const queue = {
      consume: vi.fn(async () => ({ messages: [
        { message_id: "message-1", payload: { type: "receipt.issued", orderId: "order-7", receiptNumber: "receipt-9" } },
        { message_id: "message-2", payload: { type: "fulfillment.shipped", orderId: "order-8", trackingNumber: "track-4" } }
      ] })),
      ack
    };

    const acknowledged = await deliverBatch(queue, async (event) => event.orderId === "order-7");

    expect(acknowledged).toBe(1);
    expect(ack).toHaveBeenCalledOnce();
    expect(ack).toHaveBeenCalledWith("message-1");
  });
});
