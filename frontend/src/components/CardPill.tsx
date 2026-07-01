import { ALL_CARDS } from '../types'

const BY_ID = Object.fromEntries(ALL_CARDS.map(c => [c.id, c]))

interface Props {
  cardId: string
  dimmed?: boolean
  width?: number
  imageHeight?: number
}

export default function CardPill({ cardId, dimmed, width = 88, imageHeight = 112 }: Props) {
  const card = BY_ID[cardId]
  if (!card) return null
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      width,
      background: dimmed ? '#0a0a0a' : card.bgColor,
      border: `2px solid ${dimmed ? '#333' : card.accentColor}66`,
      overflow: 'hidden',
      opacity: dimmed ? 0.4 : 1,
      boxShadow: dimmed ? 'none' : `0 0 10px ${card.accentColor}22`,
    }}>
      <div style={{ height: imageHeight, position: 'relative', overflow: 'hidden' }}>
        {card.imageSrc ? (
          <img
            src={card.imageSrc}
            style={{
              width: '100%', height: '100%',
              imageRendering: 'pixelated',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: card.bgColor,
          }}>
            <span style={{
              fontFamily: 'monospace', fontSize: 28,
              color: card.accentColor, lineHeight: 1,
            }}>
              {card.icon}
            </span>
          </div>
        )}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.07) 3px,rgba(0,0,0,0.07) 4px)',
        }} />
      </div>
      <div style={{
        background: 'rgba(0,0,0,0.82)',
        borderTop: `1px solid ${dimmed ? '#333' : card.accentColor}33`,
        padding: '5px 6px',
      }}>
        <span className="font-pixel" style={{
          fontSize: '6px',
          color: dimmed ? '#555' : card.accentColor,
          letterSpacing: '0.4px',
          display: 'block', textAlign: 'center',
          whiteSpace: 'pre-line', lineHeight: 1.4,
        }}>
          {card.name.toUpperCase()}
        </span>
      </div>
    </div>
  )
}
