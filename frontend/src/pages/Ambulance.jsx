import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import CaseMessages from '../components/CaseMessages'
import { CaseProgress, CaseStatus, EmptyCase, PatientOverview } from '../components/CaseOverview'
import Icon from '../components/Icons'
import { ErrorNotice, LiveStatus, StatusPill } from '../components/StatusPill'
import useRealtime from '../hooks/useRealtime'
import { useStripAdvance } from '../hooks/useStripAdvance'

function PageHeader({ connected }) {
  return (
    <header className="page-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1>Ambulance handoff</h1>
          <p>Identify the patient, share a crew-reported concern, and keep the receiving team informed.</p>
        </div>
        <LiveStatus connected={connected} />
      </div>
    </header>
  )
}

const QUICK_CONCERNS = [
  'Breathing difficulty',
  'Chest discomfort',
  'Injury or accident',
  'Pregnancy-related concern',
  'Other / not sure',
]

export default function Ambulance() {
  const { user } = useAuth()
  const [detail, setDetail] = useState(null)
  const [hospitals, setHospitals] = useState([])
  const [selectedHospital, setSelectedHospital] = useState('')
  const [uid, setUid] = useState('CARD-1001')
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [savingHospital, setSavingHospital] = useState(false)
  const [savingCategory, setSavingCategory] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadCaseDetail = useCallback(async (caseId) => {
    const result = await api(`/api/cases/${caseId}`)
    setDetail(result)
    setSelectedHospital(result.case.hospital_id ? String(result.case.hospital_id) : '')
    return result
  }, [])

  const refreshCurrentCase = useCallback(async () => {
    try {
      const current = await api('/api/ambulance/case')
      await loadCaseDetail(current.id)
    } catch (reason) {
      if (reason.message.includes('No active case')) {
        setDetail(null)
      } else {
        setError(reason.message || 'The active case could not be refreshed.')
      }
    } finally {
      setLoading(false)
    }
  }, [loadCaseDetail])

  const handleRealtime = useCallback(
    (event, payload) => {
      const caseId = payload?.case?.id
      if (caseId && (String(caseId) === String(detail?.case?.id) || payload.case.ambulance_id === user.ambulance_id)) {
        refreshCurrentCase()
        if (event === 'message:new') setNotice('A new hospital or case update has arrived.')
      }
    },
    [detail?.case?.id, refreshCurrentCase, user.ambulance_id],
  )
  const connected = useRealtime(handleRealtime)
  const advancing = useStripAdvance(detail?.case?.id, detail?.case?.status)

  useEffect(() => {
    let active = true
    Promise.allSettled([api('/api/hospitals'), api('/api/ambulance/case')])
      .then(async ([hospitalResult, caseResult]) => {
        if (!active) return
        if (hospitalResult.status === 'fulfilled') {
          setHospitals(hospitalResult.value)
        } else {
          setError(hospitalResult.reason.message || 'Hospital directory could not be loaded.')
        }
        if (caseResult.status === 'fulfilled') {
          try {
            const caseDetail = await api(`/api/cases/${caseResult.value.id}`)
            if (active) {
              setDetail(caseDetail)
              setSelectedHospital(caseDetail.case.hospital_id ? String(caseDetail.case.hospital_id) : '')
            }
          } catch (reason) {
            if (active) setError(reason.message || 'Active case details could not be loaded.')
          }
        } else if (!caseResult.reason.message.includes('No active case')) {
          setError(caseResult.reason.message || 'Active case could not be loaded.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function simulateScan(event) {
    event.preventDefault()
    if (!uid.trim() || scanning) return
    setScanning(true)
    setError('')
    setNotice('')
    try {
      const result = await api('/api/rfid/demo-scans', {
        method: 'POST',
        body: { uid: uid.trim() },
      })
      await loadCaseDetail(result.case.id)
      setNotice(`Patient identified. Emergency case #${result.case.id} is ready.`)
    } catch (reason) {
      setError(reason.message || 'Card could not be read. Check the UID and try again.')
    } finally {
      setScanning(false)
    }
  }

  async function assignHospital(event) {
    event.preventDefault()
    if (!selectedHospital || !detail?.case || savingHospital) return
    setSavingHospital(true)
    setError('')
    try {
      await api(`/api/cases/${detail.case.id}/hospital`, {
        method: 'POST',
        body: { hospital_id: Number(selectedHospital) },
      })
      await loadCaseDetail(detail.case.id)
      setNotice('Receiving hospital selected. The hospital dashboard is now connected to this case.')
    } catch (reason) {
      setError(reason.message || 'Hospital selection could not be saved.')
    } finally {
      setSavingHospital(false)
    }
  }

  async function toggleAmbulanceStatus() {
    if (!detail?.case) return
    const status = detail.case.ambulance_status === 'arrived' ? 'en_route' : 'arrived'
    setError('')
    try {
      await api(`/api/cases/${detail.case.id}/ambulance-status`, {
        method: 'PATCH',
        body: { status },
      })
      await loadCaseDetail(detail.case.id)
      setNotice(`Ambulance status updated to ${status.replaceAll('_', ' ')}.`)
    } catch (reason) {
      setError(reason.message || 'Ambulance status could not be updated.')
    }
  }

  async function updateCategory(event) {
    const category = event.target.value
    if (!detail?.case || savingCategory) return
    setSavingCategory(true)
    setError('')
    try {
      await api(`/api/cases/${detail.case.id}/emergency-category`, {
        method: 'PATCH',
        body: { category },
      })
      await loadCaseDetail(detail.case.id)
      setNotice(`Emergency category set to ${category}.`)
    } catch (reason) {
      setError(reason.message || 'Emergency category could not be updated.')
    } finally {
      setSavingCategory(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-5" aria-label="Loading ambulance dashboard">
        <div className="skeleton h-16" />
        <div className="skeleton h-40" />
        <div className="skeleton h-72" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader connected={connected} />
      {error ? <ErrorNotice onDismiss={() => setError('')}>{error}</ErrorNotice> : null}
      {notice ? (
        <div role="status" className="notice">
          {notice}
        </div>
      ) : null}

      <section className="strip p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-semibold text-[var(--text)]">Patient identification</h2>
                <p className="mt-1 text-[12px] text-[var(--text-muted)]">RFID scan · demo scanner</p>
              </div>
              <span className="st text-[var(--text-muted)]">Authenticated · {user.name}</span>
            </div>
            <form onSubmit={simulateScan} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor="rfid-uid">RFID card UID</label>
              <input
                id="rfid-uid"
                value={uid}
                onChange={(event) => setUid(event.target.value)}
                maxLength={64}
                placeholder="Enter RFID card UID"
                className="field-dark min-h-12 min-w-0 flex-1"
              />
              <button type="submit" disabled={!uid.trim() || scanning} className="btn min-h-12 px-5">
                <Icon name="radio" className="h-4 w-4" />
                {scanning ? 'Reading card…' : 'Simulate RFID scan'}
              </button>
            </form>
            <p className="mt-2 text-[11px] leading-5 text-[var(--text-muted)]">
              Presentation mode: enter <span className="text-[var(--text)]">CARD-1001</span>. The production device API keeps
              its own device-key authentication.
            </p>
          </div>
        </div>
      </section>

      {!detail ? (
        <EmptyCase
          title="Ready for patient identification"
          description="Scan a demo RFID card to securely load the patient summary and create or reopen an emergency case."
        />
      ) : (
        <>
          <section className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-4">
              <section className="strip overflow-hidden">
                <div className="strip-head">
                  <div className="flex items-center gap-2">
                    <span className="paper-label">Case</span>
                    <span className="font-mono text-[12px] font-semibold text-[var(--ink)]">#{detail.case.id}</span>
                    <span className="text-[var(--perf)]">·</span>
                    <span className="paper-label">{detail.ambulance?.vehicle_number ?? 'assigned'}</span>
                  </div>
                  <StatusPill status={detail.case.priority} label={`${detail.case.priority} priority`} />
                </div>
                <div className="strip-body space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="display text-[30px] leading-none text-[var(--ink)]">{detail.patient.name}</h2>
                      <p className="mt-1.5 text-[12px] text-[var(--paper-muted)]">
                        {detail.patient.age} years · {detail.patient.sex} · {detail.patient.blood_group}
                      </p>
                    </div>
                    <StatusPill
                      status={detail.case.emergency_category}
                      label={`Category: ${detail.case.emergency_category ?? 'unknown'}`}
                    />
                  </div>
                  {detail.patient.allergies ? (
                    <p className="border border-[#b43e3540] bg-[var(--alarm-tint)] px-2.5 py-1.5 text-[12px] font-medium text-[#8e2d27]">
                      Allergies · {detail.patient.allergies}
                    </p>
                  ) : null}
                  <p className="text-[12px] text-[var(--paper-muted)]">
                    {detail.hospital ? `Receiving · ${detail.hospital.name}` : 'No receiving hospital selected yet'}
                  </p>
                  <CaseStatus detail={detail} />
                  <div className="border-t border-dashed border-[var(--perf)] pt-3">
                    <CaseProgress detail={detail} advancing={advancing} />
                  </div>
                </div>
                <div className="stamp px-[30px] py-2">
                  <p className="stamp-line">
                    Handoff state · {detail.case.status?.replaceAll('_', ' ')} · ambulance{' '}
                    {detail.case.ambulance_status?.replaceAll('_', ' ') ?? 'unknown'}
                  </p>
                </div>
              </section>

              <section className="strip">
                <div className="strip-body space-y-4">
                  <h3>Response controls</h3>
                  <div>
                    <label htmlFor="emergency-category" className="paper-label">Emergency category</label>
                    <select
                      id="emergency-category"
                      value={detail.case.emergency_category}
                      onChange={updateCategory}
                      disabled={savingCategory}
                      className="field mt-2 min-h-11 w-full"
                    >
                      <option value="unknown">Not yet classified</option>
                      <option value="trauma">Trauma / accident</option>
                      <option value="cardiac">Cardiac</option>
                      <option value="respiratory">Respiratory</option>
                      <option value="obstetric">Obstetric</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-[var(--perf)] pt-3">
                    <div>
                      <p className="paper-label">Ambulance movement</p>
                      <p className="mt-1 text-[13px] font-semibold capitalize text-[var(--ink)]">
                        {detail.case.ambulance_status?.replaceAll('_', ' ') ?? 'status unavailable'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={toggleAmbulanceStatus}
                      className="border border-[var(--paper-line)] px-3 py-2 text-[11px] font-semibold text-[var(--ink)] transition-colors hover:bg-white"
                    >
                      Mark {detail.case.ambulance_status === 'arrived' ? 'en route' : 'arrived'}
                    </button>
                  </div>
                  <form onSubmit={assignHospital} className="space-y-2 border-t border-dashed border-[var(--perf)] pt-3">
                    <label htmlFor="hospital-select" className="paper-label">Receiving hospital</label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <select
                        id="hospital-select"
                        value={selectedHospital}
                        onChange={(event) => setSelectedHospital(event.target.value)}
                        required
                        className="field min-h-12 min-w-0 flex-1"
                      >
                        <option value="" disabled>Select a hospital</option>
                        {hospitals.map((hospital) => (
                          <option key={hospital.id} value={hospital.id}>{hospital.name}</option>
                        ))}
                      </select>
                      <button type="submit" disabled={!selectedHospital || savingHospital} className="btn-ink min-h-12 px-4">
                        {savingHospital ? 'Saving…' : detail.hospital ? 'Update hospital' : 'Select hospital'}
                      </button>
                    </div>
                    {detail.hospital ? (
                      <p className="text-[11px] leading-5 text-[var(--paper-muted)]">
                        Connected to {detail.hospital.name} · hospital staff receive updates in real time.
                      </p>
                    ) : (
                      <p className="text-[11px] leading-5 text-[#8e2d27]">Select a hospital before sending patient updates.</p>
                    )}
                  </form>
                </div>
              </section>

              <PatientOverview detail={detail} />
            </div>

            <section className="space-y-3">
              <div className="flex items-center gap-3 border-b border-[var(--board-line)] pb-3">
                <div className="grid h-10 w-10 place-items-center border border-[var(--board-line)] text-[var(--text)]">
                  <Icon name="activity" className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="display text-[20px] text-[var(--text)]">Emergency assistant</h2>
                  <p className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">Voice-first handoff with the receiving hospital.</p>
                </div>
              </div>
              <div className="border border-[var(--board-line)] bg-[var(--board)] px-4 py-3 text-[12px] leading-6 text-[var(--text-muted)]">
                This assistant supports communication only. It does not diagnose or replace professional medical judgment.
              </div>
              {detail.hospital ? (
                <CaseMessages
                  key={detail.case.id}
                  caseId={detail.case.id}
                  user={user}
                  canReply
                  replyLabel="Send update"
                  quickConcerns={QUICK_CONCERNS}
                />
              ) : (
                <div className="border border-dashed border-[var(--board-line)] bg-[var(--board)] px-5 py-9 text-center">
                  <Icon name="hospital" className="mx-auto h-7 w-7 text-[var(--text-muted)]" />
                  <p className="mt-3 text-[13px] font-semibold text-[var(--text)]">Select a hospital to open communication</p>
                  <p className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">
                    Patient details remain on the ambulance dashboard until a receiving hospital is assigned.
                  </p>
                </div>
              )}
            </section>
          </section>

          <section className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--board-line)] pt-3">
            <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--text-muted)]">
              <Icon name="clock" className="h-4 w-4" />
              Case opened {new Date(detail.case.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
            <div className="text-[12px] text-[var(--text-muted)]">
              {detail.case.acknowledged_at
                ? `Hospital acknowledged ${new Date(detail.case.acknowledged_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                : 'Awaiting hospital acknowledgement'}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
