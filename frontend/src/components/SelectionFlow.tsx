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
  /** If provided (interrogation mode), skips the location step and auto-fills this card */
  lockedLocationCard?: Card
}

type Step = 'suspect' | 'weapon' | 'location'

const PROMPTS: Record<Step, string> = {
  suspect:  'WHO\nDID IT?',
  weapon:   'WITH\nWHAT?',
  location: 'WHERE?',
}

const CATEGORY_LABELS: Record<Step, string> = {
  suspect:  'SUSPECT',
  weapon:   'WEAPON',
  location: 'LOCATION',
}

// Mode accent colors
const MODE_COLOR = {
  interrogation: '#cc8800',
  accusation:    '#cc1a00',
}
const MODE_LABEL = {
  interrogation: 'INTERROGATION',
  accusation:    'ACCUSATION',
}

// Tracker slot — shows filled card or empty placeholder
function TrackerSlot({ label, card, locked }: { label: string; card: Card | null; locked?: boolean }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="font-pixel" style={{
        fontSize: '6px', color: '#8a5522', letterSpacing: '2px', marginBottom: 5,
      }}>
        ── {label} ──
      </div>
      <div style={{
        border: card ? `2px solid ${card.accentColor}55` : '2px dashed #2a1800',
        background: card ? card.bgColor : 'transparent',
        padding: '8px 10px',
        minHeight: 52,
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Dot texture */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '6px 6px',
        }} />

        <AnimatePresence mode="wait">
          {card ? (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.18, ease: 'linear' }}
              style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%' }}
            >
              {card.imageSrc ? (
                <img
                  src={card.imageSrc}
                  style={{
                    width: 24,
                    height: 24,
                    imageRendering: 'pixelated',
                    objectFit: 'contain',
                    flexShrink: 0,
                  }}
                />
              ) : (
                <span style={{
                  fontFamily: 'monospace', fontSize: 18,
                  color: card.accentColor,
                  textShadow: `0 0 6px ${card.accentColor}66`,
                  flexShrink: 0,
                }}>
                  {card.icon}
                </span>
              )}
              <div>
                <div className="font-pixel" style={{
                  fontSize: '5px', color: '#cc8833', letterSpacing: '0.5px', marginBottom: 3,
                }}>
                  {card.shortName}
                </div>
                <div className="font-pixel" style={{
                  fontSize: '6px', color: card.accentColor, letterSpacing: '0.5px', lineHeight: 1.5,
                }}>
                  {card.name.toUpperCase()}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 10, color: locked ? '#888' : '#ffdd00', flexShrink: 0 }}>
                {locked ? '🔒' : '✓'}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <span style={{ fontFamily: 'monospace', fontSize: 16, color: '#8a5530', lineHeight: 1 }}>?</span>
              <span className="font-pixel" style={{ fontSize: '6px', color: '#8a5530', letterSpacing: '1px' }}>
                SELECT {label}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// Grid slide transition variants
const gridVariants = {
  enter: { x: 55, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -55, opacity: 0 },
}

