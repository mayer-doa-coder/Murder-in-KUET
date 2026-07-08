// engine.ts — The headless, authoritative game engine for Murder in KUET.
//
// This is the SINGLE SOURCE OF TRUTH for the online rules. It is pure TypeScript
// with NO React and NO DOM: it holds the full secret state (solution + every
// player's hand) and exposes per-seat *redacted* views so a client can never see
// hidden information. The logic here is ported verbatim in spirit from the local
// React hooks (useTurnActions, useMovement, CardShuffleScreen) so the online and
// offline games play by identical rules — one codebase, no drift.

import {
  SUSPECT_IDS, WEAPON_IDS, LOCATION_IDS, ALL_CARD_IDS,
} from './cards'
import {
  initializeBoard, getReachableCells, getPassageDoors, doorRoomAt,
  ROOM_TO_LOCATION_CARD, ROOM_DISPLAY_NAMES, CHAR_STARTS,
  type Cell,
} from './board'
import {
  STARTING_LIVES, claimIsTruthful, cardForClaim, truthfulClaimFor,
} from './bluffChallenge'
import type {
  ResponseClaim, PendingSuggestion, PlayerResponse,
  ResponseSummary, ChallengeSummary, RevealResult,
} from './gameTypes'
import type { EnginePhase, GameView, PublicPlayer, SuspectTokenView } from './protocol'

export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 6
const TOTAL_DEAL_CARDS = 18

// Per-seat visual identity, assigned by join order. Mirrors PLAYER_IDENTITIES in
// the frontend's types.ts so the online HUD looks like the local one.
const SEAT_ICONS  = ['①', '②', '③', '④', '⑤', '⑥']
const SEAT_COLORS = ['#4477ff', '#33aa33', '#cc2200', '#cc8800', '#cc00cc', '#00cccc']

interface EnginePlayer {
  name:       string
  icon:       string
  color:      string
  hand:       string[]   // PRIVATE — card ids
  lives:      number
  eliminated: boolean
  hasAccused: boolean
  connected:  boolean
}

interface SuspectToken {
  id:              string
  position:        [number, number]
  currentLocation: string | null
}

export type Rng = () => number

/** A recoverable rules violation. The server maps these to `errorMsg` events. */
export class EngineError extends Error {}

export class GameEngine {
  private players: EnginePlayer[] = []
  private solution: { suspect: string; weapon: string; location: string } | null = null
  private suspects: SuspectToken[] = []
  private board: Cell[][] = initializeBoard()

  phase: EnginePhase = 'lobby'
  currentTurnIndex = 0
  turnCount = 0
  winnerIndex: number | null = null
  seq = 0

  // ── Per-turn scratch state ──────────────────────────────────────────────────
  private selectedSuspectId: string | null = null
  private dice: number | null = null
  private hasMoved = false

  // ── Bluff & Challenge pipeline ──────────────────────────────────────────────
  private pendingSuggestion: PendingSuggestion | null = null
  private responses: PlayerResponse[] = []
  private awaitingResponders: number[] = []

  // ── Reveal beat ─────────────────────────────────────────────────────────────
  private reveal: RevealResult | null = null
  private revealInvestigatorIndex: number | null = null

  private readonly rng: Rng

