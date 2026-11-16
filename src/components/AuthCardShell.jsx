import { Card } from './Card.jsx'
import { ThemeToggleButton } from './ThemeToggleButton.jsx'

export function AuthCardHeader({
  eyebrow = 'jojoCRM Workspace',
  eyebrowUppercase = true,
  title,
  subtitle,
  showThemeToggle = true,
}) {
  return (
    <div className="space-y-1 border-b crm-border pb-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md btn-primary flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
            J
          </div>
          <span
            className={`text-xs font-semibold text-sub truncate ${
              eyebrowUppercase ? 'uppercase tracking-wider' : 'num-tabular'
            }`}
          >
            {eyebrow}
          </span>
        </div>
        {showThemeToggle ? <ThemeToggleButton /> : null}
      </div>
      {title ? (
        <h1 className="text-xl font-semibold text-main tracking-tight pt-1">
          {title}
        </h1>
      ) : null}
      {subtitle ? <p className="text-xs text-sub">{subtitle}</p> : null}
    </div>
  )
}

export function AuthCardShell({
  eyebrow = 'jojoCRM Workspace',
  eyebrowUppercase = true,
  title,
  subtitle,
  showThemeToggle = true,
  cardClassName = '',
  children,
}) {
  return (
    <div className="flex-1 flex justify-center p-4 overflow-y-auto">
      <Card className={`my-auto w-full max-w-md p-6 space-y-5 ${cardClassName}`.trim()}>
        <AuthCardHeader
          eyebrow={eyebrow}
          eyebrowUppercase={eyebrowUppercase}
          title={title}
          subtitle={subtitle}
          showThemeToggle={showThemeToggle}
        />
        {children}
      </Card>
    </div>
  )
}
