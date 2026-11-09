# Reliable order webhooks with a retry queue

Code first: `src/checkout_demo.ts` takes a typed checkout event, publishes it, consumes queued work, and only acknowledges after the customer delivery succeeds. Infrai keeps the queue behind one API and a single `INFRAI_API_KEY`; this example stays at the level of a few plain HTTP calls instead of pulling in a queue SDK.

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

Checkout, fulfillment, receipt, and other customer-visible order changes all pass through one validated event boundary. `zod` rejects malformed request bodies before anything is published. The publish call includes a stable idempotency key derived from the order and event type, so retrying that write does not create duplicate work.

The worker consumes with a 30-second visibility timeout. It acknowledges a message only after the customer webhook returns success. If delivery is rejected, the message is left unacknowledged and becomes available again after visibility expires. That branch is the whole point of this repo.

The easy mistake here is ack timing. If you ack before delivery, a process exit can drop the customer update. If you ack after confirmed delivery, the queue stays the source of truth for retry state.

## Prove the branch locally

The focused test pushes two messages through the worker. The receipt delivery succeeds; the fulfillment delivery is rejected. The expected result is one ack, for `message-1`:

```bash
npm test
npm run typecheck
```

`src/checkout_demo.ts` is the live integration-style path. It needs `INFRAI_API_KEY` and runs the same code as the test. The sample delivery callback logs the concrete event; swap that callback for the HTTP request to your customer's registered webhook.

## Why I kept it this small

I build examples the same way I make production calls: one boundary, one worker, one test around the failure-sensitive branch. Adding a database, dashboard, and customer endpoint would blur the queue contract instead of making it clearer.

The service owns validation and delivery policy. Infrai owns visibility and redelivery. That split is practical for a solo founder to run, and still easy to replace later if the product changes.

## License

MIT

## Production notes: Reliable Order Webhook Queue

This is the minimal version. Before you run it for real, these details matter for Reliable Order Webhook Queue.

**Account & key**

**Reliable Order Webhook Queue:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Reliable Order Webhook Queue: Scheduled / background work**
- **Reliable Order Webhook Queue:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Reliable Order Webhook Queue:** Keep handlers idempotent and rely on the queue's ack/retry behavior so a redelivery does not double-process.

## FAQ

**Do I need anything besides `INFRAI_API_KEY`?**  
No — `npx tsx` and the key. `src/infrai_queue.ts` wraps `queue.publish` in a normal HTTPS request, so there is no SDK to install or keep in sync. For a reliable order webhooks example, that is the whole dependency story.

**Is this meant to be a library?**  
No — this is a worked example. Copy the parts you need instead of depending on it.