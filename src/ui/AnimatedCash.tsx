import { useEffect, useRef, useState } from 'react'

/** 现金数字滚动动画；减少时飘出红色差额 */
export function AnimatedCash({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  const [display, setDisplay] = useState(value)
  const [delta, setDelta] = useState<number | null>(null)
  const [pulse, setPulse] = useState<'down' | 'up' | null>(null)
  const displayRef = useRef(value)
  displayRef.current = display

  useEffect(() => {
    const from = displayRef.current
    if (from === value) return

    const diff = value - from
    setDelta(diff)
    setPulse(diff < 0 ? 'down' : 'up')

    const duration = Math.min(900, 350 + Math.abs(diff) * 0.4)
    const start = performance.now()
    let raf = 0

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - t) ** 3
      setDisplay(Math.round(from + diff * eased))
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        setDisplay(value)
        window.setTimeout(() => {
          setDelta(null)
          setPulse(null)
        }, 450)
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return (
    <span
      className={[
        'animated-cash',
        pulse === 'down' ? 'animated-cash--down' : '',
        pulse === 'up' ? 'animated-cash--up' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="animated-cash__value">${display}</span>
      {delta !== null && delta !== 0 && (
        <span
          className={
            delta < 0 ? 'animated-cash__delta down' : 'animated-cash__delta up'
          }
          key={`${value}-${delta}`}
        >
          {delta > 0 ? '+' : ''}
          {delta}
        </span>
      )}
    </span>
  )
}
