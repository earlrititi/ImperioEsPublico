type DeliveryMessage = { to: string | string[]; cc?: string | string[]; bcc?: string | string[] };

export function transactionalTestMessage<T extends DeliveryMessage & { subject?: string }>(message: T, recipient: string, stripeKey: string, runId = ""): T {
  if (!recipient) return message;
  const sink = recipient.trim().toLowerCase();
  if (!/^(sk|rk)_test_/.test(stripeKey) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sink) || (runId && !/^[a-f0-9-]{36}$/.test(runId))) {
    throw new Error("TRANSACTIONAL_TEST_CONFIGURATION_INVALID");
  }
  return { ...message, to: sink, cc: undefined, bcc: undefined, subject: `[TEST - SIN COBRO REAL] ${runId ? `[run:${runId}] ` : ""}${message.subject ?? "Mensaje transaccional de prueba"}` };
}

// A saved retry payload must obey the current Test recipient boundary too.
export function assertMailRecipient(message: DeliveryMessage, mode: string, testRecipient: string) {
  if (mode !== "test") return;
  const normalize = (value: string) => value.trim().toLowerCase();
  const allowed = normalize(testRecipient);
  const recipients = [message.to, message.cc ?? [], message.bcc ?? []].flat();
  if (!allowed || !recipients.length || recipients.some(value => normalize(value) !== allowed)) {
    throw new Error("EMAIL_TEST_RECIPIENT_MISMATCH");
  }
}
