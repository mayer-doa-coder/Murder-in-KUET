// tokens.ts — Opaque per-player session tokens. A token is the ONLY proof a
// socket is a given seat in a given room; the server authorizes every action and
// reconnection against it, so tokens must be unguessable.

import { randomBytes } from 'node:crypto'

export function newToken(): string {
  return randomBytes(24).toString('base64url')
}

// Room codes are short + human-typeable (no ambiguous 0/O/1/I).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function newRoomCode(len = 4): string {
  const bytes = randomBytes(len)
  let code = ''
  for (let i = 0; i < len; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  return code
}
