/** Fixed public messages only: provider payloads can contain credentials and project identifiers. */
export function policyExtractionError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  let payload = message;
  if (error && typeof error === 'object') { try { payload += JSON.stringify(error); } catch { /* A generic message is safe. */ } }
  if (/API_KEY_HTTP_REFERRER_BLOCKED|requests from referer.*blocked/i.test(payload)) return 'The AI service does not allow this website address. Use a manual draft, or ask the site operator to enable this preview address. Your pasted text is preserved.';
  if (/Failed to fetch|NetworkError|network request failed|ECONN|fetch failed/i.test(payload)) return 'The AI service could not be reached. Check your connection and try again, or use a manual draft; your pasted text is preserved.';
  if (name === 'PolicyNoApiKeyError') return 'No AI service key is configured for this website. Start a manual draft; your pasted text is preserved.';
  if (name === 'PolicyRateLimitError' || /RESOURCE_EXHAUSTED|"code":\s*429\b|\bstatus:? 429\b|\bHTTP 429\b/.test(payload)) return 'The AI extraction limit was reached. Try again later or use a manual draft; your pasted text is preserved.';
  if (name === 'PolicySourceTooLongError') return 'The pasted text exceeds the extraction size limit. Paste the operative sections only, or use a manual draft.';
  if (/\b(SAFETY|RECITATION|PROHIBITED_CONTENT|blockReason|blockedReason)\b/.test(payload)) return 'The AI provider declined this extraction. Review the source text or use a manual draft; your pasted text is preserved.';
  return 'AI extraction did not complete. Try again or use a manual draft; your pasted text is preserved.';
}
