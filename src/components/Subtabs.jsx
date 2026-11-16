import { useCallback, useLayoutEffect, useRef, useState } from 'react'

export function Subtabs({
  tabs,
  activeId,
  onChange,
  ariaLabel = 'Sections',
  className = '',
}) {
  const barRef = useRef(null)
  const buttonRefs = useRef({})
  const [glideStyle, setGlideStyle] = useState({
    opacity: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    ready: false,
  })

  const updateGlide = useCallback(() => {
    const activeButton = buttonRefs.current[activeId]
    if (!activeButton || activeButton.offsetWidth === 0) {
      setGlideStyle((prev) => ({ ...prev, opacity: 0, ready: false }))
      return
    }
    setGlideStyle((prev) => ({
      opacity: 1,
      width: activeButton.offsetWidth,
      height: activeButton.offsetHeight,
      x: activeButton.offsetLeft,
      y: activeButton.offsetTop,
      ready: prev.ready || true,
    }))
  }, [activeId])

  useLayoutEffect(() => {
    updateGlide()
    window.addEventListener('resize', updateGlide)
    return () => window.removeEventListener('resize', updateGlide)
  }, [updateGlide, tabs])

  return (
    <div
      ref={barRef}
      className={`subtab-bar ${className}`.trim()}
      role="tablist"
      aria-label={ariaLabel}
    >
      <span
        className="tab-glide"
        aria-hidden="true"
        style={{
          opacity: glideStyle.opacity,
          width: `${glideStyle.width}px`,
          height: `${glideStyle.height}px`,
          transform: `translate(${glideStyle.x}px, ${glideStyle.y}px)`,
        }}
      />
      {tabs.map((tab) => {
        const isActive = tab.id === activeId
        return (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) {
                buttonRefs.current[tab.id] = el
              } else {
                delete buttonRefs.current[tab.id]
              }
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-subtab={tab.id}
            onClick={() => onChange(tab.id)}
            className={`subtab ${isActive ? 'is-active' : ''}`.trim()}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
