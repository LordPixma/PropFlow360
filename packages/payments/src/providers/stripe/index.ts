import type {
  PaymentProvider,
  PaymentProviderConfig,
  CreateCustomerParams,
  UpdateCustomerParams,
  Customer,
  PaymentMethod,
  CreatePaymentIntentParams,
  PaymentIntent,
  PaymentIntentStatus,
  CreateRefundParams,
  Refund,
  WebhookEvent,
} from '../../types';

interface StripeConfig extends PaymentProviderConfig {
  publishableKey?: string;
}

interface StripeApiError {
  error: {
    type: string;
    code?: string;
    message: string;
    param?: string;
  };
}

/**
 * Stripe payment provider implementation
 * Uses Stripe's REST API directly (no SDK) for Cloudflare Workers compatibility
 */
export class StripeProvider implements PaymentProvider {
  private readonly apiKey: string;
  private readonly webhookSecret: string;
  private readonly baseUrl = 'https://api.stripe.com/v1';

  constructor(config: StripeConfig) {
    this.apiKey = config.apiKey;
    this.webhookSecret = config.webhookSecret;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const options: RequestInit = { method, headers };

    if (body) {
      options.body = this.encodeFormData(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      const error = data as StripeApiError;
      throw new Error(`Stripe API error: ${error.error.message}`);
    }

    return data as T;
  }

  private encodeFormData(data: Record<string, unknown>, prefix = ''): string {
    const parts: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      const fullKey = prefix ? `${prefix}[${key}]` : key;

      if (value === undefined || value === null) {
        continue;
      }

      if (typeof value === 'object' && !Array.isArray(value)) {
        parts.push(this.encodeFormData(value as Record<string, unknown>, fullKey));
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object') {
            parts.push(this.encodeFormData(item as Record<string, unknown>, `${fullKey}[${index}]`));
          } else {
            parts.push(`${encodeURIComponent(`${fullKey}[${index}]`)}=${encodeURIComponent(String(item))}`);
          }
        });
      } else {
        parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`);
      }
    }

    return parts.filter(Boolean).join('&');
  }

  // Customer methods
  async createCustomer(params: CreateCustomerParams): Promise<Customer> {
    interface StripeCustomer {
      id: string;
      email: string;
      name: string | null;
      metadata: Record<string, string>;
    }

    const stripeCustomer = await this.request<StripeCustomer>('POST', '/customers', {
      email: params.email,
      name: params.name,
      metadata: params.metadata,
    });

    return {
      id: stripeCustomer.id,
      providerId: stripeCustomer.id,
      email: stripeCustomer.email,
      name: stripeCustomer.name || undefined,
      metadata: stripeCustomer.metadata || {},
    };
  }

  async getCustomer(customerId: string): Promise<Customer | null> {
    try {
      interface StripeCustomer {
        id: string;
        email: string;
        name: string | null;
        metadata: Record<string, string>;
        deleted?: boolean;
      }

      const stripeCustomer = await this.request<StripeCustomer>('GET', `/customers/${customerId}`);

      if (stripeCustomer.deleted) {
        return null;
      }

      return {
        id: stripeCustomer.id,
        providerId: stripeCustomer.id,
        email: stripeCustomer.email,
        name: stripeCustomer.name || undefined,
        metadata: stripeCustomer.metadata || {},
      };
    } catch {
      return null;
    }
  }

  async updateCustomer(customerId: string, params: UpdateCustomerParams): Promise<Customer> {
    interface StripeCustomer {
      id: string;
      email: string;
      name: string | null;
      metadata: Record<string, string>;
    }

    const stripeCustomer = await this.request<StripeCustomer>('POST', `/customers/${customerId}`, {
      email: params.email,
      name: params.name,
      metadata: params.metadata,
    });

    return {
      id: stripeCustomer.id,
      providerId: stripeCustomer.id,
      email: stripeCustomer.email,
      name: stripeCustomer.name || undefined,
      metadata: stripeCustomer.metadata || {},
    };
  }

  // Payment Method methods
  async attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<PaymentMethod> {
    interface StripePaymentMethod {
      id: string;
      type: string;
      card?: {
        brand: string;
        last4: string;
        exp_month: number;
        exp_year: number;
      };
    }

    const stripePaymentMethod = await this.request<StripePaymentMethod>(
      'POST',
      `/payment_methods/${paymentMethodId}/attach`,
      { customer: customerId }
    );

    return this.mapPaymentMethod(stripePaymentMethod);
  }

  async listPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    interface StripePaymentMethodList {
      data: Array<{
        id: string;
        type: string;
        card?: {
          brand: string;
          last4: string;
          exp_month: number;
          exp_year: number;
        };
      }>;
    }

    const response = await this.request<StripePaymentMethodList>(
      'GET',
      `/payment_methods?customer=${customerId}&type=card`
    );

    return response.data.map((pm) => this.mapPaymentMethod(pm));
  }

  private mapPaymentMethod(stripePm: {
    id: string;
    type: string;
    card?: {
      brand: string;
      last4: string;
      exp_month: number;
      exp_year: number;
    };
  }): PaymentMethod {
    return {
      id: stripePm.id,
      providerId: stripePm.id,
      type: stripePm.type,
      card: stripePm.card
        ? {
            brand: stripePm.card.brand,
            last4: stripePm.card.last4,
            expMonth: stripePm.card.exp_month,
            expYear: stripePm.card.exp_year,
          }
        : undefined,
    };
  }

  // Payment Intent methods
  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent> {
    interface StripePaymentIntent {
      id: string;
      amount: number;
      currency: string;
      status: string;
      client_secret: string;
      payment_method: string | null;
      metadata: Record<string, string>;
    }

    const metadata: Record<string, string> = {
      tenantId: params.tenantId,
      ...(params.bookingId && { bookingId: params.bookingId }),
      ...(params.invoiceId && { invoiceId: params.invoiceId }),
      ...params.metadata,
    };

    const requestParams: Record<string, unknown> = {
      amount: params.amount,
      currency: params.currency.toLowerCase(),
      metadata,
      automatic_payment_methods: { enabled: true },
    };

    if (params.customerId) {
      requestParams.customer = params.customerId;
    }

    if (params.returnUrl) {
      requestParams.return_url = params.returnUrl;
    }

    const stripeIntent = await this.request<StripePaymentIntent>(
      'POST',
      '/payment_intents',
      requestParams
    );

    return this.mapPaymentIntent(stripeIntent);
  }

  async confirmPaymentIntent(intentId: string): Promise<PaymentIntent> {
    interface StripePaymentIntent {
      id: string;
      amount: number;
      currency: string;
      status: string;
      client_secret: string;
      payment_method: string | null;
      metadata: Record<string, string>;
    }

    const stripeIntent = await this.request<StripePaymentIntent>(
      'POST',
      `/payment_intents/${intentId}/confirm`
    );

    return this.mapPaymentIntent(stripeIntent);
  }

  async capturePaymentIntent(intentId: string, amount?: number): Promise<PaymentIntent> {
    interface StripePaymentIntent {
      id: string;
      amount: number;
      currency: string;
      status: string;
      client_secret: string;
      payment_method: string | null;
      metadata: Record<string, string>;
    }

    const params = amount ? { amount_to_capture: amount } : {};

    const stripeIntent = await this.request<StripePaymentIntent>(
      'POST',
      `/payment_intents/${intentId}/capture`,
      params
    );

    return this.mapPaymentIntent(stripeIntent);
  }

  async cancelPaymentIntent(intentId: string): Promise<PaymentIntent> {
    interface StripePaymentIntent {
      id: string;
      amount: number;
      currency: string;
      status: string;
      client_secret: string;
      payment_method: string | null;
      metadata: Record<string, string>;
    }

    const stripeIntent = await this.request<StripePaymentIntent>(
      'POST',
      `/payment_intents/${intentId}/cancel`
    );

    return this.mapPaymentIntent(stripeIntent);
  }

  private mapPaymentIntent(stripeIntent: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    client_secret: string;
    payment_method: string | null;
    metadata: Record<string, string>;
  }): PaymentIntent {
    return {
      id: stripeIntent.id,
      providerId: stripeIntent.id,
      amount: stripeIntent.amount,
      currency: stripeIntent.currency.toUpperCase(),
      status: this.mapPaymentIntentStatus(stripeIntent.status),
      clientSecret: stripeIntent.client_secret,
      paymentMethodId: stripeIntent.payment_method || undefined,
      metadata: stripeIntent.metadata || {},
    };
  }

  private mapPaymentIntentStatus(stripeStatus: string): PaymentIntentStatus {
    const statusMap: Record<string, PaymentIntentStatus> = {
      requires_payment_method: 'pending',
      requires_confirmation: 'pending',
      requires_action: 'requires_action',
      processing: 'processing',
      requires_capture: 'processing',
      succeeded: 'succeeded',
      canceled: 'cancelled',
    };

    return statusMap[stripeStatus] || 'failed';
  }

  // Refund methods
  async createRefund(params: CreateRefundParams): Promise<Refund> {
    interface StripeRefund {
      id: string;
      payment_intent: string;
      amount: number;
      status: string;
      reason: string | null;
    }

    const requestParams: Record<string, unknown> = {
      payment_intent: params.paymentId,
    };

    if (params.amount) {
      requestParams.amount = params.amount;
    }

    if (params.reason) {
      requestParams.reason = params.reason;
    }

    const stripeRefund = await this.request<StripeRefund>('POST', '/refunds', requestParams);

    return {
      id: stripeRefund.id,
      providerId: stripeRefund.id,
      paymentId: stripeRefund.payment_intent,
      amount: stripeRefund.amount,
      status: stripeRefund.status === 'succeeded' ? 'succeeded' : stripeRefund.status === 'pending' ? 'pending' : 'failed',
      reason: stripeRefund.reason || undefined,
    };
  }

  // Webhook methods
  async constructEvent(payload: string, signature: string): Promise<WebhookEvent> {
    // Verify webhook signature
    const verified = await this.verifyWebhookSignature(payload, signature);
    if (!verified) {
      throw new Error('Invalid webhook signature');
    }

    interface StripeEvent {
      id: string;
      type: string;
      data: { object: unknown };
      created: number;
    }

    const event = JSON.parse(payload) as StripeEvent;

    return {
      id: event.id,
      type: event.type,
      data: event.data.object,
      created: event.created,
    };
  }

  private async verifyWebhookSignature(payload: string, signatureHeader: string): Promise<boolean> {
    // Parse the signature header
    const parts = signatureHeader.split(',').reduce(
      (acc, part) => {
        const [key, value] = part.split('=');
        if (key && value) {
          acc[key.trim()] = value.trim();
        }
        return acc;
      },
      {} as Record<string, string>
    );

    const timestamp = parts.t;
    const signature = parts.v1;

    if (!timestamp || !signature) {
      return false;
    }

    // Check timestamp is not too old (5 minutes tolerance)
    const timestampMs = parseInt(timestamp, 10) * 1000;
    if (Date.now() - timestampMs > 5 * 60 * 1000) {
      return false;
    }

    // Compute expected signature
    const signedPayload = `${timestamp}.${payload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return signature === expectedSignature;
  }
}
