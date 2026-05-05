import { SUSPECTS_CARDS, WEAPONS_CARDS, LOCATIONS_CARDS, ALL_CARDS } from '../types'
import type { ProbabilityData } from '../types'

function getCategory(cardId: string): keyof ProbabilityData | null {
  const card = ALL_CARDS.find(c => c.id === cardId)
  if (!card) return null
  return card.category === 'suspect' ? 'suspects'
       : card.category === 'weapon'  ? 'weapons'
       : 'locations'
}

function cloneNb(nb: ProbabilityData): ProbabilityData {
  return { suspects: { ...nb.suspects }, weapons: { ...nb.weapons }, locations: { ...nb.locations } }
}

function normalize(rec: Record<string, number>) {
  const total = Object.values(rec).reduce((s, v) => s + v, 0)
  if (total <= 0) return
  for (const k of Object.keys(rec)) rec[k] /= total
}

export function createProbabilityNotebook(myCardIds: string[] = []): ProbabilityData {
  const nb: ProbabilityData = {
    suspects:  Object.fromEntries(SUSPECTS_CARDS.map(c  => [c.id, 1 / SUSPECTS_CARDS.length])),
    weapons:   Object.fromEntries(WEAPONS_CARDS.map(c   => [c.id, 1 / WEAPONS_CARDS.length])),
    locations: Object.fromEntries(LOCATIONS_CARDS.map(c => [c.id, 1 / LOCATIONS_CARDS.length])),
  }
  // Cards in the player's own hand are definitely NOT in the case file
  for (const id of myCardIds) {
    const cat = getCategory(id)
    if (cat) { nb[cat][id] = 0; normalize(nb[cat]) }
  }
  return nb
}

// A revealed card is eliminated from the case file suspect pool
export function eliminateCard(nb: ProbabilityData, cardId: string): ProbabilityData {
  const cat = getCategory(cardId)
  if (!cat) return nb
  const out = cloneNb(nb)
  out[cat][cardId] = 0
  normalize(out[cat])
  return out
}

// Bayesian boost when no one disproves a suggestion (those cards are more likely in the case file)
export function updateNoReveal(
  nb: ProbabilityData,
  suspectId: string,
  weaponId: string,
  locationId: string,
  boost = 2.0,
): ProbabilityData {
  const out = cloneNb(nb)
  if ((out.suspects[suspectId]   ?? 0) > 0) out.suspects[suspectId]   *= boost
  if ((out.weapons[weaponId]     ?? 0) > 0) out.weapons[weaponId]     *= boost
  if ((out.locations[locationId] ?? 0) > 0) out.locations[locationId] *= boost
  normalize(out.suspects)
  normalize(out.weapons)
  normalize(out.locations)
  return out
}

export function mostLikely(nb: ProbabilityData): { suspect: string; weapon: string; location: string } {
  const top = (rec: Record<string, number>) =>
    Object.entries(rec).sort(([, a], [, b]) => b - a)[0]?.[0] ?? ''
  return { suspect: top(nb.suspects), weapon: top(nb.weapons), location: top(nb.locations) }
}

export function maxProb(rec: Record<string, number>): number {
  return Math.max(0, ...Object.values(rec))
}

export function isConfident(nb: ProbabilityData, threshold: number): boolean {
  return (
    maxProb(nb.suspects)  >= threshold &&
    maxProb(nb.weapons)   >= threshold &&
    maxProb(nb.locations) >= threshold
  )
}
