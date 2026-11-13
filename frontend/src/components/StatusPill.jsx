import Icon from './Icons'

const TONES = {
  open: 'amber',
  hospital_selected: 'blue',
  acknowledged: 'green',
  closed: 'mute',
  en_route: 'blue',
  arrived: 'green',
  pending: 'mute',
  requested: 'blue',
  preparing: 'amber',
  ready: 'green',
  sent: 'mute',
  delivered: 'blue',
  high: 'alarm',
  critical: 'critical',
  trauma: 'alarm',
  cardiac: 'amber',
  respiratory: 'blue',
  obstetric: 'blue',
  other: 'mute',
}

export function StatusPill({ status, label }) {
  const title = label ?? status?.replaceAll('_', ' ') ?? 'Unknown'
  const tone = TONES[status] ?? 'mute'
  return (
    <span className={`pill pill-${tone}`}>
      {status === 'acknowledged' || status === 'ready' ? (
        <span aria-hidden="true" className="h-1 w-1 rounded-full bg-current" />
      ) : null}
      {title}
    </span>
  )
}

export function LiveStatus({ connected }) {
  return (
    <span className="st text-[var(--text-muted)]">
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-[var(--live)]' : 'bg-[var(--st-amber)]'}`}
      />
      {connected ? 'Live updates on' : 'Reconnecting'}
    </span>
  )
}

export function ErrorNotice({ children, onDismiss }) {
  if (!children) return null
  return (
    <div role="alert" className="notice notice-alarm flex items-start justify-between gap-3">
      <p>{children}</p>
      {onDismiss ? (
        <button
          type="button"
          aria-label="Dismiss error"
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 hover:bg-[#f4d8d4]"
        >
          <Icon name="x" className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  )
}
