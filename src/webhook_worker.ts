import { z } from "zod";
import { InfraiQueue } from "./infrai_queue.ts";
import { orderUpdateSchema, type OrderUpdate } from "./order_updates.ts";

const queuedMessageSchema = z.object({
  message_id: z.string().min(1),
  payload: orderUpdateSchema
});

const consumedSchema = z.object({ messages: z.array(queuedMessageSchema) });

export type Delivery = (update: OrderUpdate) => Promise<boolean>;

export async function deliverBatch(queue: Pick<InfraiQueue, "consume" | "ack">, deliver: Delivery): Promise<number> {
  const batch = consumedSchema.parse(await queue.consume(10, 30));
  let acknowledged = 0;

  for (const message of batch.messages) {
    if (await deliver(message.payload)) {
      await queue.ack(message.message_id);
      acknowledged += 1;
    }
  }
  return acknowledged;
}
