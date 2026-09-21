function normalizeOrigin(value: string | undefined | null) {
  return value?.trim().replace(/\/$/, "") ?? "";
}

export function isAllowedRequestOrigin(
  request: Request,
  configuredOrigin?: string | null
) {
  const origin = normalizeOrigin(request.headers.get("origin"));

  if (!origin) {
    return true;
  }

  const requestOrigin = normalizeOrigin(new URL(request.url).origin);
  const canonicalOrigin = normalizeOrigin(configuredOrigin);

  return origin === requestOrigin || Boolean(canonicalOrigin && origin === canonicalOrigin);
}
