/**
 * Copy text to the clipboard and say whether it really worked.
 *
 * The plain `navigator.clipboard.writeText` is missing on non-HTTPS pages
 * (e.g. testing on a phone via http://192.168...), refuses without a user tap,
 * and is restricted on some Android WebViews. The app used to call it, ignore
 * the result and show "Copied ✓" anyway — so donors pasted nothing into their
 * payment app. Callers must only show "copied" when this returns true, and
 * otherwise tell the user to copy by hand.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }

  // Legacy path: works on http:// pages and older browsers, as long as it
  // runs inside a tap/click handler.
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.left = "0";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    area.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Highlight an element's text so the user can long-press → Copy by hand. */
export function selectTextOf(el: HTMLElement | null): void {
  if (!el || typeof window === "undefined") return;
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  selection.removeAllRanges();
  selection.addRange(range);
}
