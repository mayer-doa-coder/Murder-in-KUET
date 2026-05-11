import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import LayoutWrapper from './components/LayoutWrapper'
import IntroScreen from './screens/IntroScreen'
import GameModeScreen from './screens/GameModeScreen'
import DifficultyScreen from './screens/DifficultyScreen'
import PlayerCountScreen from './screens/PlayerCountScreen'
import AlgorithmSelectScreen from './screens/AlgorithmSelectScreen'
import CharacterSelectScreen from './screens/CharacterSelectScreen'
import PlayerTypeScreen from './screens/PlayerTypeScreen'
import ConfirmationScreen from './screens/ConfirmationScreen'
import CardShuffleScreen from './screens/CardShuffleScreen'
import PlayerCardsMenuScreen from './screens/PlayerCardsMenuScreen'
import PlayerCardViewScreen from './screens/PlayerCardViewScreen'
import GameBoardScreen from './screens/GameBoardScreen'
import HowToPlayScreen from './screens/HowToPlayScreen'
import type { Difficulty, PlayerType, Screen, Character, PlayerSetup, GameDeal, GameMode, AIAlgorithm } from './types'

const pageVariants = {
  initial: { opacity: 0, y: 28 },
  enter:   { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -28 },
}

const pageTransition = {
  duration: 0.5,
  ease: [0.22, 1, 0.36, 1] as const,
}

