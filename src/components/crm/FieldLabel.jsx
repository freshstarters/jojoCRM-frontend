export function FieldLabel({ htmlFor, label, readOnly = false }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={htmlFor} className="block font-medium text-main">
        {label}
      </label>
      {readOnly ? (
        <span className="text-[10px] uppercase tracking-wider text-sub">
          Read-only
        </span>
      ) : null}
    </div>
  )
}
