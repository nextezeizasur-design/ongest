interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={1}>
        <rect x="8" y="4" width="40" height="52" rx="4"/>
        <path d="M20 20h20M20 30h14M20 40h10"/>
        <path d="M48 48l10 10" strokeLinecap="round"/>
      </svg>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
