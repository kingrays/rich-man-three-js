import { useState } from 'react'
import { colorGroupTileIds, getTile } from '../game/board'
import { calcPropertyRent, getPlayer } from '../game/rules/helpers'
import type { TileDef, TileType } from '../game/types'
import { useGameStore } from '../store/gameStore'
import { useUiStore } from '../store/uiStore'

const TILE_TYPE_LABEL: Record<TileType, string> = {
  go: '起点',
  property: '城市地产',
  railroad: '铁路',
  utility: '公用事业',
  tax: '税收',
  chance: '机会卡',
  chest: '社区基金',
  jail: '监狱',
  gotojail: '入狱',
  parking: '免费停车',
}

export function PurchaseModal() {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)

  if (state.phase !== 'tileAction' || state.pendingPurchaseTileId === null) {
    return null
  }
  if (state.lastCardText || state.pendingRent) return null

  const tile = getTile(state, state.pendingPurchaseTileId)
  const player = state.players[state.currentPlayerIndex]!

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>购买地产</h2>
        <p style={{ marginBottom: '0.5rem' }}>
          {player.name}，是否以 <strong>${tile.price}</strong> 购买{' '}
          <strong>{tile.name}</strong>？
        </p>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
          当前现金 ${player.cash}。放弃购买将进入拍卖。
        </p>
        <div className="modal-actions">
          <button
            type="button"
            disabled={player.cash < (tile.price ?? 0)}
            onClick={() => dispatch({ type: 'BUY_PROPERTY' })}
          >
            购买
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => dispatch({ type: 'DECLINE_PROPERTY' })}
          >
            放弃（拍卖）
          </button>
        </div>
      </div>
    </div>
  )
}

/** 踩到别人地产：确认后再扣租金 */
export function RentModal() {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)

  if (state.phase !== 'tileAction' || !state.pendingRent) return null
  if (state.lastCardText) return null

  const { tileId, amount, creditorId } = state.pendingRent
  const tile = getTile(state, tileId)
  const player = state.players[state.currentPlayerIndex]!
  const owner = getPlayer(state, creditorId)
  const canAfford = player.cash >= amount

  return (
    <div className="modal-backdrop">
      <div className="modal rent-modal">
        <div className="rent-modal__badge">支付租金</div>
        <h2>踩到别人的地产</h2>
        <p className="rent-modal__lead">
          <strong style={{ color: player.color }}>{player.name}</strong>
          {' '}停在{' '}
          <strong style={{ color: owner.color }}>{owner.name}</strong>
          {' '}的 <strong>{tile.name}</strong>
        </p>
        <div className="rent-modal__amount">
          <span className="rent-modal__amount-label">应付租金</span>
          <span className="rent-modal__amount-value">${amount}</span>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
          你当前现金 <strong style={{ color: 'var(--text)' }}>${player.cash}</strong>
          {!canAfford && (
            <span style={{ color: 'var(--danger)' }}>
              {' '}
              · 不足，确认后需筹集资金或破产
            </span>
          )}
        </p>
        <div className="modal-actions">
          <button type="button" onClick={() => dispatch({ type: 'CONFIRM_PAY_RENT' })}>
            确定支付
          </button>
        </div>
      </div>
    </div>
  )
}

export function CardModal() {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)

  if (!state.lastCardText) return null
  if (state.phase === 'debt') return null

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>卡牌</h2>
        <p style={{ lineHeight: 1.5 }}>{state.lastCardText}</p>
        <div className="modal-actions">
          <button type="button" onClick={() => dispatch({ type: 'DISMISS_CARD' })}>
            知道了
          </button>
        </div>
      </div>
    </div>
  )
}

export function AuctionModal() {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)
  const [bid, setBid] = useState('')

  if (state.phase !== 'auction' || !state.auction) return null

  const auction = state.auction
  const bidderId = auction.activeBidderIds[auction.currentBidderIndex]
  if (bidderId === undefined) return null
  const bidder = getPlayer(state, bidderId)
  const tile = getTile(state, auction.tileId)
  const minBid = auction.highestBid + 1

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>拍卖 · {tile.name}</h2>
        <p style={{ marginBottom: '0.5rem' }}>
          当前最高价：${auction.highestBid}
          {auction.highestBidderId !== null
            ? `（${getPlayer(state, auction.highestBidderId).name}）`
            : '（尚无出价）'}
        </p>
        <p style={{ color: 'var(--muted)', marginBottom: '0.75rem' }}>
          轮到 <strong style={{ color: bidder.color }}>{bidder.name}</strong> 出价（现金 $
          {bidder.cash}）
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="number"
            min={minBid}
            value={bid}
            onChange={(e) => setBid(e.target.value)}
            placeholder={`最低 $${minBid}`}
            style={{ flex: 1 }}
          />
        </div>
        <div className="modal-actions">
          <button
            type="button"
            onClick={() => {
              const amount = Number(bid)
              if (!Number.isFinite(amount)) return
              dispatch({ type: 'AUCTION_BID', amount })
              setBid('')
            }}
          >
            出价
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              dispatch({ type: 'AUCTION_PASS' })
              setBid('')
            }}
          >
            放弃
          </button>
        </div>
      </div>
    </div>
  )
}

