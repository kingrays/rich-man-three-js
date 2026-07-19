import { useState } from 'react'
import { getTile } from '../game/board'
import { getPlayer } from '../game/rules/helpers'
import { useGameStore } from '../store/gameStore'

export function PurchaseModal() {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)

  if (state.phase !== 'tileAction' || state.pendingPurchaseTileId === null) {
    return null
  }
  if (state.lastCardText || state.pendingRent) return null

  const tile = getTile(state.pendingPurchaseTileId)
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
  const tile = getTile(tileId)
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
  const tile = getTile(auction.tileId)
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
                {getTile(id).name}
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
                {getTile(id).name}
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
  const trade = useGameStore((s) => s.state.trade)!
  const from = useGameStore((s) => getPlayer(s.state, trade.fromId))
  const to = useGameStore((s) => getPlayer(s.state, trade.toId))

  return (
    <div style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
      <p>
        {from.name}：现金 ${trade.cashFrom}
        {trade.jailCardsFrom ? `、出狱卡×${trade.jailCardsFrom}` : ''}
        {trade.propertiesFrom.length
          ? `、${trade.propertiesFrom.map((id) => getTile(id).name).join('、')}`
          : ''}
      </p>
      <p>
        {to.name}：现金 ${trade.cashTo}
        {trade.jailCardsTo ? `、出狱卡×${trade.jailCardsTo}` : ''}
        {trade.propertiesTo.length
          ? `、${trade.propertiesTo.map((id) => getTile(id).name).join('、')}`
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
