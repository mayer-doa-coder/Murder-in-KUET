import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  useBoard,
  ROOM_DISPLAY_NAMES,
  ROOM_BOUNDS,
  DOOR_POSITIONS,
  CHAR_STARTS,
  COLS,
  ROWS,
  getReachableCells,
  findPath,
} from '../hooks/useBoard'
import { ROOM_ACCENT } from '../components/GridCell'
import GridCell from '../components/GridCell'
import PlayerToken from '../components/PlayerToken'
import TurnOverlay from '../components/TurnOverlay'
import HandOverlay from '../components/HandOverlay'
import Dice from '../components/Dice'
import PathDots from '../components/PathDots'
import CameraController from '../components/CameraController'
import SelectionFlow from '../components/SelectionFlow'
import type { SelectionFlowResult } from '../components/SelectionFlow'
import RevealResultOverlay from '../components/RevealResultOverlay'
import StoryScreen from '../components/StoryScreen'
import GameOverPopup from '../components/GameOverPopup'
import ClueNotebook from '../components/ClueNotebook'
import ProbabilityNotebook from '../components/ProbabilityNotebook'
import { generateStory } from '../lib/storyGenerator'
import { createProbabilityNotebook, eliminateCard, updateNoReveal } from '../lib/probabilityNotebook'
import { aiChooseCell, aiMakeSuggestion, aiDecideAccusation, AI_IDLE_DELAY } from '../lib/aiEngine'
import type { PlayerSetup, GameDeal, GamePhase, PlayerStatus, RevealResult, NotebookData, NotebookBoxState, GameMode, ProbabilityData } from '../types'
import { LOCATIONS_CARDS, SUSPECTS_CARDS, WEAPONS_CARDS, ALL_CARDS } from '../types'

interface Props {
  players:  PlayerSetup[]
  deal:     GameDeal
  gameMode: GameMode
  onExit:    () => void
  onRestart: () => void
}

// ── Room visual config ────────────────────────────────────────────────────────
const ROOM_LABEL_COLORS: Record<string, string> = {
  auditorium:    '#cc66ee',
  swc:           '#44cc88',
  ae_hall:       '#ee5555',
  cafeteria:     '#ee9944',
  central_field: '#55cc55',
  it_park:       '#4488ee',
  br_hall:       '#cc66ee',
  lotus_pond:    '#44cccc',
  pocket_gate:   '#aaaaaa',
}

const ROOM_LABEL_ANCHORS: Record<string, [number, number]> = {
  auditorium:    [3,    1.5],
  swc:           [11.5, 3  ],
  ae_hall:       [20,   2.5],
  cafeteria:     [3,    8  ],
  central_field: [2.5,  14 ],
  it_park:       [2.5,  21.5],
  br_hall:       [11.5, 20.5],
  lotus_pond:    [20.5, 21.5],
  pocket_gate:   [19.5, 12 ],
}

// ── Furniture ────────────────────────────────────────────────────────────────
type FItem =
  | { shape: 'rect'; x: number; y: number; w: number; h: number; fill: string }
  | { shape: 'circ'; cx: number; cy: number; r: number; fill: string }

const FURNITURE: FItem[] = [
  { shape: 'rect', x: 0.6, y: 0.2, w: 4.8, h: 0.7, fill: '#250018' },
  { shape: 'rect', x: 0.7, y: 0.85, w: 0.65, h: 0.6, fill: '#1a0010' },
  { shape: 'rect', x: 1.6, y: 0.85, w: 0.65, h: 0.6, fill: '#1a0010' },
  { shape: 'rect', x: 2.5, y: 0.85, w: 0.65, h: 0.6, fill: '#1a0010' },
  { shape: 'rect', x: 3.4, y: 0.85, w: 0.65, h: 0.6, fill: '#1a0010' },
  { shape: 'rect', x: 4.3, y: 0.85, w: 0.65, h: 0.6, fill: '#1a0010' },
  { shape: 'rect', x: 0.3, y: 2.6,  w: 6.0, h: 0.35, fill: '#160008' },
  { shape: 'rect', x: 9.4,  y: 0.9, w: 2.2, h: 1.2, fill: '#001e0c' },
  { shape: 'rect', x: 11.9, y: 0.9, w: 2.2, h: 1.2, fill: '#001e0c' },
  { shape: 'rect', x: 9.3,  y: 4.0, w: 4.8, h: 0.8, fill: '#001408' },
  { shape: 'rect', x: 17.5, y: 0.4, w: 1.6, h: 2.2, fill: '#1c0000' },
  { shape: 'rect', x: 19.5, y: 0.4, w: 1.6, h: 2.2, fill: '#1c0000' },
  { shape: 'rect', x: 21.5, y: 0.4, w: 1.6, h: 2.2, fill: '#1c0000' },
  { shape: 'rect', x: 0.4, y: 6.5, w: 2.4, h: 1.4, fill: '#1c0c00' },
  { shape: 'rect', x: 3.3, y: 6.5, w: 2.4, h: 1.4, fill: '#1c0c00' },
  { shape: 'rect', x: 0.4, y: 8.4, w: 2.4, h: 1.4, fill: '#1c0c00' },
  { shape: 'rect', x: 3.3, y: 8.4, w: 2.4, h: 1.4, fill: '#1c0c00' },
  { shape: 'circ', cx: 2.5, cy: 14.2, r: 1.5, fill: '#001c00' },
  { shape: 'rect', x: 0.3, y: 19.4, w: 1.9, h: 1.5, fill: '#00001c' },
  { shape: 'rect', x: 2.7, y: 19.4, w: 1.9, h: 1.5, fill: '#00001c' },
  { shape: 'rect', x: 0.3, y: 21.4, w: 1.9, h: 1.5, fill: '#00001c' },
  { shape: 'rect', x: 2.7, y: 21.4, w: 1.9, h: 1.5, fill: '#00001c' },
  { shape: 'rect', x: 0.3, y: 23.4, w: 1.9, h: 1.0, fill: '#000014' },
  { shape: 'rect', x: 2.7, y: 23.4, w: 1.9, h: 1.0, fill: '#000014' },
  { shape: 'rect', x: 9.0,  y: 18.4, w: 5.5, h: 2.8, fill: '#1c001c' },
  { shape: 'rect', x: 9.0,  y: 22.2, w: 5.5, h: 0.9, fill: '#140014' },
  { shape: 'circ', cx: 20.5, cy: 21.2, r: 2.2, fill: '#001c1c' },
  { shape: 'circ', cx: 20.5, cy: 21.2, r: 1.1, fill: '#001414' },
  { shape: 'rect', x: 17.0, y: 10.5, w: 1.2, h: 3.0, fill: '#1e1e1e' },
  { shape: 'rect', x: 21.8, y: 10.5, w: 1.2, h: 3.0, fill: '#1e1e1e' },
  { shape: 'rect', x: 17.0, y: 10.0, w: 6.0, h: 0.8, fill: '#242424' },
]

type StartLabel = {
  charId: string; col: number; row: number; dir: 'top' | 'bottom' | 'left' | 'right'; label: string
}
const START_LABELS: StartLabel[] = [
  { charId: 'chef',           col: 16, row: 0,  dir: 'top',    label: 'START\nCHEF'       },
  { charId: 'hallboy',        col: 23, row: 7,  dir: 'right',  label: 'START\nHALLBOY'    },
  { charId: 'security_guard', col: 15, row: 24, dir: 'bottom', label: 'START\nSEC.GUARD'  },
  { charId: 'shopkeeper',     col: 9,  row: 24, dir: 'bottom', label: 'START\nSHOPKEEPR'  },
  { charId: 'student_girl',   col: 0,  row: 17, dir: 'left',   label: 'START\nSTD.GIRL'   },
  { charId: 'student_boy',    col: 0,  row: 5,  dir: 'left',   label: 'START\nSTD.BOY'    },
]

