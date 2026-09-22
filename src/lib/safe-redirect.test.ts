import assert from 'node:assert/strict'
import { test } from 'node:test'

import { safeRedirect } from './safe-redirect.ts'

const FALLBACK = '/'

const cases: Array<{ name: string; input: unknown; expected: string }> = [
  // Accepted: site-relative paths.
  { name: 'plain path', input: '/profile', expected: '/profile' },
  { name: 'root', input: '/', expected: '/' },
  { name: 'nested path', input: '/profile/edit', expected: '/profile/edit' },
  { name: 'path with query', input: '/profile?tab=bio', expected: '/profile?tab=bio' },
  { name: 'path with hash', input: '/profile#bio', expected: '/profile#bio' },

  // Rejected: leaves the site while still starting with a slash.
  { name: 'protocol-relative', input: '//evil.example', expected: FALLBACK },
  { name: 'protocol-relative with path', input: '//evil.example/hauz', expected: FALLBACK },
  // String.raw so the single backslash is unmistakable to a reader and cannot
  // be lost to escaping.
  { name: 'backslash variant', input: String.raw`/\evil.example`, expected: FALLBACK },
  { name: 'backslash variant with path', input: String.raw`/\evil.example/hauz`, expected: FALLBACK },
  { name: 'double backslash variant', input: String.raw`\\evil.example`, expected: FALLBACK },

  // Rejected: absolute URLs, including one on our own host. Our own host is
  // still refused because the value is only ever used as a path, and allowing
  // it would mean trusting a hostname comparison at every call site.
  { name: 'absolute https', input: 'https://evil.example/hauz', expected: FALLBACK },
  { name: 'absolute http', input: 'http://evil.example', expected: FALLBACK },
  { name: 'absolute on our own host', input: 'https://hauz.uz/profile', expected: FALLBACK },

  // Rejected: schemes.
  { name: 'javascript scheme', input: 'javascript:alert(1)', expected: FALLBACK },
  { name: 'javascript scheme, slash-prefixed', input: '/javascript:alert(1)', expected: FALLBACK },
  { name: 'data scheme', input: 'data:text/html,<script>alert(1)</script>', expected: FALLBACK },
  { name: 'mailto scheme', input: 'mailto:someone@evil.example', expected: FALLBACK },

  // Rejected: control characters used to smuggle a scheme past a naive check.
  { name: 'newline in path', input: '/prof\nile', expected: FALLBACK },
  { name: 'tab-split scheme', input: 'java\tscript:alert(1)', expected: FALLBACK },
  { name: 'null byte', input: '/profile\u0000', expected: FALLBACK },

  // Rejected: self-referential, which would loop.
  { name: 'self-referential /signin', input: '/signin', expected: FALLBACK },
  { name: 'self-referential /signin with query', input: '/signin?redirect=/profile', expected: FALLBACK },

  // Rejected: not a usable string at all.
  { name: 'empty string', input: '', expected: FALLBACK },
  { name: 'relative without slash', input: 'profile', expected: FALLBACK },
  { name: 'undefined', input: undefined, expected: FALLBACK },
  { name: 'null', input: null, expected: FALLBACK },
  { name: 'number', input: 42, expected: FALLBACK },
  { name: 'array', input: ['/profile'], expected: FALLBACK },
]

test('safeRedirect', async (t) => {
  for (const { name, input, expected } of cases) {
    await t.test(name, () => {
      assert.equal(safeRedirect(input), expected)
    })
  }
})

test('safeRedirect never returns a value that leaves the site', async (t) => {
  for (const { name, input } of cases) {
    await t.test(name, () => {
      const result = safeRedirect(input)
      const resolved = new URL(result, 'http://hauz.invalid')

      assert.equal(resolved.origin, 'http://hauz.invalid')
      assert.ok(result.startsWith('/'))
      assert.ok(!result.startsWith('//'))
    })
  }
})
