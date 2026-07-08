import { useState, useCallback, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import LayoutWrapper from './components/LayoutWrapper'
import { useBgMusic } from './hooks/useBgMusic'
import IntroScreen from './screens/IntroScreen'
import QuickPlayScreen from './screens/QuickPlayScreen'
import GameModeScreen from './screens/GameModeScreen'
import DifficultyScreen from './screens/DifficultyScreen'
import PlayerCountScreen from './screens/PlayerCountScreen'
import AlgorithmSelectScreen from './screens/AlgorithmSelectScreen'
import PlayerTypeScreen from './screens/PlayerTypeScreen'
import CardShuffleScreen from './screens/CardShuffleScreen'
import PlayerCardsMenuScreen from './screens/PlayerCardsMenuScreen'
import PlayerCardViewScreen from './screens/PlayerCardViewScreen'
import GameBoardScreen from './screens/GameBoardScreen'
import HowToPlayScreen from './screens/HowToPlayScreen'
import OnlineLobbyScreen from './screens/OnlineLobbyScreen'
import WaitingRoomScreen from './screens/WaitingRoomScreen'
import OnlineGameBoardScreen from './screens/OnlineGameBoardScreen'
import { useOnlineGame } from './hooks/useOnlineGame'
import type { Difficulty, PlayerType, Screen, PlayerSetup, GameDeal, GameMode, AIAlgorithm } from './types'
import { ALL_CARDS, makePlayer } from './types'

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
  return 'mcts'
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const { muted, toggleMute } = useBgMusic()
  useEffect(() => {
    ALL_CARDS.forEach(card => {
      if (card.imageSrc) {
        const img = new Image()
        img.src = card.imageSrc
      }
    })
  }, [])

  const [screen, setScreen]                         = useState<Screen>('intro')
  const [gameMode, setGameMode]                     = useState<GameMode>('human_vs_ai')
  const [difficulty, setDifficulty]                 = useState<Difficulty | null>(null)
  const [playerCount, setPlayerCount]               = useState<3 | 4 | 5 | 6>(3)
  const [players, setPlayers]                       = useState<PlayerSetup[]>([])
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0)
  const [deal, setDeal]                             = useState<GameDeal | null>(null)
  const [currentViewingPlayer, setCurrentViewingPlayer] = useState(0)

  // ── Online multiplayer (separate flow; local/AI modes are untouched) ────────
  const [onlineActive, setOnlineActive] = useState(false)
  const online = useOnlineGame(onlineActive)
  const leaveOnline = useCallback(() => { online.leaveRoom(); setOnlineActive(false) }, [online])

  // ── reset all setup state ─────────────────────────────────────────────────
  const resetSetup = useCallback(() => {
    setPlayers([])
    setCurrentPlayerIndex(0)
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
      // algorithms assigned on the next screen
      setScreen('algorithmSelect')
    } else if (gameMode === 'human_vs_human') {
      // every player is human — no per-player screen needed
      setPlayers(Array.from({ length: count }, (_, i) => makePlayer(i, 'human')))
      setScreen('cardShuffle')
    } else {
      // human_vs_ai → choose human/computer per player
      setScreen('playerType')
    }
  }, [resetSetup, gameMode])

  const handleAlgorithmSelectConfirm = useCallback((algorithms: AIAlgorithm[]) => {
    setPlayers(Array.from({ length: playerCount }, (_, i) =>
      makePlayer(i, 'computer', algorithms[i] ?? 'rule_based')
    ))
    setScreen('cardShuffle')
  }, [playerCount])

  // ── human_vs_ai: per-player type selection ────────────────────────────────
  const handlePlayerTypeSelect = useCallback((type: PlayerType) => {
    const algo = type === 'computer'
      ? (difficulty ? difficultyToAlgorithm(difficulty) : 'rule_based')
      : undefined
    const newPlayer = makePlayer(currentPlayerIndex, type, algo)
    const newPlayers = [...players, newPlayer]
    setPlayers(newPlayers)

    if (currentPlayerIndex >= playerCount - 1) {
      setScreen('cardShuffle')
    } else {
      setCurrentPlayerIndex(currentPlayerIndex + 1)
    }
  }, [players, currentPlayerIndex, playerCount, difficulty])

  const handlePlayerTypeBack = useCallback(() => {
    if (currentPlayerIndex === 0) {
      setScreen('playerCount')
    } else {
      setPlayers(prev => prev.slice(0, -1))
      setCurrentPlayerIndex(currentPlayerIndex - 1)
    }
  }, [currentPlayerIndex])

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

  // ── back navigation ──────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    switch (screen) {
      case 'quickPlay':       setScreen('intro'); break
      case 'howToPlay':       setScreen('intro'); break
      case 'gameMode':        setScreen('intro'); break
      case 'difficulty':      setScreen('gameMode'); break
      case 'playerCount':
        difficulty ? setScreen('difficulty') : setScreen('gameMode')
        break
      case 'algorithmSelect': setScreen('playerCount'); break
      case 'playerType':      handlePlayerTypeBack(); break
      case 'cardShuffle':     resetSetup(); setScreen('playerCount'); break
      case 'playerCardsMenu': resetSetup(); setScreen('gameMode'); break
      case 'playerCardView':  handleCardViewBack(); break
    }
  }, [screen, difficulty, handlePlayerTypeBack, handleCardViewBack, resetSetup])

  // ── restart ───────────────────────────────────────────────────────────────
  const handleStartGame = useCallback(() => {
    setScreen('gameBoard')
  }, [])

  const handleRestart = useCallback(() => {
    resetSetup()
    setDifficulty(null)
    setScreen('intro')
  }, [resetSetup])

  // ── Online mode takes over the whole screen while active ────────────────────
  if (onlineActive) {
    const node = online.view
      ? <OnlineGameBoardScreen online={online} onLeave={leaveOnline} />
      : online.roomUpdate
        ? <WaitingRoomScreen online={online} onLeave={leaveOnline} />
        : <OnlineLobbyScreen online={online} onBack={leaveOnline} />
    return <LayoutWrapper>{node}</LayoutWrapper>
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <LayoutWrapper>
      <AnimatePresence mode="wait">

        {screen === 'intro' && (
          <motion.div key="intro" className="absolute inset-0"
            variants={pageVariants} initial="initial" animate="enter" exit="exit" transition={pageTransition}>
            <IntroScreen
              onQuickPlay={() => setScreen('quickPlay')}
              onFullGuide={() => setScreen('howToPlay')}
            />
          </motion.div>
        )}

        {screen === 'quickPlay' && (
          <motion.div key="quickPlay" className="absolute inset-0"
            variants={pageVariants} initial="initial" animate="enter" exit="exit" transition={pageTransition}>
            <QuickPlayScreen onDone={() => setScreen('gameMode')} />
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
            <GameModeScreen onSelect={handleGameModeSelect} onOnline={() => setOnlineActive(true)} />
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

        {screen === 'playerType' && (
          <motion.div key={`playerType-${currentPlayerIndex}`} className="absolute inset-0"
            variants={pageVariants} initial="initial" animate="enter" exit="exit" transition={pageTransition}>
            <PlayerTypeScreen
              playerIndex={currentPlayerIndex}
              playerCount={playerCount}
              onSelect={handlePlayerTypeSelect}
              onBack={handlePlayerTypeBack}
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
            style={{ zIndex: 60 }}
            variants={pageVariants} initial="initial" animate="enter" exit="exit" transition={pageTransition}>
            <GameBoardScreen
              players={players}
              deal={deal}
              gameMode={gameMode}
              onExit={() => setScreen('playerCardsMenu')}
              onRestart={handleRestart}
              bgMuted={muted}
              onBgMuteToggle={toggleMute}
            />
          </motion.div>
        )}

      </AnimatePresence>

      {/* ── Global back button — top-left, all screens except intro & gameBoard ── */}
      {screen !== 'intro' && screen !== 'gameBoard' && (
        <motion.button
          key={screen}
          className="absolute font-pixel z-200"
          style={{
            top: '14px',
            left: '16px',
            background: '#0d0800',
            border: '2px solid #5c3d00',
            color: '#b8860b',
            padding: '8px 14px',
            fontSize: '9px',
            letterSpacing: '2px',
            cursor: 'pointer',
            boxShadow: '3px 3px 0 #000',
          }}
          onClick={handleBack}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          whileHover={{
            borderColor: '#b8860b',
            color: '#ffdd00',
            boxShadow: '3px 3px 0 #000, 0 0 14px #b8860b44',
          }}
          whileTap={{ scale: 0.94 }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', lineHeight: 1 }}>
            <span style={{ fontSize: '11px', lineHeight: 1, position: 'relative', top: '0px' }}>◄</span>
            <span>BACK</span>
          </span>
        </motion.button>
      )}

      {/* Persistent HUD */}
      {screen !== 'intro' && (
        <motion.div
          className="absolute bottom-2 left-3 font-pixel z-50"
          style={{ fontSize: '5px', color: '#1e1400', letterSpacing: '1px', pointerEvents: 'none' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
        >
          {difficulty ? `LVL:${difficulty.toUpperCase()}` : ''}
          {screen === 'playerType'
            ? `  P${currentPlayerIndex + 1}/${playerCount}`
            : ''}
        </motion.div>
      )}

      {/* Global mute icon — hidden on gameBoard (that screen has its own ♪ button) */}
      {screen !== 'gameBoard' && (
        <motion.button
          className="absolute z-50 font-pixel"
          style={{
            top: '14px', right: '16px',
            background: '#0d0800',
            border: `2px solid ${muted ? '#3a1a00' : '#5c3d00'}`,
            color: muted ? '#4a3010' : '#b8860b',
            padding: '6px 10px',
            fontSize: '16px',
            lineHeight: 1,
            cursor: 'pointer',
            boxShadow: '3px 3px 0 #000',
          }}
          onClick={toggleMute}
          title={muted ? 'Unmute music' : 'Mute music'}
          whileHover={{ borderColor: '#b8860b', color: muted ? '#886030' : '#ffdd00' }}
          whileTap={{ scale: 0.92 }}
          transition={{ duration: 0.08 }}
        >
          {muted ? '🔇' : '🔊'}
        </motion.button>
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
