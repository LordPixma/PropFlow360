// TenantRateLimit Durable Object
// Per-tenant API rate limiting

export class TenantRateLimit implements DurableObject {
  private state: DurableObjectState;
  private requests: Map<string, number[]> = new Map();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const { endpoint, limit, windowSeconds } = (await request.json()) as {
      endpoint: string;
      limit: number;
      windowSeconds: number;
    };

    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    // Get requests in current window
    let timestamps = this.requests.get(endpoint) || [];
    timestamps = timestamps.filter((t) => t > now - windowMs);

    if (timestamps.length >= limit) {
      const retryAfter = Math.ceil((timestamps[0]! + windowMs - now) / 1000);
      return Response.json(
        {
          allowed: false,
          retryAfter,
          remaining: 0,
        },
        { status: 429 }
      );
    }

    timestamps.push(now);
    this.requests.set(endpoint, timestamps);

    return Response.json({
      allowed: true,
      remaining: limit - timestamps.length,
    });
  }
}
