// cards.ts — Canonical card identity (IDs + categories) shared by client and
// server. Visual metadata (icons, images, colors) lives in the frontend's
// types.ts, keyed by these same IDs. This file is pure data — no assets.

import type { CardCategory } from './gameTypes'

export const SUSPECT_IDS = [
  'chef', 'hallboy', 'security_guard', 'shopkeeper', 'student_girl', 'student_boy',
] as const

export const WEAPON_IDS = [
  'knife', 'sleeping_pills', 'revolver', 'laptop_charger', 'anti_cutter', 'rope',
] as const

export const LOCATION_IDS = [
  'auditorium', 'student_welfare', 'amar_ekushey', 'cafeteria', 'central_field',
  'it_park', 'begum_rokeya', 'lotus_pond', 'pocket_gate',
] as const

export const ALL_CARD_IDS: string[] = [...SUSPECT_IDS, ...WEAPON_IDS, ...LOCATION_IDS]

const SUSPECT_SET = new Set<string>(SUSPECT_IDS)
const WEAPON_SET = new Set<string>(WEAPON_IDS)
const LOCATION_SET = new Set<string>(LOCATION_IDS)

/** Category of a card id, or null if the id is unknown. */
export function categoryOf(cardId: string): CardCategory | null {
  if (SUSPECT_SET.has(cardId)) return 'suspect'
  if (WEAPON_SET.has(cardId)) return 'weapon'
  if (LOCATION_SET.has(cardId)) return 'location'
  return null
}

export function isSuspect(id: string): boolean { return SUSPECT_SET.has(id) }
export function isWeapon(id: string): boolean { return WEAPON_SET.has(id) }
export function isLocation(id: string): boolean { return LOCATION_SET.has(id) }
