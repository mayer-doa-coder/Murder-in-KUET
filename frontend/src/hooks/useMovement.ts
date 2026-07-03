import { useEffect, useCallback } from 'react'
import type { Cell, BoardPlayer } from './useBoard'
import {
  COLS, ROWS, DOOR_POSITIONS,
  getReachableCells, getPassageDoors, findPath,
  ROOM_TO_LOCATION_CARD,
} from './useBoard'
import type { PlayerSetup } from '../types'
import { aiChooseCell } from '../lib/aiEngine'
import type { GameStateValues } from './useGameState'
import type { NotebooksValues } from './useNotebooks'

interface Params {
  gs: GameStateValues
  nb: NotebooksValues
  board: Cell[][]
  // The suspect token the current player is moving this turn (chosen at turn start).
  movingToken: BoardPlayer | undefined
  isAiTurn: boolean
  currentSetup: PlayerSetup | undefined
  cellSize: number
  movePlayer: (id: string, pos: [number, number]) => void
  enterRoom: (id: string, roomId: string) => void
  exitRoom:  (id: string) => void
  // Ends the movement portion of the turn: returns to idle so the player may
  // interrogate (if the token is now in a room) or end the turn.
  finishMove: () => void
}

export function useMovement({
  gs, nb,
  board, movingToken, isAiTurn, currentSetup,
  cellSize, movePlayer, enterRoom, exitRoom, finishMove,
}: Params): {
  handleDiceRelease: () => void
  handleDiceSettled: () => void
  handleGridClick:   (e: React.MouseEvent<HTMLDivElement>) => void
} {
  const {
    gamePhase, setGamePhase,
    diceValue, setDiceValue, setDiceRolling,
    setPathCells, passageCells, setPassageCells,
    setMovePath, setMoveStep, moveStep, movePath,
    setRemainingMoves, remainingMovesRef, positionRef,
    currentTurnIndex, isPaused, ms,
  } = gs
  const { probNotebooks } = nb

  // ── Dice release (human hold-to-roll) ──────────────────────────────────────
  const handleDiceRelease = useCallback(() => {
    const value = Math.ceil(Math.random() * 6)
    setDiceValue(value)
    setDiceRolling(true)
    setGamePhase('dice')
  }, [setDiceValue, setDiceRolling, setGamePhase])

  // ── Dice settled ───────────────────────────────────────────────────────────
  const handleDiceSettled = useCallback(() => {
    setDiceRolling(false)
    if (diceValue === null || !movingToken) return
    const cells = getReachableCells(board, movingToken.position, diceValue)

    const passageDoors = movingToken.currentLocation
      ? getPassageDoors(movingToken.currentLocation)
      : []
    setPassageCells(passageDoors)

    if (cells.length === 0 && passageDoors.length === 0) {
      finishMove()
      return
    }
    setPathCells(cells)
    remainingMovesRef.current = diceValue
    setRemainingMoves(diceValue)

    if (isAiTurn) {
      const algo = currentSetup?.aiAlgorithm ?? 'rule_based'
      const allCells = [...cells, ...passageDoors]
      const target = aiChooseCell(
        allCells, board, probNotebooks[currentTurnIndex], algo, ROOM_TO_LOCATION_CARD
      )
      if (target) {
        const isPassageTarget = passageDoors.some(([pc, pr]) => pc === target[0] && pr === target[1])
        if (isPassageTarget) {
          const destRoomId = Object.entries(DOOR_POSITIONS).find(([, doors]) =>
            doors.some(([dc, dr]) => dc === target[0] && dr === target[1])
          )?.[0]
          if (destRoomId) {
            movePlayer(movingToken.id, target)
            enterRoom(movingToken.id, destRoomId)
            setPassageCells([])
            setPathCells([])
            finishMove()
            return
          }
        }
        const path = findPath(board, movingToken.position, target)
        if (path.length > 0) {
          setMovePath(path)
          setMoveStep(0)
          setPathCells([])
          setPassageCells([])
          setGamePhase('moving')
          return
        }
      }
      finishMove()
    }
  }, [
    diceValue, movingToken, board, finishMove, isAiTurn, currentSetup,
    probNotebooks, currentTurnIndex, movePlayer, enterRoom,
    setDiceRolling, setPassageCells, setPathCells, setMovePath, setMoveStep,
    setRemainingMoves, remainingMovesRef, setGamePhase,
  ])

  // ── Grid click (passage teleport for human) ────────────────────────────────
  const handleGridClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (gamePhase !== 'dice' || isAiTurn || !movingToken) return
      const rect = e.currentTarget.getBoundingClientRect()
      const col = Math.floor((e.clientX - rect.left) / cellSize)
      const row = Math.floor((e.clientY - rect.top) / cellSize)
      const isPassage = passageCells.some(([pc, pr]) => pc === col && pr === row)
      if (!isPassage) return
      const destRoomId = Object.entries(DOOR_POSITIONS).find(([, doors]) =>
        doors.some(([dc, dr]) => dc === col && dr === row)
      )?.[0]
      if (destRoomId) {
        movePlayer(movingToken.id, [col, row])
        enterRoom(movingToken.id, destRoomId)
        setPassageCells([])
        setPathCells([])
        remainingMovesRef.current = 0
        setRemainingMoves(0)
        finishMove()
      }
    },
    [
      gamePhase, isAiTurn, movingToken, passageCells, cellSize,
      movePlayer, enterRoom, setPassageCells, setPathCells,
      remainingMovesRef, setRemainingMoves, finishMove,
    ]
  )

  // ── Arrow-key step-by-step movement (human only) ──────────────────────────
  useEffect(() => {
    if (gamePhase !== 'dice' || isAiTurn) return

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ') {
        if (remainingMovesRef.current > 0) {
          e.preventDefault()
          setPathCells([])
          remainingMovesRef.current = 0
          setRemainingMoves(0)
          finishMove()
        }
        return
      }

      const DIRS: Record<string, [number, number]> = {
        ArrowUp:    [0, -1],
        ArrowDown:  [0,  1],
        ArrowLeft:  [-1, 0],
        ArrowRight: [ 1, 0],
      }
      const dir = DIRS[e.key]
      if (!dir) return
      e.preventDefault()

      if (remainingMovesRef.current <= 0) return
      const token = movingToken
      if (!token) return

      if (token.currentLocation !== null) exitRoom(token.id)

      const [dc, dr] = dir
      const [cc, cr] = positionRef.current
      const nc = cc + dc, nr = cr + dr

      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) return
      const cell = board[nr]?.[nc]
      if (!cell || !cell.isWalkable) return

      positionRef.current = [nc, nr]
      remainingMovesRef.current -= 1

      movePlayer(token.id, [nc, nr])
      setRemainingMoves(remainingMovesRef.current)

      if (remainingMovesRef.current > 0) {
        const newReachable = getReachableCells(board, [nc, nr], remainingMovesRef.current)
        setPathCells(newReachable)
      } else {
        setPathCells([])
      }

      if (cell.type === 'door' && cell.roomId) {
        enterRoom(token.id, cell.roomId)
        setPathCells([])
        remainingMovesRef.current = 0
        setRemainingMoves(0)
        finishMove()
        return
      }

      if (remainingMovesRef.current <= 0) {
        finishMove()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    gamePhase, isAiTurn, movingToken, board,
    movePlayer, exitRoom, enterRoom, finishMove,
    positionRef, remainingMovesRef, setPathCells, setRemainingMoves,
  ])

  // ── Step-by-step movement animation ──────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'moving' || movePath.length === 0 || isPaused) return
    const delay = moveStep >= movePath.length ? 0 : ms(isAiTurn ? 30 : 130)
    const t = setTimeout(() => {
      if (moveStep >= movePath.length) {
        const finalPos = movePath[movePath.length - 1]
        if (finalPos && movingToken) {
          const [fc, fr] = finalPos
          const cell = board[fr]?.[fc]
          if (cell?.type === 'door' && cell.roomId) {
            enterRoom(movingToken.id, cell.roomId)
          }
        }
        finishMove()
      } else {
        const [col, row] = movePath[moveStep]
        if (movingToken) movePlayer(movingToken.id, [col, row])
        setMoveStep(s => s + 1)
      }
    }, delay)
    return () => clearTimeout(t)
  }, [
    gamePhase, movePath, moveStep, movingToken,
    movePlayer, finishMove, board, enterRoom, isAiTurn, ms, isPaused,
    setMoveStep,
  ])

  return { handleDiceRelease, handleDiceSettled, handleGridClick }
}
