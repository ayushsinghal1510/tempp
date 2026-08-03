// Phone normalisation for the calling track.
//
// This is load-bearing rather than cosmetic: Lead is uniquely keyed on
// (orgId, phone), so "+919876543210", "9876543210" and "098765 43210" must
// collapse to one string or the same person becomes three leads and the call
// history stops grouping.
//
// Scope is deliberately India-only — the dialler is an Indian admissions desk
// on an Indian DID, and a general E.164 parser would be a dependency and a
// pile of edge cases in exchange for numbers we will never dial. If that
// changes, this is the one function to replace.

const DEFAULT_COUNTRY_CODE = "91";

/**
 * Normalise a typed number to E.164, or null if it cannot be one.
 *
 * Accepts the forms people actually type: with or without +91, with or without
 * a leading 0, and with any mix of spaces, dashes and brackets.
 */
export function normalisePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Keep digits only; a leading + is implied by the country code below.
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  // 00-prefixed international dialling.
  if (digits.startsWith("00")) digits = digits.slice(2);

  // A bare 10-digit subscriber number, optionally with the STD trunk 0.
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = DEFAULT_COUNTRY_CODE + digits;

  if (digits.length !== 12 || !digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    return null;
  }

  // Indian mobile numbers start 6-9. Rejecting the rest here is what stops a
  // typo'd landline or a half-typed number from costing a call attempt.
  if (!/^[6-9]/.test(digits.slice(2))) return null;

  return `+${digits}`;
}

/** "+919876543210" → "+91 98765 43210", for display only. */
export function formatPhone(e164: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}
