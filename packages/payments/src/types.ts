// Payment provider abstraction types

export interface PaymentProvider {
  // Customers
  createCustomer(params: CreateCustomerParams): Promise<Customer>;
  getCustomer(customerId: string): Promise<Customer | null>;
  updateCustomer(customerId: string, params: UpdateCustomerParams): Promise<Customer>;

  // Payment Methods
  attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<PaymentMethod>;
  listPaymentMethods(customerId: string): Promise<PaymentMethod[]>;

  // Payment Intents
  createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent>;
  confirmPaymentIntent(intentId: string): Promise<PaymentIntent>;
  capturePaymentIntent(intentId: string, amount?: number): Promise<PaymentIntent>;
  cancelPaymentIntent(intentId: string): Promise<PaymentIntent>;

  // Refunds
  createRefund(params: CreateRefundParams): Promise<Refund>;

  // Webhooks
  constructEvent(payload: string, signature: string): Promise<WebhookEvent>;
}

export interface CreateCustomerParams {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface UpdateCustomerParams {
  email?: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface Customer {
  id: string;
  providerId: string;
  email: string;
  name?: string;
  metadata: Record<string, string>;
}

export interface PaymentMethod {
  id: string;
  providerId: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
}

export interface CreatePaymentIntentParams {
  amount: number; // in smallest currency unit (pence/cents)
  currency: string;
  customerId?: string;
  tenantId: string;
  bookingId?: string;
  invoiceId?: string;
  metadata?: Record<string, string>;
  returnUrl?: string;
}

export interface PaymentIntent {
  id: string;
  providerId: string;
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
  clientSecret?: string;
  paymentMethodId?: string;
  metadata: Record<string, string>;
}

export type PaymentIntentStatus =
  | 'pending'
  | 'requires_action'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface CreateRefundParams {
  paymentId: string;
  amount?: number; // partial refund if specified
  reason?: string;
}

export interface Refund {
  id: string;
  providerId: string;
  paymentId: string;
  amount: number;
  status: 'pending' | 'succeeded' | 'failed';
  reason?: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: unknown;
  created: number;
}

export type PaymentProviderType = 'stripe' | 'adyen';

export interface PaymentProviderConfig {
  apiKey: string;
  webhookSecret: string;
  environment?: 'test' | 'live';
  merchantAccount?: string; // Adyen
}
