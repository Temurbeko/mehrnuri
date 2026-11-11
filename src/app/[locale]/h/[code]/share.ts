/**
 * Share links look like /{locale}/h/{code} or /{locale}/h/{code}-a. The "-a"
 * form is what the donor gets when they switch "show the amount" on; without
 * it the amount stays hidden on the page and in the preview image.
 */
export function parseShareParam(raw: string): { code: string; withAmount: boolean } {
  const withAmount = raw.endsWith("-a");
  return { code: withAmount ? raw.slice(0, -2) : raw, withAmount };
}