function difficultyToAlgorithm(d: Difficulty): AIAlgorithm {
  if (d === 'easy')   return 'random'
  if (d === 'medium') return 'rule_based'
  return 'minimax'
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]                         = useState<Screen>('intro')
  const [gameMode, setGameMode]                     = useState<GameMode>('human_vs_ai')
  const [difficulty, setDifficulty]                 = useState<Difficulty | null>(null)
  const [playerCount, setPlayerCount]               = useState<3 | 4 | 5 | 6>(3)
  const [playerAlgorithms, setPlayerAlgorithms]     = useState<AIAlgorithm[]>([])
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

  // ── game-mode handlers ────────────────────────────────────────────────────
  const handleGameModeSelect = useCallback((mode: GameMode) => {
    setGameMode(mode)
    if (mode === 'human_vs_human') {
      setScreen('playerCount')
    } else if (mode === 'human_vs_ai') {
      setScreen('difficulty')
    } else {
      // ai_vs_ai → player count → algorithm select
      setScreen('playerCount')
    }
  }, [])

  const handleDifficultySelect = useCallback((d: Difficulty) => {
    setDifficulty(d)
    setScreen('playerCount')
  }, [])

  const handlePlayerCountSelect = useCallback((count: 3 | 4 | 5 | 6) => {
    setPlayerCount(count)
    resetSetup()
    if (gameMode === 'ai_vs_ai') {
      setScreen('algorithmSelect')
    } else {
      setScreen('characterSelect')
    }
  }, [resetSetup, gameMode])

  const handleAlgorithmSelectConfirm = useCallback((algorithms: AIAlgorithm[]) => {
    setPlayerAlgorithms(algorithms)
    setScreen('characterSelect')
  }, [])

  const handleCharacterSelect = useCallback((char: Character) => {
    setSelectedCharacter(char)
    if (gameMode === 'human_vs_human') {
      // all players are human — skip playerType screen
      setSelectedType('human')
      setScreen('confirmation')
    } else if (gameMode === 'ai_vs_ai') {
      // all players are computer — skip playerType screen
      setSelectedType('computer')
      setScreen('confirmation')
    } else {
      setScreen('playerType')
    }
  }, [gameMode])

  const handlePlayerTypeSelect = useCallback((type: PlayerType) => {
    setSelectedType(type)
    setScreen('confirmation')
  }, [])

  const handleConfirmNext = useCallback(() => {
    if (!selectedCharacter) return

    let algo: AIAlgorithm | undefined
    if (selectedType === 'computer') {
      if (gameMode === 'ai_vs_ai') {
        algo = playerAlgorithms[currentPlayerIndex] ?? 'rule_based'
      } else if (difficulty) {
        algo = difficultyToAlgorithm(difficulty)
      } else {
        algo = 'rule_based'
      }
    }

    const newPlayer: PlayerSetup = {
      character: selectedCharacter,
      type: selectedType,
      ...(algo !== undefined ? { aiAlgorithm: algo } : {}),
    }
    const newPlayers = [...players, newPlayer]
    setPlayers(newPlayers)

    if (currentPlayerIndex >= playerCount - 1) {
      setScreen('cardShuffle')
    } else {
      setCurrentPlayerIndex(currentPlayerIndex + 1)
      setSelectedCharacter(null)
      // Pre-set type for HvH / AIvAI modes
      if (gameMode === 'human_vs_human') setSelectedType('human')
      else if (gameMode === 'ai_vs_ai')  setSelectedType('computer')
      else                                setSelectedType('human')
      setScreen('characterSelect')
    }
  }, [selectedCharacter, selectedType, players, currentPlayerIndex, playerCount, gameMode, playerAlgorithms, difficulty])

  const handleConfirmBack = useCallback(() => {
    if (gameMode === 'human_vs_human' || gameMode === 'ai_vs_ai') {
      setScreen('characterSelect')
    } else {
      setScreen('playerType')
    }
  }, [gameMode])

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
    // In AI vs AI, skip the per-player card reveal and jump straight to the board
    if (gameMode === 'ai_vs_ai') {
      setScreen('gameBoard')
    } else {
      setScreen('playerCardsMenu')
    }
  }, [gameMode])

  const handleViewPlayer = useCallback((playerIndex: number) => {
    setCurrentViewingPlayer(playerIndex)
    setScreen('playerCardView')
  }, [])

  const handleCardViewBack = useCallback(() => {
    setScreen('playerCardsMenu')
  }, [])

  // ── restart ───────────────────────────────────────────────────────────────
  const handleStartGame = useCallback(() => {
    setScreen('gameBoard')
  }, [])

  const handleRestart = useCallback(() => {
    resetSetup()
    setDifficulty(null)
    setPlayerAlgorithms([])
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
            <IntroScreen onEnter={() => setScreen('howToPlay')} />
          </motion.div>
        )}

        {screen === 'howToPlay' && (
          <motion.div key="howToPlay" className="absolute inset-0"
            variants={pageVariants} initial="initial" animate="enter" exit="exit" transition={pageTransition}>
            <HowToPlayScreen onSkip={() => setScreen('gameMode')} />
          </motion.div>
        )}

        {screen === 'gameMode' && (
          <motion.div key="gameMode" className="absolute inset-0"
            variants={pageVariants} initial="initial" animate="enter" exit="exit" transition={pageTransition}>
            <GameModeScreen onSelect={handleGameModeSelect} />
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
            <PlayerCountScreen onSelect={handlePlayerCountSelect} />
          </motion.div>
        )}

        {screen === 'algorithmSelect' && (
          <motion.div key="algorithmSelect" className="absolute inset-0"
            variants={pageVariants} initial="initial" animate="enter" exit="exit" transition={pageTransition}>
            <AlgorithmSelectScreen playerCount={playerCount} onConfirm={handleAlgorithmSelectConfirm} />
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
              gameMode={gameMode}
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
              playerCount={playerCount}
              character={selectedCharacter}
              playerType={selectedType}
              isLastPlayer={currentPlayerIndex === playerCount - 1}
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
              playerCount={playerCount}
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
              onStart={handleStartGame}
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

        {screen === 'gameBoard' && deal && (
          <motion.div key="gameBoard" className="absolute inset-0"
            variants={pageVariants} initial="initial" animate="enter" exit="exit" transition={pageTransition}>
            <GameBoardScreen
              players={players}
              deal={deal}
              gameMode={gameMode}
              onExit={() => setScreen('playerCardsMenu')}
              onRestart={handleRestart}
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
            ? `  P${currentPlayerIndex + 1}/${playerCount}`
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
