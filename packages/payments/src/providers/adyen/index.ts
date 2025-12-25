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

interface AdyenConfig extends PaymentProviderConfig {
  merchantAccount: string;
  clientKey?: string;
  environment?: 'test' | 'live';
}

interface AdyenApiError {
  status: number;
  errorCode: string;
  message: string;
  errorType: string;
}

/**
 * Adyen payment provider implementation
 * Uses Adyen's Checkout API directly for Cloudflare Workers compatibility
 */
export class AdyenProvider implements PaymentProvider {
  private readonly apiKey: string;
  private readonly webhookSecret: string;
  private readonly merchantAccount: string;
  private readonly baseUrl: string;

  // Adyen doesn't have the same customer management as Stripe
  // We use a map to track customers (in production, store in D1)
  private customerStore: Map<string, Customer> = new Map();

  constructor(config: AdyenConfig) {
    this.apiKey = config.apiKey;
    this.webhookSecret = config.webhookSecret;
    this.merchantAccount = config.merchantAccount;

    // Set base URL based on environment
    this.baseUrl =
      config.environment === 'live'
        ? 'https://checkout-live.adyen.com/v70'
        : 'https://checkout-test.adyen.com/v70';
  }

  private async request<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      const error = data as AdyenApiError;
      throw new Error(`Adyen API error: ${error.message} (${error.errorCode})`);
    }

    return data as T;
  }

  // Customer methods - Adyen uses shopperReference, not a separate customer object
  async createCustomer(params: CreateCustomerParams): Promise<Customer> {
    // Adyen doesn't have a customer creation API like Stripe
    // We generate a shopperReference and store customer details
    const id = `cust_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;

    const customer: Customer = {
      id,
      providerId: id, // Used as shopperReference
      email: params.email,
      name: params.name,
      metadata: params.metadata || {},
    };

    this.customerStore.set(id, customer);
    return customer;
  }

  async getCustomer(customerId: string): Promise<Customer | null> {
    return this.customerStore.get(customerId) || null;
  }

  async updateCustomer(customerId: string, params: UpdateCustomerParams): Promise<Customer> {
    const customer = this.customerStore.get(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const updatedCustomer: Customer = {
      ...customer,
      email: params.email || customer.email,
      name: params.name || customer.name,
      metadata: { ...customer.metadata, ...params.metadata },
    };

    this.customerStore.set(customerId, updatedCustomer);
    return updatedCustomer;
  }

  // Payment Method methods
  async attachPaymentMethod(_customerId: string, paymentMethodId: string): Promise<PaymentMethod> {
    // In Adyen, payment methods are attached during payment
    // This is a simplified implementation
    return {
      id: paymentMethodId,
      providerId: paymentMethodId,
      type: 'card',
    };
  }

  async listPaymentMethods(_customerId: string): Promise<PaymentMethod[]> {
    // Adyen stored payment methods require the Recurring API
    // For now, return empty array
    return [];
  }

  // Payment Intent methods - Adyen uses "sessions" for similar functionality
  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent> {
    interface AdyenSession {
      sessionData: string;
      id: string;
      merchantAccount: string;
      reference: string;
      returnUrl: string;
      amount: { value: number; currency: string };
      expiresAt: string;
    }

    // Generate a unique reference
    const reference = `pi_${crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`;

    const requestBody: Record<string, unknown> = {
      merchantAccount: this.merchantAccount,
      amount: {
        value: params.amount,
        currency: params.currency.toUpperCase(),
      },
      reference,
      returnUrl: params.returnUrl || 'https://your-domain.com/checkout/result',
      metadata: {
        tenantId: params.tenantId,
        ...(params.bookingId && { bookingId: params.bookingId }),
        ...(params.invoiceId && { invoiceId: params.invoiceId }),
        ...params.metadata,
      },
    };

    if (params.customerId) {
      requestBody.shopperReference = params.customerId;
    }

    const session = await this.request<AdyenSession>('/sessions', requestBody);

    return {
      id: reference,
      providerId: session.id,
      amount: params.amount,
      currency: params.currency.toUpperCase(),
      status: 'pending',
      clientSecret: session.sessionData,
      metadata: {
        tenantId: params.tenantId,
        sessionId: session.id,
        ...(params.bookingId && { bookingId: params.bookingId }),
        ...(params.invoiceId && { invoiceId: params.invoiceId }),
        ...params.metadata,
      },
    };
  }

  async confirmPaymentIntent(_intentId: string): Promise<PaymentIntent> {
    // Adyen payments are confirmed on the client side
    // The webhook will notify us of the result
    throw new Error('Adyen payments are confirmed via the Drop-in component. Use webhooks to track status.');
  }

  async capturePaymentIntent(intentId: string, amount?: number): Promise<PaymentIntent> {
    interface AdyenCaptureResponse {
      pspReference: string;
      status: string;
    }

    // For manual capture (when autoCapture is disabled)
    const requestBody: Record<string, unknown> = {
      merchantAccount: this.merchantAccount,
      originalReference: intentId,
    };

    if (amount) {
      requestBody.modificationAmount = {
        value: amount,
        currency: 'GBP', // Should be stored from original payment
      };
    }

    const response = await this.request<AdyenCaptureResponse>('/payments/captures', requestBody);

    return {
      id: intentId,
      providerId: response.pspReference,
      amount: amount || 0,
      currency: 'GBP',
      status: response.status === 'received' ? 'processing' : 'succeeded',
      metadata: {},
    };
  }

  async cancelPaymentIntent(intentId: string): Promise<PaymentIntent> {
    interface AdyenCancelResponse {
      pspReference: string;
      status: string;
    }

    const response = await this.request<AdyenCancelResponse>('/payments/cancels', {
      merchantAccount: this.merchantAccount,
      originalReference: intentId,
    });

    return {
      id: intentId,
      providerId: response.pspReference,
      amount: 0,
      currency: 'GBP',
      status: 'cancelled',
      metadata: {},
    };
  }

  // Refund methods
  async createRefund(params: CreateRefundParams): Promise<Refund> {
    interface AdyenRefundResponse {
      pspReference: string;
      status: string;
    }

    const requestBody: Record<string, unknown> = {
      merchantAccount: this.merchantAccount,
      originalReference: params.paymentId,
    };

    if (params.amount) {
      requestBody.amount = {
        value: params.amount,
        currency: 'GBP', // Should be stored from original payment
      };
    }

    const response = await this.request<AdyenRefundResponse>('/payments/refunds', requestBody);

    return {
      id: response.pspReference,
      providerId: response.pspReference,
      paymentId: params.paymentId,
      amount: params.amount || 0,
      status: response.status === 'received' ? 'pending' : 'succeeded',
      reason: params.reason,
    };
  }

  // Webhook methods
  async constructEvent(payload: string, signature: string): Promise<WebhookEvent> {
    // Verify HMAC signature
    const verified = await this.verifyWebhookSignature(payload, signature);
    if (!verified) {
      throw new Error('Invalid webhook signature');
    }

    interface AdyenNotification {
      notificationItems: Array<{
        NotificationRequestItem: {
          pspReference: string;
          eventCode: string;
          eventDate: string;
          merchantReference: string;
          amount: { value: number; currency: string };
          success: string;
          additionalData?: Record<string, string>;
        };
      }>;
    }

    const notification = JSON.parse(payload) as AdyenNotification;
    const item = notification.notificationItems[0]?.NotificationRequestItem;

    if (!item) {
      throw new Error('Invalid notification format');
    }

    // Map Adyen event codes to our standard types
    const eventType = this.mapEventCode(item.eventCode, item.success === 'true');

    return {
      id: item.pspReference,
      type: eventType,
      data: {
        pspReference: item.pspReference,
        merchantReference: item.merchantReference,
        amount: item.amount,
        success: item.success === 'true',
        additionalData: item.additionalData,
      },
      created: new Date(item.eventDate).getTime() / 1000,
    };
  }

  private mapEventCode(eventCode: string, success: boolean): string {
    // Map Adyen event codes to Stripe-like event types
    const eventMap: Record<string, string> = {
      AUTHORISATION: success ? 'payment_intent.succeeded' : 'payment_intent.payment_failed',
      CAPTURE: 'payment_intent.captured',
      CANCELLATION: 'payment_intent.canceled',
      REFUND: success ? 'refund.created' : 'refund.failed',
      REFUND_FAILED: 'refund.failed',
      CAPTURE_FAILED: 'payment_intent.payment_failed',
      CANCEL_OR_REFUND: success ? 'refund.created' : 'refund.failed',
    };

    return eventMap[eventCode] || `adyen.${eventCode.toLowerCase()}`;
  }

  private async verifyWebhookSignature(payload: string, hmacSignature: string): Promise<boolean> {
    if (!hmacSignature) {
      return false;
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      this.hexToBytes(this.webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const expectedSignature = this.bytesToBase64(new Uint8Array(signatureBuffer));

    return hmacSignature === expectedSignature;
  }

  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  private bytesToBase64(bytes: Uint8Array): string {
    const binary = String.fromCharCode(...bytes);
    return btoa(binary);
  }
}
