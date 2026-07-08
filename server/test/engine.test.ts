// Engine unit tests — the authoritative rules, exercised headlessly with a
// seeded RNG so every run is deterministic.

import { describe, it, expect } from 'vitest'
import { GameEngine, type Rng } from '../../frontend/src/shared/engine'
import { ALL_CARD_IDS, SUSPECT_IDS, WEAPON_IDS, LOCATION_IDS, isSuspect, isWeapon, isLocation } from '../../frontend/src/shared/cards'
import { initializeBoard, getReachableCells } from '../../frontend/src/shared/board'
import { truthfulClaimFor } from '../../frontend/src/shared/bluffChallenge'

// Deterministic PRNG (mulberry32).
function seeded(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function newGame(players = 3, seed = 12345): GameEngine {
  const e = new GameEngine(seeded(seed))
  for (let i = 0; i < players; i++) e.addPlayer(`P${i + 1}`)
  e.startGame()
  return e
}

function handsOf(e: GameEngine): string[][] {
  return e.buildView(0).players.map((_p, i) => e.buildView(i).myHand)
}

function solutionOf(e: GameEngine): { suspect: string; weapon: string; location: string } {
  const dealt = new Set(handsOf(e).flat())
  const missing = ALL_CARD_IDS.filter(id => !dealt.has(id))
  return {
    suspect: missing.find(isSuspect)!,
    weapon: missing.find(isWeapon)!,
    location: missing.find(isLocation)!,
  }
}

describe('dealing', () => {
  it('deals 18 cards across players, excluding the 3 solution cards', () => {
    for (let n = 3; n <= 6; n++) {
      const e = newGame(n, 999 + n)
      const hands = handsOf(e)
      const total = hands.reduce((s, h) => s + h.length, 0)
      expect(total).toBe(18)
      const flat = hands.flat()
      expect(new Set(flat).size).toBe(18) // no duplicates
      const sol = solutionOf(e)
      expect(flat).not.toContain(sol.suspect)
      expect(flat).not.toContain(sol.weapon)
      expect(flat).not.toContain(sol.location)
      // Round-robin: hand sizes differ by at most 1.
      const sizes = hands.map(h => h.length)
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
    }
  })

  it('a solution card is one from each category', () => {
    const sol = solutionOf(newGame())
    expect(SUSPECT_IDS).toContain(sol.suspect)
    expect(WEAPON_IDS).toContain(sol.weapon)
    expect(LOCATION_IDS).toContain(sol.location)
  })
})

describe('movement validation', () => {
  it('accepts a reachable cell and rejects an unreachable one', () => {
    const e = newGame()
    e.pickSuspect(0, 'chef')
    e.roll(0)
    const view = e.buildView(0)
    const dice = view.dice!
    const token = view.suspects.find(s => s.id === 'chef')!
    const reachable = getReachableCells(initializeBoard(), token.position, dice)
    expect(reachable.length).toBeGreaterThan(0)

    // An unreachable cell throws.
    const reachSet = new Set(reachable.map(([c, r]) => `${c},${r}`))
    let far: [number, number] | null = null
    for (let c = 0; c < 24 && !far; c++) for (let r = 0; r < 25; r++) {
      if (!reachSet.has(`${c},${r}`)) { far = [c, r]; break }
    }
    expect(() => e.move(0, far![0], far![1])).toThrow()

    // A reachable cell succeeds.
    const [tc, tr] = reachable[0]
    e.move(0, tc, tr)
    expect(e.buildView(0).hasMovedThisTurn).toBe(true)
  })

  it('rejects acting out of turn', () => {
    const e = newGame()
    expect(() => e.pickSuspect(1, 'chef')).toThrow()
    expect(() => e.roll(1)).toThrow()
  })
})

describe('bluff & challenge', () => {
  // Set up an interrogation by seat 0 in the auditorium (location card 'auditorium').
  function interrogate(e: GameEngine, weaponId: string) {
    e.pickSuspect(0, 'chef')
    e._forceIntoRoomForTest('chef', 'auditorium')
    e.interrogate(0, weaponId)
  }

  it('honest disprove reveals the card only to the investigator', () => {
    const e = newGame()
    const hands = handsOf(e)
    // Find a weapon held by seat 1 so their truthful "weapon" claim can disprove.
    const heldWeapon = hands[1].find(isWeapon)
    if (!heldWeapon) return // skip rare deal where seat1 holds no weapon
    interrogate(e, heldWeapon)

    // Seat 1 truthfully claims weapon; others say cannot (truthfully or not).
    for (const seat of e.buildView(0).awaitingResponders) {
      const claim = seat === 1 ? 'weapon' : truthfulClaimFor(hands[seat], 'chef', heldWeapon, 'auditorium')
      e.respond(seat, claim)
    }
    // Investigator demands the card from seat 1.
    e.challenge(0, null, 1)

    const invView = e.buildView(0)
    const otherView = e.buildView(2)
    expect(invView.reveal?.revealedCardId).toBe(heldWeapon)
    expect(otherView.reveal?.revealedCardId).toBeNull()       // redacted
    expect(otherView.reveal?.revealedByName).toBe(invView.reveal?.revealedByName)
  })

  it('a caught bluff costs the bluffer a life', () => {
    const e = newGame()
    const hands = handsOf(e)
    // Seat 1 must NOT hold the weapon so a "weapon" claim is a lie.
    const weapon = WEAPON_IDS.find(w => !hands[1].includes(w))!
    interrogate(e, weapon)
    for (const seat of e.buildView(0).awaitingResponders) {
      e.respond(seat, seat === 1 ? 'weapon' : 'cannot')
    }
    const before = e.buildView(0).players[1].lives
    e.challenge(0, 1, null) // challenge seat 1's bluff
    const after = e.buildView(0).players[1].lives
    expect(after).toBe(before - 1)
    expect(e.buildView(0).reveal?.challenge?.wasBluff).toBe(true)
  })

  it('a wrong challenge costs the investigator a life', () => {
    const e = newGame()
    const hands = handsOf(e)
    const heldWeapon = hands[1].find(isWeapon)
    if (!heldWeapon) return
    interrogate(e, heldWeapon)
    for (const seat of e.buildView(0).awaitingResponders) {
      e.respond(seat, seat === 1 ? 'weapon' : 'cannot')
    }
    const before = e.buildView(0).players[0].lives
    e.challenge(0, 1, null) // challenge a truthful claim → investigator penalized
    expect(e.buildView(0).players[0].lives).toBe(before - 1)
    expect(e.buildView(0).reveal?.challenge?.wasBluff).toBe(false)
  })

  it('a zero-life player cannot bluff', () => {
    const e = newGame()
    const hands = handsOf(e)
    const weapon = WEAPON_IDS.find(w => !hands[1].includes(w))!
    // Drain seat 1 to zero lives via two caught bluffs across two of seat 0's turns.
    for (let round = 0; round < 2; round++) {
      interrogate(e, weapon)
      for (const seat of e.buildView(0).awaitingResponders) {
        e.respond(seat, seat === 1 ? 'weapon' : 'cannot')
      }
      e.challenge(0, 1, null)
      e.continueAfterReveal(0) // advance turn back around
      // fast-forward turns until it's seat 0 again
      while (e.buildView(0).currentTurnIndex !== 0) {
        const cur = e.buildView(0).currentTurnIndex
        e.endTurn(cur)
      }
    }
    expect(e.buildView(0).players[1].lives).toBe(0)

    interrogate(e, weapon)
    // Seat 1 now has 0 lives. Claiming the weapon (which they don't hold) is a lie
    // and is rejected; their genuinely truthful claim is accepted.
    expect(() => e.respond(1, 'weapon')).toThrow()
    const truth = truthfulClaimFor(hands[1], 'chef', weapon, 'auditorium')
    expect(() => e.respond(1, truth)).not.toThrow()
  })
})

describe('accusation & end conditions', () => {
  it('a correct accusation wins and ends the game', () => {
    const e = newGame()
    const sol = solutionOf(e)
    e.accuse(0, sol.suspect, sol.weapon, sol.location)
    expect(e.winnerIndex).toBe(0)
    expect(e.buildView(1).reveal?.correct).toBe(true)
    e.continueAfterReveal(0)
    expect(e.phase).toBe('game_over')
    // Solution is revealed to everyone only now.
    expect(e.buildView(2).caseFile).toEqual(sol)
  })

  it('a wrong accusation eliminates the player and skips their turn', () => {
    const e = newGame()
    const sol = solutionOf(e)
    const wrongWeapon = WEAPON_IDS.find(w => w !== sol.weapon)!
    e.accuse(0, sol.suspect, wrongWeapon, sol.location)
    expect(e.buildView(0).players[0].eliminated).toBe(true)
    expect(e.winnerIndex).toBeNull()
    e.continueAfterReveal(0)
    expect(e.phase).toBe('turn')
    expect(e.currentTurnIndex).toBe(1) // seat 0 skipped
  })

  it('ends with no winner when everyone is eliminated', () => {
    const e = newGame()
    const sol = solutionOf(e)
    const wrongWeapon = WEAPON_IDS.find(w => w !== sol.weapon)!
    // Every player accuses wrongly in turn.
    for (let round = 0; round < 3; round++) {
      const cur = e.buildView(0).currentTurnIndex
      e.accuse(cur, sol.suspect, wrongWeapon, sol.location)
      e.continueAfterReveal(cur)
    }
    expect(e.phase).toBe('game_over')
    expect(e.winnerIndex).toBeNull()
  })
})

describe('redaction', () => {
  it('a seat view never contains another hand or the solution mid-game', () => {
    const e = newGame()
    const hands = handsOf(e)
    const view = e.buildView(0)
    // Own hand present, solution hidden while playing.
    expect(view.myHand.length).toBe(hands[0].length)
    expect(view.caseFile).toBeNull()
    // No player object carries card ids.
    for (const p of view.players) {
      expect(p).not.toHaveProperty('hand')
    }
    // Serialized snapshot must not contain any other player's private cards.
    // Suspect ids double as board-token ids (all 6 always appear in `suspects`),
    // so only weapon/location cards are meaningful leak markers here.
    const otherCards = hands[1].concat(hands[2]).filter(id => !isSuspect(id) && !hands[0].includes(id))
    const json = JSON.stringify({ ...view, myHand: [] })
    for (const card of otherCards) {
      expect(json).not.toContain(`"${card}"`)
    }
  })
})
