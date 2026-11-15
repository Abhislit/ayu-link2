import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import CaseMessages from '../components/CaseMessages'
import CaseQueue from '../components/CaseQueue'
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

const DEMO_RFID_CARDS = [
  ['CARD-1001', 'Ravi Kumar'],
  ['D6A3F706', 'Ananya Sharma'],
  ['B408F806', 'Vikram Nair'],
  ['6221965D', 'Priya Desai'],
  ['F33D1407', 'Arjun Reddy'],
  ['6D18FD06', 'Kavya Iyer'],
  ['9CDBFE04', 'Imran Sheikh'],
  ['19B52A07', 'Neha Gupta'],
  ['D4A6FC04', 'Sanjay Patil'],
  ['2B022B07', 'Ritu Banerjee'],
  ['03F52B07', 'Manoj Verma'],
]

export default function Ambulance() {
  const { user } = useAuth()
  const [cases, setCases] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [hospitals, setHospitals] = useState([])
  const [selectedHospital, setSelectedHospital] = useState('')
  const [uid, setUid] = useState('CARD-1001')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [readerOnline, setReaderOnline] = useState(false)
  const [readerStatusLoaded, setReaderStatusLoaded] = useState(false)
  const [readerStatusError, setReaderStatusError] = useState('')
  const [savingHospital, setSavingHospital] = useState(false)
  const [savingCategory, setSavingCategory] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const detailRequest = useRef(0)

  const loadCaseDetail = useCallback(async (caseId) => {
    const requestId = ++detailRequest.current
    setDetailLoading(true)
    try {
      const result = await api(`/api/cases/${caseId}`)
      if (requestId === detailRequest.current) {
        setDetail(result)
        setSelectedHospital(result.case.hospital_id ? String(result.case.hospital_id) : '')
      }
      return result
    } finally {
      if (requestId === detailRequest.current) setDetailLoading(false)
    }
  }, [])

  const refreshCases = useCallback(async (preferredId = selectedId) => {
    const result = await api('/api/ambulance/cases')
    setCases(result)
    const selected = result.find((item) => String(item.id) === String(preferredId)) ?? result[0]
    if (!selected) {
      detailRequest.current += 1
      setSelectedId(null)
      setDetail(null)
      setSelectedHospital('')
      setDetailLoading(false)
      return result
    }
    setSelectedId(selected.id)
    await loadCaseDetail(selected.id)
    return result
  }, [loadCaseDetail, selectedId])

  const handleRealtime = useCallback(
    (event, payload) => {
      const caseId = payload?.case?.id
      if (caseId && payload.case.ambulance_id === user.ambulance_id) {
        refreshCases().catch((reason) => {
          setError(reason.message || 'Active cases could not be refreshed.')
        })
        if (event === 'message:new') setNotice('A new hospital or case update has arrived.')
      }
    },
    [refreshCases, user.ambulance_id],
  )
  const connected = useRealtime(handleRealtime)
  const selectedDetail = String(detail?.case?.id) === String(selectedId) ? detail : null
  const advancing = useStripAdvance(selectedDetail?.case?.id, selectedDetail?.case?.status)

  useEffect(() => {
    let active = true
    Promise.allSettled([api('/api/hospitals'), api('/api/ambulance/cases')])
      .then(async ([hospitalResult, casesResult]) => {
        if (!active) return
        if (hospitalResult.status === 'fulfilled') {
          setHospitals(hospitalResult.value)
        } else {
          setError(hospitalResult.reason.message || 'Hospital directory could not be loaded.')
        }
        if (casesResult.status === 'fulfilled') {
          setCases(casesResult.value)
          const firstCase = casesResult.value[0]
          if (firstCase) {
            setSelectedId(firstCase.id)
            try {
              await loadCaseDetail(firstCase.id)
            } catch (reason) {
              if (active) setError(reason.message || 'Active case details could not be loaded.')
            }
          }
        } else {
          setError(casesResult.reason.message || 'Active cases could not be loaded.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [loadCaseDetail])

  useEffect(() => {
    let active = true
    let timer

    async function pollReaderStatus() {
      try {
        const status = await api('/api/rfid/status')
        if (active) {
          setReaderOnline(status.connected)
          setReaderStatusLoaded(true)
          setReaderStatusError('')
        }
      } catch (reason) {
        if (active) {
          setReaderStatusLoaded(true)
          setReaderStatusError(reason.message || 'Could not check RFID reader status.')
        }
      } finally {
        if (active) timer = window.setTimeout(pollReaderStatus, 10000)
      }
    }

    pollReaderStatus()
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [])

  async function simulateScan(event) {
    event.preventDefault()
    if (!uid.trim() || scanning || readerOnline) return
    setScanning(true)
    setError('')
    setNotice('')
    try {
      const result = await api('/api/rfid/demo-scans', {
        method: 'POST',
        body: { uid: uid.trim() },
      })
      await refreshCases(result.case.id)
      setNotice(`Patient identified. Emergency case #${result.case.id} is ready.`)
    } catch (reason) {
      setError(reason.message || 'Card could not be read. Check the UID and try again.')
    } finally {
      setScanning(false)
    }
  }

  async function selectCase(caseId) {
    setSelectedId(caseId)
    setError('')
    try {
      await loadCaseDetail(caseId)
    } catch (reason) {
      setError(reason.message || 'Case details could not be loaded.')
    }
  }

  async function assignHospital(event) {
    event.preventDefault()
    if (!selectedHospital || !selectedDetail?.case || savingHospital) return
    setSavingHospital(true)
    setError('')
    try {
      await api(`/api/cases/${selectedDetail.case.id}/hospital`, {
        method: 'POST',
        body: { hospital_id: Number(selectedHospital) },
      })
      await refreshCases(selectedDetail.case.id)
      setNotice('Receiving hospital selected. The hospital dashboard is now connected to this case.')
    } catch (reason) {
      setError(reason.message || 'Hospital selection could not be saved.')
    } finally {
      setSavingHospital(false)
    }
  }

  async function toggleAmbulanceStatus() {
    if (!selectedDetail?.case) return
    const status = selectedDetail.case.ambulance_status === 'arrived' ? 'en_route' : 'arrived'
    setError('')
    try {
      await api(`/api/cases/${selectedDetail.case.id}/ambulance-status`, {
        method: 'PATCH',
        body: { status },
      })
      await refreshCases(selectedDetail.case.id)
      setNotice(`Ambulance status updated to ${status.replaceAll('_', ' ')}.`)
    } catch (reason) {
      setError(reason.message || 'Ambulance status could not be updated.')
    }
  }

  async function updateCategory(event) {
    const category = event.target.value
    if (!selectedDetail?.case || savingCategory) return
    setSavingCategory(true)
    setError('')
    try {
      await api(`/api/cases/${selectedDetail.case.id}/emergency-category`, {
        method: 'PATCH',
        body: { category },
      })
      await refreshCases(selectedDetail.case.id)
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
                <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                  {readerOnline ? 'Physical RFID reader connected' : 'RFID scan · demo scanner'}
                </p>
              </div>
              <span className="st text-[var(--text-muted)]">Authenticated · {user.name}</span>
            </div>
            {!readerStatusLoaded ? (
              <p role="status" className="mt-4 text-sm text-[var(--text-muted)]">
                Checking RFID reader connection…
              </p>
            ) : readerOnline ? (
              <p role="status" className="mt-4 rounded-lg border border-[var(--board-line)] bg-[var(--paper-band)] px-3 py-2 text-sm text-[var(--text)]">
                Reader is online. Scan a physical card; the simulator is hidden while the reader is connected.
              </p>
            ) : (
              <>
                <form onSubmit={simulateScan} className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <label className="sr-only" htmlFor="rfid-uid">Demo patient card</label>
                  <select
                    id="rfid-uid"
                    value={uid}
                    onChange={(event) => setUid(event.target.value)}
                    className="field-dark min-h-12 min-w-0 flex-1"
                  >
                    {DEMO_RFID_CARDS.map(([cardUid, patientName]) => (
                      <option key={cardUid} value={cardUid}>{patientName} · {cardUid}</option>
                    ))}
                  </select>
                  <button type="submit" disabled={!uid.trim() || scanning} className="btn min-h-12 px-5">
                    <Icon name="radio" className="h-4 w-4" />
                    {scanning ? 'Reading card…' : 'Simulate RFID scan'}
                  </button>
                </form>
                <p className="mt-2 text-[11px] leading-5 text-[var(--text-muted)]">
                  Choose a patient for the demo scan. The production RFID device API uses its own device-key authentication.
                </p>
              </>
            )}
            {readerStatusError ? (
              <p role="status" className="mt-2 text-[11px] leading-5 text-[var(--alarm)]">
                RFID status check failed: {readerStatusError}
                {readerOnline ? ' The simulator remains hidden based on the last online report.' : ' The simulator remains available.'}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <CaseQueue
        title="Active patient cases"
        subtitle="Select a patient card to manage its handoff. Scan another RFID card to add a case."
        cases={cases}
        selectedId={selectedId}
        onSelect={selectCase}
        loading={false}
        emptyTitle="No active patient cases"
        emptyDescription="Scan a physical RFID card or use the demo scanner to create the first patient case."
        layout="cards"
      />

      {detailLoading || (selectedId && !selectedDetail) ? (
        <div className="space-y-4" aria-label="Loading selected case">
          <div className="skeleton h-40" />
          <div className="skeleton h-80" />
        </div>
      ) : !selectedDetail ? (
        <EmptyCase
          title="Ready for patient identification"
          description="Scan a physical RFID card or use the demo scanner to securely load a patient and create or reopen an emergency case."
        />
      ) : (
        <>
          <section className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-4">
              <section className="strip overflow-hidden">
                <div className="strip-head">
                  <div className="flex items-center gap-2">
                    <span className="paper-label">Case</span>
                    <span className="font-mono text-[12px] font-semibold text-[var(--ink)]">#{selectedDetail.case.id}</span>
                    <span className="text-[var(--perf)]">·</span>
                    <span className="paper-label">{selectedDetail.ambulance?.vehicle_number ?? 'assigned'}</span>
                  </div>
                  <StatusPill status={selectedDetail.case.priority} label={`${selectedDetail.case.priority} priority`} />
                </div>
                <div className="strip-body space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="display text-[30px] leading-none text-[var(--ink)]">{selectedDetail.patient.name}</h2>
                      <p className="mt-1.5 text-[12px] text-[var(--paper-muted)]">
                        {selectedDetail.patient.age} years · {selectedDetail.patient.sex} · {selectedDetail.patient.blood_group}
                      </p>
                    </div>
                    <StatusPill
                      status={selectedDetail.case.emergency_category}
                      label={`Category: ${selectedDetail.case.emergency_category ?? 'unknown'}`}
                    />
                  </div>
                  {selectedDetail.patient.allergies ? (
                    <p className="border border-[#b43e3540] bg-[var(--alarm-tint)] px-2.5 py-1.5 text-[12px] font-medium text-[#8e2d27]">
                      Allergies · {selectedDetail.patient.allergies}
                    </p>
                  ) : null}
                  <p className="text-[12px] text-[var(--paper-muted)]">
                    {selectedDetail.hospital ? `Receiving · ${selectedDetail.hospital.name}` : 'No receiving hospital selected yet'}
                  </p>
                  <CaseStatus detail={selectedDetail} />
                  <div className="border-t border-dashed border-[var(--perf)] pt-3">
                    <CaseProgress detail={selectedDetail} advancing={advancing} />
                  </div>
                </div>
                <div className="stamp px-[30px] py-2">
                  <p className="stamp-line">
                    Handoff state · {selectedDetail.case.status?.replaceAll('_', ' ')} · ambulance{' '}
                    {selectedDetail.case.ambulance_status?.replaceAll('_', ' ') ?? 'unknown'}
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
                      value={selectedDetail.case.emergency_category}
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
                        {selectedDetail.case.ambulance_status?.replaceAll('_', ' ') ?? 'status unavailable'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={toggleAmbulanceStatus}
                      className="border border-[var(--paper-line)] px-3 py-2 text-[11px] font-semibold text-[var(--ink)] transition-colors hover:bg-white"
                    >
                      Mark {selectedDetail.case.ambulance_status === 'arrived' ? 'en route' : 'arrived'}
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
                        {savingHospital ? 'Saving…' : selectedDetail.hospital ? 'Update hospital' : 'Select hospital'}
                      </button>
                    </div>
                    {selectedDetail.hospital ? (
                      <p className="text-[11px] leading-5 text-[var(--paper-muted)]">
                        Connected to {selectedDetail.hospital.name} · hospital staff receive updates in real time.
                      </p>
                    ) : (
                      <p className="text-[11px] leading-5 text-[#8e2d27]">Select a hospital before sending patient updates.</p>
                    )}
                  </form>
                </div>
              </section>

              <PatientOverview detail={selectedDetail} />
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
              {selectedDetail.hospital ? (
                <CaseMessages
                  key={selectedDetail.case.id}
                  caseId={selectedDetail.case.id}
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
              Case opened {new Date(selectedDetail.case.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
            <div className="text-[12px] text-[var(--text-muted)]">
              {selectedDetail.case.acknowledged_at
                ? `Hospital acknowledged ${new Date(selectedDetail.case.acknowledged_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                : 'Awaiting hospital acknowledgement'}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
