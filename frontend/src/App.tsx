import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import LayoutWrapper from './components/LayoutWrapper'
import IntroScreen from './screens/IntroScreen'
import DifficultyScreen from './screens/DifficultyScreen'
import PlayerCountScreen from './screens/PlayerCountScreen'
import CharacterSelectScreen from './screens/CharacterSelectScreen'
import PlayerTypeScreen from './screens/PlayerTypeScreen'
import ConfirmationScreen from './screens/ConfirmationScreen'
import CardShuffleScreen from './screens/CardShuffleScreen'
import PlayerCardsMenuScreen from './screens/PlayerCardsMenuScreen'
import PlayerCardViewScreen from './screens/PlayerCardViewScreen'
import type { Difficulty, PlayerType, Screen, Character, PlayerSetup, GameDeal } from './types'

const PLAYER_COUNT = 3

const pageVariants = {
  initial: { opacity: 0, y: 28 },
  enter:   { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -28 },
}

const pageTransition = {
  duration: 0.5,
  ease: [0.22, 1, 0.36, 1] as const,
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]                         = useState<Screen>('intro')
  const [difficulty, setDifficulty]                 = useState<Difficulty | null>(null)
  const [players, setPlayers]                       = useState<PlayerSetup[]>([])
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0)
  const [selectedCharacter, setSelectedCharacter]   = useState<Character | null>(null)
  const [selectedType, setSelectedType]             = useState<PlayerType>('human')
  const [deal, setDeal]                             = useState<GameDeal | null>(null)
  const [currentViewingPlayer, setCurrentViewingPlayer] = useState(0)

  // ── reset all setup state ─────────────────────────────────────────────────
  const resetSetup = useCallback(() => {
    setPlayers([])
    setCurrentPlayerIndex(0)
    setSelectedCharacter(null)
    setSelectedType('human')
    setDeal(null)
    setCurrentViewingPlayer(0)
  }, [])

  // ── setup-phase handlers ──────────────────────────────────────────────────
  const handleDifficultySelect = useCallback((d: Difficulty) => {
    setDifficulty(d)
    setScreen('playerCount')
  }, [])

  const handlePlayerCountConfirm = useCallback(() => {
    resetSetup()
    setScreen('characterSelect')
  }, [resetSetup])

  const handleCharacterSelect = useCallback((char: Character) => {
    setSelectedCharacter(char)
    setScreen('playerType')
  }, [])

  const handlePlayerTypeSelect = useCallback((type: PlayerType) => {
    setSelectedType(type)
    setScreen('confirmation')
  }, [])

  const handleConfirmNext = useCallback(() => {
    if (!selectedCharacter) return
    const newPlayer: PlayerSetup = { character: selectedCharacter, type: selectedType }
    const newPlayers = [...players, newPlayer]
    setPlayers(newPlayers)

    if (currentPlayerIndex >= PLAYER_COUNT - 1) {
      setScreen('cardShuffle')
    } else {
      setCurrentPlayerIndex(currentPlayerIndex + 1)
      setSelectedCharacter(null)
      setSelectedType('human')
      setScreen('characterSelect')
    }
  }, [selectedCharacter, selectedType, players, currentPlayerIndex])

  const handleConfirmBack = useCallback(() => {
    setScreen('playerType')
  }, [])

  const handlePlayerTypeBack = useCallback(() => {
    setSelectedCharacter(null)
    setScreen('characterSelect')
  }, [])

  const handleCharacterSelectBack = useCallback(() => {
    if (currentPlayerIndex === 0) {
      setScreen('playerCount')
    } else {
      setPlayers(prev => prev.slice(0, -1))
      const prevIndex = currentPlayerIndex - 1
      setCurrentPlayerIndex(prevIndex)
      setSelectedCharacter(players[prevIndex].character)
      setSelectedType(players[prevIndex].type)
      setScreen('confirmation')
    }
  }, [currentPlayerIndex, players])

  // ── card-deal handlers ────────────────────────────────────────────────────
  const handleShuffleComplete = useCallback((gameDeal: GameDeal) => {
    setDeal(gameDeal)
    setScreen('playerCardsMenu')
  }, [])

  const handleViewPlayer = useCallback((playerIndex: number) => {
    setCurrentViewingPlayer(playerIndex)
    setScreen('playerCardView')
  }, [])

  const handleCardViewBack = useCallback(() => {
    setScreen('playerCardsMenu')
  }, [])

  // ── restart ───────────────────────────────────────────────────────────────
  const handleRestart = useCallback(() => {
    resetSetup()
    setDifficulty(null)
    setScreen('intro')
  }, [resetSetup])

  const takenCharacterIds = players.map(p => p.character.id)

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <LayoutWrapper>
      <AnimatePresence mode="wait">

        {screen === 'intro' && (
          <motion.div key="intro" className="absolute inset-0"
            variants={pageVariants} initial="initial" animate="enter" exit="exit" transition={pageTransition}>
            <IntroScreen onEnter={() => setScreen('difficulty')} />
          </motion.div>
        )}

        {screen === 'difficulty' && (
          <motion.div key="difficulty" className="absolute inset-0"
            variants={pageVariants} initial="initial" animate="enter" exit="exit" transition={pageTransition}>
            <DifficultyScreen onSelect={handleDifficultySelect} />
          </motion.div>
        )}

        {screen === 'playerCount' && (
          <motion.div key="playerCount" className="absolute inset-0"
            variants={pageVariants} initial="initial" animate="enter" exit="exit" transition={pageTransition}>
            <PlayerCountScreen onConfirm={handlePlayerCountConfirm} />
          </motion.div>
        )}

        {screen === 'characterSelect' && (
          <motion.div key={`characterSelect-${currentPlayerIndex}`} className="absolute inset-0"
            variants={pageVariants} initial="initial" animate="enter" exit="exit" transition={pageTransition}>
            <CharacterSelectScreen
              playerIndex={currentPlayerIndex}
              takenIds={takenCharacterIds}
              onSelect={handleCharacterSelect}
              onBack={handleCharacterSelectBack}
            />
          </motion.div>
        )}

        {screen === 'playerType' && selectedCharacter && (
          <motion.div key={`playerType-${currentPlayerIndex}`} className="absolute inset-0"
            variants={pageVariants} initial="initial" animate="enter" exit="exit" transition={pageTransition}>
            <PlayerTypeScreen
              playerIndex={currentPlayerIndex}
              character={selectedCharacter}
              onSelect={handlePlayerTypeSelect}
              onBack={handlePlayerTypeBack}
            />
          </motion.div>
        )}

        {screen === 'confirmation' && selectedCharacter && (
          <motion.div key={`confirmation-${currentPlayerIndex}`} className="absolute inset-0"
            variants={pageVariants} initial="initial" animate="enter" exit="exit" transition={pageTransition}>
            <ConfirmationScreen
              playerIndex={currentPlayerIndex}
              character={selectedCharacter}
              playerType={selectedType}
              isLastPlayer={currentPlayerIndex === PLAYER_COUNT - 1}
              onNext={handleConfirmNext}
              onBack={handleConfirmBack}
            />
          </motion.div>
        )}

        {screen === 'cardShuffle' && (
          <motion.div key="cardShuffle" className="absolute inset-0"
            variants={pageVariants} initial="initial" animate="enter" exit="exit" transition={pageTransition}>
            <CardShuffleScreen
              players={players}
              onComplete={handleShuffleComplete}
            />
          </motion.div>
        )}

        {screen === 'playerCardsMenu' && deal && (
          <motion.div key="playerCardsMenu" className="absolute inset-0"
            variants={pageVariants} initial="initial" animate="enter" exit="exit" transition={pageTransition}>
            <PlayerCardsMenuScreen
              players={players}
              deal={deal}
              onViewPlayer={handleViewPlayer}
            />
          </motion.div>
        )}

        {screen === 'playerCardView' && deal && (
          <motion.div key={`playerCardView-${currentViewingPlayer}`} className="absolute inset-0"
            variants={pageVariants} initial="initial" animate="enter" exit="exit" transition={pageTransition}>
            <PlayerCardViewScreen
              playerIndex={currentViewingPlayer}
              players={players}
              deal={deal}
              onBack={handleCardViewBack}
            />
          </motion.div>
        )}

      </AnimatePresence>

      {/* Persistent HUD */}
      {screen !== 'intro' && (
        <motion.div
          className="absolute bottom-2 left-3 font-pixel z-50"
          style={{ fontSize: '5px', color: '#1e1400', letterSpacing: '1px', pointerEvents: 'none' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
        >
          {difficulty ? `LVL:${difficulty.toUpperCase()}` : ''}
          {['characterSelect', 'playerType', 'confirmation'].includes(screen)
            ? `  P${currentPlayerIndex + 1}/${PLAYER_COUNT}`
            : ''}
        </motion.div>
      )}

      {/* Restart button on playerCardsMenu */}
      {screen === 'playerCardsMenu' && (
        <motion.button
          className="absolute bottom-4 right-4 z-50 font-pixel"
          style={{
            background: '#1a0800',
            border: '2px solid #3d2000',
            color: '#4a2a10',
            padding: '5px 10px',
            fontSize: '5px',
            letterSpacing: '1px',
            cursor: 'pointer',
          }}
          onClick={handleRestart}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          whileHover={{ opacity: 1, color: '#aa6030' }}
        >
          ↺ RESTART
        </motion.button>
      )}
    </LayoutWrapper>
  )
}