const SECRET_PASSAGES = [
  { col: 5.5, row: 2.8, arrow: '↘', label: 'SECRET' },
  { col: 17,  row: 9.5, arrow: '↖', label: 'SECRET' },
  { col: 18.5,row: 18.5,arrow: '↖', label: 'SECRET' },
  { col: 14.5,row: 23.5,arrow: '↘', label: 'SECRET' },
]

// ── Notebook helpers ──────────────────────────────────────────────────────────
function createEmptyNotebook(): NotebookData {
  const suspects:  Record<string, NotebookBoxState> = {}
  const weapons:   Record<string, NotebookBoxState> = {}
  const locations: Record<string, NotebookBoxState> = {}
  SUSPECTS_CARDS.forEach(c  => { suspects[c.id]  = '' })
  WEAPONS_CARDS.forEach(c   => { weapons[c.id]   = '' })
  LOCATIONS_CARDS.forEach(c => { locations[c.id] = '' })
  return { suspects, weapons, locations }
}

function cardCategory(cardId: string): 'suspects' | 'weapons' | 'locations' | null {
  const card = ALL_CARDS.find(c => c.id === cardId)
  if (!card) return null
  return card.category === 'suspect' ? 'suspects'
       : card.category === 'weapon'  ? 'weapons'
       : 'locations'
}

