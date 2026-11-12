"use client";

import { ArrowRight, Building2, Check, ChevronUp, MapPin, Plus, Share2, UserRound, Wallet, FileText } from "lucide-react";
import { digitsOnly, groupDigits } from "@/lib/format";
import { useCallback, useEffect, useState } from "react";
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
import { AppBar } from "./AppBar";
import { BottomSheet } from "./BottomSheet";
import { ResultScreen, StatusIcon } from "./ResultScreen";
import { ShareOptions } from "./ShareOptions";
import { checkRequestText } from "@/lib/moderation";
import { api, errorText } from "./api";

export function AskForm({ locale, dict, intro }: { locale: Locale; dict: Dictionary; intro?: React.ReactNode }) {
  const [utilityType, setUtilityType] = useState<UtilityType>("electricity");
  const [region, setRegion] = useState<Region>("tashkent_city");
  const [district, setDistrict] = useState<string>(DISTRICTS_BY_REGION.tashkent_city[0]!.id);
  const [step, setStep] = useState<1 | 2>(1);
  const [accountNumber, setAccountNumber] = useState<string>("");

  const [amountOwed, setAmountOwed] = useState("");
  const [showExtra, setShowExtra] = useState(false);
  const [paymentPurpose, setPaymentPurpose] = useState<PaymentPurpose>("main");
  const [meterReading, setMeterReading] = useState<string>("");
  const [familyName, setFamilyName] = useState("");
  const [story, setStory] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState<{ text: string; billId: string | null } | null>(null);
  const [textError, setTextError] = useState<{ field: "story" | "familyName"; message: string } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const closeShare = useCallback(() => setShareOpen(false), []);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
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

  /** Same rule as the server: no links or contacts in the free text. Shown under the field. */
  function textProblem(): { field: "story" | "familyName"; message: string } | null {
    for (const [field, value] of [["story", story], ["familyName", familyName]] as const) {
      const { blocked } = checkRequestText(value);
      if (blocked) return { field, message: errorText(blocked === "link" ? "text_has_link" : "text_has_contact", dict) };
    }
    return null;
  }

  function goNext() {
    setError(null);
    setTaken(null);
    setStep(2);
  }

  function goBack() {
    setError(null);
    setTaken(null);
    setStep(1);
  }

  const stepTitle = step === 1 ? dict.ask.step1Title : dict.ask.step2Title;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step !== 2) {
      goNext();
      return;
    }
    setError(null);
    setTaken(null);
    const problem = textProblem();
    setTextError(problem);
    if (problem) {
      setShowExtra(true);
      return;
    }
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
    // Catch an account that already has an open request before creating a second one.
    const check = await api<{ hasOpen?: boolean; openBillId?: string | null; blocked?: boolean }>(
      `/api/bills/check?utilityType=${utilityType}&accountNumber=${digits}`,
    );
    if (check.ok && check.data.blocked) {
      setSubmitting(false);
      return setTaken({ text: errorText("account_blocked", dict), billId: null });
    }
    if (check.ok && check.data.hasOpen) {
      setSubmitting(false);
      return setTaken({ text: dict.ask.alreadyOpen, billId: check.data.openBillId ?? null });
    }
    const res = await api<{ id?: string; code?: string; reviewStatus?: string }>("/api/bills", {
      body: {
        utilityType,
        region,
        district: currentDistrict.id,
        paymentPurpose,
        meterReading: meterUnit && meterReading.trim() !== "" ? Number(meterReading) : null,
        accountNumber: digits,
        amountOwed: amt,
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
    const billPath = `/${locale}/bill/${created.id}`;
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--paper)]">
        <ResultScreen
          art={
            <StatusIcon tone="ok">
              <Check size={40} strokeWidth={3} aria-hidden="true" />
            </StatusIcon>
          }
          title={dict.ask.successTitle}
          date={dict.ask.yourCode}
          amount={created.code}
          body={created.held ? dict.ask.heldText : dict.ask.successText}
          actions={[
            // A request that waits for review has no public page to share yet.
            ...(created.held ? [] : [{ key: "share", label: dict.ux2.share, icon: <Share2 size={22} />, onClick: () => setShareOpen(true) }]),
            { key: "bill", label: dict.ux2.myRequest, icon: <FileText size={22} />, href: billPath },
            { key: "me", label: dict.ux2.profile, icon: <UserRound size={22} />, href: `/${locale}/me` },
          ]}
          mainLabel={dict.ux2.done}
          mainHref={`/${locale}`}
        />
        <BottomSheet open={shareOpen} onClose={closeShare} labelledBy="ask-share-title">
          <h2 id="ask-share-title" className="mb-3 text-[22px] font-extrabold tracking-tight text-[var(--ink)]">
            {dict.shareTo.title}
          </h2>
          <p className="mb-4 text-[14px] text-[var(--ink-soft)]">{dict.shareTo.billText}</p>
          <ShareOptions url={`${origin}${billPath}`} text={dict.shareTo.billText} dict={dict} />
        </BottomSheet>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg">
      <AppBar title={dict.ask.title} locale={locale} backLabel={dict.common.back} onBack={step > 1 && !submitting ? goBack : undefined} />
      {intro && <div className="mb-4">{intro}</div>}
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
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <div className="flex gap-1.5" aria-hidden="true">
                {[1, 2].map((n) => (
                  <span
                    key={n}
                    className={`h-1.5 rounded-full transition-all ${n === step ? "w-8 bg-amber-500" : n < step ? "w-4 bg-amber-500/50" : "w-4 bg-stone-300"}`}
                  />
                ))}
              </div>
              <span className="text-sm font-extrabold whitespace-nowrap text-stone-500">{step}/2</span>
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
            className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-2 text-sm font-extrabold text-stone-700 hover:text-stone-900"
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
                  onChange={(e) => {
                    setStory(e.target.value);
                    setTextError(null);
                  }}
                  aria-invalid={textError?.field === "story"}
                  className="field text-sm"
                />
                {textError?.field === "story" && (
                  <p role="alert" className="mt-1.5 text-[13px] font-bold break-words text-rose-700">{textError.message}</p>
                )}
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
                    onChange={(e) => {
                      setFamilyName(e.target.value);
                      setTextError(null);
                    }}
                    aria-invalid={textError?.field === "familyName"}
                    className="field text-sm"
                  />
                  {textError?.field === "familyName" && (
                    <p role="alert" className="mt-1.5 text-[13px] font-bold break-words text-rose-700">{textError.message}</p>
                  )}
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

            {taken && (
              <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-center text-sm font-bold text-rose-700">
                {taken.text}
                {taken.billId && (
                  <Link href={`/${locale}/bill/${taken.billId}`} className="mt-1 block underline underline-offset-2">
                    {dict.ask.viewOpen}
                  </Link>
                )}
              </div>
            )}
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

            <button type="submit" disabled={submitting || !consent || !step2Valid} className="btn-primary">
              <span>{submitting ? dict.ask.submitting : dict.ask.submit}</span>
              {!submitting && <ArrowRight size={18} aria-hidden="true" />}
            </button>
            {!step2Valid && <p className="text-center text-sm font-medium text-stone-500">{dict.ask.needAccountAmount}</p>}
          </div>
        )}
        </div>
      </div>
    </form>
  );
}
