// OnlineLobbyScreen — create a new room or join an existing one by code. All the
// heavy lifting lives in useOnlineGame; this screen is just the entry form.

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { OnlineGame } from '../hooks/useOnlineGame'

interface Props {
  online: OnlineGame
  onBack: () => void
}

const box: React.CSSProperties = {
  background: '#0d0800',
  border: '2px solid #5c3d00',
  color: '#e8c060',
  padding: '10px 12px',
  fontSize: '11px',
  letterSpacing: '2px',
  outline: 'none',
  width: '100%',
  textAlign: 'center',
}

function Btn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <motion.button
      className="font-pixel"
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { y: -2 }}
      whileTap={disabled ? {} : { y: 3 }}
      style={{
        background: disabled ? '#1a1000' : '#3d2200',
        border: `3px solid ${disabled ? '#3a2600' : '#7a4c00'}`,
        color: disabled ? '#5a4420' : '#e8c060',
        padding: '11px 20px',
        fontSize: '10px',
        letterSpacing: '2px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: '4px 4px 0 #1a0f00',
        width: '100%',
      }}
    >
      {label}
    </motion.button>
  )
}

export default function OnlineLobbyScreen({ online, onBack }: Props) {
  const [name, setName]   = useState('')
  const [code, setCode]   = useState('')
  const [mode, setMode]   = useState<'menu' | 'create' | 'join'>('menu')

  useEffect(() => { online.clearError() }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const canConnect = online.status === 'connected'
  const nameOk = name.trim().length >= 1

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden" style={{ background: '#060400' }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(92,60,0,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(92,60,0,0.05) 1px,transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <motion.div className="relative z-10 text-center" style={{ marginBottom: 26 }}
        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="font-pixel" style={{ fontSize: '9px', color: '#5c3d00', letterSpacing: '4px', marginBottom: 12 }}>
          ─── MURDER IN KUET ───
        </div>
        <div className="font-pixel" style={{ fontSize: 'clamp(16px, 2.6vw, 24px)', color: '#e8c060', letterSpacing: '4px', textShadow: '3px 3px 0 #3d2200' }}>
          ONLINE MULTIPLAYER
        </div>
      </motion.div>

      <div className="relative z-10 flex flex-col gap-4" style={{ width: '100%', maxWidth: 360, padding: '0 24px' }}>
        {/* Connection status */}
        <div className="font-pixel" style={{ fontSize: '8px', letterSpacing: '1px', textAlign: 'center',
          color: canConnect ? '#33cc55' : online.status === 'connecting' ? '#ccaa00' : '#cc4422' }}>
          ● {online.status === 'connected' ? 'CONNECTED' : online.status === 'connecting' ? 'CONNECTING…' : 'OFFLINE — SERVER UNREACHABLE'}
        </div>

        <input className="font-pixel" style={box} placeholder="YOUR NAME" value={name} maxLength={16}
          onChange={e => setName(e.target.value)} />

        {mode === 'menu' && (
          <>
            <Btn label="► CREATE ROOM" disabled={!canConnect || !nameOk} onClick={() => setMode('create')} />
            <Btn label="► JOIN ROOM" disabled={!canConnect || !nameOk} onClick={() => setMode('join')} />
          </>
        )}

        {mode === 'create' && (
          <>
            <div className="font-pixel" style={{ fontSize: '7px', color: '#886633', letterSpacing: '1px', textAlign: 'center', lineHeight: 1.8 }}>
              A 4-LETTER CODE WILL BE GENERATED TO SHARE WITH 2–5 FRIENDS.
            </div>
            <Btn label="✦ CREATE & GET CODE" disabled={!canConnect || !nameOk} onClick={() => online.createRoom(name.trim())} />
            <Btn label="◄ BACK" onClick={() => setMode('menu')} />
          </>
        )}

        {mode === 'join' && (
          <>
            <input className="font-pixel" style={{ ...box, letterSpacing: '6px' }} placeholder="ROOM CODE" value={code} maxLength={8}
              onChange={e => setCode(e.target.value.toUpperCase())} />
            <Btn label="► JOIN" disabled={!canConnect || !nameOk || code.trim().length < 3}
              onClick={() => online.joinRoom(code.trim(), name.trim())} />
            <Btn label="◄ BACK" onClick={() => setMode('menu')} />
          </>
        )}

        {online.error && (
          <motion.div className="font-pixel" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ fontSize: '8px', color: '#ff6644', letterSpacing: '1px', textAlign: 'center', marginTop: 4 }}>
            ⚠ {online.error.toUpperCase()}
          </motion.div>
        )}

        <button className="font-pixel" onClick={onBack}
          style={{ marginTop: 10, background: 'none', border: 'none', color: '#664433', fontSize: '8px', letterSpacing: '2px', cursor: 'pointer' }}>
          ◄ LEAVE ONLINE MODE
        </button>
      </div>
    </div>
  )
}
