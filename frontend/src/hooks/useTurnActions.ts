import { useRef, useEffect, useCallback } from 'react'
import type { BoardPlayer } from './useBoard'
import type { GameDeal, NotebookBoxState } from '../types'
import { ALL_CARDS } from '../types'
import { ROOM_DISPLAY_NAMES, ROOM_TO_LOCATION_CARD } from './useBoard'
import { eliminateCard, updateNoReveal } from '../lib/probabilityNotebook'
import { generateStory } from '../lib/storyGenerator'
import type { SelectionFlowResult } from '../components/SelectionFlow'
import type { GameStateValues } from './useGameState'
import type { NotebooksValues } from './useNotebooks'

// Re-export so callers don't need to import SelectionFlowResult directly.
export type { SelectionFlowResult }

function cardCategory(cardId: string): 'suspects' | 'weapons' | 'locations' | null {
  const card = ALL_CARDS.find(c => c.id === cardId)
  if (!card) return null
  return card.category === 'suspect' ? 'suspects'
       : card.category === 'weapon'  ? 'weapons'
       : 'locations'
}

function runRevealLoop(
  hands: readonly (readonly string[])[],
  currentIdx: number,
  suspectId: string,
  weaponId: string,
  locationCardId: string,
): { revealedCardId: string | null; revealedByIdx: number | null } {
  const n = hands.length
  for (let offset = 1; offset < n; offset++) {
    const idx = (currentIdx + offset) % n
    const hand = hands[idx]
    const match = hand.find(c => c === suspectId || c === weaponId || c === locationCardId)
    if (match) return { revealedCardId: match, revealedByIdx: idx }
  }
  return { revealedCardId: null, revealedByIdx: null }
}

export interface TurnActionsValues {
  advanceTurn: () => void
  handleAction: (id: string) => void
  handleInterrogationComplete: (result: SelectionFlowResult) => void
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
  boardPlayers: BoardPlayer[]
  deal: GameDeal
  exitRoom: (playerId: string) => void
  onRestart: () => void
}

export function useTurnActions({
  gs, nb, boardPlayers, deal, exitRoom, onRestart,
}: Params): TurnActionsValues {
  const {
    setGamePhase, setDiceValue, setDiceRolling, setPathCells, setPassageCells,
    setMovePath, setMoveStep, setRevealResult, setRemainingMoves,
    remainingMovesRef, setCurrentTurnIndex, playerStatusRef,
    gamePhase, pendingReveal, pendingPhaseAfterStory,
    currentTurnIndex, setPlayerStatus, setGameWinner,
    setPendingReveal, setPendingPhaseAfterStory, setStoryText,
  } = gs
  const {
    setProbNotebooks, setNotebooks, setShowCards, setShowNotebook, updateNotebookBox,
  } = nb

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
    setCurrentTurnIndex(prev => {
      const n = boardPlayers.length
      const status = playerStatusRef.current
      let next = (prev + 1) % n
      for (let i = 1; i < n; i++) {
        if (!status[next].eliminated) break
        next = (next + 1) % n
      }
      return next
    })
    setGamePhase('idle')
  }, [
    boardPlayers.length,
    setDiceValue, setDiceRolling, setPathCells, setPassageCells,
    setMovePath, setMoveStep, setRevealResult, setRemainingMoves,
    remainingMovesRef, setCurrentTurnIndex, playerStatusRef, setGamePhase,
  ])

  // ── handleAction (TurnOverlay) ───────────────────────────────────────────────
  const handleAction = useCallback((id: string) => {
    if (id === 'roll') {
      setGamePhase('rolling')
    } else if (id === 'interrogation') {
      const p = boardPlayers[currentTurnIndex]
      if (!p || !p.currentLocation) return
      setGamePhase('interrogation')
    } else if (id === 'accusation') {
      if (playerStatusRef.current[currentTurnIndex]?.hasAccused) return
      if (playerStatusRef.current[currentTurnIndex]?.eliminated) return
      setGamePhase('accusation')
    } else if (id === 'cards') {
      setShowCards(true)
    } else if (id === 'notes') {
      setShowNotebook(true)
    }
  }, [boardPlayers, currentTurnIndex, playerStatusRef, setGamePhase, setShowCards, setShowNotebook])

  // ── handleInterrogationComplete ──────────────────────────────────────────────
  const handleInterrogationComplete = useCallback((result: SelectionFlowResult) => {
    const p = boardPlayers[currentTurnIndex]
    if (!p) return
    const roomId = p.currentLocation
    const locationCardId = roomId ? (ROOM_TO_LOCATION_CARD[roomId] ?? roomId) : result.location
    const roomName = roomId
      ? (ROOM_DISPLAY_NAMES[roomId] ?? roomId).replace('\n', ' ')
      : undefined
    const hands = deal.playerHands.map(h => h.map(c => c.id))
    const { revealedCardId, revealedByIdx } = runRevealLoop(
      hands, currentTurnIndex, result.suspect, result.weapon, locationCardId
    )
    const rv = {
      type: 'interrogation' as const,
      suspectId: result.suspect,
      weaponId: result.weapon,
      locationId: locationCardId,
      roomName,
      revealedCardId,
      revealedByName: revealedByIdx !== null ? boardPlayers[revealedByIdx]?.name ?? null : null,
    }

    if (revealedCardId !== null) {
      setProbNotebooks(prev => prev.map((nb, i) =>
        i === currentTurnIndex ? eliminateCard(nb, revealedCardId) : nb
      ))
      const cat = cardCategory(revealedCardId)
      if (cat) updateNotebookBox(currentTurnIndex, cat, revealedCardId, 'X')
    } else {
      setProbNotebooks(prev => prev.map(nb =>
        updateNoReveal(nb, result.suspect, result.weapon, locationCardId)
      ))
    }

    setPendingReveal(rv)
    setPendingPhaseAfterStory('reveal_result')
    setStoryText(generateStory(result.suspect, result.weapon, locationCardId))
    setGamePhase('story')
  }, [
    boardPlayers, currentTurnIndex, deal.playerHands,
    updateNotebookBox, setProbNotebooks,
    setPendingReveal, setPendingPhaseAfterStory, setStoryText, setGamePhase,
  ])

  // ── handleAccusationComplete ─────────────────────────────────────────────────
  const handleAccusationComplete = useCallback((result: SelectionFlowResult) => {
    const p = boardPlayers[currentTurnIndex]
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
    boardPlayers, currentTurnIndex, deal.caseFile, deal.playerHands,
    setPlayerStatus, setGameWinner, setProbNotebooks, setNotebooks,
    setPendingReveal, setPendingPhaseAfterStory, setStoryText, setGamePhase,
  ])

  // ── handleStoryComplete ──────────────────────────────────────────────────────
  const handleStoryComplete = useCallback(() => {
    if (!pendingReveal) return
    if (pendingReveal.type === 'interrogation' && pendingReveal.revealedCardId !== null) {
      const p = boardPlayers[currentTurnIndex]
      if (p && p.currentLocation !== null) exitRoom(p.id)
    }
    setRevealResult(pendingReveal)
    setGamePhase(pendingPhaseAfterStory)
  }, [pendingReveal, pendingPhaseAfterStory, boardPlayers, currentTurnIndex, exitRoom, setRevealResult, setGamePhase])

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
    handleAction,
    handleInterrogationComplete,
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
