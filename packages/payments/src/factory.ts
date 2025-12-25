import type { PaymentProvider, PaymentProviderType, PaymentProviderConfig } from './types';
import { StripeProvider } from './providers/stripe';
import { AdyenProvider } from './providers/adyen';

export function createPaymentProvider(
  provider: PaymentProviderType,
  config: PaymentProviderConfig
): PaymentProvider {
  switch (provider) {
    case 'stripe':
      return new StripeProvider(config);
    case 'adyen':
      if (!config.merchantAccount) {
        throw new Error('Adyen requires a merchantAccount in the config');
      }
      return new AdyenProvider({
        ...config,
        merchantAccount: config.merchantAccount,
      });
    default:
      throw new Error(`Unknown payment provider: ${provider}`);
  }
}
