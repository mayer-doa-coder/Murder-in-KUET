import { useRef, useEffect } from 'react'
import type { BoardPlayer } from './useBoard'
import { ROOM_TO_LOCATION_CARD } from './useBoard'
import type { PlayerSetup } from '../types'
import { aiDecideAccusation, aiMakeSuggestion, aiChooseSuspect, AI_IDLE_DELAY } from '../lib/aiEngine'
import type { GameStateValues } from './useGameState'
import type { NotebooksValues } from './useNotebooks'
import type { TurnActionsValues } from './useTurnActions'

interface Params {
  gs: GameStateValues
  nb: NotebooksValues
  boardSuspects: BoardPlayer[]
  actions: TurnActionsValues
  currentSetup: PlayerSetup | undefined
  isAiTurn: boolean
}

export function useAITurn({ gs, nb, boardSuspects, actions, currentSetup, isAiTurn }: Params): void {
  const {
    gamePhase, setGamePhase, setDiceValue, setDiceRolling,
    currentTurnIndex, isPaused, ms,
    playerStatusRef, hasMovedThisTurn, selectedSuspectId, setSelectedSuspectId,
  } = gs
  const { probNotebooksRef } = nb
  const {
    handleInterrogationRef, handleAccusationRef,
    handleStoryCompleteRef, handleRevealContinueRef,
  } = actions

  // Refs so AI timeouts read the latest values without restarting timers.
  const boardSuspectsRef = useRef(boardSuspects)
  useEffect(() => { boardSuspectsRef.current = boardSuspects }, [boardSuspects])
  const selectedSuspectIdRef = useRef(selectedSuspectId)
  useEffect(() => { selectedSuspectIdRef.current = selectedSuspectId }, [selectedSuspectId])
  const advanceTurnRef = useRef(actions.advanceTurn)
  useEffect(() => { advanceTurnRef.current = actions.advanceTurn }, [actions.advanceTurn])

  // ── AI idle: accusation → (pick suspect + roll) → interrogate / end turn ─────
  // Deps intentionally minimal; latest state is read via refs. `hasMovedThisTurn`
  // is included so the effect re-fires when the movement portion completes.
  useEffect(() => {
    if (gamePhase !== 'idle' || !isAiTurn || isPaused) return

    const algo = currentSetup?.aiAlgorithm ?? 'rule_based'
    const t = setTimeout(() => {
      const notebook = probNotebooksRef.current[currentTurnIndex]
      const status   = playerStatusRef.current[currentTurnIndex]

      // 1. Accuse if confident.
      const accusation = aiDecideAccusation(notebook, algo, status?.hasAccused ?? false)
      if (accusation) {
        handleAccusationRef.current({
          suspect:  accusation.suspect,
          weapon:   accusation.weapon,
          location: accusation.location,
        })
        return
      }

      // 2. Before moving: pick a suspect token to move, then roll.
      if (!hasMovedThisTurn) {
        const suspectId = aiChooseSuspect(notebook, algo)
        setSelectedSuspectId(suspectId)
        const value = Math.ceil(Math.random() * 6)
        setDiceValue(value)
        setDiceRolling(true)
        setGamePhase('dice')
        return
      }

      // 3. After moving: interrogate if the token is in a room, else end the turn.
      const token = boardSuspectsRef.current.find(s => s.id === selectedSuspectIdRef.current)
      if (token?.currentLocation) {
        const suggestion = aiMakeSuggestion(notebook, algo)
        handleInterrogationRef.current({
          suspect:  token.id,
          weapon:   suggestion.weapon,
          location: ROOM_TO_LOCATION_CARD[token.currentLocation] ?? token.currentLocation,
        })
        return
      }
      advanceTurnRef.current()
    }, ms(AI_IDLE_DELAY[algo] ?? 100))

    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePhase, isAiTurn, currentTurnIndex, currentSetup, gs.simSpeed, isPaused, hasMovedThisTurn])

  // ── AI: auto-continue story ───────────────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'story' || !isAiTurn || isPaused) return
    const t = setTimeout(() => handleStoryCompleteRef.current(), ms(1800))
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePhase, isAiTurn, gs.simSpeed, isPaused])

  // ── AI: auto-continue reveal_result ──────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'reveal_result' || !isAiTurn || isPaused) return
    const t = setTimeout(() => handleRevealContinueRef.current(), ms(1400))
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePhase, isAiTurn, gs.simSpeed, isPaused])
}
