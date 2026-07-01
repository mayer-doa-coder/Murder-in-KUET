import { useState, useRef, useEffect, useCallback } from 'react'
import type { GamePhase, PlayerStatus, RevealResult, PlayerSetup } from '../types'

export interface GameStateValues {
  gamePhase: GamePhase
  setGamePhase: (p: GamePhase) => void
  currentTurnIndex: number
  setCurrentTurnIndex: React.Dispatch<React.SetStateAction<number>>
  diceValue: number | null
  setDiceValue: (v: number | null) => void
  diceRolling: boolean
  setDiceRolling: (v: boolean) => void
  pathCells: [number, number][]
  setPathCells: (v: [number, number][]) => void
  passageCells: [number, number][]
  setPassageCells: (v: [number, number][]) => void
  movePath: [number, number][]
  setMovePath: (v: [number, number][]) => void
  moveStep: number
  setMoveStep: React.Dispatch<React.SetStateAction<number>>
  playerStatus: PlayerStatus[]
  setPlayerStatus: React.Dispatch<React.SetStateAction<PlayerStatus[]>>
  revealResult: RevealResult | null
  setRevealResult: (v: RevealResult | null) => void
  gameWinner: number | null
  setGameWinner: (v: number | null) => void
  remainingMoves: number
  setRemainingMoves: (v: number) => void
  storyText: string
  setStoryText: (v: string) => void
  pendingReveal: RevealResult | null
  setPendingReveal: (v: RevealResult | null) => void
  pendingPhaseAfterStory: 'reveal_result' | 'game_over'
  setPendingPhaseAfterStory: (v: 'reveal_result' | 'game_over') => void
  turnCount: number
  setTurnCount: React.Dispatch<React.SetStateAction<number>>
  simSpeed: 1 | 4 | 16
  setSimSpeed: (v: 1 | 4 | 16) => void
  isPaused: boolean
  setIsPaused: (v: boolean) => void
  pauseViewIdx: number
  setPauseViewIdx: (v: number) => void
  positionRef: React.MutableRefObject<[number, number]>
  remainingMovesRef: React.MutableRefObject<number>
  playerStatusRef: React.MutableRefObject<PlayerStatus[]>
  ms: (base: number) => number
}

export function useGameState(players: PlayerSetup[]): GameStateValues {
  const [gamePhase, setGamePhase]       = useState<GamePhase>('idle')
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0)
  const [diceValue, setDiceValue]       = useState<number | null>(null)
  const [diceRolling, setDiceRolling]   = useState(false)
  const [pathCells, setPathCells]       = useState<[number, number][]>([])
  const [passageCells, setPassageCells] = useState<[number, number][]>([])
  const [movePath, setMovePath]         = useState<[number, number][]>([])
  const [moveStep, setMoveStep]         = useState(0)
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus[]>(
    () => players.map(() => ({ eliminated: false, hasAccused: false }))
  )
  const playerStatusRef = useRef(playerStatus)
  useEffect(() => { playerStatusRef.current = playerStatus }, [playerStatus])

  const [revealResult, setRevealResult] = useState<RevealResult | null>(null)
  const [gameWinner, setGameWinner]     = useState<number | null>(null)
  const [remainingMoves, setRemainingMoves] = useState(0)
  const [storyText, setStoryText]       = useState('')
  const [pendingReveal, setPendingReveal] = useState<RevealResult | null>(null)
  const [pendingPhaseAfterStory, setPendingPhaseAfterStory] =
    useState<'reveal_result' | 'game_over'>('reveal_result')

  const positionRef       = useRef<[number, number]>([12, 12])
  const remainingMovesRef = useRef(0)

  const [turnCount, setTurnCount] = useState(0)
  const [simSpeed, setSimSpeed] = useState<1 | 4 | 16>(1)
  const ms = useCallback((base: number) => Math.max(0, Math.round(base / simSpeed)), [simSpeed])
  const [isPaused,     setIsPaused]     = useState(false)
  const [pauseViewIdx, setPauseViewIdx] = useState(0)

  return {
    gamePhase, setGamePhase,
    currentTurnIndex, setCurrentTurnIndex,
    diceValue, setDiceValue,
    diceRolling, setDiceRolling,
    pathCells, setPathCells,
    passageCells, setPassageCells,
    movePath, setMovePath,
    moveStep, setMoveStep,
    playerStatus, setPlayerStatus,
    revealResult, setRevealResult,
    gameWinner, setGameWinner,
    remainingMoves, setRemainingMoves,
    storyText, setStoryText,
    pendingReveal, setPendingReveal,
    pendingPhaseAfterStory, setPendingPhaseAfterStory,
    turnCount, setTurnCount,
    simSpeed, setSimSpeed,
    isPaused, setIsPaused,
    pauseViewIdx, setPauseViewIdx,
    positionRef, remainingMovesRef, playerStatusRef,
    ms,
  }
}
