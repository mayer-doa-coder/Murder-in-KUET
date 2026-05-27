import suspectChefImg        from './assets/cards/suspect_chef.png'
import suspectHallboyImg     from './assets/cards/suspect_hallboy.png'
import suspectSecurityImg    from './assets/cards/suspect_security_guard.png'
import suspectShopkeeperImg  from './assets/cards/suspect_shopkeeper.png'
import suspectStudentBoyImg  from './assets/cards/suspect_student_boy.png'
import suspectStudentGirlImg from './assets/cards/suspect_student_girl.png'
import weaponAntiCutterImg   from './assets/cards/weapon_anti_cutter.png'
import weaponKnifeImg        from './assets/cards/weapon_knife.png'
import weaponLaptopImg       from './assets/cards/weapon_laptop_charger.png'
import weaponRevolverImg     from './assets/cards/weapon_revolver.png'
import weaponRopeImg         from './assets/cards/weapon_rope.png'
import weaponPillImg         from './assets/cards/weapon_sleeping_pill.png'
import locationAmarImg       from './assets/cards/location_Amar_Ekushey_Hall.png'
import locationAuditoriumImg from './assets/cards/location_auditorium.png'
import locationBegumImg      from './assets/cards/location_begum_rokeya_hall.png'
import locationCafeteriaImg  from './assets/cards/location_cafetaria.png'
import locationFieldImg      from './assets/cards/location_central_field.png'
import locationITParkImg     from './assets/cards/location_it_park.png'
import locationLotusImg      from './assets/cards/location_lotus_pond.png'
import locationGateImg       from './assets/cards/location_pocket_gate.png'
import locationWelfareImg    from './assets/cards/location_student_welfare_center.png'

// ── Basic game enums ──────────────────────────────────────────────────────────
export type Difficulty   = 'easy' | 'medium' | 'hard'
export type PlayerType   = 'human' | 'computer'
export type CardCategory = 'suspect' | 'weapon' | 'location'
export type GamePhase    = 'idle' | 'rolling' | 'dice' | 'moving' | 'interrogation' | 'accusation' | 'story' | 'reveal_result' | 'game_over'
export type GameMode     = 'human_vs_human' | 'human_vs_ai' | 'ai_vs_ai'
export type AIAlgorithm  = 'random' | 'rule_based' | 'minimax' | 'expectiminimax' | 'negamax' | 'monte_carlo' | 'mcts'

export const AI_ALGORITHM_LABELS: Record<AIAlgorithm, string> = {
  random:         'RANDOM',
  rule_based:     'RULE-BASED',
  minimax:        'MINIMAX',
  expectiminimax: 'EXPECTIMINIMAX',
  negamax:        'NEGAMAX',
  monte_carlo:    'MONTE CARLO',
  mcts:           'MCTS',
}

export const ALL_ALGORITHMS: AIAlgorithm[] = [
  'random', 'rule_based', 'minimax', 'expectiminimax', 'negamax', 'monte_carlo', 'mcts',
]

export interface PlayerStatus {
  eliminated: boolean
  hasAccused:  boolean
}

export interface RevealResult {
  type:               'interrogation' | 'accusation'
  suspectId:          string
  weaponId:           string
  locationId:         string  // location card id (mapped from room id for interrogation)
  roomName?:          string  // human-readable room name (interrogation only)
  revealedCardId:     string | null
  revealedByName:     string | null
  correct?:           boolean       // accusation only
  accusingPlayerName?: string
  accusingPlayerIcon?: string
}

export type Screen =
  | 'intro'
  | 'howToPlay'
  | 'gameMode'
  | 'difficulty'
  | 'playerCount'
  | 'algorithmSelect'
  | 'characterSelect'
  | 'playerType'
  | 'confirmation'
  | 'cardShuffle'
  | 'playerCardsMenu'
  | 'playerCardView'
  | 'gameBoard'

// ── Board types ───────────────────────────────────────────────────────────────
export type CellType = 'hallway' | 'room' | 'void' | 'start' | 'door'

export interface Cell {
  type: CellType
  roomId: string | null
  isWalkable: boolean
}

export interface BoardPlayer {
  id: string
  name: string
  icon: string
  imageSrc?: string
  accentColor: string
  position: [number, number]        // [col, row]; when inside a room this is the entry door cell
  currentLocation: string | null    // roomId when fully inside a room, null when on grid
}

