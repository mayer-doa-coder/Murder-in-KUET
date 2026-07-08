// WaitingRoomScreen — live roster of everyone who has joined a room. The host may
// start once at least MIN_PLAYERS are present; everyone else waits for the host.

import { motion } from 'framer-motion'
import type { OnlineGame } from '../hooks/useOnlineGame'

interface Props {
  online: OnlineGame
  onLeave: () => void
}

export default function WaitingRoomScreen({ online, onLeave }: Props) {
  const room = online.roomUpdate
  const myIndex = online.session?.playerIndex ?? -1
  if (!room) return null

  const amHost = myIndex === room.hostIndex
  const canStart = room.players.length >= room.minPlayers

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden" style={{ background: '#060400' }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(92,60,0,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(92,60,0,0.05) 1px,transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <motion.div className="relative z-10 text-center" style={{ marginBottom: 20 }}
        initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="font-pixel" style={{ fontSize: '8px', color: '#886633', letterSpacing: '3px', marginBottom: 10 }}>
          ROOM CODE — SHARE TO INVITE
        </div>
        <div className="font-pixel" style={{ fontSize: 'clamp(30px, 6vw, 52px)', color: '#ffdd44', letterSpacing: '10px', textShadow: '3px 3px 0 #3d2200, 0 0 24px #b8860b55' }}>
          {room.code}
        </div>
      </motion.div>

      <div className="relative z-10 flex flex-col gap-2" style={{ width: '100%', maxWidth: 380, padding: '0 24px' }}>
        <div className="font-pixel" style={{ fontSize: '8px', color: '#886633', letterSpacing: '2px', marginBottom: 4 }}>
          PLAYERS {room.players.length}/{room.maxPlayers}
        </div>
        {room.players.map(p => (
          <motion.div key={p.index} layout
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: p.index === myIndex ? 'rgba(40,25,0,0.9)' : 'rgba(20,12,0,0.6)',
              border: `2px solid ${p.index === myIndex ? '#7a4c00' : '#2a1800'}`,
              padding: '10px 14px',
            }}>
            <span className="font-pixel" style={{ fontSize: '11px', color: '#e8c060' }}>{p.index + 1}</span>
            <span className="font-pixel" style={{ flex: 1, fontSize: '10px', color: p.connected ? '#e8c060' : '#775533', letterSpacing: '1px' }}>
              {p.name.toUpperCase()}{p.index === myIndex ? '  (YOU)' : ''}
            </span>
            {p.isHost && <span className="font-pixel" style={{ fontSize: '7px', color: '#ffaa22', letterSpacing: '1px' }}>HOST</span>}
            {!p.connected && <span className="font-pixel" style={{ fontSize: '7px', color: '#cc4422' }}>○ AWAY</span>}
          </motion.div>
        ))}

        <div style={{ marginTop: 14 }}>
          {amHost ? (
            <motion.button className="font-pixel" onClick={online.startGame} disabled={!canStart}
              whileHover={canStart ? { y: -2 } : {}} whileTap={canStart ? { y: 3 } : {}}
              style={{
                width: '100%', padding: '13px', fontSize: '11px', letterSpacing: '2px',
                background: canStart ? '#3d2200' : '#1a1000',
                border: `3px solid ${canStart ? '#7a4c00' : '#3a2600'}`,
                color: canStart ? '#e8c060' : '#5a4420',
                boxShadow: '4px 4px 0 #1a0f00',
                cursor: canStart ? 'pointer' : 'not-allowed',
              }}>
              {canStart ? '► START GAME' : `NEED ${room.minPlayers}+ PLAYERS`}
            </motion.button>
          ) : (
            <motion.div className="font-pixel" style={{ textAlign: 'center', fontSize: '9px', color: '#ccaa00', letterSpacing: '2px', padding: '13px' }}
              animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.6, repeat: Infinity }}>
              WAITING FOR HOST TO START…
            </motion.div>
          )}
        </div>

        {online.error && (
          <div className="font-pixel" style={{ fontSize: '8px', color: '#ff6644', letterSpacing: '1px', textAlign: 'center' }}>
            ⚠ {online.error.toUpperCase()}
          </div>
        )}

        <button className="font-pixel" onClick={onLeave}
          style={{ marginTop: 6, background: 'none', border: 'none', color: '#664433', fontSize: '8px', letterSpacing: '2px', cursor: 'pointer' }}>
          ◄ LEAVE ROOM
        </button>
      </div>
    </div>
  )
}
