import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PixelButton from '../components/PixelButton'

interface Props {
  onSkip: () => void
}

// ── Screen-local atmospheric particles ──────────────────────────────────────
const SHARD_SHAPES = [
  'polygon(50% 0%, 0% 100%, 100% 100%)',
  'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  'polygon(15% 0%, 85% 8%, 100% 72%, 50% 100%, 0% 68%)',
]
const PARTICLES = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  left: `${5 + i * 9.5}%`,
  bottom: `${(i * 15) % 60}%`,
  size: 7 + (i % 4) * 5,
  shape: SHARD_SHAPES[i % 3],
  color: ['#1e0000', '#3a0000', '#ffffff11', '#8b0000'][i % 4],
  delay: -((i * 2.1) % 16),
  duration: 14 + (i % 5) * 3,
}))

const SECTIONS = [
  {
    id: 'objective',
    label: 'OBJECTIVE',
    icon: '✦',
    color: '#cc4422',
    accent: '#ff6644',
    content: [
      {
        heading: 'THE CRIME',
        icon: '☠',
        text: 'A BODY HAS BEEN DISCOVERED ON KUET CAMPUS. THE MURDERER, THE WEAPON USED, AND THE EXACT LOCATION OF THE CRIME ARE UNKNOWN. THREE CARDS — ONE SUSPECT, ONE WEAPON, ONE LOCATION — HAVE BEEN SEALED INTO A HIDDEN CASE FILE.',
      },
      {
        heading: 'YOUR MISSION',
        icon: '🔎',
        text: 'YOU ARE A DETECTIVE. USE LOGIC AND DEDUCTION TO UNCOVER ALL THREE ELEMENTS OF THE CASE FILE BEFORE YOUR RIVALS DO. THE FIRST PLAYER TO CORRECTLY NAME THE SUSPECT, WEAPON, AND LOCATION WINS.',
      },
      {
        heading: 'HOW DEDUCTION WORKS',
        icon: '◎',
        text: 'EVERY CARD NOT IN THE CASE FILE IS DEALT TO THE PLAYERS. WHEN OPPONENTS REVEAL CARDS DURING INTERROGATIONS, THOSE CARDS ARE DEFINITIVELY CLEARED. CROSS THEM OFF YOUR NOTEBOOK AND NARROW THE FIELD UNTIL ONLY THE TRUTH REMAINS.',
      },
      {
        heading: 'FIRST CORRECT ACCUSATION WINS',
        icon: '⚑',
        text: 'THE GAME ENDS THE INSTANT A PLAYER MAKES A CORRECT FORMAL ACCUSATION. THERE IS NO SECOND CHANCE — SPEED AND LOGICAL PRECISION ARE BOTH CRITICAL.',
      },
    ],
  },
  {
    id: 'cards',
    label: 'THE CARDS',
    icon: '◇',
    color: '#ccaa00',
    accent: '#ffdd44',
    content: [
      {
        heading: 'SUSPECTS  (6 CARDS)',
        icon: '♛',
        text: '♛ CHEF — THE COOK\n◇ HALLBOY — THE SERVANT\n⚔ SECURITY GUARD — THE WARDEN\n♟ SHOPKEEPER — THE MERCHANT\n✿ STUDENT GIRL — THE SCHOLAR\n♞ STUDENT BOY — THE STUDENT',
      },
      {
        heading: 'WEAPONS  (6 CARDS)',
        icon: '†',
        text: '† KNIFE\n● SLEEPING PILLS\n⊛ REVOLVER\n⚡ LAPTOP CHARGER\n✦ ANTI CUTTER\n∿ ROPE',
      },
      {
        heading: 'LOCATIONS  (9 CARDS)',
        icon: '▲',
        text: '▲ AUDITORIUM  ✦ STUDENT WELFARE CENTER  ♦ AMAR EKUSHEY HALL\n□ CAFETERIA  ◆ CENTRAL FIELD  ⌘ IT PARK\n◎ BEGUM ROKEYA HALL  ◉ LOTUS POND  ⬡ POCKET GATE',
      },
      {
        heading: 'THE DEAL  (21 TOTAL)',
        icon: '⊛',
        text: '3 CARDS (1 SUSPECT + 1 WEAPON + 1 LOCATION) ARE LOCKED IN THE CASE FILE AS EVIDENCE. THE REMAINING 18 CARDS ARE SHUFFLED AND DEALT EVENLY TO ALL PLAYERS. PLAYERS KEEP THEIR HAND SECRET.',
      },
    ],
  },
  {
    id: 'gameplay',
    label: 'GAMEPLAY',
    icon: '⊛',
    color: '#44cc44',
    accent: '#88ff88',
    content: [
      {
        heading: '① ROLL THE DICE',
        icon: '⚄',
        text: 'AT THE START OF YOUR TURN, ROLL THE DICE. YOUR TOKEN MAY MOVE UP TO THAT MANY STEPS ALONG HALLWAYS AND CORRIDORS ACROSS THE KUET CAMPUS BOARD. PLAN YOUR PATH CAREFULLY.',
      },
      {
        heading: '② ENTER A ROOM',
        icon: '⬡',
        text: 'MOVE INTO ANY ROOM TO MAKE A SUGGESTION. YOU MUST NAME (A) ANY SUSPECT, (B) ANY WEAPON, AND (C) THE ROOM YOU JUST ENTERED AS THE CRIME LOCATION. YOU CANNOT MAKE A SUGGESTION FROM A HALLWAY.',
      },
      {
        heading: '③ INTERROGATION',
        icon: '◉',
        text: 'AFTER YOUR SUGGESTION, EACH OTHER PLAYER IS ASKED (CLOCKWISE FROM YOUR LEFT) IF THEY HOLD ANY OF THE THREE NAMED CARDS. THE FIRST PLAYER WHO HOLDS AT LEAST ONE MUST PRIVATELY SHOW YOU EXACTLY ONE MATCHING CARD. THE REST SEE NOTHING.',
      },
      {
        heading: '④ NO REFUTATION',
        icon: '✦',
        text: 'IF NO OPPONENT CAN DISPROVE YOUR SUGGESTION (NOBODY HOLDS ANY OF THE THREE CARDS), THOSE CARDS ARE STRONG CANDIDATES FOR THE CASE FILE. YOU MAY IMMEDIATELY MAKE AN ACCUSATION OR WAIT AND GATHER MORE EVIDENCE.',
      },
      {
        heading: '⑤ USE YOUR NOTEBOOK',
        icon: '□',
        text: 'AFTER EACH INTERROGATION, UPDATE YOUR CLUE NOTEBOOK. MARK ✓ FOR CARDS YOU HAVE SEEN (CLEARED) AND ✗ FOR CARDS YOU KNOW ARE IN THE CASE FILE. THE NOTEBOOK IS YOUR MOST POWERFUL TOOL.',
      },
      {
        heading: '⑥ AI PLAYERS',
        icon: '⊛',
        text: 'COMPUTER PLAYERS USE THEIR ASSIGNED ALGORITHM (RANDOM → RULE-BASED → MINIMAX → MCTS) TO MAKE DECISIONS. STRONGER ALGORITHMS DEDUCE MORE EFFICIENTLY. IN AI VS AI MODE, WATCH THEM COMPETE AUTONOMOUSLY.',
      },
    ],
  },
  {
    id: 'winning',
    label: 'WIN / LOSE',
    icon: '†',
    color: '#4466ff',
    accent: '#88aaff',
    content: [
      {
        heading: 'MAKING AN ACCUSATION',
        icon: '⚑',
        text: 'ON YOUR TURN, INSTEAD OF A SUGGESTION, YOU MAY DECLARE A FORMAL ACCUSATION. NAME YOUR CHOSEN SUSPECT, WEAPON, AND LOCATION. THIS IS YOUR ONE-SHOT CHANCE — CHOOSE WISELY.',
      },
      {
        heading: '✓ CORRECT — YOU WIN',
        icon: '✓',
        text: 'IF ALL THREE OF YOUR CHOICES MATCH THE SEALED CASE FILE EXACTLY, THE MYSTERY IS SOLVED. THE GAME ENDS IMMEDIATELY AND YOU ARE DECLARED THE GREATEST DETECTIVE ON KUET CAMPUS.',
      },
      {
        heading: '✗ WRONG — ELIMINATED',
        icon: '✗',
        text: 'IF ANY ELEMENT IS WRONG, YOUR ACCUSATION FAILS AND YOU ARE ELIMINATED FROM ACTIVE PLAY. YOU MAY NO LONGER MAKE SUGGESTIONS OR ACCUSATIONS, BUT YOU MUST STILL REVEAL CARDS WHEN OPPONENTS ASK DURING THEIR INTERROGATIONS.',
      },
      {
        heading: 'LAST PLAYER ELIMINATED',
        icon: '☠',
        text: 'IF THE FINAL UNELIMINATED PLAYER ALSO MAKES A WRONG ACCUSATION, ALL PLAYERS LOSE. THE MURDERER ESCAPES INTO THE CAMPUS NIGHT AND THE CASE GOES COLD.',
      },
    ],
  },
  {
    id: 'controls',
    label: 'CONTROLS',
    icon: '▶',
    color: '#cc44ff',
    accent: '#ee88ff',
    content: [
      {
        heading: 'MENU NAVIGATION',
        icon: '◇',
        text: '↑ ↓ ARROW KEYS — MOVE CURSOR UP / DOWN\n◄ ► ARROW KEYS — SWITCH TABS / NAVIGATE\nENTER — CONFIRM SELECTION\nESCAPE — GO BACK / SKIP SCREEN',
      },
      {
        heading: 'GAME BOARD',
        icon: '⬡',
        text: '↑ ↓ ◄ ► — MOVE YOUR PLAYER TOKEN\nENTER — CONFIRM MOVE / END TURN\nCLICK CELL — MOVE TO CLICKED POSITION\nCLICK ROOM — ENTER ROOM & TRIGGER SUGGESTION',
      },
      {
        heading: 'CARD & NOTEBOOK',
        icon: '□',
        text: 'HOLD A — REVEAL ALL CARDS IN CARD VIEW\nCLICK NOTEBOOK CELL — CYCLE ✓ / ✗ / BLANK\nCLICK HAND ICON — OPEN YOUR CARD HAND\nCLICK NOTEBOOK ICON — OPEN CLUE NOTEBOOK',
      },
      {
        heading: 'MOUSE & GENERAL',
        icon: '◎',
        text: 'HOVER — HIGHLIGHT MENU ITEMS\nCLICK — SELECT / CONFIRM ANY ACTION\nSCROLL (THIS SCREEN) — ↑↓ ARROW KEYS OR MOUSE\nALL SCREENS SUPPORT BOTH KEYBOARD AND MOUSE',
      },
    ],
  },
]

