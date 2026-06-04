import { useRef, useEffect } from 'react'
import type { BoardPlayer } from './useBoard'
import { ROOM_TO_LOCATION_CARD } from './useBoard'
import type { PlayerSetup } from '../types'
import { aiDecideAccusation, aiMakeSuggestion, AI_IDLE_DELAY } from '../lib/aiEngine'
import type { GameStateValues } from './useGameState'
import type { NotebooksValues } from './useNotebooks'
import type { TurnActionsValues } from './useTurnActions'

interface Params {
  gs: GameStateValues
  nb: NotebooksValues
  boardPlayers: BoardPlayer[]
  actions: TurnActionsValues
  currentSetup: PlayerSetup | undefined
  isAiTurn: boolean
}

export function useAITurn({ gs, nb, boardPlayers, actions, currentSetup, isAiTurn }: Params): void {
  const {
    gamePhase, setGamePhase, setDiceValue, setDiceRolling,
    currentTurnIndex, isPaused, ms,
    playerStatusRef,
  } = gs
  const { probNotebooksRef } = nb
  const {
    handleInterrogationRef, handleAccusationRef,
    handleStoryCompleteRef, handleRevealContinueRef,
  } = actions

  // Keep boardPlayersRef in sync (read inside AI timeouts via ref to avoid stale closures)
  const boardPlayersRef = useRef(boardPlayers)
  useEffect(() => { boardPlayersRef.current = boardPlayers }, [boardPlayers])

  // ── AI idle: accusation → interrogation → dice roll ───────────────────────
  // Deps are intentionally minimal: we read probNotebooks/boardPlayers/callbacks
  // via refs so that those updates never cancel+restart this timer.
  useEffect(() => {
    if (gamePhase !== 'idle' || !isAiTurn || isPaused) return

    const algo = currentSetup?.aiAlgorithm ?? 'rule_based'
    const t = setTimeout(() => {
      const notebook = probNotebooksRef.current[currentTurnIndex]
      const status   = playerStatusRef.current[currentTurnIndex]
      const p        = boardPlayersRef.current[currentTurnIndex]

      const accusation = aiDecideAccusation(notebook, algo, status?.hasAccused ?? false)
      if (accusation) {
        handleAccusationRef.current({
          suspect:  accusation.suspect,
          weapon:   accusation.weapon,
          location: accusation.location,
        })
        return
      }
      if (p?.currentLocation) {
        const suggestion = aiMakeSuggestion(notebook, algo)
        handleInterrogationRef.current({
          suspect:  suggestion.suspect,
          weapon:   suggestion.weapon,
          location: ROOM_TO_LOCATION_CARD[p.currentLocation] ?? p.currentLocation,
        })
        return
      }
      const value = Math.ceil(Math.random() * 6)
      setDiceValue(value)
      setDiceRolling(true)
      setGamePhase('dice')
    }, ms(AI_IDLE_DELAY[algo] ?? 100))

    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePhase, isAiTurn, currentTurnIndex, currentSetup, gs.simSpeed, isPaused])

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
