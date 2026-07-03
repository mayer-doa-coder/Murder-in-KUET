import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import SelectionCard from './SelectionCard'
import { SUSPECTS_CARDS, WEAPONS_CARDS, LOCATIONS_CARDS } from '../types'
import type { Card } from '../types'

export interface SelectionFlowResult {
  suspect: string
  weapon: string
  location: string
}

interface Props {
  mode: 'interrogation' | 'accusation'
  onComplete: (result: SelectionFlowResult) => void
  onCancel: () => void
  lockedLocationCard?: Card
  lockedSuspectCard?: Card
}

type Step = 'suspect' | 'weapon' | 'location'

const MODE_COLOR = {
  interrogation: '#cc8800',
  accusation:    '#cc1a00',
}
const MODE_LABEL = {
  interrogation: 'INTERROGATION',
  accusation:    'ACCUSATION',
}

// Visual config per step
const STEP_CONFIG: Record<Step, { icon: string; color: string; label: string }> = {
  suspect:  { icon: '👤', color: '#ff6644', label: 'WHO DID IT?' },
  weapon:   { icon: '🗡️', color: '#ddaa22', label: 'WITH WHAT?' },
  location: { icon: '📍', color: '#44aaff', label: 'WHERE?' },
}

// Portrait tracker slot — image-first, minimal text
function PortraitSlot({ label, card, locked }: { label: string; card: Card | null; locked?: boolean }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="font-pixel" style={{
        fontSize: '5px', color: '#8a5522', letterSpacing: '2px', marginBottom: 5,
      }}>
        {label}
      </div>

      <AnimatePresence mode="wait">
        {card ? (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.88 }}
            transition={{ duration: 0.18, ease: 'linear' }}
            style={{
              position: 'relative', overflow: 'hidden',
              border: locked ? `2px solid ${card.accentColor}44` : `2px solid ${card.accentColor}99`,
              background: card.bgColor,
              height: 260,
            }}
          >
            {/* Full-bleed portrait image */}
            {card.imageSrc ? (
              <img
                src={card.imageSrc}
                style={{
                  width: '100%', height: '100%',
                  objectFit: 'cover', imageRendering: 'pixelated',
                  display: 'block',
                  filter: locked ? 'brightness(0.7) saturate(0.6)' : 'none',
                }}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{
                  fontFamily: 'monospace', fontSize: 36,
                  color: card.accentColor,
                  textShadow: `0 0 12px ${card.accentColor}88`,
                }}>{card.icon}</span>
              </div>
            )}

            {/* Scan-line overlay */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.06) 3px,rgba(0,0,0,0.06) 4px)',
            }} />

            {/* Name + status strip at bottom */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'rgba(0,0,0,0.78)',
              borderTop: `1px solid ${card.accentColor}33`,
              padding: '3px 6px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span className="font-pixel" style={{
                fontSize: '5px', color: card.accentColor, letterSpacing: '0.4px',
              }}>
                {card.name.toUpperCase()}
              </span>
              <span style={{ fontSize: 9, lineHeight: 1 }}>
                {locked ? '🔒' : '✓'}
              </span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            style={{
              height: 260,
              border: '2px dashed #2a1800',
              background: '#080300',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 6,
            }}
          >
            <div style={{
              width: 28, height: 28,
              border: '2px dashed #3a2000',
              borderRadius: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontFamily: 'monospace', fontSize: 16, color: '#4a2800', lineHeight: 1 }}>?</span>
            </div>
            <span className="font-pixel" style={{ fontSize: '4px', color: '#4a2800', letterSpacing: '0.8px' }}>
              SELECT {label}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const gridVariants = {
  enter:  { x: 50, opacity: 0 },
  center: { x: 0,  opacity: 1 },
  exit:   { x: -50, opacity: 0 },
}

