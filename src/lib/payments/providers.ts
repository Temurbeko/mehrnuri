import "server-only";
import type { PaymentDoc } from "@/lib/db/models";
import { PAYMENT_PROVIDERS, type PaymentProviderId } from "@/lib/domain";
import type { Locale } from "@/i18n/config";
import { hmac } from "@/lib/security/crypto";

export interface PaymentProvider {
  id: PaymentProviderId;
  checkoutUrl(payment: PaymentDoc, ctx: { locale: Locale }): string;
}

export function paymentSignature(paymentId: string): string {
  return hmac(`payment-confirm:${paymentId}`);
}

const directPayUrl = (p: PaymentDoc, locale: Locale) => `/${locale}/pay/${p._id.toHexString()}`;

function createDirectProvider(id: PaymentProviderId): PaymentProvider {
  return {
    id,
    checkoutUrl: (p, { locale }) => directPayUrl(p, locale),
  };
}

const ALL: Record<PaymentProviderId, PaymentProvider> = {
  click: createDirectProvider("click"),
  payme: createDirectProvider("payme"),
  uzum: createDirectProvider("uzum"),
  paynet: createDirectProvider("paynet"),
};

export function getProvider(id: PaymentProviderId): PaymentProvider | null {
  return ALL[id] ?? null;
}

export function enabledProviders(): PaymentProviderId[] {
  return [...PAYMENT_PROVIDERS];
}