// ── Setup-phase types ─────────────────────────────────────────────────────────
export interface Character {
  id: string
  name: string
  title: string
  bgColor: string
  borderColor: string
  accentColor: string
  icon: string
  imageSrc?: string
}

export interface PlayerSetup {
  character:    Character
  type:         PlayerType
  aiAlgorithm?: AIAlgorithm  // only set for computer players
}

// ── Probability Notebook ──────────────────────────────────────────────────────
export interface ProbabilityData {
  suspects:  Record<string, number>  // card id → 0.0–1.0
  weapons:   Record<string, number>
  locations: Record<string, number>
}

// ── Card system ───────────────────────────────────────────────────────────────
export interface Card {
  id: string
  name: string
  shortName: string     // ≤3 chars — compact label
  category: CardCategory
  icon: string          // Unicode symbol (fallback)
  imageSrc?: string     // PNG asset; renders instead of icon when present
  bgColor: string       // face-up background
  accentColor: string   // icon + text color
}

export interface GameDeal {
  caseFile: { suspect: Card; weapon: Card; location: Card }
  playerHands: Card[][]   // [P1 cards, P2 cards, P3 cards]
}

// ── Character roster ──────────────────────────────────────────────────────────
export const CHARACTERS: Character[] = [
  {
    id: 'chef',
    name: 'CHEF',
    title: 'THE COOK',
    bgColor: '#2a0800',
    borderColor: '#884422',
    accentColor: '#ff6633',
    icon: '♛',
    imageSrc: suspectChefImg,
  },
  {
    id: 'hallboy',
    name: 'HALLBOY',
    title: 'THE SERVANT',
    bgColor: '#1a1500',
    borderColor: '#6a5500',
    accentColor: '#ccaa00',
    icon: '◇',
    imageSrc: suspectHallboyImg,
  },
  {
    id: 'security_guard',
    name: 'SECURITY GUARD',
    title: 'THE WARDEN',
    bgColor: '#0a0a2a',
    borderColor: '#223388',
    accentColor: '#4466ff',
    icon: '⚔',
    imageSrc: suspectSecurityImg,
  },
  {
    id: 'shopkeeper',
    name: 'SHOPKEEPER',
    title: 'THE MERCHANT',
    bgColor: '#082008',
    borderColor: '#226622',
    accentColor: '#44cc44',
    icon: '♟',
    imageSrc: suspectShopkeeperImg,
  },
  {
    id: 'student_girl',
    name: 'STUDENT GIRL',
    title: 'THE SCHOLAR',
    bgColor: '#1a0828',
    borderColor: '#6622aa',
    accentColor: '#cc44ff',
    icon: '✿',
    imageSrc: suspectStudentGirlImg,
  },
  {
    id: 'student_boy',
    name: 'STUDENT BOY',
    title: 'THE STUDENT',
    bgColor: '#001a20',
    borderColor: '#115566',
    accentColor: '#22aacc',
    icon: '♞',
    imageSrc: suspectStudentBoyImg,
  },
]

// ── Suspects (6) ──────────────────────────────────────────────────────────────
export const SUSPECTS_CARDS: Card[] = [
  { id: 'chef',           name: 'Chef',           shortName: 'CHF', category: 'suspect', icon: '♛', imageSrc: suspectChefImg,        bgColor: '#2a0800', accentColor: '#ff6633' },
  { id: 'hallboy',        name: 'Hallboy',         shortName: 'HBY', category: 'suspect', icon: '◇', imageSrc: suspectHallboyImg,     bgColor: '#1a1500', accentColor: '#ccaa00' },
  { id: 'security_guard', name: 'Security Guard',  shortName: 'SGD', category: 'suspect', icon: '⚔', imageSrc: suspectSecurityImg,    bgColor: '#0a0a2a', accentColor: '#4466ff' },
  { id: 'shopkeeper',     name: 'Shopkeeper',      shortName: 'SHK', category: 'suspect', icon: '♟', imageSrc: suspectShopkeeperImg,  bgColor: '#082008', accentColor: '#44cc44' },
  { id: 'student_girl',   name: 'Student Girl',    shortName: 'SGR', category: 'suspect', icon: '✿', imageSrc: suspectStudentGirlImg, bgColor: '#1a0828', accentColor: '#cc44ff' },
  { id: 'student_boy',    name: 'Student Boy',     shortName: 'SBY', category: 'suspect', icon: '♞', imageSrc: suspectStudentBoyImg,  bgColor: '#001a20', accentColor: '#22aacc' },
]

