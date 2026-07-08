// bluffChallenge.ts — Pure helpers for the Bluff & Challenge system, shared by
// the client and the authoritative server.
//
// A "response" is a public claim a player makes about whether they can disprove
// a suggestion. Players with at least one life may lie (bluff); players with
// zero lives must answer truthfully. Truthfulness is verified against the
// player's real hand — the game engine is the ground-truth arbiter.

import type { ResponseClaim } from './gameTypes'

export const RESPONSE_CLAIMS: ResponseClaim[] = ['suspect', 'weapon', 'location', 'cannot']

export const CLAIM_LABEL: Record<ResponseClaim, string> = {
  suspect:  'DISPROVE SUSPECT',
  weapon:   'DISPROVE WEAPON',
  location: 'DISPROVE LOCATION',
  cannot:   'CANNOT DISPROVE',
}

export const CLAIM_ICON: Record<ResponseClaim, string> = {
  suspect:  '🕵',
  weapon:   '🗡',
  location: '📍',
  cannot:   '✕',
}

export const CLAIM_COLOR: Record<ResponseClaim, string> = {
  suspect:  '#ff6644',
  weapon:   '#ddaa22',
  location: '#44aaff',
  cannot:   '#889099',
}

// Starting lives per player.
export const STARTING_LIVES = 2

/** The card id a "disprove X" claim points at (null for "cannot disprove"). */
export function cardForClaim(
  claim: ResponseClaim,
  suspectId: string,
  weaponId: string,
  locationId: string,
): string | null {
  switch (claim) {
    case 'suspect':  return suspectId
    case 'weapon':   return weaponId
    case 'location': return locationId
    case 'cannot':   return null
  }
}

/** True when the given claim is honest for a hand and suggestion. */
export function claimIsTruthful(
  claim: ResponseClaim,
  hand: readonly string[],
  suspectId: string,
  weaponId: string,
  locationId: string,
): boolean {
  const has = (id: string) => hand.includes(id)
  switch (claim) {
    case 'suspect':  return has(suspectId)
    case 'weapon':   return has(weaponId)
    case 'location': return has(locationId)
    case 'cannot':   return !has(suspectId) && !has(weaponId) && !has(locationId)
  }
}

/**
 * The claim an honest player would give. Priority suspect > weapon > location;
 * falls back to "cannot" when the player holds none of the three cards. Used to
 * compute AI responses and to force truthful answers from zero-life players.
 */
export function truthfulClaimFor(
  hand: readonly string[],
  suspectId: string,
  weaponId: string,
  locationId: string,
): ResponseClaim {
  if (hand.includes(suspectId))  return 'suspect'
  if (hand.includes(weaponId))   return 'weapon'
  if (hand.includes(locationId)) return 'location'
  return 'cannot'
}

/** Hearts glyph string for a life total (max 2). ♥ = life, ♡ = lost. */
export function heartsFor(lives: number): string {
  const full = Math.max(0, Math.min(STARTING_LIVES, lives))
  return '♥'.repeat(full) + '♡'.repeat(STARTING_LIVES - full)
}
