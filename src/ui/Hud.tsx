import { ANIMAL_LABELS } from '../scene/AnimalFigures'
import { useCameraStore } from '../store/cameraStore'
import { useGameStore } from '../store/gameStore'
import { getTile } from '../game/board'
import {
  canBuildHouse,
  canSellHouse,
  currentPlayer,
  ownedProperties,
} from '../game/rules/helpers'
import { AnimatedCash } from './AnimatedCash'

export function GameLog() {
  const log = useGameStore((s) => s.state.log)
  return (
    <div
      className="panel thin-scroll"
      style={{
        maxHeight: 180,
        overflow: 'auto',
        fontSize: '0.8rem',
        lineHeight: 1.45,
      }}
    >
      <div style={{ color: 'var(--gold)', marginBottom: '0.4rem', fontWeight: 600 }}>战报</div>
      {log.length === 0 && <div style={{ color: 'var(--muted)' }}>暂无记录</div>}
      {log.map((e) => {
        // 建房提醒用金色高亮，避免淹没在普通战报里
        const isBuildHint = e.message.includes('可在「') && e.message.includes('建造')
        return (
          <div
            key={e.id}
            style={{
              color: isBuildHint ? 'var(--gold-bright)' : 'var(--muted)',
              marginBottom: '0.25rem',
              fontWeight: isBuildHint ? 600 : 400,
            }}
          >
            {e.message}
          </div>
        )
      })}
    </div>
  )
}

