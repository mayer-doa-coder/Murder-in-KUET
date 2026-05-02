// ── Basic game enums ──────────────────────────────────────────────────────────
export type Difficulty  = 'easy' | 'medium' | 'hard'
export type PlayerType  = 'human' | 'computer'
export type CardCategory = 'suspect' | 'weapon' | 'location'

export type Screen =
  | 'intro'
  | 'difficulty'
  | 'playerCount'
  | 'characterSelect'
  | 'playerType'
  | 'confirmation'
  | 'cardShuffle'
  | 'playerCardsMenu'
  | 'playerCardView'

// ── Setup-phase types ─────────────────────────────────────────────────────────
export interface Character {
  id: string
  name: string
  title: string
  bgColor: string
  borderColor: string
  accentColor: string
  icon: string
}

export interface PlayerSetup {
  character: Character
  type: PlayerType
}

// ── Card system ───────────────────────────────────────────────────────────────
export interface Card {
  id: string
  name: string
  shortName: string     // ≤3 chars — compact label
  category: CardCategory
  icon: string          // Unicode symbol
  bgColor: string       // face-up background
  accentColor: string   // icon + text color
}

export interface GameDeal {
  caseFile: { suspect: Card; weapon: Card; location: Card }
  playerHands: Card[][]   // [P1 cards, P2 cards, P3 cards]
}

// ── Character roster (updated suspect names) ──────────────────────────────────
export const CHARACTERS: Character[] = [
  {
    id: 'chef',
    name: 'CHEF',
    title: 'THE COOK',
    bgColor: '#2a0800',
    borderColor: '#884422',
    accentColor: '#ff6633',
    icon: '♛',
  },
  {
    id: 'hallboy',
    name: 'HALLBOY',
    title: 'THE SERVANT',
    bgColor: '#1a1500',
    borderColor: '#6a5500',
    accentColor: '#ccaa00',
    icon: '◇',
  },
  {
    id: 'security_guard',
    name: 'SECURITY GUARD',
    title: 'THE WARDEN',
    bgColor: '#0a0a2a',
    borderColor: '#223388',
    accentColor: '#4466ff',
    icon: '⚔',
  },
  {
    id: 'shopkeeper',
    name: 'SHOPKEEPER',
    title: 'THE MERCHANT',
    bgColor: '#082008',
    borderColor: '#226622',
    accentColor: '#44cc44',
    icon: '♟',
  },
  {
    id: 'student_girl',
    name: 'STUDENT GIRL',
    title: 'THE SCHOLAR',
    bgColor: '#1a0828',
    borderColor: '#6622aa',
    accentColor: '#cc44ff',
    icon: '✿',
  },
  {
    id: 'student_boy',
    name: 'STUDENT BOY',
    title: 'THE STUDENT',
    bgColor: '#001a20',
    borderColor: '#115566',
    accentColor: '#22aacc',
    icon: '♞',
  },
]

// ── Suspects (6) ──────────────────────────────────────────────────────────────
export const SUSPECTS_CARDS: Card[] = [
  { id: 'chef',           name: 'Chef',           shortName: 'CHF', category: 'suspect', icon: '♛', bgColor: '#2a0800', accentColor: '#ff6633' },
  { id: 'hallboy',        name: 'Hallboy',         shortName: 'HBY', category: 'suspect', icon: '◇', bgColor: '#1a1500', accentColor: '#ccaa00' },
  { id: 'security_guard', name: 'Security Guard',  shortName: 'SGD', category: 'suspect', icon: '⚔', bgColor: '#0a0a2a', accentColor: '#4466ff' },
  { id: 'shopkeeper',     name: 'Shopkeeper',      shortName: 'SHK', category: 'suspect', icon: '♟', bgColor: '#082008', accentColor: '#44cc44' },
  { id: 'student_girl',   name: 'Student Girl',    shortName: 'SGR', category: 'suspect', icon: '✿', bgColor: '#1a0828', accentColor: '#cc44ff' },
  { id: 'student_boy',    name: 'Student Boy',     shortName: 'SBY', category: 'suspect', icon: '♞', bgColor: '#001a20', accentColor: '#22aacc' },
]

// ── Weapons (6) ───────────────────────────────────────────────────────────────
export const WEAPONS_CARDS: Card[] = [
  { id: 'knife',          name: 'Knife',           shortName: 'KNF', category: 'weapon', icon: '†',  bgColor: '#1a1a1a', accentColor: '#cccccc' },
  { id: 'sleeping_pills', name: 'Sleeping Pills',  shortName: 'SLP', category: 'weapon', icon: '●',  bgColor: '#0a0a20', accentColor: '#8899ff' },
  { id: 'revolver',       name: 'Revolver',        shortName: 'RVL', category: 'weapon', icon: '⊛',  bgColor: '#1a1000', accentColor: '#ddcc22' },
  { id: 'laptop_charger', name: 'Laptop Charger',  shortName: 'LPC', category: 'weapon', icon: '⚡', bgColor: '#000a1a', accentColor: '#22aaff' },
  { id: 'anti_cutter',    name: 'Anti Cutter',     shortName: 'ACT', category: 'weapon', icon: '✦',  bgColor: '#1a0800', accentColor: '#ff8833' },
  { id: 'rope',           name: 'Rope',            shortName: 'RPE', category: 'weapon', icon: '∿',  bgColor: '#0d0800', accentColor: '#cc8833' },
]

// ── Locations (9) ─────────────────────────────────────────────────────────────
export const LOCATIONS_CARDS: Card[] = [
  { id: 'auditorium',        name: 'Auditorium',              shortName: 'AUD', category: 'location', icon: '▲', bgColor: '#180018', accentColor: '#aa44ff' },
  { id: 'student_welfare',   name: 'Student Welfare Center',  shortName: 'SWC', category: 'location', icon: '✦', bgColor: '#001a0a', accentColor: '#44cc77' },
  { id: 'amar_ekushey',      name: 'Amar Ekushey Hall',       shortName: 'AEH', category: 'location', icon: '♦', bgColor: '#1a0000', accentColor: '#ff4444' },
  { id: 'cafeteria',         name: 'Cafeteria',               shortName: 'CAF', category: 'location', icon: '□', bgColor: '#1a0d00', accentColor: '#ffaa22' },
  { id: 'central_field',     name: 'Central Field',           shortName: 'CTF', category: 'location', icon: '◆', bgColor: '#001800', accentColor: '#44ff44' },
  { id: 'it_park',           name: 'IT Park',                 shortName: 'ITP', category: 'location', icon: '⌘', bgColor: '#00001a', accentColor: '#4488ff' },
  { id: 'begum_rokeya',      name: 'Begum Rokeya Hall',       shortName: 'BRH', category: 'location', icon: '◎', bgColor: '#1a0014', accentColor: '#ff55aa' },
  { id: 'lotus_pond',        name: 'Lotus Pond',              shortName: 'LTP', category: 'location', icon: '◉', bgColor: '#001a1a', accentColor: '#44cccc' },
  { id: 'pocket_gate',       name: 'Pocket Gate',             shortName: 'PGT', category: 'location', icon: '⬡', bgColor: '#0d0d0d', accentColor: '#888888' },
]

export const ALL_CARDS: Card[] = [
  ...SUSPECTS_CARDS,
  ...WEAPONS_CARDS,
  ...LOCATIONS_CARDS,
]

// ── Utilities ─────────────────────────────────────────────────────────────────
export function shuffleDeck<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