export default function SelectionFlow({ mode, onComplete, onCancel, lockedLocationCard }: Props) {
  const twoStep = mode === 'interrogation' && !!lockedLocationCard
  const [step, setStep] = useState<Step>('suspect')
  const [suspectCard, setSuspectCard] = useState<Card | null>(null)
  const [weaponCard, setWeaponCard]   = useState<Card | null>(null)

  const modeColor = MODE_COLOR[mode]

  // Dynamic step list and numbering
  const stepList: Step[] = twoStep ? ['suspect', 'weapon'] : ['suspect', 'weapon', 'location']
  const stepNum = (s: Step) => stepList.indexOf(s) + 1
  const totalSteps = stepList.length

  const handleSuspectSelect = (card: Card) => {
    setSuspectCard(card)
    setTimeout(() => setStep('weapon'), 160)
  }

  const handleWeaponSelect = (card: Card) => {
    setWeaponCard(card)
    if (twoStep && lockedLocationCard && suspectCard) {
      // Auto-complete with locked location
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

  const isLocStep = step === 'location'

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
        height: 50,
        background: '#060204',
        borderBottom: `2px solid ${modeColor}55`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 18px',
        flexShrink: 0,
      }}>
        <div className="font-pixel" style={{ fontSize: '8px', color: modeColor, letterSpacing: '3px' }}>
          {MODE_LABEL[mode]}
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {stepList.map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="font-pixel" style={{
                fontSize: '7px',
                color: s === step ? '#ffdd00' : (stepNum(s) < stepNum(step) ? modeColor : '#7a5030'),
                letterSpacing: '0.5px',
              }}>
                {stepNum(s)}·{CATEGORY_LABELS[s]}
              </div>
              {i < stepList.length - 1 && (
                <span style={{ color: '#8a5030', fontSize: 10, fontFamily: 'monospace' }}>›</span>
              )}
            </div>
          ))}
        </div>

        {/* Cancel */}
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px 16px',
          overflow: 'hidden',
          borderRight: '2px solid #140a00',
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
                  gridTemplateColumns: 'repeat(2, minmax(110px, 140px))',
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
                  gridTemplateColumns: 'repeat(2, minmax(110px, 140px))',
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
                  gridTemplateColumns: 'repeat(3, minmax(90px, 120px))',
                  gap: 8,
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

        {/* CENTER — prompt */}
        <div style={{
          width: 200,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: isLocStep ? 'flex-end' : 'center',
          padding: isLocStep ? '0 16px 32px' : '0 16px',
          borderRight: '2px solid #140a00',
        }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.18, ease: 'linear' }}
              style={{ textAlign: 'center' }}
            >
              {/* Step number */}
              <div className="font-pixel" style={{
                fontSize: '6px', color: '#8a5522', letterSpacing: '2px', marginBottom: 14,
              }}>
                STEP {stepNum(step)} / {totalSteps}
              </div>

              {/* Main prompt */}
              <div className="font-pixel" style={{
                fontSize: '14px',
                color: modeColor,
                letterSpacing: '2px',
                lineHeight: 1.8,
                whiteSpace: 'pre-line',
                textShadow: `0 0 16px ${modeColor}77`,
              }}>
                {PROMPTS[step]}
              </div>

              {/* Divider */}
              <div style={{
                margin: '16px auto',
                width: 70,
                height: 1,
                background: `repeating-linear-gradient(90deg,${modeColor}88 0,${modeColor}88 4px,transparent 4px,transparent 8px)`,
              }} />

              {/* Category label */}
              <div className="font-pixel" style={{
                fontSize: '7px', color: '#aa6633', letterSpacing: '1.5px',
              }}>
                SELECT {CATEGORY_LABELS[step]}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* RIGHT — tracker */}
        <div style={{
          width: 240,
          flexShrink: 0,
          padding: '18px 14px',
          overflowY: 'auto',
          background: '#060204',
        }}>
          <div className="font-pixel" style={{
            fontSize: '6px', color: modeColor,
            letterSpacing: '2px', marginBottom: 16,
          }}>
            ── SELECTION ──
          </div>

          <TrackerSlot label="SUSPECT"  card={suspectCard} />
          <TrackerSlot label="WEAPON"   card={weaponCard} />
          <TrackerSlot label="LOCATION" card={lockedLocationCard ?? null} locked={twoStep} />

          {/* Confirm summary when all 3 are done */}
          {step === 'location' && suspectCard && weaponCard && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="font-pixel"
              style={{
                marginTop: 20,
                fontSize: '6px', color: '#cc8833',
                letterSpacing: '1px', lineHeight: 2.2,
                borderTop: '1px solid #7a4422',
                paddingTop: 12,
              }}
            >
              <div style={{ color: '#aa6633', marginBottom: 6 }}>── READY ──</div>
              <div>PICK LOCATION</div>
              <div>TO CONFIRM</div>
              <motion.div
                style={{ marginTop: 8, color: modeColor }}
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              >
                ▶ FINALISE
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
