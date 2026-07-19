import { useGameStore } from './store/gameStore'
import { Lobby } from './ui/Lobby'
import { ActionBar, GameLog, PlayerList } from './ui/Hud'
import {
  AuctionModal,
  CardModal,
  GameOverModal,
  PurchaseModal,
  RentModal,
  TileInfoModal,
  TradeModal,
} from './ui/Modals'
import { GameScene } from './scene/GameScene'

export default function App() {
  const phase = useGameStore((s) => s.state.phase)
  const reset = useGameStore((s) => s.reset)

  if (phase === 'lobby') {
    return <Lobby />
  }

  const endGame = () => {
    if (window.confirm('确定结束本局并返回大厅？当前进度将被清除。')) {
      reset()
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <GameScene />

      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          width: 260,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 10,
          pointerEvents: 'auto',
        }}
      >
        <PlayerList />
        <GameLog />
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          width: 320,
          zIndex: 10,
        }}
      >
        <ActionBar />
      </div>

      <div className="game-top-right">
        <span className="game-brand">大富翁</span>
        <button type="button" className="secondary game-end-btn" onClick={endGame}>
          结束游戏
        </button>
      </div>

      <PurchaseModal />
      <RentModal />
      <CardModal />
      <AuctionModal />
      <TradeModal />
      <GameOverModal />
      <TileInfoModal />
    </div>
  )
}
