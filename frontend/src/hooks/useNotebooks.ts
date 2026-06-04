import { useState, useRef, useEffect, useCallback } from 'react'
import type { PlayerSetup, GameDeal, NotebookData, NotebookBoxState, ProbabilityData } from '../types'
import { SUSPECTS_CARDS, WEAPONS_CARDS, LOCATIONS_CARDS } from '../types'
import { createProbabilityNotebook } from '../lib/probabilityNotebook'

function createEmptyNotebook(): NotebookData {
  const suspects:  Record<string, NotebookBoxState> = {}
  const weapons:   Record<string, NotebookBoxState> = {}
  const locations: Record<string, NotebookBoxState> = {}
  SUSPECTS_CARDS.forEach(c  => { suspects[c.id]  = '' })
  WEAPONS_CARDS.forEach(c   => { weapons[c.id]   = '' })
  LOCATIONS_CARDS.forEach(c => { locations[c.id] = '' })
  return { suspects, weapons, locations }
}

export interface NotebooksValues {
  notebooks: NotebookData[]
  setNotebooks: React.Dispatch<React.SetStateAction<NotebookData[]>>
  showNotebook: boolean
  setShowNotebook: (v: boolean) => void
  showCards: boolean
  setShowCards: (v: boolean) => void
  showAiNotebook: boolean
  setShowAiNotebook: (v: boolean) => void
  probNotebooks: ProbabilityData[]
  setProbNotebooks: React.Dispatch<React.SetStateAction<ProbabilityData[]>>
  updateNotebookBox: (
    playerIdx: number,
    category: 'suspects' | 'weapons' | 'locations',
    cardId: string,
    state: NotebookBoxState,
  ) => void
  probNotebooksRef: React.MutableRefObject<ProbabilityData[]>
}

export function useNotebooks(players: PlayerSetup[], deal: GameDeal): NotebooksValues {
  const [notebooks, setNotebooks] = useState<NotebookData[]>(
    () => players.map(() => createEmptyNotebook())
  )
  const [showNotebook,   setShowNotebook]   = useState(false)
  const [showCards,      setShowCards]      = useState(false)
  const [showAiNotebook, setShowAiNotebook] = useState(false)

  const [probNotebooks, setProbNotebooks] = useState<ProbabilityData[]>(() =>
    players.map((_, i) =>
      createProbabilityNotebook(deal.playerHands[i]?.map(c => c.id) ?? [])
    )
  )
  const probNotebooksRef = useRef(probNotebooks)
  useEffect(() => { probNotebooksRef.current = probNotebooks }, [probNotebooks])

  const updateNotebookBox = useCallback((
    playerIdx: number,
    category: 'suspects' | 'weapons' | 'locations',
    cardId: string,
    state: NotebookBoxState,
  ) => {
    setNotebooks(prev => prev.map((nb, i) =>
      i !== playerIdx ? nb : { ...nb, [category]: { ...nb[category], [cardId]: state } }
    ))
  }, [])

  return {
    notebooks, setNotebooks,
    showNotebook, setShowNotebook,
    showCards, setShowCards,
    showAiNotebook, setShowAiNotebook,
    probNotebooks, setProbNotebooks,
    updateNotebookBox,
    probNotebooksRef,
  }
}
