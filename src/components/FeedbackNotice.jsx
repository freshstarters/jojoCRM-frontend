import { Card } from './Card.jsx'

export function FeedbackNotice({ message, tone = 'subtle', className = '' }) {
  if (!message) {
    return null
  }

  let toneClasses = 'p-3.5 text-xs text-sub'
  if (tone === 'danger') {
    toneClasses = 'badge-danger rounded-lg px-3.5 py-2.5 text-xs'
  } else if (tone === 'success') {
    toneClasses = 'badge-success rounded-lg px-3.5 py-2.5 text-xs'
  } else if (tone === 'warn') {
    toneClasses = 'badge-warn rounded-lg px-3.5 py-2.5 text-xs'
  } else if (tone === 'info') {
    toneClasses = 'badge-info rounded-lg px-3.5 py-2.5 text-xs'
  }

  return (
    <Card
      variant="subtle"
      role="status"
      aria-live="polite"
      className={`${toneClasses} ${className}`.trim()}
    >
      {message}
    </Card>
  )
}
