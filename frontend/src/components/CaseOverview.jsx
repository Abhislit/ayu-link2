import Icon from './Icons'
import { StatusPill } from './StatusPill'

export function PatientOverview({ detail, compact = false }) {
  if (!detail?.patient) return null
  const { patient, medical_record: record } = detail
  return (
    <section className="strip">
      <div className="strip-body">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="paper-label">Patient</p>
            <h2 className="display mt-1 text-[28px] leading-none text-[var(--ink)]">{patient.name}</h2>
            <p className="mt-1.5 text-[12px] text-[var(--paper-muted)]">
              {patient.age ? `${patient.age} years` : 'Age unavailable'}
              {patient.sex ? ` · ${patient.sex}` : ''}
              {patient.blood_group ? ` · ${patient.blood_group}` : ''}
            </p>
          </div>
          <StatusPill
            status={detail.case?.priority ?? 'unknown'}
            label={`${detail.case?.priority ?? 'Unknown'} priority`}
          />
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <div className="border border-[#b43e3540] bg-[var(--alarm-tint)] p-2.5">
            <p className="paper-label text-[var(--alarm)]">Allergies</p>
            <p className="mt-1 text-[13px] font-medium text-[var(--ink)]">{patient.allergies || 'None recorded'}</p>
          </div>
          <div className="border border-[var(--paper-line)] bg-[var(--paper-band)] p-2.5">
            <p className="paper-label">Known conditions</p>
            <p className="mt-1 text-[13px] font-medium text-[var(--ink)]">{patient.conditions || 'None recorded'}</p>
          </div>
        </div>

        {patient.aadhaar || patient.phone || patient.emergency_contact || patient.address ? (
          <div className="mt-2.5 grid gap-x-3 gap-y-2.5 border border-[var(--paper-line)] bg-white p-3 sm:grid-cols-2">
            <div>
              <p className="paper-label">Aadhaar</p>
              <p className="mt-1 text-[13px] font-medium text-[var(--ink)]">{patient.aadhaar || 'Not recorded'}</p>
            </div>
            <div>
              <p className="paper-label">Phone</p>
              <p className="mt-1 text-[13px] font-medium text-[var(--ink)]">{patient.phone || 'Not recorded'}</p>
            </div>
            <div>
              <p className="paper-label">Emergency contact</p>
              <p className="mt-1 text-[13px] font-medium text-[var(--ink)]">{patient.emergency_contact || 'Not recorded'}</p>
            </div>
            <div>
              <p className="paper-label">Address</p>
              <p className="mt-1 text-[13px] font-medium text-[var(--ink)]">{patient.address || 'Not recorded'}</p>
            </div>
          </div>
        ) : null}

        {!compact ? (
          <div className="mt-4 border-t border-dashed border-[var(--perf)] pt-3">
            <p className="paper-label">Available medical history</p>
            {record ? (
              <div className="mt-1.5 space-y-1 text-[13px] leading-6 text-[var(--ink)]">
                {record.summary ? <p>{record.summary}</p> : null}
                {record.medications ? <p><span className="font-semibold">Medications:</span> {record.medications}</p> : null}
                {record.notes ? <p>{record.notes}</p> : null}
              </div>
            ) : (
              <p className="mt-1 text-[13px] text-[var(--paper-muted)]">No additional medical record is available.</p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function CaseStatus({ detail }) {
  if (!detail?.case) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusPill status={detail.case.status} />
      <StatusPill status={detail.case.priority} label={`${detail.case.priority} priority`} />
      <StatusPill
        status={detail.case.emergency_category}
        label={`Category: ${detail.case.emergency_category ?? 'unknown'}`}
      />
      <StatusPill
        status={detail.case.ambulance_status}
        label={`Ambulance ${detail.case.ambulance_status?.replaceAll('_', ' ') ?? 'status unavailable'}`}
      />
      {detail.case.prep_status ? <StatusPill status={detail.case.prep_status} label={`Hospital ${detail.case.prep_status}`} /> : null}
    </div>
  )
}

const PROGRESS_STEPS = [
  ['open', 'Patient identified'],
  ['hospital_selected', 'Hospital selected'],
  ['acknowledged', 'Hospital acknowledged'],
  ['closed', 'Case closed'],
]

export function CaseProgress({ detail, advancing = false }) {
  const status = detail?.case?.status
  if (!status) return null
  const current = Math.max(0, PROGRESS_STEPS.findIndex(([key]) => key === status))
  return (
    <div className={`handoff-progress${advancing ? ' is-advancing' : ''}`}>
      <p className="paper-label">Handoff progress</p>
      <ol className="handoff-progress-list">
        {PROGRESS_STEPS.map(([key, label], index) => {
          const state = index < current ? 'done' : index === current ? 'current' : 'future'
          return (
            <li
              key={key}
              className={`handoff-step${state === 'done' ? ' is-complete' : ''}${state === 'current' ? ' is-current' : ''}`}
              aria-current={index === current ? 'step' : undefined}
            >
              <span className="handoff-stop" aria-hidden="true">
                {state === 'done' ? <Icon name="check" className="h-3 w-3" /> : null}
              </span>
              <span>{label}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function EmptyCase({ title = 'No active emergency case', description, children }) {
  return (
    <section className="empty-state">
      <h2>{title}</h2>
      <p>{description}</p>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  )
}
