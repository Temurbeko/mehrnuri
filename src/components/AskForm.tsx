"use client";

import { ArrowRight, Building2, Check, ChevronLeft, ChevronUp, MapPin, Phone, Plus, Wallet } from "lucide-react";
import { digitsOnly, groupDigits } from "@/lib/format";
import { useState } from "react";
import Link from "next/link";
import {
  PAYMENT_PURPOSES,
  REGIONS,
  UTILITY_ICONS,
  UTILITY_TYPES,
  type PaymentPurpose,
  type Region,
  type UtilityType,
} from "@/lib/domain";
import { DISTRICTS_BY_REGION, findDistrict, meterUnitFor, officialSupplierName } from "@/lib/uzbekistan";
import type { Locale } from "@/i18n/config";
import { fmt, formatMoney, type Dictionary } from "@/i18n";
import { Combobox } from "./Combobox";
import { api, errorText } from "./api";

export function AskForm({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const [utilityType, setUtilityType] = useState<UtilityType>("electricity");
  const [region, setRegion] = useState<Region>("tashkent_city");
  const [district, setDistrict] = useState<string>(DISTRICTS_BY_REGION.tashkent_city[0]!.id);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [accountNumber, setAccountNumber] = useState<string>("");

  const [amountOwed, setAmountOwed] = useState("");
  const [phone, setPhone] = useState("+998");
  const [showExtra, setShowExtra] = useState(false);
  const [paymentPurpose, setPaymentPurpose] = useState<PaymentPurpose>("main");
  const [meterReading, setMeterReading] = useState<string>("");
  const [familyName, setFamilyName] = useState("");
  const [story, setStory] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; code: string; held: boolean } | null>(null);

  const districts = DISTRICTS_BY_REGION[region];
  const currentDistrict = findDistrict(region, district);
  const supplier = officialSupplierName(utilityType, region);
  const meterUnit = meterUnitFor(utilityType);

  const accountDigits = accountNumber.replace(/[\s-]/g, "");
  const amountNum = Number(amountOwed.replace(/\s/g, ""));
  const step2Valid =
    /^\d{5,20}$/.test(accountDigits) &&
    amountOwed.trim() !== "" &&
    Number.isInteger(amountNum) &&
    amountNum >= 1000 &&
    amountNum <= 5000000;

  function goNext() {
    setError(null);
    if (step === 1) setStep(2);
    else if (step === 2 && step2Valid) setStep(3);
  }

  function goBack() {
    setError(null);
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
  }

  const stepTitle = step === 1 ? dict.ask.step1Title : step === 2 ? dict.ask.step2Title : dict.ask.step3Title;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step !== 3) {
      goNext();
      return;
    }
    setError(null);
    const digits = accountNumber.replace(/[\s-]/g, "");
    if (!/^\d{5,20}$/.test(digits)) {
      setError(dict.ask.accountHint);
      return;
    }
    const amt = Number(amountOwed.replace(/\s/g, ""));
    if (!Number.isFinite(amt) || amt < 1000) {
      setError(dict.ask.amountHint);
      return;
    }
    setSubmitting(true);
    const res = await api<{ id?: string; code?: string; reviewStatus?: string }>("/api/bills", {
      body: {
        utilityType,
        region,
        district: currentDistrict.id,
        paymentPurpose,
        meterReading: meterUnit && meterReading.trim() !== "" ? Number(meterReading) : null,
        accountNumber: digits,
        amountOwed: amt,
        phone,
        familyName: familyName || undefined,
        story: story || undefined,
        consent,
        website,
      },
    });
    setSubmitting(false);

    if (!res.ok || !res.data.id || !res.data.code) {
      if (
        res.data.error === "amount_exceeds_debt" &&
        res.data.details &&
        typeof res.data.details === "object" &&
        "max" in res.data.details
      ) {
        setError(fmt(dict.ask.amountTooHigh, { max: formatMoney(Number((res.data.details as { max: number }).max), dict) }));
      } else {
        setError(errorText(res.data.error, dict, res.data.details));
      }
      return;
    }
    setCreated({ id: res.data.id, code: res.data.code, held: res.data.reviewStatus === "pending_review" });
  }

  if (created) {
    return (
      <div className="mx-auto max-w-lg space-y-6 pt-4 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <Check size={44} strokeWidth={3} aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">{dict.ask.successTitle}</h1>
          <p className="text-sm leading-relaxed text-stone-600">{created.held ? dict.ask.heldText : dict.ask.successText}</p>
        </div>
        <div className="surface px-4 py-6">
          <div className="text-sm font-medium text-stone-500">{dict.ask.yourCode}</div>
          <div className="mt-1 tabular-nums text-4xl leading-tight font-extrabold tracking-wider text-stone-900 select-all">
            {created.code}
          </div>
        </div>
        <div className="space-y-2.5">
          <Link href={`/${locale}/bill/${created.id}`} className="btn-primary">
            <span>{dict.ask.viewBill}</span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <Link href={`/${locale}/me#my-requests`} className="btn-tonal w-full">
            {dict.ask.viewMyRequests}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg">
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <div className="space-y-5">
        <div className="space-y-3">
          <div className="flex min-h-10 items-center gap-3">
            {step !== 1 && (
              <button
                type="button"
                onClick={goBack}
                disabled={submitting}
                className="btn-ghost -ml-2 w-auto shrink-0 whitespace-nowrap px-2"
              >
                <ChevronLeft size={18} aria-hidden="true" />
                {dict.common.back}
              </button>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <div className="flex gap-1.5" aria-hidden="true">
                {[1, 2, 3].map((n) => (
                  <span
                    key={n}
                    className={`h-1.5 rounded-full transition-all ${n === step ? "w-8 bg-amber-500" : n < step ? "w-4 bg-amber-500/50" : "w-4 bg-stone-300"}`}
                  />
                ))}
              </div>
              <span className="text-sm font-extrabold whitespace-nowrap text-stone-500">{fmt(dict.checkout.stepOf, { n: step })}</span>
            </div>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">{stepTitle}</h1>
        </div>

        <div className="surface space-y-4 p-5">

        {step === 1 && (
          <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
          {UTILITY_TYPES.map((u) => {
            const active = utilityType === u;
            return (
              <button
                key={u}
                type="button"
                onClick={() => setUtilityType(u)}
                aria-pressed={active}
                className={active ? "tile-active min-h-[88px] px-1.5" : "tile min-h-[88px] px-1.5"}
              >
                {active && (
                  <span className="absolute top-2 right-2 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[var(--lamp)] text-[#2b1a04]">
                    <Check size={13} strokeWidth={3} aria-hidden="true" />
                  </span>
                )}
                <span className="text-[28px] leading-none" aria-hidden="true">
                  {UTILITY_ICONS[u]}
                </span>
                <span className="line-clamp-1 text-sm font-extrabold leading-tight">{dict.utility[u]}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            <Combobox
              id="region"
              label={dict.ask.region}
              value={region}
              onChange={(v) => {
                const nextRegion = v as Region;
                setRegion(nextRegion);
                setDistrict(DISTRICTS_BY_REGION[nextRegion][0]!.id);
              }}
              options={REGIONS.map((r) => ({ value: r, label: dict.region[r] }))}
              placeholder={dict.ask.region}
              searchPlaceholder={dict.common.search}
              emptyText={dict.common.nothingFound}
              icon={<MapPin size={18} aria-hidden="true" />}
            />
            <Combobox
              id="district"
              label={dict.ask.district}
              value={currentDistrict.id}
              onChange={setDistrict}
              options={districts.map((d) => ({ value: d.id, label: dict.districts[d.id] }))}
              placeholder={dict.ask.district}
              searchPlaceholder={dict.common.search}
              emptyText={dict.common.nothingFound}
              icon={<Building2 size={18} aria-hidden="true" />}
            />
          </div>

          <div className="px-1 text-xs font-medium text-stone-400 truncate">
            {supplier}
          </div>
        </div>
            <button type="button" onClick={goNext} className="btn-primary">
              <span>{dict.common.next}</span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="accountNumber">
                {dict.ask.accountNumber}
              </label>
              <input
                id="accountNumber"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder={dict.ask.accountHint}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="field tabular-nums text-lg font-extrabold tracking-[0.15em]"
              />
            </div>

            <div>
              <label className="label" htmlFor="amountOwed">
                {dict.ask.amount}
              </label>
              <div className="relative">
                <Wallet size={18} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  id="amountOwed"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="150 000"
                  value={groupDigits(amountOwed)}
                  onChange={(e) => setAmountOwed(digitsOnly(e.target.value, 7))}
                  className="field pl-11 pr-16 tabular-nums text-lg font-extrabold"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-stone-500">
                  {dict.common.som}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {[100000, 200000, 500000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmountOwed(String(v))}
                    className={amountNum === v ? "chip-active" : "chip"}
                  >
                    {v.toLocaleString("ru-RU")}
                  </button>
                ))}
              </div>
            </div>

        <div className="panel">
          <button
            type="button"
            onClick={() => setShowExtra((v) => !v)}
            className="flex min-h-10 w-full cursor-pointer items-center justify-between gap-2 text-sm font-extrabold text-stone-700 hover:text-stone-900"
          >
            <span className="inline-flex items-center gap-1.5"><Plus size={18} aria-hidden="true" />{dict.ask.moreToggle}</span>
            <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-stone-600">
              {showExtra ? <ChevronUp size={14} aria-hidden="true" /> : dict.ask.optionalBadge}
            </span>
          </button>

          {showExtra && (
            <div className="mt-3 space-y-3 pt-1">
              <div>
                <label className="label" htmlFor="story">
                  {dict.ask.story}
                </label>
                <textarea
                  id="story"
                  rows={2}
                  maxLength={300}
                  placeholder={dict.ask.storyHint}
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                  className="field text-sm"
                />
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="familyName">
                    {dict.ask.familyName}
                  </label>
                  <input
                    id="familyName"
                    type="text"
                    maxLength={40}
                    placeholder={dict.ask.familyNameHint}
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    className="field text-sm"
                  />
                </div>

                {meterUnit && (
                  <div>
                    <label className="label" htmlFor="meterReading">
                      {fmt(dict.ask.meter, { unit: meterUnit })}
                    </label>
                    <input
                      id="meterReading"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={9999999}
                      placeholder="00425"
                      value={meterReading}
                      onChange={(e) => setMeterReading(e.target.value)}
                      className="field tabular-nums text-sm"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_PURPOSES.map((p) => {
                  const active = paymentPurpose === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPaymentPurpose(p)}
                      className={`${active ? "chip-active" : "chip bg-white hover:bg-white/70"} justify-center whitespace-normal py-2 text-center`}
                    >
                      {p === "main" ? dict.bill.purposeMain : dict.bill.purposePenalty}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

            <button type="button" onClick={goNext} disabled={!step2Valid} className="btn-primary">
              <span>{dict.common.next}</span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            {!step2Valid && <p className="text-center text-sm font-medium text-stone-500">{dict.ask.needAccountAmount}</p>}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="phone">
                {dict.ask.phone}
              </label>
              <div className="relative">
                <Phone size={18} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <span className="pointer-events-none absolute left-11 top-1/2 -translate-y-1/2 tabular-nums text-base font-bold text-stone-500">
                  +998
                </span>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  required
                  minLength={9}
                  maxLength={9}
                  placeholder="90 123 45 67"
                  value={phone.slice(4)}
                  onChange={(e) => setPhone("+998" + e.target.value.replace(/\D/g, "").slice(0, 9))}
                  className="field pl-[5.5rem] tabular-nums text-lg font-bold tracking-wide"
                />
              </div>
            </div>

            <label
              className={`panel flex cursor-pointer items-start gap-3 text-sm font-medium transition-all active:scale-[0.99] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber-500/70 ${
                consent ? "bg-amber-50 text-stone-800" : "text-stone-600"
              }`}
            >
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                required
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  consent ? "bg-amber-500 text-white" : "bg-[var(--tone-hover)]"
                }`}
              >
                {consent && <Check size={16} strokeWidth={3} />}
              </span>
              <span className="min-w-0">{dict.ask.consent}</span>
            </label>

            {error && (
              <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-center text-sm font-bold text-rose-700">
                {error}
              </div>
            )}

            <button type="submit" disabled={submitting || !consent} className="btn-primary">
              <span>{submitting ? dict.ask.submitting : dict.ask.submit}</span>
              {!submitting && <ArrowRight size={18} aria-hidden="true" />}
            </button>
          </div>
        )}
        </div>
      </div>
    </form>
  );
}
