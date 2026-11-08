import type { PaymentProviderId } from "@/lib/domain";

export type MerchantId = PaymentProviderId;

export interface MerchantApp {
  id: MerchantId;
  name: string;
  icon: string;
  color: string;
  activeClass: string;
  mobileAppUrl: string;
  webCheckoutUrl: string;
  qrUrl: string;
}

export const MERCHANT_APPS: Record<MerchantId, MerchantApp> = {
  click: {
    id: "click",
    name: "Click",
    icon: "/merchants/click.png",
    color: "#0aa4f6",
    activeClass: "border-sky-500 bg-sky-500/8 ring-2 ring-sky-500/20",
    mobileAppUrl: "https://my.click.uz/app/billing",
    webCheckoutUrl: "https://my.click.uz/services",
    qrUrl: "https://my.click.uz/app/billing",
  },
  payme: {
    id: "payme",
    name: "Payme",
    icon: "/merchants/payme.png",
    color: "#00b8b8",
    activeClass: "border-teal-500 bg-teal-500/8 ring-2 ring-teal-500/20",
    mobileAppUrl: "https://payme.uz/openapp",
    webCheckoutUrl: "https://payme.uz/home/payment",
    qrUrl: "https://payme.uz/openapp",
  },
  paynet: {
    id: "paynet",
    name: "Paynet",
    icon: "/merchants/paynet.png",
    color: "#00a651",
    activeClass: "border-emerald-500 bg-emerald-500/8 ring-2 ring-emerald-500/20",
    mobileAppUrl: "https://app.paynet.uz/",
    webCheckoutUrl: "https://app.paynet.uz/",
    qrUrl: "https://app.paynet.uz/",
  },
  uzum: {
    id: "uzum",
    name: "Uzum Bank",
    icon: "/merchants/uzum.png",
    color: "#7000ff",
    activeClass: "border-violet-500 bg-violet-500/8 ring-2 ring-violet-500/20",
    mobileAppUrl: "https://uzumbank.uz/goto",
    webCheckoutUrl: "https://uzumbank.uz/",
    qrUrl: "https://uzumbank.uz/goto",
  },
};
