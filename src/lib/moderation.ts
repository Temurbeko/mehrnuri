/**
 * Text moderation for the free text of a request (story, family name).
 * Pure logic and data, no UI text: callers map the result to messages.
 *
 *  - `blocked`: the text carries a way around the app (a link, an @handle, a
 *    phone or card number). The family gets a clear validation error.
 *  - `hold`: profanity or hate words. The request is still created, but it goes
 *    to the admin "pending" queue instead of the public feed.
 *
 * Importable from both the server (createBill) and the browser (AskForm).
 */

export interface TextCheck {
  blocked: "link" | "contact" | null;
  hold: boolean;
}

/* ---------------------------------------------------------------- links -- */

const TLDS = "uz|com|ru|me|org|net|io|info|biz|co|tv|ly|app|xyz|online|site|store|shop|link|click|cc|gl|su|kz|tj";

const LINK_PATTERNS: RegExp[] = [
  /https?:\/\//i,
  /\bwww\./i,
  /\b(?:t\.me|telegram\.me|wa\.me|bit\.ly)\b/i,
  // word.tld, no space around the dot (a sentence end like "...bor. Uz..." is not a link)
  new RegExp(`[\\p{L}\\p{N}-]\\.(?:${TLDS})(?![\\p{L}\\p{N}])`, "iu"),
  // Instagram / Telegram handle: @ followed by 4+ name characters
  /(?:^|[^\p{L}\p{N}_@.])@[\p{L}\p{N}_.]{4,}/u,
];

/* -------------------------------------------------------------- contacts -- */

/** A run of digits that may be spaced with spaces, dashes, parentheses, a + prefix. */
const DIGIT_RUN = /\+?\(?\d[\d\s\-()]{5,}\d/g;
const CURRENCY_AFTER = /^\s*(?:so['ʻ’`‘]?m|sum|som|сум|сўм|uzs|ming|минг)/i;

function hasContactNumber(text: string): boolean {
  for (const m of text.matchAll(DIGIT_RUN)) {
    const run = m[0].trim();
    const digits = run.replace(/\D/g, "");
    if (digits.length < 7) continue;
    if (digits.length <= 8) {
      // An amount, not a phone: "1 500 000" (thousand groups) or "1500000 so'm".
      const thousands = /^\d{1,3}(?: \d{3})+$/.test(run);
      const followedByCurrency = CURRENCY_AFTER.test(text.slice((m.index ?? 0) + m[0].length));
      if (thousands || followedByCurrency) continue;
    }
    return true;
  }
  return false;
}

/* ------------------------------------------------------------ profanity -- */

/** Cyrillic (Russian + Uzbek) to a Latin skeleton, so one list serves every script. */
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh",
  ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya", ў: "o", қ: "q", ғ: "g", ҳ: "h",
};

/**
 * Lowercase, drop apostrophes and zero-width characters, join letters split by
 * separators (b.l.y.a, b-l-y-a), turn Cyrillic into Latin (lookalikes such as
 * Cyrillic а/о/е/с/р/х then land on the same Latin letter) and squeeze repeated
 * letters (bllyyaaa). The word lists below are written in this skeleton form.
 */
export function normalizeForModeration(text: string): string {
  let s = text.toLowerCase().replace(/[​-‏⁠﻿]/g, "");
  s = s.replace(/['ʻʼ’‘`´]/g, "");
  s = s.replace(/(?<=\p{L})[.\-_*•·]+(?=\p{L})/gu, "");
  s = Array.from(s, (c) => TRANSLIT[c] ?? c).join("");
  return s.replace(/([a-z])\1+/g, "$1");
}

/** Prefixes Russian mat takes (na-huy, za-ebal, vy-ebat, po-huy ...). */
const PREFIX = "(?:na|po|za|vy|vi|s|ob|ot|raz|ras|u|do|pro|pri|pere|ne)?";

/**
 * Roots in normalized form (see normalizeForModeration: single letters, no
 * apostrophes, ё = e, ж = j, х = x, ц = ts, щ = sh). Kept to roots that are not
 * ordinary words, and each is anchored at a word start to avoid false hits.
 */
const PROFANITY_ROOTS: string[] = [
  // --- Russian mat: хуй/хуя/хуе/хуи, пизд, еба/ёба/ебл, бля, сука, мудак, пидор, гандон, шлюха ---
  "[xh]uy", "xu[eiy]",
  "pizd",
  "eba[tln]", "ebu", "ebl", "ebi[st]", "ebe[tm]", "ebok",
  "bly(?:a|ad|at)",
  "suk(?:a|i)(?![a-z])", "such(?:ka|ar)",
  "mudak", "mudil",
  "pid[oa]r", "pidr", "pedik",
  "gandon", "gondon",
  "shlyu[xh]",
  "d[ao]lb[ao][ye]?[eo]b", // долбоёб, далбаёб, dalbayob
  "zalup", "uebok", "uebish", "govn[oa]", "debil", "mraz(?![a-z])",
  // --- Uzbek insults (Latin; Cyrillic is covered by the transliteration) ---
  "jalab", "qanji[qk]",
  "onangni", "ananni",
  "sik(?:ay|ish|ib|il)",
  "[hx]aromi(?:y|lar)?(?![a-z])", "[hx]aromzoda",
  "it\\s?(?:emgan|vachcha|bachcha)",
  "[qk]a[hx]ba(?![a-z])",
  // --- hate words (ethnic / racial slurs) ---
  "churk[ai]", "xoxol", "katsap", "(?:zh|j)id(?![a-z])", "nigg[ae]r?", "negr(?![a-z])",
];

const PROFANITY = new RegExp(`(?<![a-z])${PREFIX}(?:${PROFANITY_ROOTS.join("|")})`);

/* ------------------------------------------------------------------ API -- */

export function checkRequestText(text: string): TextCheck {
  const raw = text ?? "";
  let blocked: TextCheck["blocked"] = null;
  if (LINK_PATTERNS.some((re) => re.test(raw))) blocked = "link";
  else if (hasContactNumber(raw)) blocked = "contact";
  return { blocked, hold: PROFANITY.test(normalizeForModeration(raw)) };
}
