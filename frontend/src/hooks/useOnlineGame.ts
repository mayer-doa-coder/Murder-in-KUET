// useOnlineGame.ts — Owns the Socket.IO connection to the authoritative server
// and exposes an interface the online screens consume: the latest redacted
// snapshot, lobby roster, and action senders. All rules live on the server; this
// hook never computes game logic — it only ships intent and renders snapshots.

import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { GameView, RoomUpdate, GameAction, YouAre } from '../shared/protocol'
import { EV } from '../shared/protocol'

const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? 'http://localhost:8787'
const STORE_KEY = 'mik_online_session'

export type OnlineStatus = 'connecting' | 'connected' | 'disconnected'

export interface OnlineSession {
  code:        string
  token:       string
  playerIndex: number
}

function loadSession(): OnlineSession | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as OnlineSession) : null
  } catch { return null }
}
function saveSession(s: OnlineSession | null): void {
  try {
    if (s) localStorage.setItem(STORE_KEY, JSON.stringify(s))
    else localStorage.removeItem(STORE_KEY)
  } catch { /* ignore */ }
}

export interface OnlineGame {
  status:     OnlineStatus
  error:      string | null
  clearError: () => void
  session:    OnlineSession | null
  roomUpdate: RoomUpdate | null
  view:       GameView | null
  createRoom: (name: string) => void
  joinRoom:   (code: string, name: string) => void
  startGame:  () => void
  leaveRoom:  () => void
  send:       (action: GameAction) => void
}

export function useOnlineGame(active: boolean): OnlineGame {
  const [status, setStatus]         = useState<OnlineStatus>('disconnected')
  const [error, setError]           = useState<string | null>(null)
  const [session, setSession]       = useState<OnlineSession | null>(null)
  const [roomUpdate, setRoomUpdate] = useState<RoomUpdate | null>(null)
  const [view, setView]             = useState<GameView | null>(null)
  const socketRef                   = useRef<Socket | null>(null)
  const sessionRef                  = useRef<OnlineSession | null>(null)

  useEffect(() => { sessionRef.current = session }, [session])

  // Connect once the online flow becomes active; tear down when it leaves.
  useEffect(() => {
    if (!active) return
    setStatus('connecting')
    const socket = io(WS_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', () => {
      setStatus('connected')
      // Attempt to resume an in-progress seat after a reload/disconnect.
      const saved = loadSession()
      if (saved) {
        setSession(saved)
        socket.emit(EV.reconnect, { code: saved.code, token: saved.token })
      }
    })
    socket.on('disconnect', () => setStatus('disconnected'))
    socket.io.on('reconnect', () => setStatus('connected'))

    socket.on(EV.youAre, (p: YouAre) => {
      const s: OnlineSession = { code: p.code, token: p.token, playerIndex: p.playerIndex }
      setSession(s)
      saveSession(s)
    })
    socket.on(EV.roomUpdate, (u: RoomUpdate) => { setRoomUpdate(u); setView(null) })
    socket.on(EV.gameView, (v: GameView) => setView(v))
    socket.on(EV.errorMsg, (e: { message: string }) => setError(e.message))

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
  }, [active])

  const createRoom = useCallback((name: string) => {
    socketRef.current?.emit(EV.createRoom, { name })
  }, [])
  const joinRoom = useCallback((code: string, name: string) => {
    socketRef.current?.emit(EV.joinRoom, { code, name })
  }, [])
  const startGame = useCallback(() => {
    socketRef.current?.emit(EV.startGame)
  }, [])
  const send = useCallback((action: GameAction) => {
    socketRef.current?.emit(EV.action, action)
  }, [])
  const leaveRoom = useCallback(() => {
    socketRef.current?.emit(EV.leaveRoom)
    saveSession(null)
    setSession(null); setRoomUpdate(null); setView(null)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return {
    status, error, clearError, session, roomUpdate, view,
    createRoom, joinRoom, startGame, leaveRoom, send,
  }
}
