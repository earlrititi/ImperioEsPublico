export const ADMIN_USER_IDS = [
  "24f42701-98e0-4716-810c-363ae1cc8fa2",
  "596ce13f-3a34-467e-a5b3-65251a5cf446",
] as const;

export function isImperioAdmin(user: { id: string; email_confirmed_at?: string | null } | null | undefined) {
  return Boolean(user?.email_confirmed_at) && ADMIN_USER_IDS.some(id => id === user?.id);
}
