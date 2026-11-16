import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

function resolveTooltipHost(node) {
  if (!node || typeof node.closest !== 'function') {
    return null
  }
  const host = node.closest('[data-tooltip]')
  if (!host) {
    return null
  }
  const text = host.getAttribute('data-tooltip')
  return text ? host : null
}

function positionTooltipElement(tipEl, hostEl) {
  if (!tipEl || !hostEl || !document.contains(hostEl)) {
    return
  }
  const text = hostEl.getAttribute('data-tooltip')
  if (!text) {
    return
  }

  tipEl.textContent = text
  tipEl.style.left = '-9999px'
  tipEl.style.top = '0px'

  const hostRect = hostEl.getBoundingClientRect()
  const tipRect = tipEl.getBoundingClientRect()
  const margin = 8
  const sidebar = hostEl.closest('.floating-sidebar')

  let left
  let top
  if (sidebar) {
    const sideRect = sidebar.getBoundingClientRect()
    left = sideRect.right + margin
    top = hostRect.top + (hostRect.height - tipRect.height) / 2
  } else {
    left = hostRect.left + (hostRect.width - tipRect.width) / 2
    top = hostRect.top - tipRect.height - margin
    if (top < margin) {
      top = hostRect.bottom + margin
    }
  }

  if (left + tipRect.width > window.innerWidth - margin) {
    left = window.innerWidth - margin - tipRect.width
  }
  if (left < margin) {
    left = margin
  }
  if (top + tipRect.height > window.innerHeight - margin) {
    top = Math.max(margin, window.innerHeight - margin - tipRect.height)
  }

  tipEl.style.left = `${Math.round(left)}px`
  tipEl.style.top = `${Math.round(top)}px`
}

export function CrmTooltipLayer() {
  const tooltipRef = useRef(null)

  useEffect(() => {
    let delayTimer = 0
    let frameId = 0
    let activeHost = null

    function hideTooltip() {
      window.clearTimeout(delayTimer)
      window.cancelAnimationFrame(frameId)
      activeHost = null
      const tipEl = tooltipRef.current
      if (tipEl) {
        tipEl.classList.remove('is-on')
      }
    }

    function showTooltip(host) {
      const tipEl = tooltipRef.current
      if (!tipEl || activeHost !== host || !document.contains(host)) {
        return
      }
      positionTooltipElement(tipEl, host)
      frameId = window.requestAnimationFrame(() => {
        if (activeHost === host && tooltipRef.current) {
          tooltipRef.current.classList.add('is-on')
        }
      })
    }

    function scheduleTooltip(host) {
      const tipEl = tooltipRef.current
      if (activeHost === host && tipEl?.classList.contains('is-on')) {
        return
      }
      window.clearTimeout(delayTimer)
      window.cancelAnimationFrame(frameId)
      activeHost = host
      if (tipEl) {
        tipEl.classList.remove('is-on')
      }
      delayTimer = window.setTimeout(() => showTooltip(host), 360)
    }

    function handleMouseOver(event) {
      const host = resolveTooltipHost(event.target)
      if (host) {
        scheduleTooltip(host)
      }
    }

    function handleMouseOut(event) {
      const host = resolveTooltipHost(event.target)
      if (!host) {
        return
      }
      const relatedHost = resolveTooltipHost(event.relatedTarget)
      if (relatedHost !== host) {
        hideTooltip()
      }
    }

    function handleFocusIn(event) {
      const host = resolveTooltipHost(event.target)
      if (host) {
        scheduleTooltip(host)
      }
    }

    function handleTransitionEnd(event) {
      if (
        event.target?.classList?.contains('floating-sidebar') &&
        activeHost &&
        tooltipRef.current?.classList.contains('is-on')
      ) {
        positionTooltipElement(tooltipRef.current, activeHost)
      }
    }

    document.addEventListener('mouseover', handleMouseOver)
    document.addEventListener('mouseout', handleMouseOut)
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', hideTooltip)
    document.addEventListener('scroll', hideTooltip, true)
    document.addEventListener('click', hideTooltip)
    document.addEventListener('transitionend', handleTransitionEnd)
    window.addEventListener('blur', hideTooltip)
    window.addEventListener('resize', hideTooltip)

    return () => {
      hideTooltip()
      document.removeEventListener('mouseover', handleMouseOver)
      document.removeEventListener('mouseout', handleMouseOut)
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', hideTooltip)
      document.removeEventListener('scroll', hideTooltip, true)
      document.removeEventListener('click', hideTooltip)
      document.removeEventListener('transitionend', handleTransitionEnd)
      window.removeEventListener('blur', hideTooltip)
      window.removeEventListener('resize', hideTooltip)
    }
  }, [])

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      ref={tooltipRef}
      id="crmTooltip"
      className="crm-tooltip"
      role="tooltip"
    />,
    document.body,
  )
}
