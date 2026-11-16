const THEME_CHANGE_EVENT = 'jojocrm:theme-change'

export function readCurrentTheme() {
  if (typeof document === 'undefined') {
    return 'light'
  }
  return document.documentElement.getAttribute('data-theme') === 'dark'
    ? 'dark'
    : 'light'
}

export function applyThemeToDocument(nextTheme) {
  if (typeof document === 'undefined') {
    return
  }
  const normalizedTheme = nextTheme === 'dark' ? 'dark' : 'light'
  const html = document.documentElement
  html.setAttribute('data-theme', normalizedTheme)
  if (normalizedTheme === 'dark') {
    html.classList.add('dark')
  } else {
    html.classList.remove('dark')
  }
  try {
    window.localStorage.setItem('jojocrm_theme', normalizedTheme)
  } catch {
    // Ignore storage errors in restricted environments
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(THEME_CHANGE_EVENT, { detail: normalizedTheme }),
    )
  }
}

export function subscribeThemeChange(listener) {
  if (typeof window === 'undefined' || typeof listener !== 'function') {
    return () => {}
  }
  function handleThemeEvent(event) {
    listener(event?.detail === 'dark' ? 'dark' : readCurrentTheme())
  }
  function handleStorageEvent(event) {
    if (event.key === 'jojocrm_theme') {
      listener(readCurrentTheme())
    }
  }
  window.addEventListener(THEME_CHANGE_EVENT, handleThemeEvent)
  window.addEventListener('storage', handleStorageEvent)
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, handleThemeEvent)
    window.removeEventListener('storage', handleStorageEvent)
  }
}

export function initSavedTheme() {
  if (typeof window === 'undefined') {
    return
  }
  try {
    const saved = window.localStorage.getItem('jojocrm_theme')
    if (saved === 'dark' || saved === 'light') {
      applyThemeToDocument(saved)
    }
  } catch {
    // Ignore storage errors
  }
}
