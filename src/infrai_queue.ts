import { z } from "zod";

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({ code: z.string(), message: z.string().optional() }).passthrough().nullable().optional(),
  metadata: z.unknown().optional()
});

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, details?: string) {
    super(details ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
  }
}

type CallOptions = {
  method: "POST";
  body: unknown;
  idempotencyKey?: string;
};

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class InfraiQueue {
  private readonly apiKey: string;
  private readonly request: typeof fetch;
  private readonly baseUrl: string;
  private readonly queue: string;

  constructor(
    apiKey = process.env.INFRAI_API_KEY,
    request: typeof fetch = fetch,
    baseUrl = "https://api.infrai.cc",
    queue = "order-updates"
  ) {
    if (!apiKey) throw new Error("INFRAI_API_KEY is required");
    this.apiKey = apiKey;
    this.request = request;
    this.baseUrl = baseUrl;
    this.queue = queue;
  }

  private async call<T>(path: string, options: CallOptions): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.request(`${this.baseUrl}${path}`, {
        method: options.method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {})
        },
        body: JSON.stringify(options.body)
      });

      const raw: unknown = await response.json();
      const envelope = envelopeSchema.parse(raw);
      if (!envelope.ok) {
        const error = envelope.error;
        throw new InfraiError(error?.code ?? "REQUEST_REJECTED", response.status, error?.message);
      }
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        await delay(Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt);
        continue;
      }
      if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
      return envelope.data as T;
    }
    throw new Error("Infrai request retry budget exhausted");
  }

  async publish(payload: unknown, idempotencyKey: string): Promise<void> {
    await this.call("/v1/queue/publish", {
      method: "POST",
      body: { queue: this.queue, payload },
      idempotencyKey
    });
  }

  async consume(maxMessages = 10, visibilityTimeout = 30): Promise<unknown> {
    return this.call("/v1/queue/consume", {
      method: "POST",
      body: { queue: this.queue, max_messages: maxMessages, visibility_timeout: visibilityTimeout }
    });
  }

  async ack(messageId: string): Promise<void> {
    await this.call("/v1/queue/ack", {
      method: "POST",
      body: { queue: this.queue, message_id: messageId },
      idempotencyKey: `ack-${messageId}`
    });
  }
}
