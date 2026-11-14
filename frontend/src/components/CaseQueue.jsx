import Icon from './Icons'
import { StatusPill } from './StatusPill'

export default function CaseQueue({
  title = 'Incoming cases',
  subtitle,
  cases,
  selectedId,
  onSelect,
  loading,
  emptyTitle = 'No incoming cases',
  emptyDescription,
  layout = 'rows',
}) {
  const cardLayout = layout === 'cards'
  return (
    <section className={cardLayout ? 'case-card-queue' : 'strip overflow-hidden'}>
      <header className={cardLayout ? 'case-card-queue-head' : 'strip-head'}>
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold text-[var(--ink)]">{title}</h2>
          {subtitle ? <p className="mt-1 text-[12px] leading-4 text-[var(--paper-muted)]">{subtitle}</p> : null}
        </div>
        <span className="pill pill-mute tabular-nums">{cases.length}</span>
      </header>
      <div className={cardLayout ? 'patient-case-grid' : 'max-h-[34rem] overflow-y-auto py-1 pl-[18px] pr-1'}>
        {loading ? (
          <div className="space-y-2 py-2 pr-2" aria-label="Loading cases">
            <div className="skeleton h-16" />
            <div className="skeleton h-16" />
          </div>
        ) : cases.length ? (
          cases.map((item, index) => (
            <button
              type="button"
              key={item.id}
              onClick={() => onSelect(item.id)}
              aria-current={String(selectedId) === String(item.id) ? 'true' : undefined}
              aria-label={`View ${item.patient?.name ?? 'patient'} and ambulance handoff details`}
              className={cardLayout ? 'patient-case-card' : 'rack-row'}
            >
              {cardLayout ? (
                <>
                  <span className="flex items-center justify-between gap-2">
                    <span className="paper-label">Case #{item.id} · Amb #{item.ambulance_id}</span>
                    <Icon name="chevron" className="h-4 w-4 shrink-0 text-[var(--paper-muted)]" />
                  </span>
                  <span className="mt-2 block truncate text-[15px] font-semibold text-[var(--ink)]">
                    {item.patient?.name ?? 'Patient'}
                  </span>
                  <span className="mt-1 block text-[12px] text-[var(--paper-muted)]">
                    {[
                      item.patient?.age != null ? `${item.patient.age} years` : null,
                      item.patient?.sex,
                      item.patient?.blood_group,
                    ].filter(Boolean).join(' · ') || 'Patient details available'}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-1">
                    <StatusPill status={item.priority} label={`${item.priority} priority`} />
                    <StatusPill status={item.emergency_category} label={item.emergency_category ?? 'unknown'} />
                    <StatusPill status={item.status} />
                  </span>
                  <span className="mt-2 block text-[10px] font-semibold text-[var(--route)]">
                    {String(selectedId) === String(item.id) ? 'Full patient and handoff details open' : 'Select to view full details'}
                  </span>
                </>
              ) : (
                <>
                  <span className="rack-bay">{String(index + 1).padStart(2, '0')}</span>
                  <span className="min-w-0 py-2.5">
                    <span className="block truncate text-[14px] font-semibold text-[var(--ink)]">
                      {item.patient?.name ?? 'Patient'}
                    </span>
                    <span className="mt-0.5 block text-[10px] uppercase tracking-[0.06em] text-[var(--paper-muted)]">
                      Case #{item.id} · Amb #{item.ambulance_id}
                    </span>
                    <span className="mt-1.5 flex flex-wrap gap-1">
                      <StatusPill status={item.priority} label={`${item.priority} priority`} />
                      <StatusPill status={item.emergency_category} label={item.emergency_category ?? 'unknown'} />
                      <StatusPill status={item.status} />
                    </span>
                    <span className="mt-1.5 block text-[10px] font-semibold text-[var(--route)]">
                      {String(selectedId) === String(item.id) ? 'Patient and handoff details open' : 'View patient and handoff details'}
                    </span>
                  </span>
                  <Icon name="chevron" className="h-4 w-4 shrink-0 text-[var(--paper-muted)]" />
                </>
              )}
            </button>
          ))
        ) : (
          <div className="border border-dashed border-[var(--paper-line)] px-4 py-8 text-center">
            <p className="text-[13px] font-semibold text-[var(--ink)]">{emptyTitle}</p>
            {emptyDescription ? (
              <p className="mt-1 text-[12px] leading-5 text-[var(--paper-muted)]">{emptyDescription}</p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  )
}