export function PlayerList() {
  const state = useGameStore((s) => s.state)
  const focusPlayer = useCameraStore((s) => s.focusPlayer)
  return (
    <div className="panel" style={{ fontSize: '0.85rem' }}>
      <div style={{ color: 'var(--gold)', marginBottom: '0.5rem', fontWeight: 600 }}>玩家</div>
      {state.players.map((p, i) => {
        const props = ownedProperties(state, p.id)
        const isCurrent = i === state.currentPlayerIndex && !p.bankrupt
        return (
          <div
            key={p.id}
            style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              padding: '0.35rem 0',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              opacity: p.bankrupt ? 0.45 : 1,
              background: isCurrent ? 'rgba(212,175,55,0.12)' : 'transparent',
              borderRadius: 4,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: p.color,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div>
                {p.name}
                {p.inJail ? ' 🔒' : ''}
                {p.bankrupt ? '（破产）' : ''}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>
                {ANIMAL_LABELS[p.animalKind]} ·{' '}
                <AnimatedCash value={p.cash} /> · {props.length} 处地产
                {p.getOutOfJailCards > 0 ? ` · 出狱卡×${p.getOutOfJailCards}` : ''}
              </div>
            </div>
            {!p.bankrupt && (
              <button
                type="button"
                className="secondary player-focus-btn"
                title="视角飞到此玩家"
                onClick={() => focusPlayer(p.id)}
              >
                飞往
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function ActionBar() {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)
  const player = currentPlayer(state)

  if (state.phase === 'gameOver') return null

  // 停在自家地产且该格可建房时，给出醒目提醒
  const standTile = getTile(player.position)
  const standPs = state.properties[player.position]
  const canBuildHere =
    state.phase === 'manageAssets' &&
    standPs?.ownerId === player.id &&
    canBuildHouse(state, player.id, player.position)
  const buildCost = standTile.houseCost ?? 0
  const buildLabel = (standPs?.houses ?? 0) >= 4 ? '建酒店' : '建房'

  return (
    <div className="panel">
      <div style={{ marginBottom: '0.6rem' }}>
        <span style={{ color: 'var(--gold-bright)', fontWeight: 700 }}>{player.name}</span>
        <span style={{ color: 'var(--muted)', marginLeft: '0.5rem', fontSize: '0.85rem' }}>
          <AnimatedCash value={player.cash} />
          {state.lastDice ? ` · 骰子 ${state.lastDice.value}` : ''}
        </span>
      </div>

      {canBuildHere && (
        <div className="build-hint" role="status">
          <div className="build-hint__text">
            你停在自家「{standTile.name}」，本回合可{buildLabel}一次（${buildCost}）
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: 'BUILD_HOUSE', tileId: player.position })}
          >
            立即{buildLabel}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {state.phase === 'waitingRoll' && (
          <>
            {player.inJail && (
              <>
                <button type="button" onClick={() => dispatch({ type: 'PAY_JAIL_FINE' })}>
                  交保 $50
                </button>
                {player.getOutOfJailCards > 0 && (
                  <button type="button" onClick={() => dispatch({ type: 'USE_JAIL_CARD' })}>
                    使用出狱卡
                  </button>
                )}
              </>
            )}
            <button type="button" onClick={() => dispatch({ type: 'ROLL_DICE' })}>
              掷骰子
            </button>
          </>
        )}

        {state.phase === 'rolling' && (
          <span style={{ color: 'var(--gold-bright)', fontSize: '0.9rem' }}>
            骰子滚动中…
          </span>
        )}

        {state.phase === 'moving' && (
          <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>棋子移动中…</span>
        )}

        {state.phase === 'manageAssets' && (
          <>
            <button type="button" onClick={() => dispatch({ type: 'END_TURN' })}>
              结束回合
            </button>
            {state.players
              .filter((p) => !p.bankrupt && p.id !== player.id)
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="secondary"
                  onClick={() => dispatch({ type: 'START_TRADE', toId: p.id })}
                >
                  与 {p.name} 交易
                </button>
              ))}
          </>
        )}

        {state.phase === 'debt' && state.debt && (
          <>
            <button
              type="button"
              onClick={() => dispatch({ type: 'RESOLVE_DEBT_DONE' })}
            >
              检查是否付清
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => dispatch({ type: 'DECLARE_BANKRUPTCY' })}
            >
              宣布破产
            </button>
          </>
        )}
      </div>

      {state.phase === 'debt' && state.debt && (
        <p style={{ marginTop: '0.6rem', color: 'var(--danger)', fontSize: '0.85rem' }}>
          需筹集 ${state.debt.amount}（{state.debt.reason}）。可出售房屋或抵押地产。
        </p>
      )}

      {/* 当前玩家地产快捷管理 */}
      {(state.phase === 'manageAssets' || state.phase === 'debt') && (
        <PropertyManage />
      )}
    </div>
  )
}

function PropertyManage() {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)
  // 债务阶段由欠款人操作资产
  const playerId =
    state.phase === 'debt' && state.debt
      ? state.debt.debtorId
      : state.players[state.currentPlayerIndex]!.id
  const props = ownedProperties(state, playerId)
  const standPos =
    state.players.find((p) => p.id === playerId)?.position ?? -1

  if (props.length === 0) return null

  return (
    <div className="thin-scroll" style={{ marginTop: '0.75rem', maxHeight: 160, overflow: 'auto' }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.35rem' }}>
        地产管理
      </div>
      {props.map((id) => {
        const tile = getTile(id)
        const ps = state.properties[id]!
        const canBuild = canBuildHouse(state, playerId, id)
        const canSell = canSellHouse(state, playerId, id)
        const isStandingHere = id === standPos
        return (
          <div
            key={id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.75rem',
              marginBottom: '0.3rem',
              flexWrap: 'wrap',
              // 当前所在格 + 可建房时高亮整行
              padding: isStandingHere || canBuild ? '0.25rem 0.35rem' : 0,
              borderRadius: 6,
              background: canBuild
                ? 'rgba(212,175,55,0.18)'
                : isStandingHere
                  ? 'rgba(255,255,255,0.06)'
                  : 'transparent',
              outline: canBuild ? '1px solid rgba(240,208,96,0.55)' : 'none',
            }}
          >
            <span style={{ minWidth: 90 }}>
              {tile.name}
              {isStandingHere ? ' ·当前' : ''}
              {ps.mortgaged ? '（抵押）' : ''}
              {ps.houses > 0 ? ` ·${ps.houses === 5 ? '酒店' : `${ps.houses}房`}` : ''}
              {canBuild ? ' ·可建' : ''}
            </span>
            <button
              type="button"
              className={canBuild ? undefined : 'secondary'}
              disabled={!canBuild}
              style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
              onClick={() => dispatch({ type: 'BUILD_HOUSE', tileId: id })}
            >
              建房
            </button>
            <button
              type="button"
              className="secondary"
              disabled={!canSell}
              style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
              onClick={() => dispatch({ type: 'SELL_HOUSE', tileId: id })}
            >
              拆房
            </button>
            <button
              type="button"
              className="secondary"
              style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
              onClick={() =>
                dispatch({
                  type: ps.mortgaged ? 'UNMORTGAGE' : 'MORTGAGE',
                  tileId: id,
                })
              }
            >
              {ps.mortgaged ? '赎回' : '抵押'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
