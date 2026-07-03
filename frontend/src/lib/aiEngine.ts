import type { Cell, AIAlgorithm, ProbabilityData } from '../types'
import { SUSPECTS_CARDS, WEAPONS_CARDS } from '../types'
import { mostLikely, isConfident } from './probabilityNotebook'

// Accusation confidence thresholds per algorithm
const THRESHOLDS: Record<AIAlgorithm, number> = {
  random:         0.95,
  rule_based:     0.85,
  minimax:        0.80,
  expectiminimax: 0.78,
  negamax:        0.80,
  monte_carlo:    0.75,
  mcts:           0.72,
}

// Delay (ms) before AI acts in idle phase at 1× speed
export const AI_IDLE_DELAY: Record<AIAlgorithm, number> = {
  random:         700,
  rule_based:     900,
  minimax:        1400,
  expectiminimax: 1300,
  negamax:        1200,
  monte_carlo:    800,
  mcts:           800,
}

// Pick a target cell for AI movement
export function aiChooseCell(
  reachableCells: [number, number][],
  board: Cell[][],
  notebook: ProbabilityData,
  algorithm: AIAlgorithm,
  roomToLocationCard: Record<string, string>,
): [number, number] | null {
  if (reachableCells.length === 0) return null

  const rand = () => reachableCells[Math.floor(Math.random() * reachableCells.length)]

  if (algorithm === 'random') return rand()

  // monte_carlo: 30% random exploration
  if (algorithm === 'monte_carlo' && Math.random() < 0.3) return rand()

  // Strategic: prefer door cells leading toward the most-likely crime location
  const doorCells = reachableCells.filter(([c, r]) => board[r]?.[c]?.type === 'door')
  if (doorCells.length > 0) {
    const { location: bestLoc } = mostLikely(notebook)
    const ideal = doorCells.find(([c, r]) => {
      const roomId = board[r]?.[c]?.roomId
      return roomId && roomToLocationCard[roomId] === bestLoc
    })
    return ideal ?? doorCells[Math.floor(Math.random() * doorCells.length)]
  }

  return rand()
}

// Pick which of the 6 suspect tokens the AI should move on its turn.
// Strategic algorithms steer the suspect they currently deem most likely toward
// a room to interrogate; random / exploration picks any suspect.
export function aiChooseSuspect(
  notebook: ProbabilityData,
  algorithm: AIAlgorithm,
): string {
  const suspectIds = SUSPECTS_CARDS.map(c => c.id)
  const randSuspect = () => suspectIds[Math.floor(Math.random() * suspectIds.length)]

  if (algorithm === 'random') return randSuspect()
  if (algorithm === 'monte_carlo' && Math.random() < 0.3) return randSuspect()

  const { suspect } = mostLikely(notebook)
  return suspect || randSuspect()
}

// Pick suspect + weapon to suggest in an interrogation
export function aiMakeSuggestion(
  notebook: ProbabilityData,
  algorithm: AIAlgorithm,
): { suspect: string; weapon: string } {
  const randSuspects = Object.keys(notebook.suspects).filter(id => notebook.suspects[id] > 0)
  const randWeapons  = Object.keys(notebook.weapons).filter(id => notebook.weapons[id] > 0)
  const randResult = {
    suspect: randSuspects[Math.floor(Math.random() * randSuspects.length)] ?? SUSPECTS_CARDS[0].id,
    weapon:  randWeapons[Math.floor(Math.random() * randWeapons.length)]   ?? WEAPONS_CARDS[0].id,
  }

  if (algorithm === 'random') return randResult

  // monte_carlo: 30% random to gather novel information
  if (algorithm === 'monte_carlo' && Math.random() < 0.3) return randResult

  const { suspect, weapon } = mostLikely(notebook)
  return { suspect, weapon }
}

// Decide whether to accuse (and what to accuse)
export function aiDecideAccusation(
  notebook: ProbabilityData,
  algorithm: AIAlgorithm,
  hasAccused: boolean,
): false | { suspect: string; weapon: string; location: string } {
  if (hasAccused) return false
  if (!isConfident(notebook, THRESHOLDS[algorithm])) return false
  const best = mostLikely(notebook)
  if (!best.suspect || !best.weapon || !best.location) return false
  return best
}
