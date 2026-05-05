import { ALL_CARDS } from '../types'

const BY_ID = Object.fromEntries(ALL_CARDS.map(c => [c.id, c]))

const TEMPLATES: Array<(suspect: string, weapon: string, location: string) => string> = [
  (s, w, l) => `${s} was seen at the ${l} clutching a ${w}. The lights flickered. Then — silence.`,
  (s, w, l) => `A witness spotted ${s} near the ${l} with a ${w}. By morning, the body was found.`,
  (s, w, l) => `${s} was the last to leave the ${l}. A ${w} was found nearby, still warm from use.`,
  (s, w, l) => `Security logs place ${s} inside the ${l} at midnight. The ${w} was discovered at dawn.`,
  (s, w, l) => `Someone heard a struggle at the ${l}. Only ${s} was seen walking away — carrying a ${w}.`,
  (s, w, l) => `The ${l} was locked from inside. ${s} had the key. A ${w} lay abandoned on the floor.`,
  (s, w, l) => `${s} entered the ${l} alone after hours. A ${w} was concealed in their bag.`,
  (s, w, l) => `A cry rang out from the ${l}. When they arrived, ${s} stood there — a ${w} in hand.`,
  (s, w, l) => `Witnesses saw ${s} rushing from the ${l}, breathing hard. The ${w} was never returned.`,
  (s, w, l) => `${s} claimed to be elsewhere. But the ${w} found at the ${l} tells a different story.`,
  (s, w, l) => `The ${l} held one secret too many. ${s} was there — and so was the ${w}.`,
  (s, w, l) => `No alibi. No witnesses. Only ${s}, the ${l}, and a ${w} that shouldn't have been there.`,
]

export function generateStory(suspectId: string, weaponId: string, locationId: string): string {
  const suspect  = BY_ID[suspectId]?.name  ?? suspectId
  const weapon   = BY_ID[weaponId]?.name   ?? weaponId
  const location = BY_ID[locationId]?.name ?? locationId
  const idx = Math.floor(Math.random() * TEMPLATES.length)
  return TEMPLATES[idx](suspect, weapon, location)
}
