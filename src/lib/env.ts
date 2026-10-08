export function getRequiredEnv(name: string): string {
  const runtimeProcess = globalThis as typeof globalThis & {
    process?: {
      env?: Record<string, string | undefined>;
    };
  };
  const value = import.meta.env?.[name] ?? runtimeProcess.process?.env?.[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
