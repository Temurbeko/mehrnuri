/**
 * Amount fields show money the way people read it ("50 000"), while the state
 * keeps plain digits ("50000") so validation and the API never see spaces.
 */
export function digitsOnly(value: string, maxDigits = 9): string {
  return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, maxDigits);
}

/** "1234567" -> "1 234 567" (space-grouped, the norm in Uzbekistan). */
export function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

interface TimeWords {
  now: string;
  min: string;
  hour: string;
  yesterday: string;
  day: string;
}

/** "hozirgina", "5 daqiqa oldin", "kecha"... in the caller's language (`dict.time`). */
export function timeAgo(iso: string, words: TimeWords, now: number = Date.now()): string {
  const ms = now - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  const fill = (tpl: string, n: number) => tpl.replace("{n}", String(n));
  if (!Number.isFinite(min) || min < 1) return words.now;
  if (min < 60) return fill(words.min, min);
  const hours = Math.floor(min / 60);
  if (hours < 24) return fill(words.hour, hours);
  const days = Math.floor(hours / 24);
  if (days < 2) return words.yesterday;
  return fill(words.day, days);
}

/** Lower-case, drop apostrophe variants and extra spaces: "Farg'ona" matches "fargona". */
export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/['ʻʼ`’‘]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
