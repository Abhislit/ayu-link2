import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import CaseMessages from '../components/CaseMessages'
import CaseQueue from '../components/CaseQueue'
import { CaseProgress, CaseStatus, EmptyCase, PatientOverview } from '../components/CaseOverview'
import { ErrorNotice, LiveStatus } from '../components/StatusPill'
import useRealtime from '../hooks/useRealtime'
import { useStripAdvance } from '../hooks/useStripAdvance'

export default function Hospital() {
  const { user } = useAuth()
  const [cases, setCases] = useState([])
  const [detail, setDetail] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadCases = useCallback(async () => {
    try {
      const result = await api('/api/hospital/cases')
      setCases(result)
      setError('')
      setSelectedId((current) => current ?? result[0]?.id ?? null)
    } catch (reason) {
      setError(reason.message || 'Incoming cases could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDetail = useCallback(async (caseId) => {
    if (!caseId) {
      setDetail(null)
      return
    }
    setDetailLoading(true)
    try {
      setDetail(await api(`/api/cases/${caseId}`))
    } catch (reason) {
      setError(reason.message || 'Case details could not be loaded.')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const handleRealtime = useCallback(
    (event, payload) => {
      loadCases()
      if (String(payload?.case?.id) === String(selectedId)) loadDetail(selectedId)
      if (event === 'message:new') setNotice('New emergency communication received.')
    },
    [loadCases, loadDetail, selectedId],
  )
  const connected = useRealtime(handleRealtime)

  useEffect(() => {
    loadCases()
  }, [loadCases])

  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
  }, [loadDetail, selectedId])

  const selectedDetail =
    String(detail?.case?.id) === String(selectedId) ? detail : null
  const advancing = useStripAdvance(selectedDetail?.case?.id, selectedDetail?.case?.status)

  async function acknowledge() {
    if (!selectedId || saving) return
    setSaving(true)
    setError('')
    try {
      await api(`/api/cases/${selectedId}/acknowledge`, { method: 'POST' })
      await Promise.all([loadCases(), loadDetail(selectedId)])
      setNotice('Emergency communication acknowledged.')
    } catch (reason) {
      setError(reason.message || 'Acknowledgement could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function updatePrepStatus(event) {
    const status = event.target.value
    if (!selectedId || saving) return
    setSaving(true)
    setError('')
    try {
      await api(`/api/cases/${selectedId}/prep-status`, {
        method: 'PATCH',
        body: { status },
      })
      await Promise.all([loadCases(), loadDetail(selectedId)])
      setNotice(`Preparation status updated to ${status}.`)
    } catch (reason) {
      setError(reason.message || 'Preparation status could not be updated.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="page-heading">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1>Hospital coordination</h1>
            <p>Review incoming handoffs, acknowledge the case, and update preparation status.</p>
          </div>
          <LiveStatus connected={connected} />
        </div>
      </header>
      {error ? <ErrorNotice onDismiss={() => setError('')}>{error}</ErrorNotice> : null}
      {notice ? (
        <div role="status" className="notice">
          {notice}
        </div>
      ) : null}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(17rem,0.72fr)_minmax(0,1.5fr)]">
        <CaseQueue
          title="Incoming cases"
          subtitle="Assigned to your hospital"
          cases={cases}
          selectedId={selectedId}
          onSelect={setSelectedId}
          loading={loading}
          emptyDescription="Cases appear here after an ambulance selects this hospital."
        />

        {detailLoading ? (
          <div className="space-y-4" aria-label="Loading selected case">
            <div className="skeleton h-40" />
            <div className="skeleton h-80" />
          </div>
        ) : selectedDetail ? (
          <div className="space-y-4">
            <section className="strip overflow-hidden">
              <div className="strip-head">
                <div className="flex items-center gap-2">
                  <span className="paper-label">Case</span>
                  <span className="font-mono text-[12px] font-semibold text-[var(--ink)]">#{selectedDetail.case.id}</span>
                  <span className="text-[var(--perf)]">·</span>
                  <span className="paper-label">{selectedDetail.ambulance?.vehicle_number}</span>
                </div>
                <span className="st text-[var(--paper-muted)]">
                  {new Date(selectedDetail.case.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>
              <div className="strip-body space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="display text-[30px] leading-none text-[var(--ink)]">{selectedDetail.patient.name}</h2>
                    <p className="mt-1.5 text-[12px] text-[var(--paper-muted)]">
                      {selectedDetail.patient.age} years · {selectedDetail.patient.sex} · {selectedDetail.patient.blood_group}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={acknowledge}
                    disabled={saving || selectedDetail.case.status === 'acknowledged'}
                    className="btn-ink min-h-12 px-4"
                  >
                    {selectedDetail.case.status === 'acknowledged' ? 'Acknowledged' : saving ? 'Saving…' : 'Acknowledge emergency'}
                  </button>
                </div>
                <CaseStatus detail={selectedDetail} />
                <div className="border-t border-dashed border-[var(--perf)] pt-3">
                  <CaseProgress detail={selectedDetail} advancing={advancing} />
                </div>
                <div className="grid gap-3 border-t border-dashed border-[var(--perf)] pt-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="prep-status" className="paper-label">Emergency preparation</label>
                    <select
                      id="prep-status"
                      value={selectedDetail.case.prep_status}
                      onChange={updatePrepStatus}
                      disabled={saving}
                      className="field mt-2 min-h-11 w-full"
                    >
                      <option value="pending">Pending</option>
                      <option value="requested">Requested</option>
                      <option value="preparing">Preparing</option>
                      <option value="ready">Ready</option>
                    </select>
                  </div>
                  <div className="border border-[var(--paper-line)] bg-[var(--paper-band)] p-3">
                    <p className="paper-label">Handoff state</p>
                    <p className="mt-1 text-[13px] font-semibold capitalize text-[var(--ink)]">
                      {selectedDetail.case.status.replaceAll('_', ' ')}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--paper-muted)]">
                      Ambulance movement:{' '}
                      <span className="font-semibold capitalize">
                        {selectedDetail.case.ambulance_status?.replaceAll('_', ' ') ?? 'status unavailable'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
              <div className="stamp px-[30px] py-2">
                <p className="stamp-line">
                  Handoff state · {selectedDetail.case.status?.replaceAll('_', ' ')} · prep{' '}
                  {selectedDetail.case.prep_status?.replaceAll('_', ' ') ?? 'pending'}
                </p>
              </div>
            </section>
            <PatientOverview detail={selectedDetail} />
            <CaseMessages key={selectedDetail.case.id} caseId={selectedDetail.case.id} user={user} canReply replyLabel="Reply to ambulance" />
          </div>
        ) : (
          <EmptyCase
            title="Select an incoming emergency"
            description="Choose a case from the queue to view patient information, listen to ambulance updates, and acknowledge the handoff."
          />
        )}
      </div>
    </div>
  )
}
