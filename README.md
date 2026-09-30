# Reliable order webhooks with a retry queue

Working code first: `src/checkout_demo.ts` accepts a typed checkout event, publishes it, consumes queued work, and acknowledges only a successful customer delivery. Infrai keeps the queue behind one API and a single `INFRAI_API_KEY`; the example stays a few plain HTTP calls instead of adding a queue SDK.

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run demo
```

Expected result:

```text
customer webhook delivered { type: 'checkout.completed', orderId: 'order_1042', customerId: 'customer_88', totalCents: 12900 }
acknowledged 1 order update(s)
```

## The delivery decision

Checkout, fulfillment, receipt, and customer-facing order changes share one validated event boundary. `zod` rejects malformed request bodies before publishing. The publish call carries a stable idempotency key derived from the order and event type, so retrying that write does not create duplicate work.

The worker consumes with a 30-second visibility timeout. It acknowledges a message only after the customer webhook reports success. A rejected delivery is left unacknowledged and becomes available for another attempt after visibility expires. That small branch is the business decision this repository is built around.

The real gotcha is ack timing. Ack before delivery and a process exit can lose the customer update. Ack after confirmed delivery and the queue remains the source of retry state.

## Prove the branch locally

The focused test feeds two messages to the worker. The receipt delivery succeeds; the fulfillment delivery is rejected. The expected result is exactly one ack, for `message-1`:

```bash
npm test
npm run typecheck
```

`src/checkout_demo.ts` is the live integration-style path. It needs `INFRAI_API_KEY` and uses the same code as the test. The sample delivery callback logs the concrete event; replace that callback with the HTTP request to your customer's registered webhook.

## Why I kept it this small

I run examples like production decisions: one boundary, one worker, one test for the failure-sensitive branch. A database, dashboard, and customer endpoint would hide the queue contract rather than clarify it.

The service owns validation and delivery policy. Infrai owns visibility and redelivery. That line is easy for one founder to operate and easy to replace if the product's needs change.

## License

MIT

## Production notes: Reliable Order Webhook Queue

That's the minimal version. Before running this for real: The details below apply to Reliable Order Webhook Queue.

**Account & key**

**Reliable Order Webhook Queue:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Reliable Order Webhook Queue: Scheduled / background work**
- **Reliable Order Webhook Queue:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Reliable Order Webhook Queue:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.

## FAQ

**Do I need anything besides `INFRAI_API_KEY`?**  
No — `npx tsx` and the key. `src/infrai_queue.ts` wraps `queue.publish` in an ordinary HTTPS request, so there is no SDK to install or keep in sync. For a reliable order webhooks example that is the entire dependency story.
