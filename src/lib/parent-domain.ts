/**
 * Hidden internal login domain for parent accounts. Parents never type this —
 * they sign in with a GR number, which resolves to the stored alias.
 * Existing accounts keep whatever alias they were created with.
 */
export const PARENT_EMAIL_DOMAIN = "parents.dawnbreakers.app";

export function parentAlias(phone: string) {
  return `parent.${phone}@${PARENT_EMAIL_DOMAIN}`;
}
