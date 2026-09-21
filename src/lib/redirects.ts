export function safeInternalPath(input: string | null | undefined, fallback: string) {
  if (!input || !input.startsWith("/") || input.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(input, "https://imperioes.invalid");

    if (parsed.origin !== "https://imperioes.invalid") {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