export default function HowToPlayScreen({ onSkip }: Props) {
  const [activeTab, setActiveTab]   = useState(0)
  const [prevTab, setPrevTab]       = useState(0)
  const [glitching, setGlitching]   = useState(false)
  const contentRef                  = useRef<HTMLDivElement>(null)

  // periodic glitch on the title
  useEffect(() => {
    const iv = setInterval(() => {
      setGlitching(true)
      setTimeout(() => setGlitching(false), 180)
    }, 5000)
    return () => clearInterval(iv)
  }, [])

  const shiftTab = useCallback((dir: number) => {
    setActiveTab(t => {
      const next = Math.max(0, Math.min(SECTIONS.length - 1, t + dir))
      setPrevTab(t)
      return next
    })
    // reset scroll when switching tabs
    setTimeout(() => { if (contentRef.current) contentRef.current.scrollTop = 0 }, 0)
  }, [])

  const goToTab = useCallback((i: number) => {
    setPrevTab(activeTab)
    setActiveTab(i)
    setTimeout(() => { if (contentRef.current) contentRef.current.scrollTop = 0 }, 0)
  }, [activeTab])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); shiftTab(-1) }
      if (e.key === 'ArrowRight') { e.preventDefault(); shiftTab(1) }
      if (e.key === 'Escape')     onSkip()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shiftTab, onSkip])

  const section  = SECTIONS[activeTab]
  const slideDir = activeTab >= prevTab ? 1 : -1

  return (
    <div
      className="relative w-full h-full flex flex-col items-center overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #120800 0%, #060400 60%, #000000 100%)' }}
    >
      {/* ── Background grid ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(92,60,0,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(92,60,0,0.06) 1px,transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* ── Vignette ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.8) 100%)' }}
      />

      {/* ── CRT scanlines ── */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(transparent 50%, rgba(0,0,0,0.06) 50%)',
          backgroundSize: '100% 4px',
        }}
        animate={{ opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 3.5, repeat: Infinity }}
      />

      {/* ── Rotating dark shards ── */}
      {PARTICLES.map(p => (
        <div
          key={p.id}
          className="absolute pointer-events-none"
          style={{
            left: p.left,
            bottom: p.bottom,
            width: p.size,
            height: p.size,
            background: p.color,
            clipPath: p.shape,
            animationName: 'shard-rise',
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            animationTimingFunction: 'linear',
            animationIterationCount: 'infinite',
          }}
        />
      ))}

      {/* ── Blood drip accents top-left / top-right ── */}
      {[{ left: '4%', delay: 0, h: 55 }, { left: '96%', delay: 0.3, h: 40 }, { left: '12%', delay: 0.7, h: 35 }, { left: '88%', delay: 1.0, h: 60 }].map((d, i) => (
        <motion.div
          key={i}
          className="absolute top-0 pointer-events-none"
          style={{ left: d.left, width: 4, background: '#6b0000', originY: 0 }}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 0.6 }}
          transition={{ delay: d.delay, duration: 1.0, ease: 'easeIn' }}
        >
          <div style={{ height: d.h, background: '#8b0000' }} />
          <div style={{ width: 8, height: 8, background: '#6b0000', borderRadius: '0 0 4px 4px', marginLeft: -2 }} />
        </motion.div>
      ))}

      {/* ══════════════════ HEADER ══════════════════ */}
      <motion.div
        className="relative z-10 text-center w-full"
        style={{ paddingTop: 20, paddingBottom: 14 }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
      >
        {/* Supertitle */}
        <motion.div
          className="font-pixel"
          style={{ fontSize: '9px', color: '#5c3d00', letterSpacing: '4px', marginBottom: 10 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          ─── MURDER IN KUET ───
        </motion.div>

        {/* Main title with glitch */}
        <motion.div
          className="font-pixel"
          style={{
            fontSize: 'clamp(18px, 3vw, 26px)',
            color: '#e8c060',
            letterSpacing: '5px',
            textShadow: '4px 4px 0 #3d2200, 0 0 24px #b8860b55',
          }}
          animate={glitching ? { x: [-2, 3, -1, 0], skewX: [-1, 1, 0] } : {}}
          transition={{ duration: 0.18 }}
        >
          HOW TO PLAY
        </motion.div>

        {/* Decorative divider */}
        <motion.div
          style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '0 32px' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div style={{ flex: 1, height: 2, background: 'repeating-linear-gradient(90deg, #5c3d00 0, #5c3d00 6px, transparent 6px, transparent 12px)' }} />
          <span className="font-pixel" style={{ color: '#8b0000', fontSize: '10px' }}>✦</span>
          <div style={{ flex: 1, height: 2, background: 'repeating-linear-gradient(90deg, #5c3d00 0, #5c3d00 6px, transparent 6px, transparent 12px)' }} />
        </motion.div>
      </motion.div>

      {/* ══════════════════ TAB BAR ══════════════════ */}
      <motion.div
        className="relative z-10 flex gap-2"
        style={{ width: '100%', maxWidth: 780, padding: '0 20px', marginBottom: 14, flexShrink: 0 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        {SECTIONS.map((s, i) => {
          const isActive = i === activeTab
          return (
            <motion.button
              key={s.id}
              onClick={() => goToTab(i)}
              className="font-pixel flex-1"
              style={{
                background: isActive ? 'rgba(40,25,0,0.95)' : 'rgba(12,8,0,0.7)',
                border: `2px solid ${isActive ? s.color : '#2a1800'}`,
                color: isActive ? s.color : '#665544',
                padding: '10px 4px',
                fontSize: '9px',
                letterSpacing: '0.5px',
                cursor: 'pointer',
                outline: 'none',
                transition: 'border-color 0.15s, color 0.15s',
              }}
              animate={isActive
                ? { boxShadow: [`0 0 10px ${s.color}33, 3px 3px 0 #000`, `0 0 20px ${s.color}66, 3px 3px 0 #000`, `0 0 10px ${s.color}33, 3px 3px 0 #000`] }
                : { boxShadow: '2px 2px 0 #000' }
              }
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
            >
              {s.label}
            </motion.button>
          )
        })}
      </motion.div>

      {/* ══════════════════ CONTENT AREA ══════════════════ */}
      <div
        className="relative z-10 flex-1 w-full tab-scrollbar"
        style={{
          maxWidth: 780,
          padding: '0 20px',
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          '--tab-color': section.color,
          '--tab-color-bright': section.accent,
          scrollbarColor: `${section.color} #090000`,
        } as React.CSSProperties}
        ref={contentRef}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={section.id}
            className="flex flex-col gap-4 pb-2"
            initial={{ opacity: 0, x: slideDir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: slideDir * -40 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Section title banner */}
            <motion.div
              style={{
                background: `linear-gradient(90deg, ${section.color}22 0%, transparent 100%)`,
                borderLeft: `4px solid ${section.color}`,
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35 }}
            >
              <div>
                <div
                  className="font-pixel"
                  style={{ fontSize: '13px', color: section.color, letterSpacing: '3px', textShadow: `2px 2px 0 #000, 0 0 12px ${section.color}88` }}
                >
                  {section.label}
                </div>
                <div
                  className="font-pixel"
                  style={{ fontSize: '7px', color: '#443322', letterSpacing: '1px', marginTop: 5 }}
                >
                  {activeTab + 1} / {SECTIONS.length}
                </div>
              </div>
              {/* Animated blinking cursor */}
              <motion.span
                className="font-pixel"
                style={{ fontSize: '14px', color: section.color, marginLeft: 4 }}
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear', times: [0, 0.45, 0.5, 0.95, 1] }}
              >
                _
              </motion.span>
            </motion.div>

            {/* Rule cards */}
            {section.content.map((item, i) => (
              <motion.div
                key={item.heading}
                style={{
                  background: 'rgba(18,10,0,0.85)',
                  border: `2px solid ${section.color}55`,
                  padding: '16px 20px',
                  boxShadow: `4px 4px 0 #000, 0 0 14px ${section.color}18`,
                  position: 'relative',
                  overflow: 'hidden',
                }}
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: i * 0.08, duration: 0.32, ease: 'easeOut' }}
                whileHover={{
                  borderColor: `${section.color}aa`,
                  boxShadow: `4px 4px 0 #000, 0 0 22px ${section.color}33`,
                  transition: { duration: 0.15 },
                }}
              >
                {/* Top-left corner accent */}
                <div style={{
                  position: 'absolute', top: 0, left: 0,
                  width: 6, height: 6,
                  background: section.color,
                  opacity: 0.6,
                }} />

                {/* Heading row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div
                    className="font-pixel"
                    style={{
                      fontSize: '10px',
                      color: section.accent,
                      letterSpacing: '1.5px',
                      textShadow: `1px 1px 0 #000`,
                    }}
                  >
                    {item.heading}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: `${section.color}33`, marginBottom: 12 }} />

                {/* Body text — handle \n line breaks */}
                <div
                  className="font-pixel"
                  style={{ fontSize: '9px', color: '#bb9966', letterSpacing: '0.5px', lineHeight: 2.4 }}
                >
                  {item.text.split('\n').map((line, li) => (
                    <span key={li} style={{ display: 'block' }}>{line}</span>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ══════════════════ FOOTER ══════════════════ */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-3"
        style={{ paddingTop: 12, paddingBottom: 16, flexShrink: 0 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45, duration: 0.4 }}
      >
        {/* Tab progress dots */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          {SECTIONS.map((s, i) => (
            <motion.button
              key={s.id}
              onClick={() => goToTab(i)}
              style={{
                width: i === activeTab ? 20 : 8,
                height: 8,
                background: i === activeTab ? s.color : '#2a1800',
                border: 'none',
                cursor: 'pointer',
                outline: 'none',
                boxShadow: i === activeTab ? `0 0 8px ${s.color}88` : 'none',
              }}
              animate={{ width: i === activeTab ? 20 : 8 }}
              transition={{ duration: 0.25 }}
            />
          ))}
        </div>

        {/* Hint text */}
        <motion.div
          className="font-pixel"
          style={{ fontSize: '9px', color: '#cc8833', letterSpacing: '2px', textShadow: '0 0 8px #cc883366' }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.2, repeat: Infinity }}
        >
          ◄► SWITCH TABS · ESC TO SKIP
        </motion.div>

        <PixelButton onClick={onSkip} color="yellow">
          SKIP  ►
        </PixelButton>
      </motion.div>
    </div>
  )
}