// ── Weapons (6) ───────────────────────────────────────────────────────────────
export const WEAPONS_CARDS: Card[] = [
  { id: 'knife',          name: 'Knife',           shortName: 'KNF', category: 'weapon', icon: '†',  imageSrc: weaponKnifeImg,      bgColor: '#1a1a1a', accentColor: '#cccccc' },
  { id: 'sleeping_pills', name: 'Sleeping Pills',  shortName: 'SLP', category: 'weapon', icon: '●',  imageSrc: weaponPillImg,       bgColor: '#0a0a20', accentColor: '#8899ff' },
  { id: 'revolver',       name: 'Revolver',        shortName: 'RVL', category: 'weapon', icon: '⊛',  imageSrc: weaponRevolverImg,   bgColor: '#1a1000', accentColor: '#ddcc22' },
  { id: 'laptop_charger', name: 'Laptop Charger',  shortName: 'LPC', category: 'weapon', icon: '⚡', imageSrc: weaponLaptopImg,     bgColor: '#000a1a', accentColor: '#22aaff' },
  { id: 'anti_cutter',    name: 'Anti Cutter',     shortName: 'ACT', category: 'weapon', icon: '✦',  imageSrc: weaponAntiCutterImg, bgColor: '#1a0800', accentColor: '#ff8833' },
  { id: 'rope',           name: 'Rope',            shortName: 'RPE', category: 'weapon', icon: '∿',  imageSrc: weaponRopeImg,       bgColor: '#0d0800', accentColor: '#cc8833' },
]

// ── Locations (9) ─────────────────────────────────────────────────────────────
export const LOCATIONS_CARDS: Card[] = [
  { id: 'auditorium',        name: 'Auditorium',              shortName: 'AUD', category: 'location', icon: '▲', imageSrc: locationAuditoriumImg, bgColor: '#180018', accentColor: '#aa44ff' },
  { id: 'student_welfare',   name: 'Student Welfare Center',  shortName: 'SWC', category: 'location', icon: '✦', imageSrc: locationWelfareImg,    bgColor: '#001a0a', accentColor: '#44cc77' },
  { id: 'amar_ekushey',      name: 'Amar Ekushey Hall',       shortName: 'AEH', category: 'location', icon: '♦', imageSrc: locationAmarImg,       bgColor: '#1a0000', accentColor: '#ff4444' },
  { id: 'cafeteria',         name: 'Cafeteria',               shortName: 'CAF', category: 'location', icon: '□', imageSrc: locationCafeteriaImg,  bgColor: '#1a0d00', accentColor: '#ffaa22' },
  { id: 'central_field',     name: 'Central Field',           shortName: 'CTF', category: 'location', icon: '◆', imageSrc: locationFieldImg,      bgColor: '#001800', accentColor: '#44ff44' },
  { id: 'it_park',           name: 'IT Park',                 shortName: 'ITP', category: 'location', icon: '⌘', imageSrc: locationITParkImg,     bgColor: '#00001a', accentColor: '#4488ff' },
  { id: 'begum_rokeya',      name: 'Begum Rokeya Hall',       shortName: 'BRH', category: 'location', icon: '◎', imageSrc: locationBegumImg,      bgColor: '#1a0014', accentColor: '#ff55aa' },
  { id: 'lotus_pond',        name: 'Lotus Pond',              shortName: 'LTP', category: 'location', icon: '◉', imageSrc: locationLotusImg,      bgColor: '#001a1a', accentColor: '#44cccc' },
  { id: 'pocket_gate',       name: 'Pocket Gate',             shortName: 'PGT', category: 'location', icon: '⬡', imageSrc: locationGateImg,       bgColor: '#0d0d0d', accentColor: '#888888' },
]

export const ALL_CARDS: Card[] = [
  ...SUSPECTS_CARDS,
  ...WEAPONS_CARDS,
  ...LOCATIONS_CARDS,
]

// ── Clue Notebook ─────────────────────────────────────────────────────────────
export type NotebookBoxState = '' | 'X' | '✓'

export interface NotebookData {
  suspects:  Record<string, NotebookBoxState>
  weapons:   Record<string, NotebookBoxState>
  locations: Record<string, NotebookBoxState>
}

// ── Utilities ─────────────────────────────────────────────────────────────────
export function shuffleDeck<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
