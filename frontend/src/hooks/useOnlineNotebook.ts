// useOnlineNotebook.ts — Client-side clue notebook for online play. Local's
// human players only ever get a blank, manually-filled notebook (the
// auto-deduction ProbabilityNotebook is exclusively an AI aid, never shown to
// humans) — so online mirrors that exactly: a private, per-viewer scratch grid
// with no server involvement, matching local's useNotebooks human-facing slice.

import { useState, useCallback } from 'react'
import type { NotebookData, NotebookBoxState } from '../types'
import { SUSPECTS_CARDS, WEAPONS_CARDS, LOCATIONS_CARDS } from '../types'

function emptyNotebook(): NotebookData {
  const suspects:  Record<string, NotebookBoxState> = {}
  const weapons:   Record<string, NotebookBoxState> = {}
  const locations: Record<string, NotebookBoxState> = {}
  SUSPECTS_CARDS.forEach(c  => { suspects[c.id]  = '' })
  WEAPONS_CARDS.forEach(c   => { weapons[c.id]   = '' })
  LOCATIONS_CARDS.forEach(c => { locations[c.id] = '' })
  return { suspects, weapons, locations }
}

export interface OnlineNotebookValues {
  notebook:          NotebookData
  showNotebook:       boolean
  setShowNotebook:    (v: boolean) => void
  updateNotebookBox:  (
    category: 'suspects' | 'weapons' | 'locations',
    cardId:   string,
    state:    NotebookBoxState,
  ) => void
}

export function useOnlineNotebook(): OnlineNotebookValues {
  const [notebook, setNotebook]         = useState<NotebookData>(emptyNotebook)
  const [showNotebook, setShowNotebook] = useState(false)

  const updateNotebookBox = useCallback((
    category: 'suspects' | 'weapons' | 'locations',
    cardId:   string,
    state:    NotebookBoxState,
  ) => {
    setNotebook(prev => ({ ...prev, [category]: { ...prev[category], [cardId]: state } }))
  }, [])

  return { notebook, showNotebook, setShowNotebook, updateNotebookBox }
}
