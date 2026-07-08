// protocol.ts — Shared wire contracts between the client and the authoritative
// server. Plain TS types only (the server validates them at runtime with zod).

import type {
  PendingSuggestion, PlayerResponse, RevealResult, ResponseClaim,
} from './gameTypes'

// Authoritative server-side phases (a subset; the client maps these onto its
// richer animation phases in GamePhase).
export type EnginePhase = 'lobby' | 'turn' | 'response' | 'challenge' | 'reveal' | 'game_over'

export interface PublicPlayer {
  index:      number
  name:       string
  icon:       string
  color:      string
  lives:      number
  eliminated: boolean
  hasAccused: boolean
  handCount:  number
  connected:  boolean
}

export interface SuspectTokenView {
  id:              string
  position:        [number, number]
  currentLocation: string | null
}

// A per-viewer redacted snapshot of the game. Hidden info (other hands, the
// solution, the privately-revealed card) is stripped before it reaches a client.
export interface GameView {
  phase:              EnginePhase
  currentTurnIndex:   number
  turnCount:          number
  players:            PublicPlayer[]
  suspects:           SuspectTokenView[]
  dice:               number | null
  selectedSuspectId:  string | null
  hasMovedThisTurn:   boolean
  pendingSuggestion:  PendingSuggestion | null
  responses:          PlayerResponse[]      // public claims collected so far
  awaitingResponders: number[]              // indices still to respond
  reveal:             RevealResult | null   // redacted per viewer
  winnerIndex:        number | null
  caseFile:           { suspect: string; weapon: string; location: string } | null
  myIndex:            number                // viewer's seat, -1 for spectators
  myHand:             string[]              // viewer's own hand (card ids)
  seq:                number                // increments on every state change
}

// ── Client → server action payloads ─────────────────────────────────────────
export type GameAction =
  | { type: 'pickSuspect'; suspectId: string }
  | { type: 'roll' }
  | { type: 'move'; col: number; row: number }
  | { type: 'finishMove' }
  | { type: 'interrogate'; weaponId: string }
  | { type: 'respond'; claim: ResponseClaim }
  | { type: 'challenge'; challengedIndex: number | null; revealTargetIndex: number | null }
  | { type: 'accuse'; suspectId: string; weaponId: string; locationId: string }
  | { type: 'endTurn' }
  | { type: 'continue' }

export type ActionType = GameAction['type']

// ── Socket.IO event names ────────────────────────────────────────────────────
export const EV = {
  // client → server
  createRoom: 'createRoom',
  joinRoom:   'joinRoom',
  reconnect:  'reconnect',
  leaveRoom:  'leaveRoom',
  startGame:  'startGame',
  action:     'action',
  // server → client
  roomUpdate: 'roomUpdate',
  youAre:     'youAre',
  gameView:   'gameView',
  errorMsg:   'errorMsg',
} as const

export interface RoomPlayerInfo {
  index:     number
  name:      string
  connected: boolean
  isHost:    boolean
}

export interface RoomUpdate {
  code:     string
  players:  RoomPlayerInfo[]
  hostIndex: number
  started:  boolean
  minPlayers: number
  maxPlayers: number
}

export interface YouAre {
  code:        string
  playerIndex: number
  token:       string
}