export function TradeModal() {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)

  if (state.phase !== 'trade' || !state.trade) return null

  const trade = state.trade
  const from = getPlayer(state, trade.fromId)
  const to = getPlayer(state, trade.toId)

  const fromProps = Object.entries(state.properties)
    .filter(([, ps]) => ps.ownerId === from.id)
    .map(([id]) => Number(id))
  const toProps = Object.entries(state.properties)
    .filter(([, ps]) => ps.ownerId === to.id)
    .map(([id]) => Number(id))

  const toggleProp = (side: 'from' | 'to', tileId: number) => {
    const key = side === 'from' ? 'propertiesFrom' : 'propertiesTo'
    const list = [...trade[key]]
    const idx = list.indexOf(tileId)
    if (idx >= 0) list.splice(idx, 1)
    else list.push(tileId)
    dispatch({ type: 'UPDATE_TRADE', offer: { [key]: list } })
  }

  if (trade.status === 'pending') {
    return (
      <div className="modal-backdrop">
        <div className="modal">
          <h2>确认交易</h2>
          <p style={{ marginBottom: '0.75rem' }}>
            请 <strong>{to.name}</strong> 确认与 {from.name} 的交易：
          </p>
          <TradeSummary />
          <div className="modal-actions">
            <button type="button" onClick={() => dispatch({ type: 'ACCEPT_TRADE' })}>
              接受
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => dispatch({ type: 'REJECT_TRADE' })}
            >
              拒绝
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 520 }}>
        <h2>
          交易：{from.name} ↔ {to.name}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <div style={{ color: 'var(--gold)', marginBottom: '0.4rem' }}>
              {from.name} 给出
            </div>
            <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.4rem' }}>
              现金
              <input
                type="number"
                min={0}
                value={trade.cashFrom}
                onChange={(e) =>
                  dispatch({
                    type: 'UPDATE_TRADE',
                    offer: { cashFrom: Number(e.target.value) || 0 },
                  })
                }
                style={{ width: '100%', marginTop: 4 }}
              />
            </label>
            <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.4rem' }}>
              出狱卡
              <input
                type="number"
                min={0}
                max={from.getOutOfJailCards}
                value={trade.jailCardsFrom}
                onChange={(e) =>
                  dispatch({
                    type: 'UPDATE_TRADE',
                    offer: { jailCardsFrom: Number(e.target.value) || 0 },
                  })
                }
                style={{ width: '100%', marginTop: 4 }}
              />
            </label>
            {fromProps.map((id) => (
              <label
                key={id}
                style={{ display: 'flex', gap: 6, fontSize: '0.8rem', marginBottom: 2 }}
              >
                <input
                  type="checkbox"
                  checked={trade.propertiesFrom.includes(id)}
                  onChange={() => toggleProp('from', id)}
                />
                {getTile(state, id).name}
              </label>
            ))}
          </div>
          <div>
            <div style={{ color: 'var(--gold)', marginBottom: '0.4rem' }}>
              {to.name} 给出
            </div>
            <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.4rem' }}>
              现金
              <input
                type="number"
                min={0}
                value={trade.cashTo}
                onChange={(e) =>
                  dispatch({
                    type: 'UPDATE_TRADE',
                    offer: { cashTo: Number(e.target.value) || 0 },
                  })
                }
                style={{ width: '100%', marginTop: 4 }}
              />
            </label>
            <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.4rem' }}>
              出狱卡
              <input
                type="number"
                min={0}
                max={to.getOutOfJailCards}
                value={trade.jailCardsTo}
                onChange={(e) =>
                  dispatch({
                    type: 'UPDATE_TRADE',
                    offer: { jailCardsTo: Number(e.target.value) || 0 },
                  })
                }
                style={{ width: '100%', marginTop: 4 }}
              />
            </label>
            {toProps.map((id) => (
              <label
                key={id}
                style={{ display: 'flex', gap: 6, fontSize: '0.8rem', marginBottom: 2 }}
              >
                <input
                  type="checkbox"
                  checked={trade.propertiesTo.includes(id)}
                  onChange={() => toggleProp('to', id)}
                />
                {getTile(state, id).name}
              </label>
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" onClick={() => dispatch({ type: 'PROPOSE_TRADE' })}>
            提交给对方确认
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => dispatch({ type: 'CANCEL_TRADE' })}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

function TradeSummary() {
  const state = useGameStore((s) => s.state)
  const trade = state.trade!
  const from = getPlayer(state, trade.fromId)
  const to = getPlayer(state, trade.toId)

  return (
    <div style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
      <p>
        {from.name}：现金 ${trade.cashFrom}
        {trade.jailCardsFrom ? `、出狱卡×${trade.jailCardsFrom}` : ''}
        {trade.propertiesFrom.length
          ? `、${trade.propertiesFrom.map((id) => getTile(state, id).name).join('、')}`
          : ''}
      </p>
      <p>
        {to.name}：现金 ${trade.cashTo}
        {trade.jailCardsTo ? `、出狱卡×${trade.jailCardsTo}` : ''}
        {trade.propertiesTo.length
          ? `、${trade.propertiesTo.map((id) => getTile(state, id).name).join('、')}`
          : ''}
      </p>
    </div>
  )
}

export function GameOverModal() {
  const state = useGameStore((s) => s.state)
  const reset = useGameStore((s) => s.reset)

  if (state.phase !== 'gameOver' || state.winnerId === null) return null
  const winner = getPlayer(state, state.winnerId)

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ textAlign: 'center' }}>
        <h2>游戏结束</h2>
        <p style={{ fontSize: '1.2rem', margin: '1rem 0' }}>
          <span style={{ color: winner.color, fontWeight: 700 }}>{winner.name}</span> 获胜！
        </p>
        <div className="modal-actions" style={{ justifyContent: 'center' }}>
          <button type="button" onClick={reset}>
            再来一局
          </button>
        </div>
      </div>
    </div>
  )
}

