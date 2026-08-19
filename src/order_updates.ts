import { z } from "zod";

export const orderUpdateSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("checkout.completed"), orderId: z.string().min(1), customerId: z.string().min(1), totalCents: z.number().int().nonnegative() }),
  z.object({ type: z.literal("fulfillment.shipped"), orderId: z.string().min(1), trackingNumber: z.string().min(1) }),
  z.object({ type: z.literal("receipt.issued"), orderId: z.string().min(1), receiptNumber: z.string().min(1) }),
  z.object({ type: z.literal("customer.order_updated"), orderId: z.string().min(1), status: z.enum(["paid", "shipped", "delivered"]) })
]);

export type OrderUpdate = z.infer<typeof orderUpdateSchema>;

export function acceptOrderUpdate(body: unknown): OrderUpdate {
  return orderUpdateSchema.parse(body);
}
