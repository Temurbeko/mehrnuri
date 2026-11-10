"use client";

import { ArrowRight, Building2, Check, ChevronLeft, ChevronUp, MapPin, Phone, Plus, Wallet } from "lucide-react";
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
import { UTILITY_THEMES } from "./BillCard";
import { api, errorText } from "./api";

export function AskForm({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const [utilityType, setUtilityType] = useState<UtilityType>("electricity");
  const [region, setRegion] = useState<Region>("tashkent_city");
  const [district, setDistrict] = useState<string>(DISTRICTS_BY_REGION.tashkent_city[0]!.id);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [accountNumber, setAccountNumber] = useState<string>("");

  const [amountOwed, setAmountOwed] = useState("");
  const [phone, setPhone] = useState("+998 ");
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
      <div className="card mx-auto max-w-md space-y-5 text-center p-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/25">
          <Check size={28} aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-slate-900">{dict.ask.successTitle}</h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{created.held ? dict.ask.heldText : dict.ask.successText}</p>
        </div>
        <div className="panel">
          <div className="text-sm font-semibold text-slate-600">{dict.ask.yourCode}</div>
          <div className="mt-0.5 font-mono text-xl font-extrabold tracking-widest text-slate-900 select-all">
            {created.code}
          </div>
        </div>
        <Link href={`/${locale}/bill/${created.id}`} className="btn-primary">
          <span>{dict.ask.viewBill}</span>
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
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

      <div className="card space-y-5 p-5 sm:p-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            {step !== 1 && (
              <button
                type="button"
                onClick={goBack}
                disabled={submitting}
                className="btn-ghost w-auto shrink-0 whitespace-nowrap px-2"
              >
                <ChevronLeft size={18} aria-hidden="true" />
                {dict.common.back}
              </button>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <div className="flex gap-1.5" aria-hidden="true">
                {[1, 2, 3].map((n) => (
                  <span key={n} className={`h-2 w-6 rounded-full ${n <= step ? "bg-amber-500" : "bg-slate-200"}`} />
                ))}
              </div>
              <span className="text-sm font-extrabold whitespace-nowrap text-slate-500">{fmt(dict.checkout.stepOf, { n: step })}</span>
            </div>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">{stepTitle}</h1>
        </div>

        {step === 1 && (
          <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {UTILITY_TYPES.map((u) => {
            const active = utilityType === u;
            const theme = UTILITY_THEMES[u];
            return (
              <button
                key={u}
                type="button"
                onClick={() => setUtilityType(u)}
                className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 py-2.5 px-1.5 text-center transition-all active:scale-95 ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white shadow-xs"
                    : "border-slate-200/80 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg ${
                    active ? "bg-white/15" : `${theme.bg} ${theme.text}`
                  }`}
                  aria-hidden="true"
                >
                  {UTILITY_ICONS[u]}
                </span>
                <span className="line-clamp-1 text-[11px] font-extrabold leading-tight">{dict.utility[u]}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="label" htmlFor="region">
                <MapPin size={16} aria-hidden="true" className="mr-1.5 -mt-0.5 inline" />{dict.ask.region}
              </label>
              <select
                id="region"
                value={region}
                onChange={(e) => {
                  const nextRegion = e.target.value as Region;
                  setRegion(nextRegion);
                  setDistrict(DISTRICTS_BY_REGION[nextRegion][0]!.id);
                }}
                className="input cursor-pointer py-2.5 text-xs sm:text-sm font-bold"
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {dict.region[r]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="district">
                <Building2 size={16} aria-hidden="true" className="mr-1.5 -mt-0.5 inline" />{dict.ask.district}
              </label>
              <select
                id="district"
                value={currentDistrict.id}
                onChange={(e) => setDistrict(e.target.value)}
                className="input cursor-pointer py-2.5 text-xs sm:text-sm font-bold"
              >
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {dict.districts[d.id]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="px-1 text-[11px] font-semibold text-slate-400 truncate">
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
            <div className="space-y-1.5">
              <label className="label" htmlFor="accountNumber">
                {dict.ask.accountNumber}
              </label>
              <input
                id="accountNumber"
                type="text"
                inputMode="numeric"
                placeholder={dict.ask.accountHint}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="input font-mono text-base font-extrabold tracking-wider"
              />
            </div>

            <div>
              <label className="label" htmlFor="amountOwed">
                <Wallet size={16} aria-hidden="true" className="mr-1.5 -mt-0.5 inline" />{dict.ask.amount}
              </label>
              <input
                id="amountOwed"
                type="number"
                inputMode="numeric"
                min={1000}
                max={5000000}
                step={100}
                placeholder="150 000"
                value={amountOwed}
                onChange={(e) => setAmountOwed(e.target.value)}
                className="input font-mono text-base font-extrabold"
              />
            </div>

        <div className="panel">
          <button
            type="button"
            onClick={() => setShowExtra((v) => !v)}
            className="flex w-full cursor-pointer items-center justify-between text-xs font-extrabold text-slate-600 hover:text-slate-900"
          >
            <span className="inline-flex items-center gap-1.5"><Plus size={18} aria-hidden="true" />{dict.ask.moreToggle}</span>
            <span className="rounded-md bg-slate-200/70 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              {showExtra ? <ChevronUp size={14} aria-hidden="true" /> : dict.ask.optionalBadge}
            </span>
          </button>

          {showExtra && (
            <div className="mt-3 space-y-3 border-t border-slate-200/70 pt-3">
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
                  className="input bg-white py-2 text-xs sm:text-sm"
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
                    className="input bg-white py-2 text-xs sm:text-sm"
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
                      className="input bg-white py-2 font-mono text-xs sm:text-sm"
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
                      className={`cursor-pointer rounded-xl border py-2 px-2.5 text-xs font-bold transition-all ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
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
            {!step2Valid && <p className="text-center text-sm font-semibold text-slate-500">{dict.ask.needAccountAmount}</p>}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="phone">
                <Phone size={16} aria-hidden="true" className="mr-1.5 -mt-0.5 inline" />{dict.ask.phone}
              </label>
              <input
                id="phone"
                type="tel"
                required
                placeholder="+998 90 123 45 67"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input font-mono text-base font-bold"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                required
                className="h-5 w-5 shrink-0 rounded accent-amber-500"
              />
              <span>{dict.ask.consent}</span>
            </label>

            {error && (
              <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-center text-sm font-bold text-rose-700">
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
    </form>
  );
}
