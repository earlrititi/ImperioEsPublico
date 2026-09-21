const EXTERNAL_PATH_PATTERN = /^(?:[a-z][a-z\d+.-]*:|#)/i;

export const withBase = (path = "") => {
  if (!path || EXTERNAL_PATH_PATTERN.test(path)) return path;

  const base = import.meta.env?.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;

  return `${normalizedBase}${normalizedPath}`;
};