  constructor(rng: Rng = Math.random) {
    this.rng = rng
    this.resetTokens()
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Lobby
  // ════════════════════════════════════════════════════════════════════════════

  get playerCount(): number { return this.players.length }
  get started(): boolean { return this.phase !== 'lobby' }

  playerName(seat: number): string { return this.players[seat]?.name ?? `P${seat + 1}` }

  addPlayer(name: string): number {
    if (this.started) throw new EngineError('Game already started')
    if (this.players.length >= MAX_PLAYERS) throw new EngineError('Room is full')
    const trimmed = name.trim().slice(0, 16) || `Player ${this.players.length + 1}`
    if (this.players.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new EngineError('Name already taken')
    }
    const seat = this.players.length
    this.players.push({
      name: trimmed,
      icon: SEAT_ICONS[seat] ?? '●',
      color: SEAT_COLORS[seat] ?? '#cccccc',
      hand: [], lives: STARTING_LIVES, eliminated: false, hasAccused: false, connected: true,
    })
    this.bump()
    return seat
  }

  setConnected(seat: number, connected: boolean): void {
    const p = this.players[seat]
    if (!p) return
    p.connected = connected
    this.bump()
  }

  /** Remove a not-yet-started player (lobby only). Returns true if removed. */
  removePlayer(seat: number): boolean {
    if (this.started) return false
    if (seat < 0 || seat >= this.players.length) return false
    this.players.splice(seat, 1)
    // Re-assign seat visuals so they stay contiguous.
    this.players.forEach((p, i) => { p.icon = SEAT_ICONS[i] ?? '●'; p.color = SEAT_COLORS[i] ?? '#cccccc' })
    this.bump()
    return true
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Game start + dealing
  // ════════════════════════════════════════════════════════════════════════════

  startGame(): void {
    if (this.started) throw new EngineError('Game already started')
    if (this.players.length < MIN_PLAYERS) throw new EngineError(`Need at least ${MIN_PLAYERS} players`)

    // Pick the solution — one random card from each category.
    const suspect  = this.pick(SUSPECT_IDS as readonly string[])
    const weapon   = this.pick(WEAPON_IDS as readonly string[])
    const location = this.pick(LOCATION_IDS as readonly string[])
    this.solution = { suspect, weapon, location }

    // Deal the remaining 18 cards round-robin (tolerates uneven hands 3–6 players).
    const crime = new Set([suspect, weapon, location])
    const deck = this.shuffle(ALL_CARD_IDS.filter(id => !crime.has(id)))
    this.players.forEach(p => { p.hand = [] })
    deck.forEach((card, i) => { this.players[i % this.players.length].hand.push(card) })

    this.resetTokens()
    this.currentTurnIndex = 0
    this.turnCount = 0
    this.winnerIndex = null
    this.clearTurnScratch()
    this.phase = 'turn'
    this.bump()
  }

  private resetTokens(): void {
    this.suspects = (SUSPECT_IDS as readonly string[]).map(id => ({
      id,
      position: (CHAR_STARTS[id] ?? [12, 12]) as [number, number],
      currentLocation: null,
    }))
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Turn actions
  // ════════════════════════════════════════════════════════════════════════════

  pickSuspect(seat: number, suspectId: string): void {
    this.requireTurn(seat)
    if (this.dice !== null || this.hasMoved) throw new EngineError('Cannot change suspect after rolling')
    if (!this.suspects.some(s => s.id === suspectId)) throw new EngineError('Unknown suspect')
    this.selectedSuspectId = suspectId
    this.bump()
  }

  roll(seat: number): number {
    this.requireTurn(seat)
    if (!this.selectedSuspectId) throw new EngineError('Pick a suspect token first')
    if (this.hasMoved) throw new EngineError('Already moved this turn')
    if (this.dice !== null) throw new EngineError('Already rolled')
    this.dice = 1 + Math.floor(this.rng() * 6)
    this.bump()
    return this.dice
  }

  move(seat: number, col: number, row: number): void {
    this.requireTurn(seat)
    if (this.dice === null) throw new EngineError('Roll first')
    if (this.hasMoved) throw new EngineError('Already moved this turn')
    const token = this.suspects.find(s => s.id === this.selectedSuspectId)
    if (!token) throw new EngineError('No suspect selected')

    const target: [number, number] = [col, row]
    const passageDoors = token.currentLocation ? getPassageDoors(token.currentLocation) : []
    const isPassage = passageDoors.some(([pc, pr]) => pc === col && pr === row)

    if (isPassage) {
      const destRoom = doorRoomAt(col, row)
      if (!destRoom) throw new EngineError('Invalid passage target')
      token.position = target
      token.currentLocation = destRoom
    } else {
      const reachable = getReachableCells(this.board, token.position, this.dice)
      if (!reachable.some(([rc, rr]) => rc === col && rr === row)) {
        throw new EngineError('Cell not reachable')
      }
      token.position = target
      // Landing on a door cell enters that room; anywhere else stays on the grid.
      token.currentLocation = doorRoomAt(col, row)
    }

    this.hasMoved = true
    this.dice = null
    this.bump()
  }

  /** Ends movement without advancing (player chooses to stop and interrogate/end). */
  finishMove(seat: number): void {
    this.requireTurn(seat)
    if (this.dice === null && !this.hasMoved) throw new EngineError('Nothing to finish')
    this.hasMoved = true
    this.dice = null
    this.bump()
  }

  interrogate(seat: number, weaponId: string): void {
    this.requireTurn(seat)
    if (!this.hasMoved) throw new EngineError('Move into a room before interrogating')
    const token = this.suspects.find(s => s.id === this.selectedSuspectId)
    if (!token?.currentLocation) throw new EngineError('Suspect is not in a room')
    if (!(WEAPON_IDS as readonly string[]).includes(weaponId)) throw new EngineError('Unknown weapon')

    const roomId = token.currentLocation
    const suggestion: PendingSuggestion = {
      investigatorIndex: seat,
      suspectId: token.id,
      weaponId,
      locationCardId: ROOM_TO_LOCATION_CARD[roomId] ?? roomId,
      roomName: (ROOM_DISPLAY_NAMES[roomId] ?? roomId).replace('\n', ' '),
    }
    this.pendingSuggestion = suggestion
    this.responses = []

    // Responders = every non-eliminated player except the investigator.
    this.awaitingResponders = this.players
      .map((_p, i) => i)
      .filter(i => i !== seat && !this.players[i].eliminated)

    if (this.awaitingResponders.length === 0) {
      // Unchallenged — resolve immediately.
      this.resolveSuggestion(suggestion, [], { challengedIndex: null, revealTargetIndex: null })
      return
    }
    this.phase = 'response'
    this.bump()
  }

  respond(seat: number, claim: ResponseClaim): void {
    if (this.phase !== 'response') throw new EngineError('Not accepting responses')
    if (!this.awaitingResponders.includes(seat)) throw new EngineError('Not your response to give')
    const p = this.players[seat]
    const s = this.pendingSuggestion!
    // Zero-life players cannot bluff — the server enforces truth.
    if (p.lives <= 0 && !claimIsTruthful(claim, p.hand, s.suspectId, s.weaponId, s.locationCardId)) {
      throw new EngineError('You have no lives left and must answer truthfully')
    }
    this.responses.push({ playerIndex: seat, claim })
    this.awaitingResponders = this.awaitingResponders.filter(i => i !== seat)
    if (this.awaitingResponders.length === 0) {
      this.phase = 'challenge'
    }
    this.bump()
  }

  challenge(seat: number, challengedIndex: number | null, revealTargetIndex: number | null): void {
    if (this.phase !== 'challenge') throw new EngineError('Not in challenge phase')
    if (!this.pendingSuggestion) throw new EngineError('No suggestion pending')
    if (seat !== this.pendingSuggestion.investigatorIndex) throw new EngineError('Only the investigator may challenge')
    this.resolveSuggestion(this.pendingSuggestion, this.responses, { challengedIndex, revealTargetIndex })
  }

  // Ported from useTurnActions.resolveSuggestion — the authoritative bluff/reveal.
  private resolveSuggestion(
    suggestion: PendingSuggestion,
    resp: PlayerResponse[],
    choice: { challengedIndex: number | null; revealTargetIndex: number | null },
  ): void {
    const { investigatorIndex, suspectId, weaponId, locationCardId, roomName } = suggestion
    const has = (idx: number, id: string) => (this.players[idx]?.hand ?? []).includes(id)

    // ── Challenge resolution (adjusts lives only) ──
    const lifeDelta: Record<number, number> = {}
    let challengeSummary: ChallengeSummary
    if (choice.challengedIndex !== null) {
      const ci = choice.challengedIndex
      const claim = resp.find(r => r.playerIndex === ci)?.claim ?? 'cannot'
      const truthful = claimIsTruthful(claim, this.players[ci]?.hand ?? [], suspectId, weaponId, locationCardId)
      const wasBluff = !truthful
      const penalized = wasBluff ? ci : investigatorIndex
      lifeDelta[penalized] = (lifeDelta[penalized] ?? 0) - 1
      challengeSummary = {
        challengerName: this.playerName(investigatorIndex),
        challengedIndex: ci,
        challengedName: this.playerName(ci),
        wasBluff,
        penalizedName: this.playerName(penalized),
      }
    } else {
      challengeSummary = {
        challengerName: this.playerName(investigatorIndex),
        challengedIndex: null, challengedName: null, wasBluff: null, penalizedName: null,
      }
    }
    for (const [idx, delta] of Object.entries(lifeDelta)) {
      const p = this.players[Number(idx)]
      if (p) p.lives = Math.max(0, p.lives + delta)
    }

    // ── Card reveal (normal Cluedo deduction) ──
    const claimants = resp.filter(r => r.claim !== 'cannot')
    let revealedCardId: string | null = null
    let revealedByName: string | null = null
    let bluffedReveal = false
    let noOneCouldDisprove = false

    if (claimants.length > 0) {
      let targetIdx = choice.revealTargetIndex
      if (targetIdx === null || !claimants.some(c => c.playerIndex === targetIdx)) {
        targetIdx = claimants[0].playerIndex
      }
      const targetClaim = resp.find(r => r.playerIndex === targetIdx)?.claim ?? 'cannot'
      const wantCard = cardForClaim(targetClaim, suspectId, weaponId, locationCardId)
      if (wantCard && has(targetIdx, wantCard)) {
        revealedCardId = wantCard
        revealedByName = this.playerName(targetIdx)
      } else {
        bluffedReveal = true
      }
    } else {
      const anyTrueHolder = resp.some(r =>
        has(r.playerIndex, suspectId) || has(r.playerIndex, weaponId) || has(r.playerIndex, locationCardId)
      )
      noOneCouldDisprove = !anyTrueHolder
    }

    const responseSummaries: ResponseSummary[] = resp.map(r => ({
      playerIndex: r.playerIndex,
      playerName: this.playerName(r.playerIndex),
      playerIcon: this.players[r.playerIndex]?.icon ?? '?',
      playerColor: this.players[r.playerIndex]?.color ?? '#cc8800',
      claim: r.claim,
    }))

    this.reveal = {
      type: 'interrogation',
      suspectId, weaponId, locationId: locationCardId, roomName,
      revealedCardId, revealedByName,
      investigatorName: this.playerName(investigatorIndex),
      responses: responseSummaries,
      challenge: challengeSummary,
      bluffedReveal, noOneCouldDisprove,
    }
    this.revealInvestigatorIndex = investigatorIndex
    this.phase = 'reveal'
    this.bump()
  }

  accuse(seat: number, suspectId: string, weaponId: string, locationId: string): void {
    this.requireTurn(seat)
    const p = this.players[seat]
    if (p.hasAccused) throw new EngineError('You have already accused')
    if (!this.solution) throw new EngineError('No solution')

    p.hasAccused = true
    const correct =
      suspectId === this.solution.suspect &&
      weaponId === this.solution.weapon &&
      locationId === this.solution.location

    if (correct) {
      this.winnerIndex = seat
    } else {
      p.eliminated = true
    }

    this.reveal = {
      type: 'accusation',
      suspectId, weaponId, locationId,
      revealedCardId: null, revealedByName: null,
      correct,
      accusingPlayerName: p.name,
      accusingPlayerIcon: p.icon,
    }
    this.revealInvestigatorIndex = null
    this.phase = 'reveal'
    this.bump()
  }

  /** The current player dismisses the reveal overlay, advancing the game. */
  continueAfterReveal(seat: number): void {
    if (this.phase !== 'reveal') throw new EngineError('No reveal to dismiss')
    // The current player dismisses their own reveal even if it just eliminated
    // them (a wrong accusation), so the turn can advance past them.
    if (seat !== this.currentTurnIndex) throw new EngineError('Not your turn')

    // Correct accusation ends the game for everyone.
    if (this.winnerIndex !== null) {
      this.phase = 'game_over'
      this.clearTurnScratch()
      this.bump()
      return
    }

    // A revealed interrogation sends the interrogated token back out to the grid.
    if (this.reveal?.type === 'interrogation' && this.reveal.revealedCardId !== null) {
      const token = this.suspects.find(s => s.id === this.selectedSuspectId)
      if (token && token.currentLocation !== null) token.currentLocation = null
    }

    if (this.players.every(pl => pl.eliminated)) {
      this.phase = 'game_over'
      this.winnerIndex = null
      this.clearTurnScratch()
      this.bump()
      return
    }
    this.advanceTurn()
  }

  endTurn(seat: number): void {
    this.requireTurn(seat)
    this.advanceTurn()
  }

  private advanceTurn(): void {
    this.clearTurnScratch()
    const n = this.players.length
    let next = (this.currentTurnIndex + 1) % n
    for (let i = 1; i < n; i++) {
      if (!this.players[next].eliminated) break
      next = (next + 1) % n
    }
    this.currentTurnIndex = next
    this.turnCount += 1
    this.phase = 'turn'
    this.bump()
  }

  private clearTurnScratch(): void {
    this.selectedSuspectId = null
    this.dice = null
    this.hasMoved = false
    this.pendingSuggestion = null
    this.responses = []
    this.awaitingResponders = []
    this.reveal = null
    this.revealInvestigatorIndex = null
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Redaction — per-seat views
  // ════════════════════════════════════════════════════════════════════════════

  buildView(seat: number): GameView {
    const publicPlayers: PublicPlayer[] = this.players.map((p, i) => ({
      index: i,
      name: p.name,
      icon: p.icon,
      color: p.color,
      lives: p.lives,
      eliminated: p.eliminated,
      hasAccused: p.hasAccused,
      handCount: p.hand.length,
      connected: p.connected,
    }))

    const suspects: SuspectTokenView[] = this.suspects.map(s => ({
      id: s.id,
      position: s.position,
      currentLocation: s.currentLocation,
    }))

    // Redact the privately-revealed card: only the investigator learns which card
    // was shown. Everyone else sees that *a* card was revealed, not which one.
    let reveal = this.reveal
    if (reveal && reveal.revealedCardId !== null && seat !== this.revealInvestigatorIndex) {
      reveal = { ...reveal, revealedCardId: null }
    }

    return {
      phase: this.phase,
      currentTurnIndex: this.currentTurnIndex,
      turnCount: this.turnCount,
      players: publicPlayers,
      suspects,
      dice: this.dice,
      selectedSuspectId: this.selectedSuspectId,
      hasMovedThisTurn: this.hasMoved,
      pendingSuggestion: this.pendingSuggestion,
      responses: this.responses,
      awaitingResponders: this.awaitingResponders,
      reveal,
      winnerIndex: this.winnerIndex,
      // The solution is only ever exposed once the game is over.
      caseFile: this.phase === 'game_over' && this.solution
        ? { suspect: this.solution.suspect, weapon: this.solution.weapon, location: this.solution.location }
        : null,
      myIndex: seat,
      myHand: this.players[seat]?.hand ? [...this.players[seat].hand] : [],
      seq: this.seq,
    }
  }

  // ── Internal guards ─────────────────────────────────────────────────────────

  private requireCurrent(seat: number): void {
    if (seat !== this.currentTurnIndex) throw new EngineError('Not your turn')
    if (this.players[seat]?.eliminated) throw new EngineError('You are eliminated')
  }

  private requireTurn(seat: number): void {
    if (this.phase !== 'turn') throw new EngineError('Not in the action phase')
    this.requireCurrent(seat)
  }

  private bump(): void { this.seq += 1 }

  // TEST SEAM (not used by the server): forces the current player's selected
  // token into a room so the interrogation → bluff → challenge pipeline can be
  // exercised without driving full dice movement across the board.
  _forceIntoRoomForTest(suspectId: string, roomId: string): void {
    this.selectedSuspectId = suspectId
    const t = this.suspects.find(s => s.id === suspectId)
    if (t) t.currentLocation = roomId
    this.dice = null
    this.hasMoved = true
  }

  private pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.rng() * arr.length)]
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
}

// Re-export helpers the AI/analysis layers might want later.
export { truthfulClaimFor, TOTAL_DEAL_CARDS }