/** 点击棋盘格子后弹出的详情说明 */
export function TileInfoModal() {
  const tileId = useUiStore((s) => s.inspectedTileId)
  const close = useUiStore((s) => s.closeTileInspect)
  const state = useGameStore((s) => s.state)

  if (tileId === null) return null

  const tile = getTile(state, tileId)
  const prop = state.properties[tileId]
  const owner =
    prop?.ownerId != null
      ? state.players.find((p) => p.id === prop.ownerId) ?? null
      : null
  const occupants = state.players.filter((p) => !p.bankrupt && p.position === tileId)
  const summary = describeTileSituation(tile, state.goSalary)

  return (
    <div
      className="modal-backdrop tile-info-backdrop"
      onClick={close}
      role="presentation"
    >
      <div
        className="modal tile-info-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="tile-info-title"
      >
        <div className="tile-info-modal__badge">{TILE_TYPE_LABEL[tile.type]}</div>
        <h2 id="tile-info-title">{tile.name}</h2>
        <p className="tile-info-modal__summary">{summary}</p>

        <dl className="tile-info-modal__meta">
          <div>
            <dt>编号</dt>
            <dd>第 {tile.id} 格</dd>
          </div>
          {occupants.length > 0 && (
            <div>
              <dt>当前停靠</dt>
              <dd>
                {occupants.map((p, i) => (
                  <span key={p.id}>
                    {i > 0 ? '、' : ''}
                    <span style={{ color: p.color, fontWeight: 600 }}>{p.name}</span>
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>

        <TileOwnershipBlock tile={tile} prop={prop} owner={owner} />
        <TileEconomyBlock tile={tile} prop={prop} />

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={close}>
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

function describeTileSituation(tile: TileDef, goSalary: number): string {
  switch (tile.type) {
    case 'go':
      return `经过或停在此处可领取 $${goSalary}。`
    case 'property':
      return '可购买的城市地产。他人停靠需付租金；可建房提高租金。'
    case 'railroad':
      return '铁路地产。拥有的铁路越多，租金越高。'
    case 'utility':
      return '公用事业。租金按本次掷骰点数 × 倍率计算（拥有全部时倍率更高）。'
    case 'tax':
      return `停在此处需向银行缴纳 $${tile.taxAmount ?? 0} 税款。`
    case 'chance':
      return '停在此处将抽取一张机会卡，并立即执行卡面效果。'
    case 'chest':
      return '停在此处将抽取一张社区基金卡，并立即执行卡面效果。'
    case 'jail':
      return '路过仅为参观；被判入狱的玩家需在此服刑，可用现金、出狱卡或掷骰出狱。'
    case 'gotojail':
      return '停在此处将立即被送入监狱，且不经过起点、不领取工资。'
    case 'parking':
      return '免费停车格，停在此处无额外收支效果。'
    default:
      return '棋盘格子。'
  }
}

function TileOwnershipBlock({
  tile,
  prop,
  owner,
}: {
  tile: TileDef
  prop: { ownerId: number | null; houses: number; mortgaged: boolean } | undefined
  owner: { name: string; color: string } | null
}) {
  const isOwnable =
    tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility'
  if (!isOwnable) return null

  const houses = prop?.houses ?? 0
  const houseLabel =
    houses === 0 ? '空地' : houses === 5 ? '酒店 ×1' : `房屋 ×${houses}`

  return (
    <div className="tile-info-modal__section">
      <h3>所有权</h3>
      {owner ? (
        <ul className="tile-info-modal__list">
          <li>
            所有者：
            <strong style={{ color: owner.color }}>{owner.name}</strong>
          </li>
          {tile.type === 'property' && <li>建筑：{houseLabel}</li>}
          <li>状态：{prop?.mortgaged ? '已抵押（不计租金）' : '正常营业'}</li>
        </ul>
      ) : (
        <p className="tile-info-modal__muted">尚未被购买，停靠后可出价购买或进入拍卖。</p>
      )}
    </div>
  )
}

function TileEconomyBlock({
  tile,
  prop,
}: {
  tile: TileDef
  prop: { ownerId: number | null; houses: number; mortgaged: boolean } | undefined
}) {
  const state = useGameStore((s) => s.state)

  if (tile.type === 'property' && tile.price != null && tile.rent) {
    const currentRent =
      prop?.ownerId != null && !prop.mortgaged
        ? calcPropertyRent(state, tile.id)
        : null
    return (
      <div className="tile-info-modal__section">
        <h3>价格与租金</h3>
        <ul className="tile-info-modal__list">
          <li>购买价：${tile.price}</li>
          {tile.mortgage != null && <li>抵押价：${tile.mortgage}</li>}
          {tile.houseCost != null && <li>建房/酒店费：${tile.houseCost}</li>}
          {currentRent != null && (
            <li>
              当前租金：<strong>${currentRent}</strong>
            </li>
          )}
        </ul>
        <table className="tile-info-modal__rent-table">
          <thead>
            <tr>
              <th>等级</th>
              <th>租金</th>
            </tr>
          </thead>
          <tbody>
            {['空地', '1 栋房', '2 栋房', '3 栋房', '4 栋房', '酒店'].map((label, i) => (
              <tr key={label} className={prop?.houses === i ? 'is-current' : undefined}>
                <td>{label}</td>
                <td>${tile.rent![i] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (tile.type === 'railroad' && tile.price != null && tile.rent) {
    const ownedCount =
      prop?.ownerId != null
        ? colorGroupTileIds(state.board, 'railroad').filter(
            (id) =>
              state.properties[id]?.ownerId === prop.ownerId &&
              !state.properties[id]?.mortgaged,
          ).length
        : 0
    const currentRent =
      prop?.ownerId != null && !prop.mortgaged
        ? calcPropertyRent(state, tile.id)
        : null
    return (
      <div className="tile-info-modal__section">
        <h3>价格与租金</h3>
        <ul className="tile-info-modal__list">
          <li>购买价：${tile.price}</li>
          {tile.mortgage != null && <li>抵押价：${tile.mortgage}</li>}
          {ownedCount > 0 && <li>该玩家拥有铁路：{ownedCount} 条</li>}
          {currentRent != null && (
            <li>
              当前租金：<strong>${currentRent}</strong>
            </li>
          )}
        </ul>
        <table className="tile-info-modal__rent-table">
          <thead>
            <tr>
              <th>拥有条数</th>
              <th>租金</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4].map((n) => (
              <tr key={n} className={ownedCount === n ? 'is-current' : undefined}>
                <td>{n} 条</td>
                <td>${tile.rent![n - 1] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (tile.type === 'utility' && tile.price != null && tile.rent) {
    const ownedCount =
      prop?.ownerId != null
        ? colorGroupTileIds(state.board, 'utility').filter(
            (id) =>
              state.properties[id]?.ownerId === prop.ownerId &&
              !state.properties[id]?.mortgaged,
          ).length
        : 0
    return (
      <div className="tile-info-modal__section">
        <h3>价格与租金</h3>
        <ul className="tile-info-modal__list">
          <li>购买价：${tile.price}</li>
          {tile.mortgage != null && <li>抵押价：${tile.mortgage}</li>}
          {ownedCount > 0 && <li>该玩家拥有公用事业：{ownedCount} 处</li>}
          <li>拥有 1 处：骰点 × {tile.rent[0]}</li>
          <li>拥有 2 处：骰点 × {tile.rent[1]}</li>
        </ul>
      </div>
    )
  }

  if (tile.type === 'tax') {
    return (
      <div className="tile-info-modal__section">
        <h3>税额</h3>
        <p className="tile-info-modal__tax">${tile.taxAmount ?? 0}</p>
      </div>
    )
  }

  return null
}
