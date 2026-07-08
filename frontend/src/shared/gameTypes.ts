// gameTypes.ts — Pure, framework-free game types shared by the client and the
// authoritative server. NO React, NO DOM, NO image-asset imports may appear in
// this file or anything it imports, so the server can bundle it cleanly.

export type CardCategory = 'suspect' | 'weapon' | 'location'

// Client-side animation-aware phase (the online client derives these from the
// authoritative engine phase; see shared/engine.ts EnginePhase for the
// server-authoritative set).
export type GamePhase =
  | 'idle' | 'rolling' | 'dice' | 'moving' | 'interrogation' | 'response'
  | 'challenge' | 'accusation' | 'story' | 'reveal_result' | 'game_over'

export interface PlayerStatus {
  eliminated: boolean
  hasAccused: boolean
  lives:      number   // Bluff & Challenge lives (2 = ♥♥). 0 = can no longer bluff.
}

// A player's public claim about whether they can disprove a suggestion.
export type ResponseClaim = 'suspect' | 'weapon' | 'location' | 'cannot'

// The in-flight suggestion whose response/challenge phases are being resolved.
export interface PendingSuggestion {
  investigatorIndex: number
  suspectId:         string
  weaponId:          string
  locationCardId:    string
  roomName?:         string
}

// A single responder's collected claim during the Response Phase.
export interface PlayerResponse {
  playerIndex: number
  claim:       ResponseClaim
}

// Public summary of one responder's claim, for the result overlay.
export interface ResponseSummary {
  playerIndex: number
  playerName:  string
  playerIcon:  string
  playerColor: string
  claim:       ResponseClaim
}

// Public outcome of the challenge phase, for the result overlay.
export interface ChallengeSummary {
  challengerName:  string
  challengedIndex: number | null   // null = investigator chose not to challenge
  challengedName:  string | null
  wasBluff:        boolean | null  // null when no challenge was made
  penalizedName:   string | null   // who lost a life (null when skipped)
}

export interface RevealResult {
  type:               'interrogation' | 'accusation'
  suspectId:          string
  weaponId:           string
  locationId:         string  // location card id (mapped from room id for interrogation)
  roomName?:          string  // human-readable room name (interrogation only)
  revealedCardId:     string | null   // PRIVATE to the investigator; redacted for others
  revealedByName:     string | null
  correct?:           boolean       // accusation only
  accusingPlayerName?: string
  accusingPlayerIcon?: string
  // Bluff & Challenge extras (interrogation only)
  investigatorName?:  string
  responses?:         ResponseSummary[]
  challenge?:         ChallengeSummary
  bluffedReveal?:     boolean       // demanded a card from a claimant who had none
  noOneCouldDisprove?: boolean      // genuine no-reveal (all truthfully "cannot")
}

// The investigator's decision at the end of the challenge phase.
export interface ChallengeChoice {
  challengedIndex:   number | null  // player to challenge, or null to skip
  revealTargetIndex: number | null  // claimant to demand a card from, or null to auto-pick
}
