import { useRef, useEffect, useCallback } from 'react'
import type { BoardPlayer } from './useBoard'
import type {
  GameDeal, NotebookBoxState, PlayerSetup,
  PendingSuggestion, PlayerResponse, ResponseSummary, ChallengeSummary, RevealResult,
} from '../types'
import { ALL_CARDS } from '../types'
import { ROOM_DISPLAY_NAMES, ROOM_TO_LOCATION_CARD } from './useBoard'
import { eliminateCard, updateNoReveal } from '../lib/probabilityNotebook'
import { claimIsTruthful, cardForClaim } from '../lib/bluffChallenge'
import { generateStory } from '../lib/storyGenerator'
import type { SelectionFlowResult } from '../components/SelectionFlow'
import type { GameStateValues } from './useGameState'
import type { NotebooksValues } from './useNotebooks'

// Re-export so callers don't need to import SelectionFlowResult directly.
export type { SelectionFlowResult }

// Choice the investigator makes at the end of the challenge phase.
export interface ChallengeChoice {
  challengedIndex:   number | null  // player to challenge, or null to skip
  revealTargetIndex: number | null  // claimant to demand a card from, or null to auto-pick
}

function cardCategory(cardId: string): 'suspects' | 'weapons' | 'locations' | null {
  const card = ALL_CARDS.find(c => c.id === cardId)
  if (!card) return null
  return card.category === 'suspect' ? 'suspects'
       : card.category === 'weapon'  ? 'weapons'
       : 'locations'
}

export interface TurnActionsValues {
  advanceTurn: () => void
  finishMove: () => void
  handleAction: (id: string) => void
  handleInterrogationComplete: (result: SelectionFlowResult) => void
  handleResponsesComplete: (responses: PlayerResponse[]) => void
  handleChallengeResolve: (choice: ChallengeChoice) => void
  handleAccusationComplete: (result: SelectionFlowResult) => void
  handleStoryComplete: () => void
  handleRevealContinue: () => void
  handleSelectionCancel: () => void
  handleInterrogationRef:  React.MutableRefObject<(r: SelectionFlowResult) => void>
  handleAccusationRef:     React.MutableRefObject<(r: SelectionFlowResult) => void>
  handleStoryCompleteRef:  React.MutableRefObject<() => void>
  handleRevealContinueRef: React.MutableRefObject<() => void>
}

interface Params {
  gs: GameStateValues
  nb: NotebooksValues
  players: PlayerSetup[]
  boardSuspects: BoardPlayer[]
  deal: GameDeal
  exitRoom: (suspectId: string) => void
  onRestart: () => void
}

