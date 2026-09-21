type EditorialUser = {
  email_confirmed_at?: string;
  app_metadata?: Record<string, unknown>;
};

// Only trusted Auth metadata is accepted, never user-editable profile metadata.
export function hasEditorialAccess(user: EditorialUser | null | undefined) {
  return Boolean(user?.email_confirmed_at) && user?.app_metadata?.editorial_admin === true;
}
