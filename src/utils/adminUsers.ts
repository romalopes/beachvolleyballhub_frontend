import type { AdminUser } from "../api";

export function adminUserDisplayName(user: AdminUser) {
  const contactName = [user.first_name, user.last_name].filter(Boolean).join(" ");
  return contactName || user.name || user.email_address;
}