export function useTurnActions({
  gs, nb, players, boardSuspects, deal, exitRoom, onRestart,
}: Params): TurnActionsValues {
  const {
    setGamePhase, setDiceValue, setDiceRolling, setPathCells, setPassageCells,
    setMovePath, setMoveStep, setRevealResult, setRemainingMoves,
    remainingMovesRef, setCurrentTurnIndex, playerStatusRef,
    gamePhase, pendingReveal, pendingPhaseAfterStory,
    currentTurnIndex, setPlayerStatus, setGameWinner,
    setPendingReveal, setPendingPhaseAfterStory, setStoryText,
    setTurnCount,
    selectedSuspectId, setSelectedSuspectId, setHasMovedThisTurn,
    hasMovedThisTurn,
    pendingSuggestion, setPendingSuggestion, responses, setResponses,
  } = gs

  const movingToken = boardSuspects.find(s => s.id === selectedSuspectId)
  const {
    setProbNotebooks, setNotebooks, setShowCards, setShowNotebook,
  } = nb

  // ── finishMove ──────────────────────────────────────────────────────────────
  // Ends the movement portion of the turn without advancing. Returns to idle so
  // the current player may interrogate (if their token is now in a room) or end
  // the turn.
  const finishMove = useCallback(() => {
    setDiceValue(null)
    setDiceRolling(false)
    setPathCells([])
    setPassageCells([])
    setMovePath([])
    setMoveStep(0)
    setRemainingMoves(0)
    remainingMovesRef.current = 0
    setHasMovedThisTurn(true)
    setGamePhase('idle')
  }, [
    setDiceValue, setDiceRolling, setPathCells, setPassageCells,
    setMovePath, setMoveStep, setRemainingMoves, remainingMovesRef,
    setHasMovedThisTurn, setGamePhase,
  ])

  // ── advanceTurn ─────────────────────────────────────────────────────────────
  const advanceTurn = useCallback(() => {
    setDiceValue(null)
    setDiceRolling(false)
    setPathCells([])
    setPassageCells([])
    setMovePath([])
    setMoveStep(0)
    setRevealResult(null)
    setRemainingMoves(0)
    remainingMovesRef.current = 0
    setSelectedSuspectId(null)
    setHasMovedThisTurn(false)
    setPendingSuggestion(null)
    setResponses([])
    setCurrentTurnIndex(prev => {
      const n = players.length
      const status = playerStatusRef.current
      let next = (prev + 1) % n
      for (let i = 1; i < n; i++) {
        if (!status[next].eliminated) break
        next = (next + 1) % n
      }
      return next
    })
    setTurnCount(prev => prev + 1)
    setGamePhase('idle')
  }, [
    players.length,
    setDiceValue, setDiceRolling, setPathCells, setPassageCells,
    setMovePath, setMoveStep, setRevealResult, setRemainingMoves,
    remainingMovesRef, setCurrentTurnIndex, playerStatusRef, setGamePhase,
    setTurnCount, setSelectedSuspectId, setHasMovedThisTurn,
    setPendingSuggestion, setResponses,
  ])

  // ── handleAction (TurnOverlay) ───────────────────────────────────────────────
  const handleAction = useCallback((id: string) => {
    if (id === 'roll') {
      // Must have picked a suspect token and not already moved this turn.
      if (hasMovedThisTurn || !selectedSuspectId) return
      setGamePhase('rolling')
    } else if (id === 'interrogation') {
      // Only after moving, and only if the moved suspect is standing in a room.
      if (!hasMovedThisTurn || !movingToken?.currentLocation) return
      setGamePhase('interrogation')
    } else if (id === 'accusation') {
      if (playerStatusRef.current[currentTurnIndex]?.hasAccused) return
      if (playerStatusRef.current[currentTurnIndex]?.eliminated) return
      setGamePhase('accusation')
    } else if (id === 'endturn') {
      advanceTurn()
    } else if (id === 'cards') {
      setShowCards(true)
    } else if (id === 'notes') {
      setShowNotebook(true)
    }
  }, [
    hasMovedThisTurn, selectedSuspectId, movingToken, currentTurnIndex,
    playerStatusRef, setGamePhase, advanceTurn, setShowCards, setShowNotebook,
  ])

  // ── resolveSuggestion ────────────────────────────────────────────────────────
  // Shared resolution used by both the normal challenge flow and the no-responder
  // edge case. Applies life changes, resolves the card reveal against real hands,
  // updates notebooks soundly, and hands off to the story → reveal_result beats.
  const resolveSuggestion = useCallback((
    suggestion: PendingSuggestion,
    resp: PlayerResponse[],
    choice: ChallengeChoice,
  ) => {
    const { investigatorIndex, suspectId, weaponId, locationCardId, roomName } = suggestion
    const hands = deal.playerHands.map(h => h.map(c => c.id))
    const has = (idx: number, id: string) => (hands[idx] ?? []).includes(id)

    // ── Challenge resolution (adjusts lives only) ──
    const lifeDelta: Record<number, number> = {}
    let challengeSummary: ChallengeSummary
    if (choice.challengedIndex !== null) {
      const ci = choice.challengedIndex
      const claim = resp.find(r => r.playerIndex === ci)?.claim ?? 'cannot'
      const truthful = claimIsTruthful(claim, hands[ci] ?? [], suspectId, weaponId, locationCardId)
      const wasBluff = !truthful
      // Correct challenge → the bluffer loses a life. Wrong → the investigator does.
      const penalized = wasBluff ? ci : investigatorIndex
      lifeDelta[penalized] = (lifeDelta[penalized] ?? 0) - 1
      challengeSummary = {
        challengerName: players[investigatorIndex]?.name ?? 'INVESTIGATOR',
        challengedIndex: ci,
        challengedName: players[ci]?.name ?? null,
        wasBluff,
        penalizedName: players[penalized]?.name ?? null,
      }
    } else {
      challengeSummary = {
        challengerName: players[investigatorIndex]?.name ?? 'INVESTIGATOR',
        challengedIndex: null, challengedName: null, wasBluff: null, penalizedName: null,
      }
    }

    if (Object.keys(lifeDelta).length > 0) {
      setPlayerStatus(ps => ps.map((s, i) =>
        lifeDelta[i] ? { ...s, lives: Math.max(0, s.lives + lifeDelta[i]) } : s
      ))
    }

    // ── Card reveal (normal Cluedo deduction) ──
    const claimants = resp.filter(r => r.claim !== 'cannot')
    let revealedCardId: string | null = null
    let revealedByName: string | null = null
    let bluffedReveal = false
    let noOneCouldDisprove = false

    if (claimants.length > 0) {
      // Investigator demands a card from one claimant (auto-pick first if unset).
      let targetIdx = choice.revealTargetIndex
      if (targetIdx === null || !claimants.some(c => c.playerIndex === targetIdx)) {
        targetIdx = claimants[0].playerIndex
      }
      const targetClaim = resp.find(r => r.playerIndex === targetIdx)?.claim ?? 'cannot'
      const wantCard = cardForClaim(targetClaim, suspectId, weaponId, locationCardId)
      if (wantCard && has(targetIdx, wantCard)) {
        revealedCardId = wantCard
        revealedByName = players[targetIdx]?.name ?? null
      } else {
        // Claimed to disprove but held nothing — the investigator was bluffed.
        bluffedReveal = true
      }
    } else {
      // Everyone claimed "cannot". Only feed a genuine no-reveal (nobody actually
      // holds any suggested card) into notebooks; a hidden bluffer must not poison
      // deduction.
      const anyTrueHolder = resp.some(r =>
        has(r.playerIndex, suspectId) || has(r.playerIndex, weaponId) || has(r.playerIndex, locationCardId)
      )
      noOneCouldDisprove = !anyTrueHolder
    }

    // ── Notebook updates (sound: private eliminate / public genuine no-reveal) ──
    if (revealedCardId !== null) {
      const revealed = revealedCardId
      setProbNotebooks(prev => prev.map((nb, i) =>
        i === investigatorIndex ? eliminateCard(nb, revealed) : nb
      ))
    } else if (noOneCouldDisprove) {
      setProbNotebooks(prev => prev.map(nb =>
        updateNoReveal(nb, suspectId, weaponId, locationCardId)
      ))
    }

    // ── Build reveal result ──
    const responseSummaries: ResponseSummary[] = resp.map(r => ({
      playerIndex: r.playerIndex,
      playerName: players[r.playerIndex]?.name ?? `P${r.playerIndex + 1}`,
      playerIcon: players[r.playerIndex]?.icon ?? '?',
      playerColor: players[r.playerIndex]?.accentColor ?? '#cc8800',
      claim: r.claim,
    }))

    const rv: RevealResult = {
      type: 'interrogation',
      suspectId,
      weaponId,
      locationId: locationCardId,
      roomName,
      revealedCardId,
      revealedByName,
      investigatorName: players[investigatorIndex]?.name,
      responses: responseSummaries,
      challenge: challengeSummary,
      bluffedReveal,
      noOneCouldDisprove,
    }

    setPendingReveal(rv)
    setPendingPhaseAfterStory('reveal_result')
    setStoryText(generateStory(suspectId, weaponId, locationCardId))
    setGamePhase('story')
  }, [
    deal.playerHands, players, setPlayerStatus, setProbNotebooks,
    setPendingReveal, setPendingPhaseAfterStory, setStoryText, setGamePhase,
  ])

  // ── handleInterrogationComplete → opens the Response Phase ───────────────────
  const handleInterrogationComplete = useCallback((result: SelectionFlowResult) => {
    // The suspect + location are fixed by the token the player parked; only the
    // weapon is guessed. Fall back to the result values defensively.
    const roomId = movingToken?.currentLocation ?? null
    const suspectId = movingToken?.id ?? result.suspect
    const locationCardId = roomId ? (ROOM_TO_LOCATION_CARD[roomId] ?? roomId) : result.location
    const roomName = roomId
      ? (ROOM_DISPLAY_NAMES[roomId] ?? roomId).replace('\n', ' ')
      : undefined

    const suggestion: PendingSuggestion = {
      investigatorIndex: currentTurnIndex,
      suspectId,
      weaponId: result.weapon,
      locationCardId,
      roomName,
    }
    setPendingSuggestion(suggestion)
    setResponses([])

    // Responders = every non-eliminated player except the investigator.
    const status = playerStatusRef.current
    const hasResponders = players.some((_p, i) =>
      i !== currentTurnIndex && !status[i]?.eliminated
    )

    if (!hasResponders) {
      // No opponents left to respond — the suggestion stands unchallenged.
      resolveSuggestion(suggestion, [], { challengedIndex: null, revealTargetIndex: null })
      return
    }

    setGamePhase('response')
  }, [
    movingToken, players, currentTurnIndex, playerStatusRef,
    setPendingSuggestion, setResponses, setGamePhase, resolveSuggestion,
  ])

  // ── handleResponsesComplete → opens the Challenge Phase ──────────────────────
  const handleResponsesComplete = useCallback((resp: PlayerResponse[]) => {
    setResponses(resp)
    setGamePhase('challenge')
  }, [setResponses, setGamePhase])

  // ── handleChallengeResolve → resolves challenge + card reveal ────────────────
  const handleChallengeResolve = useCallback((choice: ChallengeChoice) => {
    if (!pendingSuggestion) return
    resolveSuggestion(pendingSuggestion, responses, choice)
  }, [pendingSuggestion, responses, resolveSuggestion])

  // ── handleAccusationComplete ─────────────────────────────────────────────────
  const handleAccusationComplete = useCallback((result: SelectionFlowResult) => {
    const p = players[currentTurnIndex]
    if (!p) return

    setPlayerStatus(ps => ps.map((s, i) =>
      i === currentTurnIndex ? { ...s, hasAccused: true } : s
    ))

    const cf = deal.caseFile
    const correct =
      result.suspect  === cf.suspect.id &&
      result.weapon   === cf.weapon.id  &&
      result.location === cf.location.id

    const rv = {
      type: 'accusation' as const,
      suspectId: result.suspect,
      weaponId: result.weapon,
      locationId: result.location,
      revealedCardId: null,
      revealedByName: null,
      correct,
      accusingPlayerName: p.name,
      accusingPlayerIcon: p.icon,
    }

    if (!correct) {
      setPlayerStatus(ps => ps.map((s, i) =>
        i === currentTurnIndex ? { ...s, eliminated: true } : s
      ))
      const eliminatedHand = deal.playerHands[currentTurnIndex] ?? []
      if (eliminatedHand.length > 0) {
        setProbNotebooks(prev => prev.map((nb, i) =>
          i === currentTurnIndex ? nb :
          eliminatedHand.reduce((acc, card) => eliminateCard(acc, card.id), nb)
        ))
        setNotebooks(prev => prev.map((nb, i) => {
          if (i === currentTurnIndex) return nb
          return eliminatedHand.reduce((acc, card) => {
            const cat = cardCategory(card.id)
            if (!cat) return acc
            return { ...acc, [cat]: { ...acc[cat], [card.id]: 'X' as NotebookBoxState } }
          }, nb)
        }))
      }
    } else {
      setGameWinner(currentTurnIndex)
    }

    setPendingReveal(rv)
    setPendingPhaseAfterStory(correct ? 'game_over' : 'reveal_result')
    setStoryText(generateStory(result.suspect, result.weapon, result.location))
    setGamePhase('story')
  }, [
    players, currentTurnIndex, deal.caseFile, deal.playerHands,
    setPlayerStatus, setGameWinner, setProbNotebooks, setNotebooks,
    setPendingReveal, setPendingPhaseAfterStory, setStoryText, setGamePhase,
  ])

  // ── handleStoryComplete ──────────────────────────────────────────────────────
  const handleStoryComplete = useCallback(() => {
    if (!pendingReveal) return
    if (pendingReveal.type === 'interrogation' && pendingReveal.revealedCardId !== null) {
      // Send the interrogated suspect token back out to the grid.
      if (movingToken && movingToken.currentLocation !== null) exitRoom(movingToken.id)
    }
    setRevealResult(pendingReveal)
    setGamePhase(pendingPhaseAfterStory)
  }, [pendingReveal, pendingPhaseAfterStory, movingToken, exitRoom, setRevealResult, setGamePhase])

  // ── handleRevealContinue ─────────────────────────────────────────────────────
  const handleRevealContinue = useCallback(() => {
    if (gamePhase === 'game_over') {
      onRestart()
      return
    }
    if (playerStatusRef.current.every(s => s.eliminated)) {
      setGamePhase('game_over')
      setGameWinner(null)
      return
    }
    advanceTurn()
  }, [gamePhase, onRestart, playerStatusRef, setGamePhase, setGameWinner, advanceTurn])

  // ── handleSelectionCancel ────────────────────────────────────────────────────
  const handleSelectionCancel = useCallback(() => setGamePhase('idle'), [setGamePhase])

  // ── Stable callback refs (for AI timeout closures) ───────────────────────────
  const handleInterrogationRef  = useRef<(r: SelectionFlowResult) => void>(() => {})
  const handleAccusationRef     = useRef<(r: SelectionFlowResult) => void>(() => {})
  const handleStoryCompleteRef  = useRef<() => void>(() => {})
  const handleRevealContinueRef = useRef<() => void>(() => {})

  useEffect(() => { handleInterrogationRef.current  = handleInterrogationComplete }, [handleInterrogationComplete])
  useEffect(() => { handleAccusationRef.current     = handleAccusationComplete },    [handleAccusationComplete])
  useEffect(() => { handleStoryCompleteRef.current  = handleStoryComplete },         [handleStoryComplete])
  useEffect(() => { handleRevealContinueRef.current = handleRevealContinue },        [handleRevealContinue])

  return {
    advanceTurn,
    finishMove,
    handleAction,
    handleInterrogationComplete,
    handleResponsesComplete,
    handleChallengeResolve,
    handleAccusationComplete,
    handleStoryComplete,
    handleRevealContinue,
    handleSelectionCancel,
    handleInterrogationRef,
    handleAccusationRef,
    handleStoryCompleteRef,
    handleRevealContinueRef,
  }
}
