/**
 * A profile linked to an account is shown as "Account (profile)": the account
 * is the real identity of the person, while the profile display name is what a
 * coach may have recorded separately. When the profile has no account - or the
 * display name already matches the account - the profile name alone is shown.
 */
export function profileDisplayName(
  accountName: string | null | undefined,
  profileName: string | null | undefined,
): string {
  if (accountName && profileName && accountName !== profileName) {
    return `${accountName} (${profileName})`;
  }
  return profileName || accountName || "";
}

/**
 * Pickers and readonly identity labels prefer the account name outright: the
 * account is the real identity of the person. The profile display name is only
 * a fallback for a profile recorded without an account (or whose account has
 * no usable name yet).
 */
export function accountDisplayName(
  accountName: string | null | undefined,
  profileName: string | null | undefined,
): string {
  const trimmed = accountName?.trim();
  if (trimmed) return trimmed;
  return profileName || "";
}