export default function SelectionFlow({ mode, onComplete, onCancel, lockedLocationCard, lockedSuspectCard }: Props) {
  // weapon-only: both suspect & location fixed by the parked token → just pick a weapon
  const weaponOnly = mode === 'interrogation' && !!lockedLocationCard && !!lockedSuspectCard
  const twoStep = mode === 'interrogation' && !!lockedLocationCard && !weaponOnly
  const [step, setStep]             = useState<Step>(weaponOnly ? 'weapon' : 'suspect')
  const [suspectCard, setSuspectCard] = useState<Card | null>(weaponOnly ? lockedSuspectCard! : null)
  const [weaponCard, setWeaponCard]   = useState<Card | null>(null)

  const modeColor = MODE_COLOR[mode]
  const stepList: Step[] = weaponOnly ? ['weapon']
    : twoStep ? ['suspect', 'weapon']
    : ['suspect', 'weapon', 'location']
  const stepNum  = (s: Step) => stepList.indexOf(s) + 1
  const totalSteps = stepList.length

  const handleSuspectSelect = (card: Card) => {
    setSuspectCard(card)
    setTimeout(() => setStep('weapon'), 160)
  }

  const handleWeaponSelect = (card: Card) => {
    setWeaponCard(card)
    if (weaponOnly && lockedLocationCard && lockedSuspectCard) {
      setTimeout(() => onComplete({
        suspect: lockedSuspectCard.id, weapon: card.id, location: lockedLocationCard.id,
      }), 380)
    } else if (twoStep && lockedLocationCard && suspectCard) {
      setTimeout(() => onComplete({
        suspect: suspectCard.id, weapon: card.id, location: lockedLocationCard.id,
      }), 380)
    } else {
      setTimeout(() => setStep('location'), 160)
    }
  }

  const handleLocationSelect = (card: Card) => {
    if (suspectCard && weaponCard) {
      setTimeout(() => onComplete({ suspect: suspectCard.id, weapon: weaponCard.id, location: card.id }), 380)
    }
  }

  const cfg = STEP_CONFIG[step]

  return (
    <motion.div
      style={{
        position: 'absolute', inset: 0,
        background: '#040202',
        display: 'flex', flexDirection: 'column',
        zIndex: 30,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'linear' }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        height: 50, background: '#060204',
        borderBottom: `2px solid ${modeColor}55`,
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 18px', flexShrink: 0,
      }}>
        <div className="font-pixel" style={{ fontSize: '8px', color: modeColor, letterSpacing: '3px' }}>
          {MODE_LABEL[mode]}
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {stepList.map((s, i) => {
            const done    = stepNum(s) < stepNum(step)
            const current = s === step
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{
                    width: 8, height: 8,
                    borderRadius: 1,
                    background: done ? modeColor : current ? '#ffdd00' : '#3a2000',
                    boxShadow: current ? `0 0 6px #ffdd0088` : 'none',
                    transition: 'background 0.2s',
                  }} />
                  <div className="font-pixel" style={{
                    fontSize: '6px',
                    color: current ? '#ffdd00' : done ? modeColor : '#5a3820',
                    letterSpacing: '0.5px',
                  }}>
                    {STEP_CONFIG[s].label.split(' ')[0]}
                  </div>
                </div>
                {i < stepList.length - 1 && (
                  <span style={{ color: '#4a2800', fontSize: 10, fontFamily: 'monospace' }}>›</span>
                )}
              </div>
            )
          })}
        </div>

        <motion.button
          className="font-pixel"
          style={{
            background: 'transparent', border: '1px solid #2a0800',
            color: '#3a1400', padding: '3px 10px', fontSize: '5px',
            letterSpacing: '1px', cursor: 'pointer',
          }}
          whileHover={{ color: '#cc3300', borderColor: '#661100' }}
          onClick={onCancel}
        >
          ✕ CANCEL
        </motion.button>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT — card grid */}
        <div style={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          borderRight: '2px solid #140a00',
        }}>
          {/* Step visual banner */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15, ease: 'linear' }}
              style={{
                padding: '10px 20px 8px',
                borderBottom: `1px solid ${cfg.color}22`,
                display: 'flex', alignItems: 'center', gap: 10,
                flexShrink: 0,
                background: `${cfg.color}08`,
              }}
            >
              <div>
                <div className="font-pixel" style={{
                  fontSize: '5px', color: '#6a4020', letterSpacing: '1.5px', marginBottom: 2,
                }}>
                  STEP {stepNum(step)} / {totalSteps}
                </div>
                <div className="font-pixel" style={{
                  fontSize: '9px', color: cfg.color, letterSpacing: '2px',
                  textShadow: `0 0 10px ${cfg.color}66`,
                }}>
                  {cfg.label}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Grid */}
          <div style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px 20px', overflow: 'hidden',
          }}>
            <AnimatePresence mode="wait">
              {step === 'suspect' && (
                <motion.div
                  key="grid-suspect"
                  variants={gridVariants}
                  initial="enter" animate="center" exit="exit"
                  transition={{ duration: 0.18, ease: 'linear' }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(75px, 108px))',
                    gap: 10,
                  }}
                >
                  {SUSPECTS_CARDS.map(card => (
                    <SelectionCard
                      key={card.id}
                      icon={card.icon}
                      imageSrc={card.imageSrc}
                      name={card.name}
                      shortName={card.shortName}
                      bgColor={card.bgColor}
                      accentColor={card.accentColor}
                      isSelected={suspectCard?.id === card.id}
                      onClick={() => handleSuspectSelect(card)}
                    />
                  ))}
                </motion.div>
              )}

              {step === 'weapon' && (
                <motion.div
                  key="grid-weapon"
                  variants={gridVariants}
                  initial="enter" animate="center" exit="exit"
                  transition={{ duration: 0.18, ease: 'linear' }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(75px, 108px))',
                    gap: 10,
                  }}
                >
                  {WEAPONS_CARDS.map(card => (
                    <SelectionCard
                      key={card.id}
                      icon={card.icon}
                      imageSrc={card.imageSrc}
                      name={card.name}
                      shortName={card.shortName}
                      bgColor={card.bgColor}
                      accentColor={card.accentColor}
                      isSelected={weaponCard?.id === card.id}
                      onClick={() => handleWeaponSelect(card)}
                    />
                  ))}
                </motion.div>
              )}

              {step === 'location' && (
                <motion.div
                  key="grid-location"
                  variants={gridVariants}
                  initial="enter" animate="center" exit="exit"
                  transition={{ duration: 0.18, ease: 'linear' }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(75px, 108px))',
                    gap: 10,
                  }}
                >
                  {LOCATIONS_CARDS.map(card => (
                    <SelectionCard
                      key={card.id}
                      icon={card.icon}
                      imageSrc={card.imageSrc}
                      name={card.name}
                      shortName={card.shortName}
                      bgColor={card.bgColor}
                      accentColor={card.accentColor}
                      isSelected={false}
                      onClick={() => handleLocationSelect(card)}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* RIGHT — visual selection tracker */}
        <div style={{
          width: 220, flexShrink: 0,
          padding: '14px 12px',
          overflowY: 'auto',
          background: '#060204',
          display: 'flex', flexDirection: 'column',
        }}>
          <div className="font-pixel" style={{
            fontSize: '5px', color: modeColor,
            letterSpacing: '2px', marginBottom: 14,
          }}>
            ── SELECTION ──
          </div>

          <PortraitSlot label="SUSPECT"  card={suspectCard} locked={weaponOnly} />
          <PortraitSlot label="WEAPON"   card={weaponCard} />
          <PortraitSlot label="LOCATION" card={(twoStep || weaponOnly) && lockedLocationCard ? lockedLocationCard : null} locked={(twoStep || weaponOnly) && !!lockedLocationCard} />

          {/* Ready indicator */}
          {step === 'location' && suspectCard && weaponCard && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              style={{ marginTop: 16, borderTop: '1px solid #7a4422', paddingTop: 12 }}
            >
              <motion.div
                className="font-pixel"
                style={{ fontSize: '6px', color: modeColor, letterSpacing: '1.5px', textAlign: 'center' }}
                animate={{ opacity: [1, 0.35, 1] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              >
                ▶ PICK LOCATION
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
