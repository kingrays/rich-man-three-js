import { useState } from 'react'
import {
  BOARD_SIZE_OPTIONS,
  DEFAULT_BOARD_SIZE,
  GO_SALARY,
  STARTING_CASH,
  type BoardSizeId,
} from '../game/board'
import {
  ANIMAL_KINDS,
  ANIMAL_LABELS,
  type AnimalKind,
} from '../game/types'
import { useGameStore } from '../store/gameStore'

const DEFAULT_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12']
const DEFAULT_NAMES = ['小猪玩家', '猫咪玩家', '兔子玩家', '小熊玩家']
const DEFAULT_ANIMALS: AnimalKind[] = ['pig', 'cat', 'rabbit', 'bear']

export function Lobby() {
  const dispatch = useGameStore((s) => s.dispatch)
  const [count, setCount] = useState(2)
  const [names, setNames] = useState([...DEFAULT_NAMES])
  const [animals, setAnimals] = useState<AnimalKind[]>([...DEFAULT_ANIMALS])
  const [startingCash, setStartingCash] = useState(STARTING_CASH)
  const [goSalary, setGoSalary] = useState(GO_SALARY)
  const [boardSize, setBoardSize] = useState<BoardSizeId>(DEFAULT_BOARD_SIZE)

  const start = () => {
    const players = Array.from({ length: count }, (_, i) => ({
      name: names[i] || ANIMAL_LABELS[animals[i]!],
      color: DEFAULT_COLORS[i]!,
      animalKind: animals[i]!,
    }))
    dispatch({
      type: 'START_GAME',
      players,
      startingCash,
      goSalary,
      boardSize,
    })
  }

  return (
    <div className="lobby">
      <div className="lobby-card">
        <header className="lobby-header">
          <h1 className="lobby-title">大富翁</h1>
          <p className="lobby-subtitle">经典规则 · 本机 2–4 人对战 · 动物棋子</p>
        </header>

        <section className="lobby-section">
          <h2 className="lobby-section-title">本局规则</h2>
          <label className="lobby-field">
            <span className="lobby-label">玩家人数</span>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            >
              <option value={2}>2 人</option>
              <option value={3}>3 人</option>
              <option value={4}>4 人</option>
            </select>
          </label>

          <label className="lobby-field">
            <span className="lobby-label">棋盘大小</span>
            <select
              value={boardSize}
              onChange={(e) => setBoardSize(e.target.value as BoardSizeId)}
            >
              {BOARD_SIZE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <p className="lobby-hint">
            城市地产随机生成；北京、上海、广州、深圳常驻且价格最高。
          </p>

          <div className="lobby-money-row">
            <label className="lobby-field">
              <span className="lobby-label">开局金币</span>
              <input
                type="number"
                min={0}
                step={100}
                value={startingCash}
                onChange={(e) => setStartingCash(Number(e.target.value))}
              />
            </label>
            <label className="lobby-field">
              <span className="lobby-label">过起点金币</span>
              <input
                type="number"
                min={0}
                step={50}
                value={goSalary}
                onChange={(e) => setGoSalary(Number(e.target.value))}
              />
            </label>
          </div>
        </section>

        {/* 仅玩家列表滚动，避免整卡出现刺眼系统滚动条 */}
        <section className="lobby-section lobby-players">
          <h2 className="lobby-section-title">玩家设置</h2>
          <div className="lobby-players-scroll thin-scroll">
            {Array.from({ length: count }, (_, i) => (
              <div
                key={i}
                className="lobby-player-card"
                style={{ ['--player-accent' as string]: DEFAULT_COLORS[i] }}
              >
                <div className="lobby-player-head">
                  <span className="lobby-player-dot" />
                  <span>玩家 {i + 1}</span>
                  <span className="lobby-player-role">
                    {ANIMAL_LABELS[animals[i]!]}
                  </span>
                </div>
                <div className="lobby-player-fields">
                  <label className="lobby-field">
                    <span className="lobby-label">昵称</span>
                    <input
                      value={names[i]}
                      onChange={(e) => {
                        const next = [...names]
                        next[i] = e.target.value
                        setNames(next)
                      }}
                      maxLength={12}
                    />
                  </label>
                  <label className="lobby-field">
                    <span className="lobby-label">棋子角色</span>
                    <select
                      value={animals[i]}
                      onChange={(e) => {
                        const next = [...animals]
                        next[i] = e.target.value as AnimalKind
                        setAnimals(next)
                      }}
                    >
                      {ANIMAL_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {ANIMAL_LABELS[kind]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="lobby-footer">
          <button type="button" className="lobby-start" onClick={start}>
            开始游戏
          </button>
        </footer>
      </div>
    </div>
  )
}
