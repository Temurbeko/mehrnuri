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
