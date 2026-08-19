import { InfraiQueue } from "./infrai_queue.ts";
import { acceptOrderUpdate } from "./order_updates.ts";
import { deliverBatch } from "./webhook_worker.ts";

const queue = new InfraiQueue();
const update = acceptOrderUpdate({
  type: "checkout.completed",
  orderId: "order_1042",
  customerId: "customer_88",
  totalCents: 12900
});

await queue.publish(update, `order-update-${update.orderId}-${update.type}`);
const acknowledged = await deliverBatch(queue, async (event) => {
  console.log("customer webhook delivered", event);
  return true;
});
console.log(`acknowledged ${acknowledged} order update(s)`);
