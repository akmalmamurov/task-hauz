/**
 * Where a `redirect` query parameter is allowed to send someone.
 *
 * TASK.md says to send people to whatever page `redirect` names. Taken
 * literally that is an open redirect: /signin?redirect=https://evil.example
 * hands an attacker a phishing link that starts on our own domain, which is
 * exactly what makes it convincing. So the value is treated as untrusted
 * input and has to survive this function before it is used.
 *
 * A rejected value falls back to "/" silently. There is nothing useful to
 * tell the visitor, and an error message would only confirm to whoever built
 * the link that the parameter is being inspected.
 */

const FALLBACK = '/'

/** An origin no real site can hold, so a same-origin result means "relative". */
const BASE = 'http://hauz.invalid'

/** Sending someone from /signin back to /signin is a loop, not a destination. */
const NOT_A_DESTINATION = ['/signin']

function parseAgainstBase(target: string): URL | null {
  try {
    return new URL(target, BASE)
  } catch {
    return null
  }
}

export function safeRedirect(target: unknown): string {
  if (typeof target !== 'string' || target.length === 0) {
    return FALLBACK
  }

  // Must be site-relative. A single leading slash and nothing else.
  if (!target.startsWith('/')) {
    return FALLBACK
  }

  // A backslash is normalised to a forward slash by some browsers, which turns
  // "/\evil.example" into a protocol-relative URL. Compare on a normalised
  // copy so both spellings are caught by the same check.
  if (target.replaceAll('\\', '/').startsWith('//')) {
    return FALLBACK
  }

  // A colon can only be a scheme here ("javascript:", "https:"). Site-relative
  // paths in this app never contain one.
  if (target.includes(':')) {
    return FALLBACK
  }

  // Control characters, including the newline and tab that are sometimes used
  // to smuggle a scheme past a naive check.
  if (/[\u0000-\u001f\u007f]/.test(target)) {
    return FALLBACK
  }

  // Final check against a real parser rather than against our own assumptions:
  // whatever the string is, it has to resolve to the same origin.
  const resolved = parseAgainstBase(target)
  if (!resolved || resolved.origin !== BASE) {
    return FALLBACK
  }

  if (NOT_A_DESTINATION.includes(resolved.pathname)) {
    return FALLBACK
  }

  // Rebuilt from the parsed URL, so what gets used is the normalised path and
  // not the raw string that was checked.
  return `${resolved.pathname}${resolved.search}${resolved.hash}`
}
