import 'server-only';

/**
 * Logs the FULL Supabase / fetch error (message, code, status, details, hint) to the server logs
 * (Vercel → Logs, or the `npm run dev` terminal). The user keeps seeing the translated message only.
 * Never pass secrets: only the error object and non-sensitive context (phone is masked).
 */
export function logError(scope: string, err: unknown, context: Record<string, unknown> = {}) {
  const e = (err ?? {}) as Record<string, unknown>;
  console.error(
    `[boda:${scope}]`,
    JSON.stringify({
      ...context,
      name: e.name,
      message: e.message ?? (typeof err === 'string' ? err : undefined),
      code: e.code,
      status: e.status ?? e.statusCode,
      details: e.details,
      hint: e.hint,
    }),
  );
}

/** +254702181688 -> +2547•••1688 (enough to correlate a log line with a user, not enough to leak it). */
export const maskPhone = (phone: string | null | undefined) =>
  phone ? `${phone.slice(0, 5)}•••${phone.slice(-4)}` : null;

/**
 * True only when GoTrue says the credentials are wrong. Anything else (email provider disabled,
 * network, wrong API key…) is an infrastructure problem and must not look like a wrong PIN/password.
 */
export function isBadCredentials(err: { status?: number; code?: string } | null | undefined) {
  return !!err && (err.code === 'invalid_credentials' || (err.status === 400 && !err.code));
}