const ROOM_TO_LOCATION_CARD: Record<string, string> = {
  auditorium:    'auditorium',
  swc:           'student_welfare',
  ae_hall:       'amar_ekushey',
  cafeteria:     'cafeteria',
  central_field: 'central_field',
  it_park:       'it_park',
  br_hall:       'begum_rokeya',
  lotus_pond:    'lotus_pond',
  pocket_gate:   'pocket_gate',
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

const SIDEBAR_W = 252
const HEADER_H  = 54
const PAD       = 6

// ── Component ─────────────────────────────────────────────────────────────────
export default function GameBoardScreen({ players, deal, gameMode, onExit, onRestart }: Props) {
  const [vw, setVw] = useState(window.innerWidth)
  const [vh, setVh] = useState(window.innerHeight)

  useEffect(() => {
    const fn = () => { setVw(window.innerWidth); setVh(window.innerHeight) }
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  const cellSize = Math.max(12, Math.floor(Math.min(
    (vw - SIDEBAR_W - PAD * 2) / COLS,
    (vh - HEADER_H - PAD * 2) / ROWS,
  )))
  const boardW = cellSize * COLS
  const boardH = cellSize * ROWS

  const { board, boardPlayers, movePlayer, enterRoom, exitRoom } = useBoard(players)
  const flatCells = useMemo(() => board.flat(), [board])

  // ── Turn / phase state ────────────────────────────────────────────────────
  const [gamePhase, setGamePhase]       = useState<GamePhase>('idle')
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0)
  const [diceValue, setDiceValue]       = useState<number | null>(null)
  const [diceRolling, setDiceRolling]   = useState(false)
  const [pathCells, setPathCells]       = useState<[number, number][]>([])
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

  // ── Clue notebooks (human players) ───────────────────────────────────────
  const [notebooks, setNotebooks] = useState<NotebookData[]>(
    () => players.map(() => createEmptyNotebook())
  )
  const [showNotebook, setShowNotebook] = useState(false)
  const [showCards,    setShowCards]    = useState(false)
  const [showAiNotebook, setShowAiNotebook] = useState(false)

  // ── AI probability notebooks ──────────────────────────────────────────────
  const [probNotebooks, setProbNotebooks] = useState<ProbabilityData[]>(() =>
    players.map((_, i) =>
      createProbabilityNotebook(deal.playerHands[i]?.map(c => c.id) ?? [])
    )
  )

  const updateNotebookBox = useCallback((
    playerIdx: number,
    category: 'suspects' | 'weapons' | 'locations',
    cardId: string,
    state: NotebookBoxState,
  ) => {
    setNotebooks(prev => prev.map((nb, i) =>
      i !== playerIdx ? nb : { ...nb, [category]: { ...nb[category], [cardId]: state } }
    ))
  }, [])

  // ── Story / pending state ─────────────────────────────────────────────────
  const [storyText, setStoryText]       = useState('')
  const [pendingReveal, setPendingReveal] = useState<RevealResult | null>(null)
  const [pendingPhaseAfterStory, setPendingPhaseAfterStory] = useState<'reveal_result' | 'game_over'>('reveal_result')

  // Refs for immediate sync during rapid key presses / AI callbacks
  const positionRef       = useRef<[number, number]>([12, 12])
  const remainingMovesRef = useRef(0)

  // ── Simulation speed & pause ──────────────────────────────────────────────
  const [simSpeed, setSimSpeed] = useState<1 | 4 | 16>(1)
  const ms = useCallback((base: number) => Math.max(0, Math.round(base / simSpeed)), [simSpeed])
  const [isPaused,       setIsPaused]       = useState(false)
  const [pauseViewIdx,   setPauseViewIdx]   = useState(0)   // which player to inspect

  const currentPlayer = boardPlayers[currentTurnIndex]
  const currentSetup  = players[currentTurnIndex]
  const isAiTurn      = currentSetup?.type === 'computer'

  // ── Stable refs for values used inside AI timeouts ────────────────────────
  // probNotebooks/boardPlayers are declared above so they can be used as initial values.
  // The callback refs can't reference their callbacks here (TDZ — callbacks are defined
  // later via useCallback), so they start as no-ops; useEffect sets the real values
  // before any setTimeout fires (minimum ~80ms away).
  const probNotebooksRef        = useRef(probNotebooks)
  const boardPlayersRef         = useRef(boardPlayers)
  const handleInterrogationRef  = useRef<(r: SelectionFlowResult) => void>(() => {})
  const handleAccusationRef     = useRef<(r: SelectionFlowResult) => void>(() => {})
  const handleStoryCompleteRef  = useRef<() => void>(() => {})
  const handleRevealContinueRef = useRef<() => void>(() => {})
  useEffect(() => { probNotebooksRef.current       = probNotebooks },        [probNotebooks])
  useEffect(() => { boardPlayersRef.current        = boardPlayers },         [boardPlayers])

  // Keep positionRef in sync
  useEffect(() => {
    if (currentPlayer) positionRef.current = currentPlayer.position
  }, [currentPlayer])

  // ── advanceTurn ───────────────────────────────────────────────────────────
  const advanceTurn = useCallback(() => {
    setDiceValue(null)
    setDiceRolling(false)
    setPathCells([])
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
  }, [boardPlayers.length])

  // ── handleAction (from TurnOverlay) ──────────────────────────────────────
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
  }, [boardPlayers, currentTurnIndex])

  // ── Interrogation complete → show story ──────────────────────────────────
  const handleInterrogationComplete = useCallback((result: SelectionFlowResult) => {
    const p = boardPlayers[currentTurnIndex]
    if (!p) return
    const roomId = p.currentLocation
    const locationCardId = roomId ? (ROOM_TO_LOCATION_CARD[roomId] ?? roomId) : result.location
    const roomName = roomId ? (ROOM_DISPLAY_NAMES[roomId] ?? roomId).replace('\n', ' ') : undefined
    const hands = deal.playerHands.map(h => h.map(c => c.id))
    const { revealedCardId, revealedByIdx } = runRevealLoop(
      hands, currentTurnIndex, result.suspect, result.weapon, locationCardId
    )
    const rv: RevealResult = {
      type: 'interrogation',
      suspectId: result.suspect,
      weaponId: result.weapon,
      locationId: locationCardId,
      roomName,
      revealedCardId,
      revealedByName: revealedByIdx !== null ? boardPlayers[revealedByIdx]?.name ?? null : null,
    }

    // Update suggesting player's prob notebook
    if (revealedCardId !== null) {
      // A card was revealed — eliminate it from the suggesting player's notebook
      setProbNotebooks(prev => prev.map((nb, i) =>
        i === currentTurnIndex ? eliminateCard(nb, revealedCardId) : nb
      ))
      const cat = cardCategory(revealedCardId)
      if (cat) updateNotebookBox(currentTurnIndex, cat, revealedCardId, 'X')
    } else {
      // No reveal — boost all three suggested cards in ALL players' notebooks (public info)
      setProbNotebooks(prev => prev.map(nb =>
        updateNoReveal(nb, result.suspect, result.weapon, locationCardId)
      ))
    }

    setPendingReveal(rv)
    setPendingPhaseAfterStory('reveal_result')
    setStoryText(generateStory(result.suspect, result.weapon, locationCardId))
    setGamePhase('story')
  }, [boardPlayers, currentTurnIndex, deal.playerHands, updateNotebookBox])

  // ── Accusation complete → show story ─────────────────────────────────────
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

    const rv: RevealResult = {
      type: 'accusation',
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
    } else {
      setGameWinner(currentTurnIndex)
    }

    setPendingReveal(rv)
    setPendingPhaseAfterStory(correct ? 'game_over' : 'reveal_result')
    setStoryText(generateStory(result.suspect, result.weapon, result.location))
    setGamePhase('story')
  }, [boardPlayers, currentTurnIndex, deal.caseFile])

  // ── Story complete → show result ──────────────────────────────────────────
  const handleStoryComplete = useCallback(() => {
    if (!pendingReveal) return
    if (pendingReveal.type === 'interrogation' && pendingReveal.revealedCardId !== null) {
      const p = boardPlayers[currentTurnIndex]
      if (p && p.currentLocation !== null) exitRoom(p.id)
    }
    setRevealResult(pendingReveal)
    setGamePhase(pendingPhaseAfterStory)
  }, [pendingReveal, pendingPhaseAfterStory, boardPlayers, currentTurnIndex, exitRoom])

  // ── Reveal result acknowledged ────────────────────────────────────────────
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
  }, [gamePhase, onRestart, advanceTurn])

  const handleSelectionCancel = useCallback(() => {
    setGamePhase('idle')
  }, [])

  // ── Sync callback refs after all useCallbacks are defined ─────────────────
  useEffect(() => { handleInterrogationRef.current  = handleInterrogationComplete }, [handleInterrogationComplete])
  useEffect(() => { handleAccusationRef.current     = handleAccusationComplete },    [handleAccusationComplete])
  useEffect(() => { handleStoryCompleteRef.current  = handleStoryComplete },         [handleStoryComplete])
  useEffect(() => { handleRevealContinueRef.current = handleRevealContinue },        [handleRevealContinue])

  // ── Dice ──────────────────────────────────────────────────────────────────
  const handleDiceRelease = useCallback(() => {
    const value = Math.ceil(Math.random() * 6)
    setDiceValue(value)
    setDiceRolling(true)
    setGamePhase('dice')
  }, [])

  const handleDiceSettled = useCallback(() => {
    setDiceRolling(false)
    if (diceValue === null || !currentPlayer) return
    const cells = getReachableCells(board, currentPlayer.position, diceValue)
    if (cells.length === 0) {
      advanceTurn()
      return
    }
    setPathCells(cells)
    remainingMovesRef.current = diceValue
    setRemainingMoves(diceValue)

    // AI: pick a cell and animate movement
    if (isAiTurn) {
      const algo = currentSetup?.aiAlgorithm ?? 'rule_based'
      const target = aiChooseCell(cells, board, probNotebooks[currentTurnIndex], algo, ROOM_TO_LOCATION_CARD)
      if (target) {
        const path = findPath(board, currentPlayer.position, target)
        if (path.length > 0) {
          setMovePath(path)
          setMoveStep(0)
          setPathCells([])
          setGamePhase('moving')
          return
        }
      }
      // No valid path — skip movement
      advanceTurn()
    }
  }, [diceValue, currentPlayer, board, advanceTurn, isAiTurn, currentSetup, probNotebooks, currentTurnIndex])

  const handleGridClick = useCallback(
    (_e: React.MouseEvent<HTMLDivElement>) => { /* arrow keys handle movement */ },
    []
  )

  // ── AI idle automation ────────────────────────────────────────────────────
  // Deps are intentionally minimal: we read probNotebooks/boardPlayers/callbacks
  // via refs so that those updates never cancel+restart this timer.
  useEffect(() => {
    if (gamePhase !== 'idle' || !isAiTurn || isPaused) return

    const algo = currentSetup?.aiAlgorithm ?? 'rule_based'
    const t = setTimeout(() => {
      const notebook = probNotebooksRef.current[currentTurnIndex]
      const status   = playerStatusRef.current[currentTurnIndex]
      const p        = boardPlayersRef.current[currentTurnIndex]

      // Try accusation first
      const accusation = aiDecideAccusation(notebook, algo, status?.hasAccused ?? false)
      if (accusation) {
        handleAccusationRef.current({ suspect: accusation.suspect, weapon: accusation.weapon, location: accusation.location })
        return
      }
      // If in a room, interrogate
      if (p?.currentLocation) {
        const suggestion = aiMakeSuggestion(notebook, algo)
        handleInterrogationRef.current({
          suspect:  suggestion.suspect,
          weapon:   suggestion.weapon,
          location: ROOM_TO_LOCATION_CARD[p.currentLocation] ?? p.currentLocation,
        })
        return
      }
      // Otherwise roll dice
      const value = Math.ceil(Math.random() * 6)
      setDiceValue(value)
      setDiceRolling(true)
      setGamePhase('dice')
    }, ms(AI_IDLE_DELAY[algo] ?? 100))

    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePhase, isAiTurn, currentTurnIndex, currentSetup, simSpeed, isPaused])

  // ── AI: auto-continue story ───────────────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'story' || !isAiTurn || isPaused) return
    const t = setTimeout(() => handleStoryCompleteRef.current(), ms(1800))
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePhase, isAiTurn, simSpeed, isPaused])

  // ── AI: auto-continue reveal_result ──────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'reveal_result' || !isAiTurn || isPaused) return
    const t = setTimeout(() => handleRevealContinueRef.current(), ms(1400))
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePhase, isAiTurn, simSpeed, isPaused])

  // ── Arrow-key step-by-step movement (human only) ─────────────────────────
  useEffect(() => {
    if (gamePhase !== 'dice' || isAiTurn) return

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ') {
        if (remainingMovesRef.current > 0) {
          e.preventDefault()
          setPathCells([])
          remainingMovesRef.current = 0
          setRemainingMoves(0)
          advanceTurn()
        }
        return
      }

      const DIRS: Record<string, [number, number]> = {
        ArrowUp:    [0, -1],
        ArrowDown:  [0, 1],
        ArrowLeft:  [-1, 0],
        ArrowRight: [1, 0],
      }
      const dir = DIRS[e.key]
      if (!dir) return
      e.preventDefault()

      if (remainingMovesRef.current <= 0) return
      const player = currentPlayer
      if (!player) return

      if (player.currentLocation !== null) exitRoom(player.id)

      const [dc, dr] = dir
      const [cc, cr] = positionRef.current
      const nc = cc + dc, nr = cr + dr

      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) return
      const cell = board[nr]?.[nc]
      if (!cell || !cell.isWalkable) return

      positionRef.current = [nc, nr]
      remainingMovesRef.current -= 1

      movePlayer(player.id, [nc, nr])
      setRemainingMoves(remainingMovesRef.current)

      if (remainingMovesRef.current > 0) {
        const newReachable = getReachableCells(board, [nc, nr], remainingMovesRef.current)
        setPathCells(newReachable)
      } else {
        setPathCells([])
      }

      if (cell.type === 'door' && cell.roomId) {
        enterRoom(player.id, cell.roomId)
        setPathCells([])
        remainingMovesRef.current = 0
        setRemainingMoves(0)
        advanceTurn()
        return
      }

      if (remainingMovesRef.current <= 0) {
        advanceTurn()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [gamePhase, isAiTurn, currentPlayer, board, movePlayer, exitRoom, enterRoom, advanceTurn])

  // ── Step-by-step movement animation ──────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'moving' || movePath.length === 0 || isPaused) return
    const delay = moveStep >= movePath.length ? 0 : ms(isAiTurn ? 30 : 130)
    const t = setTimeout(() => {
      if (moveStep >= movePath.length) {
        const finalPos = movePath[movePath.length - 1]
        if (finalPos && currentPlayer) {
          const [fc, fr] = finalPos
          const cell = board[fr]?.[fc]
          if (cell?.type === 'door' && cell.roomId) {
            enterRoom(currentPlayer.id, cell.roomId)
          }
        }
        advanceTurn()
      } else {
        const [col, row] = movePath[moveStep]
        if (currentPlayer) movePlayer(currentPlayer.id, [col, row])
        setMoveStep(s => s + 1)
      }
    }, delay)
    return () => clearTimeout(t)
  }, [gamePhase, movePath, moveStep, currentPlayer, movePlayer, advanceTurn, board, enterRoom, isAiTurn, ms, isPaused])

  // ── Derived values ────────────────────────────────────────────────────────
  const currentRoomId = currentPlayer?.currentLocation ?? null

  const disabledActions = useMemo(() => {
    const d: string[] = []
    const status = playerStatus[currentTurnIndex]
    if (!currentRoomId) d.push('interrogation')
    if (status?.hasAccused || status?.eliminated) d.push('accusation')
    if (status?.eliminated) { d.push('roll'); d.push('interrogation') }
    return d
  }, [currentRoomId, playerStatus, currentTurnIndex])

  const lockedLocationCard = useMemo(() => {
    if (!currentRoomId) return undefined
    const cardId = ROOM_TO_LOCATION_CARD[currentRoomId] ?? currentRoomId
    return LOCATIONS_CARDS.find(c => c.id === cardId)
  }, [currentRoomId])

  // ── Camera ────────────────────────────────────────────────────────────────
  const isZoomed = gamePhase === 'idle' && !!currentPlayer

  const charColors: Record<string, string> = {}
  boardPlayers.forEach(p => { charColors[p.id] = p.accentColor })

  const lfs = Math.max(4, Math.floor(cellSize * 0.19))

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full flex flex-col" style={{ background: '#020204' }}>

      {/* Header */}
      <div
        className="font-pixel flex items-center justify-between px-4 shrink-0"
        style={{ height: HEADER_H, background: '#060308', borderBottom: '2px solid #2a0025' }}
      >
        <motion.button
          className="font-pixel"
          style={{
            fontSize: '8px', color: '#aa3355', background: 'transparent',
            border: '1px solid #661130', padding: '4px 11px', cursor: 'pointer', letterSpacing: '1px',
          }}
          whileHover={{ color: '#ee2266', borderColor: '#aa0044' }}
          onClick={onExit}
        >
          ← EXIT
        </motion.button>
        <div style={{ fontSize: '9px', color: '#dd3366', letterSpacing: '4px' }}>
          MURDER IN KUET
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Speed selector + Pause — visible when any AI player exists */}
          {players.some(p => p.type === 'computer') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {([1, 4, 16] as const).map(s => (
                <motion.button
                  key={s}
                  className="font-pixel"
                  onClick={() => setSimSpeed(s)}
                  style={{
                    fontSize: '6px', letterSpacing: '0.5px',
                    padding: '3px 7px', cursor: 'pointer',
                    background: simSpeed === s ? '#cc8844' : 'transparent',
                    border: `1px solid ${simSpeed === s ? '#cc8844' : '#3a2200'}`,
                    color: simSpeed === s ? '#000' : '#664400',
                  }}
                  whileHover={{ borderColor: '#cc8844', color: '#cc8844' }}
                  transition={{ duration: 0.06 }}
                >
                  {s}×
                </motion.button>
              ))}
              <motion.button
                className="font-pixel"
                onClick={() => {
                  if (isPaused) {
                    setIsPaused(false)
                  } else {
                    setIsPaused(true)
                    setPauseViewIdx(currentTurnIndex)
                  }
                }}
                style={{
                  fontSize: '6px', letterSpacing: '0.5px',
                  padding: '3px 9px', cursor: 'pointer',
                  background: isPaused ? '#cc4488' : 'transparent',
                  border: `1px solid ${isPaused ? '#cc4488' : '#550033'}`,
                  color: isPaused ? '#000' : '#884466',
                }}
                whileHover={{ borderColor: '#cc4488', color: isPaused ? '#000' : '#cc4488' }}
                transition={{ duration: 0.06 }}
              >
                {isPaused ? '▶ RESUME' : '⏸ PAUSE'}
              </motion.button>
            </div>
          )}
          <div className="font-pixel" style={{ fontSize: '7px', color: '#cc8844', letterSpacing: '1px' }}>
            {gamePhase === 'idle'          && (isAiTurn ? 'AI THINKING...' : 'SELECT ACTION')}
            {gamePhase === 'rolling'       && 'ROLLING...'}
            {gamePhase === 'dice'          && diceValue !== null && `ROLLED: ${diceValue} — ${isAiTurn ? 'AI MOVING' : 'USE ARROWS'}`}
            {gamePhase === 'moving'        && 'MOVING...'}
            {gamePhase === 'interrogation' && 'INTERROGATION'}
            {gamePhase === 'accusation'    && 'ACCUSATION'}
            {gamePhase === 'story'         && 'CRIME THEORY'}
            {gamePhase === 'reveal_result' && 'RESULT'}
            {gamePhase === 'game_over'     && (
              gameWinner !== null
                ? `${boardPlayers[gameWinner]?.name ?? 'PLAYER'} WINS!`
                : 'GAME OVER'
            )}
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">

        {/* Board area */}
        <div
          className="flex-1 flex items-center justify-center overflow-hidden relative"
          style={{ padding: PAD, background: '#040a04' }}
        >
          {/* Camera wrap */}
          <CameraController
            playerCol={currentPlayer?.position[0] ?? 12}
            playerRow={currentPlayer?.position[1] ?? 12}
            cellSize={cellSize}
            boardW={boardW}
            boardH={boardH}
            isZoomed={isZoomed}
          >
            {/* Board container */}
            <div
              className="relative shrink-0"
              style={{ width: boardW, height: boardH, overflow: 'visible' }}
            >
              {/* Grid cells */}
              <div
                style={{
                  position: 'absolute', inset: 0,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${COLS}, ${cellSize}px)`,
                  gridTemplateRows:    `repeat(${ROWS}, ${cellSize}px)`,
                  cursor: 'default',
                }}
                onClick={handleGridClick}
              >
                {flatCells.map((cell, i) => (
                  <GridCell
                    key={i}
                    cell={cell}
                    cellSize={cellSize}
                    col={i % COLS}
                    row={Math.floor(i / COLS)}
                  />
                ))}
              </div>

              {/* SVG overlay */}
              <svg
                style={{
                  position: 'absolute', inset: 0, overflow: 'visible',
                  width: boardW, height: boardH, pointerEvents: 'none', zIndex: 2,
                }}
              >
                {FURNITURE.map((item, i) =>
                  item.shape === 'rect' ? (
                    <rect key={i}
                      x={item.x * cellSize} y={item.y * cellSize}
                      width={item.w * cellSize} height={item.h * cellSize}
                      fill={item.fill} rx={1}
                    />
                  ) : (
                    <circle key={i}
                      cx={item.cx * cellSize} cy={item.cy * cellSize}
                      r={item.r * cellSize} fill={item.fill}
                    />
                  )
                )}

                {/* Door arch bars */}
                {Object.entries(DOOR_POSITIONS).flatMap(([roomId, doors]) =>
                  doors.map(([dc, dr], di) => {
                    const bounds = ROOM_BOUNDS[roomId]
                    if (!bounds) return null
                    const [c0, c1, r0] = bounds
                    const accent = ROOM_ACCENT[roomId] ?? '#666'
                    const x0 = dc * cellSize, y0 = dr * cellSize
                    const gap = Math.max(1, cellSize * 0.18)
                    const thick = Math.max(2, cellSize * 0.18)
                    let rx = x0 + gap, ry = y0, rw = cellSize - gap * 2, rh = thick
                    if (dc === c0) { rx = x0; ry = y0 + gap; rw = thick; rh = cellSize - gap * 2 }
                    else if (dc === c1) { rx = x0 + cellSize - thick; ry = y0 + gap; rw = thick; rh = cellSize - gap * 2 }
                    else if (dr === r0) { rx = x0 + gap; ry = y0; rw = cellSize - gap * 2; rh = thick }
                    else { rx = x0 + gap; ry = y0 + cellSize - thick; rw = cellSize - gap * 2; rh = thick }
                    return (
                      <rect key={`door-${roomId}-${di}`}
                        x={rx} y={ry} width={rw} height={rh}
                        fill={accent} opacity={0.9} rx={1}
                      />
                    )
                  })
                )}

                {/* Secret passage arrows */}
                {SECRET_PASSAGES.map((sp, i) => (
                  <g key={i}>
                    <text
                      x={sp.col * cellSize} y={sp.row * cellSize}
                      fontSize={Math.max(6, cellSize * 0.4)}
                      fill="#ccaa00" opacity={0.85}
                      fontFamily="monospace" textAnchor="middle" dominantBaseline="middle"
                    >
                      {sp.arrow}
                    </text>
                    <text
                      x={sp.col * cellSize} y={sp.row * cellSize + cellSize * 0.45}
                      fontSize={Math.max(3, cellSize * 0.15)}
                      fill="#887700" opacity={0.7}
                      fontFamily="'Press Start 2P', monospace"
                      textAnchor="middle" dominantBaseline="middle" letterSpacing="0.3"
                    >
                      {sp.label}
                    </text>
                  </g>
                ))}

                {/* Start labels */}
                {START_LABELS.map(({ charId, col, row, dir, label }) => {
                  const color = charColors[charId] ?? '#aaaaaa'
                  const cx = (col + 0.5) * cellSize, cy = (row + 0.5) * cellSize
                  const margin = cellSize * 0.6
                  let tx = cx, ty = cy, anchor = 'middle', rot = 0
                  if (dir === 'top')    { ty = -margin }
                  if (dir === 'bottom') { ty = boardH + margin }
                  if (dir === 'left')   { tx = -margin * 0.4; anchor = 'end'; rot = -90 }
                  if (dir === 'right')  { tx = boardW + margin * 0.4; anchor = 'start'; rot = 90 }
                  const lines = label.split('\n')
                  return (
                    <g key={charId} transform={rot ? `rotate(${rot},${tx},${ty})` : undefined}>
                      {lines.map((line, li) => (
                        <text key={li}
                          x={tx} y={ty + li * (lfs + 2) - ((lines.length - 1) * (lfs + 2)) / 2}
                          fontSize={lfs} fill={color} opacity={0.85}
                          fontFamily="'Press Start 2P', monospace"
                          textAnchor={anchor as 'middle' | 'end' | 'start'}
                          dominantBaseline="middle" letterSpacing="0.5"
                        >
                          {line}
                        </text>
                      ))}
                    </g>
                  )
                })}

                {/* Start dots */}
                {Object.entries(CHAR_STARTS).map(([charId, [sc, sr]]) => (
                  <circle key={charId}
                    cx={(sc + 0.5) * cellSize} cy={(sr + 0.5) * cellSize}
                    r={Math.max(2, cellSize * 0.12)}
                    fill={charColors[charId] ?? '#888'} opacity={0.55}
                  />
                ))}
              </svg>

              {/* Room name labels */}
              {Object.entries(ROOM_LABEL_ANCHORS).map(([roomId, [cx, cy]]) => (
                <div
                  key={roomId}
                  className="font-pixel pointer-events-none"
                  style={{
                    position: 'absolute',
                    left: cx * cellSize, top: cy * cellSize,
                    transform: 'translate(-50%, -50%)',
                    fontSize: Math.max(7, Math.floor(cellSize * 0.28)),
                    color: ROOM_LABEL_COLORS[roomId] ?? '#aaaaaa',
                    letterSpacing: '0.5px', textAlign: 'center',
                    lineHeight: 1.7, whiteSpace: 'pre-line',
                    textShadow: '1px 1px 0 #000, 0 0 8px #000000cc',
                    zIndex: 3, userSelect: 'none',
                  }}
                >
                  {ROOM_DISPLAY_NAMES[roomId]}
                </div>
              ))}

              {/* Center staircase */}
              <div
                className="pointer-events-none"
                style={{
                  position: 'absolute',
                  left: 9 * cellSize, top: 10 * cellSize,
                  width: 5 * cellSize, height: 6 * cellSize,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  zIndex: 4, background: '#020202', border: '1px solid #1a0010',
                }}
              >
                {[0.8, 0.65, 0.5].map((w, i) => (
                  <div key={i} style={{
                    width: `${w * 5 * cellSize}px`,
                    height: Math.max(3, cellSize * 0.22),
                    background: `#${['2a0008', '1e0006', '140004'][i]}`,
                    marginBottom: 1, flexShrink: 0,
                  }} />
                ))}
                <div style={{ fontFamily: 'monospace', fontSize: Math.max(10, cellSize * 0.55), color: '#660000', lineHeight: 1, margin: '2px 0' }}>✕</div>
                <div className="font-pixel" style={{
                  fontSize: Math.max(3, Math.floor(cellSize * 0.14)),
                  color: '#440010', letterSpacing: '0.8px', textAlign: 'center', lineHeight: 1.7,
                }}>
                  MURDER{'\n'}IN KUET
                </div>
              </div>

              {/* Board border */}
              <div style={{
                position: 'absolute', inset: 0,
                border: '3px solid #1a1200', outline: '2px solid #0a0a00',
                pointerEvents: 'none', zIndex: 5,
              }} />

              {/* Path dots */}
              {gamePhase === 'dice' && !isAiTurn && (
                <PathDots cells={pathCells} cellSize={cellSize} />
              )}

              {/* Player tokens — hidden while player is inside a room */}
              {boardPlayers.map((p, i) =>
                p.currentLocation === null ? (
                  <PlayerToken
                    key={p.id}
                    player={p}
                    cellSize={cellSize}
                    isSelected={i === currentTurnIndex}
                    playerIndex={i}
                    onClick={() => {}}
                  />
                ) : null
              )}
            </div>
          </CameraController>

          {/* Turn overlay — only for human turns */}
          <AnimatePresence>
            {gamePhase === 'idle' && currentPlayer && !isAiTurn && (
              <TurnOverlay
                key={currentTurnIndex}
                playerName={currentPlayer.name}
                playerIcon={currentPlayer.icon}
                playerColor={currentPlayer.accentColor}
                playerIndex={currentTurnIndex}
                onAction={handleAction}
                disabledActions={disabledActions as ('roll' | 'interrogation' | 'accusation' | 'cards')[]}
              />
            )}
          </AnimatePresence>

          {/* AI turn indicator */}
          <AnimatePresence>
            {gamePhase === 'idle' && currentPlayer && isAiTurn && (
              <motion.div
                key={`ai-indicator-${currentTurnIndex}`}
                style={{
                  position: 'absolute', bottom: 20, left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(0,0,0,0.88)',
                  border: `1px solid ${currentPlayer.accentColor}44`,
                  padding: '8px 18px',
                  display: 'flex', alignItems: 'center', gap: 10,
                  zIndex: 30,
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <motion.span
                  style={{ fontFamily: 'monospace', fontSize: 14, color: currentPlayer.accentColor }}
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 0.7, repeat: Infinity }}
                >
                  ⊛
                </motion.span>
                <div className="font-pixel" style={{ fontSize: '6px', color: currentPlayer.accentColor, letterSpacing: '1px' }}>
                  {currentPlayer.name} (AI) IS THINKING...
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Selection flow — interrogation or accusation (human turns only) */}
          <AnimatePresence>
            {(gamePhase === 'interrogation' || gamePhase === 'accusation') && !isAiTurn && (
              <SelectionFlow
                key={gamePhase}
                mode={gamePhase}
                onComplete={gamePhase === 'interrogation' ? handleInterrogationComplete : handleAccusationComplete}
                onCancel={handleSelectionCancel}
                lockedLocationCard={gamePhase === 'interrogation' ? lockedLocationCard : undefined}
              />
            )}
          </AnimatePresence>

          {/* Story screen */}
          <AnimatePresence>
            {gamePhase === 'story' && pendingReveal && (
              <StoryScreen
                key="story"
                story={storyText}
                suspectId={pendingReveal.suspectId}
                weaponId={pendingReveal.weaponId}
                locationId={pendingReveal.locationId}
                onContinue={handleStoryComplete}
              />
            )}
          </AnimatePresence>

          {/* Reveal result overlay */}
          <AnimatePresence>
            {(gamePhase === 'reveal_result' ||
              (gamePhase === 'game_over' && gameWinner !== null)
            ) && revealResult && (
              <RevealResultOverlay
                result={revealResult}
                caseFile={{
                  suspect:  { id: deal.caseFile.suspect.id,  icon: deal.caseFile.suspect.icon,  name: deal.caseFile.suspect.name  },
                  weapon:   { id: deal.caseFile.weapon.id,   icon: deal.caseFile.weapon.icon,   name: deal.caseFile.weapon.name   },
                  location: { id: deal.caseFile.location.id, icon: deal.caseFile.location.icon, name: deal.caseFile.location.name },
                }}
                onContinue={handleRevealContinue}
              />
            )}
          </AnimatePresence>

          {/* Game over popup */}
          <AnimatePresence>
            {gamePhase === 'game_over' && gameWinner === null && (
              <GameOverPopup
                key="game-over"
                caseFile={deal.caseFile}
                onExit={onExit}
                onRestart={onRestart}
              />
            )}
          </AnimatePresence>

          {/* Clue notebook overlay (human) */}
          <AnimatePresence>
            {showNotebook && !isAiTurn && (
              <ClueNotebook
                key="notebook"
                data={notebooks[currentTurnIndex] ?? notebooks[0]}
                onChange={(cat, cardId, state) =>
                  updateNotebookBox(currentTurnIndex, cat, cardId, state)
                }
                onClose={() => setShowNotebook(false)}
              />
            )}
          </AnimatePresence>

          {/* AI probability notebook overlay */}
          <AnimatePresence>
            {showAiNotebook && (
              <ProbabilityNotebook
                key="ai-notebook"
                data={probNotebooks[currentTurnIndex]}
                algorithm={currentSetup?.aiAlgorithm ?? 'rule_based'}
                onClose={() => setShowAiNotebook(false)}
              />
            )}
          </AnimatePresence>

          {/* Cards overlay */}
          <AnimatePresence>
            {showCards && (
              <motion.div
                key="cards-overlay"
                style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(0,0,0,0.92)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 46,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: 'linear' }}
                onClick={e => { if (e.target === e.currentTarget) setShowCards(false) }}
              >
                <motion.div
                  style={{
                    background: '#060208',
                    border: `2px solid ${currentPlayer?.accentColor ?? '#cc3355'}55`,
                    boxShadow: `0 0 50px ${currentPlayer?.accentColor ?? '#cc3355'}22`,
                    padding: '24px 28px',
                    maxWidth: 480,
                    width: '90%',
                    display: 'flex', flexDirection: 'column', gap: 0,
                  }}
                  initial={{ scale: 0.88, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: 'linear' }}
                  onClick={e => e.stopPropagation()}
                >
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 18, paddingBottom: 12,
                    borderBottom: `1px solid ${currentPlayer?.accentColor ?? '#cc3355'}33`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        fontFamily: 'monospace', fontSize: 20,
                        color: currentPlayer?.accentColor ?? '#cc3355',
                        lineHeight: 1,
                      }}>
                        {currentPlayer?.icon}
                      </span>
                      <div>
                        <div className="font-pixel" style={{ fontSize: '8px', color: currentPlayer?.accentColor ?? '#cc3355', letterSpacing: '2px' }}>
                          {currentPlayer?.name} — CARDS
                        </div>
                        <div className="font-pixel" style={{ fontSize: '5px', color: '#886644', letterSpacing: '0.8px', marginTop: 4 }}>
                          {deal.playerHands[currentTurnIndex]?.length ?? 0} CARDS IN HAND
                        </div>
                      </div>
                    </div>
                    <motion.button
                      className="font-pixel"
                      style={{
                        background: 'transparent',
                        border: `1px solid ${currentPlayer?.accentColor ?? '#cc3355'}55`,
                        color: currentPlayer?.accentColor ?? '#cc3355',
                        fontSize: '7px', padding: '5px 10px',
                        cursor: 'pointer', letterSpacing: '1px',
                      }}
                      whileHover={{ background: `${currentPlayer?.accentColor ?? '#cc3355'}22` }}
                      whileTap={{ scale: 0.94 }}
                      transition={{ duration: 0.06 }}
                      onClick={() => setShowCards(false)}
                    >
                      ✕ CLOSE
                    </motion.button>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {(deal.playerHands[currentTurnIndex] ?? []).map(card => (
                      <div
                        key={card.id}
                        style={{
                          background: card.bgColor,
                          border: `2px solid ${card.accentColor}44`,
                          padding: '10px 14px',
                          display: 'flex', alignItems: 'center', gap: 9,
                          minWidth: 140,
                        }}
                      >
                        <span style={{
                          fontFamily: 'monospace', fontSize: 18,
                          color: card.accentColor,
                          textShadow: `0 0 8px ${card.accentColor}55`,
                          lineHeight: 1, flexShrink: 0,
                        }}>
                          {card.icon}
                        </span>
                        <div>
                          <div className="font-pixel" style={{ fontSize: '5px', color: '#666', letterSpacing: '0.5px', marginBottom: 3 }}>
                            {card.category.toUpperCase()}
                          </div>
                          <div className="font-pixel" style={{ fontSize: '6px', color: card.accentColor, letterSpacing: '0.5px' }}>
                            {card.name.toUpperCase()}
                          </div>
                        </div>
                      </div>
                    ))}
                    {(deal.playerHands[currentTurnIndex]?.length ?? 0) === 0 && (
                      <div className="font-pixel" style={{ fontSize: '7px', color: '#554433', letterSpacing: '1px' }}>
                        NO CARDS DEALT
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Pause inspector overlay ─────────────────────────────────── */}
          <AnimatePresence>
            {isPaused && (
              <motion.div
                key="pause-inspector"
                style={{
                  position: 'absolute', inset: 0, zIndex: 60,
                  background: 'rgba(0,0,0,0.94)',
                  display: 'flex', flexDirection: 'column',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {/* Header bar */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px', borderBottom: '1px solid #330022',
                  background: '#0a0008', flexShrink: 0,
                }}>
                  <div className="font-pixel" style={{ fontSize: '8px', color: '#cc4488', letterSpacing: '3px' }}>
                    ⏸ PAUSED — INSPECT PLAYERS
                  </div>
                  <motion.button
                    className="font-pixel"
                    onClick={() => setIsPaused(false)}
                    style={{
                      background: '#2a0018', border: '2px solid #cc4488',
                      color: '#cc4488', fontSize: '7px',
                      letterSpacing: '1px', padding: '5px 14px', cursor: 'pointer',
                    }}
                    whileHover={{ background: '#cc4488', color: '#000' }}
                    transition={{ duration: 0.08 }}
                  >
                    ▶ RESUME
                  </motion.button>
                </div>

                {/* Player tab row */}
                <div style={{
                  display: 'flex', gap: 4, padding: '8px 12px',
                  background: '#060006', borderBottom: '1px solid #220014',
                  flexShrink: 0, flexWrap: 'wrap',
                }}>
                  {boardPlayers.map((p, i) => {
                    const isActive = i === pauseViewIdx
                    const isElim   = playerStatus[i]?.eliminated
                    const pSetup   = players[i]
                    return (
                      <motion.button
                        key={p.id}
                        className="font-pixel"
                        onClick={() => setPauseViewIdx(i)}
                        style={{
                          background: isActive ? p.accentColor : 'transparent',
                          border: `1px solid ${isActive ? p.accentColor : p.accentColor + '44'}`,
                          color: isActive ? '#000' : (isElim ? '#444' : p.accentColor),
                          fontSize: '5px', letterSpacing: '0.8px',
                          padding: '4px 10px', cursor: 'pointer',
                          opacity: isElim ? 0.5 : 1,
                        }}
                        whileHover={!isActive ? { background: p.accentColor + '22' } : {}}
                        transition={{ duration: 0.06 }}
                      >
                        {p.icon} P{i + 1} · {p.name.slice(0, 8)}
                        {pSetup?.type === 'computer' ? ' ⊛' : ' ◇'}
                        {isElim ? ' ✗' : ''}
                      </motion.button>
                    )
                  })}
                </div>

                {/* Inspector body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                  {(() => {
                    const pi    = pauseViewIdx
                    const p     = boardPlayers[pi]
                    const pSetup = players[pi]
                    const isElim = playerStatus[pi]?.eliminated
                    const roomName = p?.currentLocation
                      ? (ROOM_DISPLAY_NAMES[p.currentLocation] ?? p.currentLocation).replace('\n', ' ')
                      : 'HALLWAY'

                    return (
                      <div style={{ maxWidth: 700, margin: '0 auto' }}>
                        {/* Player header */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          marginBottom: 18, paddingBottom: 12,
                          borderBottom: `1px solid ${p?.accentColor ?? '#444'}33`,
                        }}>
                          <span style={{
                            fontFamily: 'monospace', fontSize: 28,
                            color: isElim ? '#444' : (p?.accentColor ?? '#fff'),
                            textShadow: isElim ? 'none' : `0 0 12px ${p?.accentColor}88`,
                          }}>
                            {p?.icon}
                          </span>
                          <div>
                            <div className="font-pixel" style={{
                              fontSize: '9px', letterSpacing: '2px',
                              color: isElim ? '#553333' : (p?.accentColor ?? '#fff'),
                              marginBottom: 4,
                            }}>
                              P{pi + 1} · {p?.name}
                              {pSetup?.type === 'computer' ? ` · AI (${(pSetup.aiAlgorithm ?? 'rule_based').toUpperCase().replace('_', '-')})` : ' · HUMAN'}
                              {isElim ? ' · ELIMINATED' : ''}
                            </div>
                            <div className="font-pixel" style={{ fontSize: '5px', color: '#664444', letterSpacing: '0.8px' }}>
                              [{String(p?.position[0] ?? 0).padStart(2,'0')},{String(p?.position[1] ?? 0).padStart(2,'0')}] {roomName}
                              {' · '}{deal.playerHands[pi]?.length ?? 0} CARDS
                              {playerStatus[pi]?.hasAccused ? ' · ACCUSED' : ''}
                            </div>
                          </div>
                        </div>

                        {pSetup?.type === 'computer' && pSetup.aiAlgorithm ? (
                          /* AI player — show full probability notebook */
                          <ProbabilityNotebook
                            data={probNotebooks[pi]}
                            algorithm={pSetup.aiAlgorithm}
                            compact={false}
                          />
                        ) : (
                          /* Human player — show their hand */
                          <div>
                            <div className="font-pixel" style={{
                              fontSize: '6px', color: '#44cc88', letterSpacing: '1.5px',
                              marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #1a3322',
                            }}>
                              ── HAND CARDS
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                              {(deal.playerHands[pi] ?? []).map(card => (
                                <div key={card.id} style={{
                                  background: card.bgColor,
                                  border: `2px solid ${card.accentColor}44`,
                                  padding: '10px 14px',
                                  display: 'flex', alignItems: 'center', gap: 9,
                                  minWidth: 140,
                                }}>
                                  <span style={{
                                    fontFamily: 'monospace', fontSize: 18,
                                    color: card.accentColor,
                                    textShadow: `0 0 8px ${card.accentColor}55`,
                                    lineHeight: 1, flexShrink: 0,
                                  }}>
                                    {card.icon}
                                  </span>
                                  <div>
                                    <div className="font-pixel" style={{ fontSize: '5px', color: '#666', letterSpacing: '0.5px', marginBottom: 3 }}>
                                      {card.category.toUpperCase()}
                                    </div>
                                    <div className="font-pixel" style={{ fontSize: '6px', color: card.accentColor }}>
                                      {card.name.toUpperCase()}
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {(deal.playerHands[pi]?.length ?? 0) === 0 && (
                                <div className="font-pixel" style={{ fontSize: '7px', color: '#554433' }}>
                                  NO CARDS DEALT
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hand overlay (human dice roll) */}
          <AnimatePresence>
            {gamePhase === 'rolling' && !isAiTurn && (
              <HandOverlay onRelease={handleDiceRelease} />
            )}
          </AnimatePresence>

          {/* Dice — top-left of board area */}
          {(gamePhase === 'dice' || gamePhase === 'moving') && diceValue !== null && (
            <motion.div
              style={{ position: 'absolute', top: 14, left: 14, zIndex: 20 }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.15, ease: 'linear' }}
            >
              <Dice value={diceValue} rolling={diceRolling} onSettled={handleDiceSettled} />
              {!diceRolling && diceValue !== null && (
                <>
                  <div className="font-pixel" style={{
                    marginTop: 6, fontSize: '7px', color: '#ffdd00',
                    letterSpacing: '1px', textAlign: 'center',
                  }}>
                    STEPS: {remainingMoves}
                  </div>
                  {gamePhase === 'dice' && remainingMoves > 0 && !isAiTurn && (
                    <motion.div
                      className="font-pixel"
                      style={{
                        marginTop: 4, fontSize: '5px', color: '#cc9933',
                        letterSpacing: '0.5px', textAlign: 'center', lineHeight: 1.8,
                      }}
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <div>↑↓←→ MOVE</div>
                      <div>[SPC] SKIP</div>
                    </motion.div>
                  )}

                  {/* Pause button — visible whenever any AI player exists */}
                  {players.some(p => p.type === 'computer') && (
                    <motion.button
                      className="font-pixel"
                      onClick={() => { setIsPaused(true); setPauseViewIdx(currentTurnIndex) }}
                      style={{
                        marginTop: 8, width: '100%',
                        background: '#1a0010', border: '1px solid #660044',
                        color: '#cc4488', fontSize: '6px',
                        letterSpacing: '1px', padding: '4px 0', cursor: 'pointer',
                      }}
                      whileHover={{ background: '#330020', color: '#ff66aa' }}
                      transition={{ duration: 0.06 }}
                    >
                      ⏸ PAUSE
                    </motion.button>
                  )}
                </>
              )}
            </motion.div>
          )}
        </div>

        {/* Sidebar */}
        <div
          className="font-pixel flex flex-col shrink-0"
          style={{
            width: SIDEBAR_W, background: '#050208',
            borderLeft: '2px solid #150012',
            padding: '14px 10px 12px', overflowY: 'auto',
          }}
        >
          <div style={{ fontSize: '7px', color: '#cc3355', letterSpacing: '2px', marginBottom: 14 }}>
            ── SUSPECTS ──
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {boardPlayers.map((p, i) => {
              const isTurn = i === currentTurnIndex
              const roomName = p.currentLocation
                ? (ROOM_DISPLAY_NAMES[p.currentLocation] ?? p.currentLocation).replace('\n', ' ')
                : 'HALLWAY'
              const pSetup = players[i]
              const isElim = playerStatus[i]?.eliminated
              const isAi   = pSetup?.type === 'computer'
              const algo   = pSetup?.aiAlgorithm
              return (
                <div
                  key={p.id}
                  style={{
                    background: isTurn ? 'rgba(80,0,30,0.35)' : 'transparent',
                    border: isTurn ? `1px solid ${p.accentColor}55` : '1px solid #120010',
                    padding: '7px 8px',
                    opacity: isElim ? 0.5 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 15, color: isElim ? '#444' : p.accentColor,
                      textShadow: isTurn && !isElim ? `0 0 7px ${p.accentColor}88` : 'none',
                      lineHeight: 1, flexShrink: 0,
                    }}>{p.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '6px',
                        color: isElim ? '#553333' : isTurn ? '#ffdd00' : '#cc9944',
                        letterSpacing: '1.2px', marginBottom: 2,
                      }}>P{i + 1} · {p.name}</div>
                      <div style={{ fontSize: '5px', color: '#aa7733', letterSpacing: '0.5px' }}>
                        {isAi ? `AI${algo ? ` · ${algo.toUpperCase().replace('_','-')}` : ''}` : 'HUMAN'} · {deal.playerHands[i]?.length ?? 0}♠
                      </div>
                    </div>
                    {isTurn && !isElim && (
                      <motion.span
                        style={{ fontSize: '7px', color: '#ff3344', flexShrink: 0 }}
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 0.65, repeat: Infinity }}
                      >●</motion.span>
                    )}
                  </div>
                  <div style={{ fontSize: '5px', color: isTurn ? '#998844' : '#776633', letterSpacing: '0.5px' }}>
                    [{String(p.position[0]).padStart(2,'0')},{String(p.position[1]).padStart(2,'0')}] {roomName}
                  </div>
                  {isElim && (
                    <div style={{ fontSize: '5px', color: '#ee3333', letterSpacing: '0.5px', marginTop: 3 }}>
                      ✗ ELIMINATED
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{
            height: 1,
            background: 'repeating-linear-gradient(90deg,#551133 0,#551133 4px,transparent 4px,transparent 8px)',
            margin: '14px 0',
          }} />

          {/* AI Probability Notebook — compact sidebar view for current AI player */}
          {isAiTurn && currentSetup?.aiAlgorithm && (
            <>
              <div style={{ marginBottom: 8 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 6,
                }}>
                  <div style={{ fontSize: '6px', color: '#44cc88', letterSpacing: '1px' }}>
                    AI NOTEBOOK
                  </div>
                  <motion.button
                    className="font-pixel"
                    style={{
                      fontSize: '4px', color: '#44cc88',
                      background: 'transparent', border: '1px solid #44cc8833',
                      padding: '2px 6px', cursor: 'pointer', letterSpacing: '0.5px',
                    }}
                    whileHover={{ background: '#44cc8822' }}
                    onClick={() => setShowAiNotebook(true)}
                  >
                    EXPAND ▸
                  </motion.button>
                </div>
                <ProbabilityNotebook
                  data={probNotebooks[currentTurnIndex]}
                  algorithm={currentSetup.aiAlgorithm}
                  compact
                />
              </div>
              <div style={{
                height: 1,
                background: 'repeating-linear-gradient(90deg,#224433 0,#224433 4px,transparent 4px,transparent 8px)',
                margin: '8px 0 14px',
              }} />
            </>
          )}

          {/* Phase info */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '6px', color: '#bb3355', letterSpacing: '1px', marginBottom: 8 }}>
              PHASE
            </div>
            <div style={{ fontSize: '6px', color: '#ff9944', letterSpacing: '1px' }}>
              {gamePhase === 'idle'          && '⬥ AWAITING ACTION'}
              {gamePhase === 'rolling'       && '⬥ ROLLING DICE'}
              {gamePhase === 'dice'          && `⬥ MOVING (${remainingMoves} LEFT)`}
              {gamePhase === 'moving'        && '⬥ MOVING'}
              {gamePhase === 'interrogation' && '⬥ INTERROGATION'}
              {gamePhase === 'accusation'    && '⬥ ACCUSATION'}
              {gamePhase === 'story'         && '⬥ CRIME THEORY'}
              {gamePhase === 'reveal_result' && '⬥ RESULT'}
              {gamePhase === 'game_over'     && '⬥ GAME OVER'}
            </div>
            {gamePhase === 'dice' && remainingMoves > 0 && !isAiTurn && (
              <div style={{ fontSize: '5px', color: '#cc9933', marginTop: 6, letterSpacing: '0.5px' }}>
                ↑↓←→ TO MOVE · SPC TO SKIP
              </div>
            )}
          </div>

          {!isAiTurn && (
            <div style={{ fontSize: '6px', color: '#8a5566', letterSpacing: '0.5px', lineHeight: 2.2 }}>
              <div style={{ color: '#bb4466', marginBottom: 4 }}>── CONTROLS ──</div>
              <div>[ENTER]  CONFIRM</div>
              <div>[↑↓←→]  MOVE</div>
              <div>[SPC]   SKIP MOVE</div>
            </div>
          )}

          {gameMode === 'ai_vs_ai' && (
            <div style={{ fontSize: '5px', color: '#334433', letterSpacing: '0.5px', lineHeight: 2, marginTop: 8 }}>
              <div style={{ color: '#446644', marginBottom: 4 }}>── OBSERVATION MODE ──</div>
              <div>AI VS AI — WATCH & ANALYZE</div>
              <div>PROBABILITY UPDATES LIVE</div>
            </div>
          )}

          <div style={{ flex: 1 }} />

          <div style={{
            borderTop: '1px solid #331120', paddingTop: 10,
            fontSize: '6px', color: '#7a4422', letterSpacing: '0.5px', lineHeight: 2,
          }}>
            <div>FIND THE KILLER</div>
            <div>SOLVE THE CASE</div>
          </div>
        </div>
      </div>
    </div>
  )
}
