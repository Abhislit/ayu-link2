import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import CaseMessages from './CaseMessages'
import CaseQueue from './CaseQueue'
import { CaseProgress, CaseStatus, EmptyCase, PatientOverview } from './CaseOverview'
import { ErrorNotice } from './StatusPill'

export default function AdminCaseManager({ cases, hospitals, onRefresh }) {
  const { user } = useAuth()
  const [activeId, setActiveId] = useState(cases[0]?.id ?? null)
  const selectedId = cases.some((item) => String(item.id) === String(activeId))
    ? activeId
    : cases[0]?.id ?? null
  const [detail, setDetail] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadDetail = useCallback(async (caseId) => {
    if (!caseId) return
    try {
      setDetail(await api(`/api/admin/cases/${caseId}`))
      setError('')
    } catch (reason) {
      setError(reason.message || 'Case details could not be loaded.')
    }
  }, [])

  useEffect(() => {
    if (!selectedId) return undefined
    let active = true
    api(`/api/admin/cases/${selectedId}`)
      .then((result) => {
        if (active) {
          setDetail(result)
          setError('')
        }
      })
      .catch((reason) => {
        if (active) setError(reason.message || 'Case details could not be loaded.')
      })
    return () => {
      active = false
    }
  }, [selectedId])

  const selectedDetail =
    String(detail?.case?.id) === String(selectedId) ? detail : null

  async function updateCase(fields) {
    if (!selectedId || saving) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api(`/api/admin/cases/${selectedId}`, { method: 'PATCH', body: fields })
      await Promise.all([loadDetail(selectedId), onRefresh()])
      setNotice('Case updated.')
    } catch (reason) {
      setError(reason.message || 'Case could not be updated.')
    } finally {
      setSaving(false)
    }
  }

  async function closeCase() {
    if (!selectedId || saving || !window.confirm('Close this emergency case? Admins can reopen it later.')) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api(`/api/cases/${selectedId}/close`, { method: 'POST' })
      await Promise.all([loadDetail(selectedId), onRefresh()])
      setNotice('Case closed. Admins can reopen it from the case status control.')
    } catch (reason) {
      setError(reason.message || 'Case could not be closed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {error ? <ErrorNotice onDismiss={() => setError('')}>{error}</ErrorNotice> : null}
      {notice ? <div role="status" className="notice">{notice}</div> : null}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(17rem,0.72fr)_minmax(0,1.5fr)]">
        <CaseQueue
          title="All emergency cases"
          subtitle="Admin access across every ambulance and hospital."
          cases={cases}
          selectedId={selectedId}
          onSelect={setActiveId}
          loading={false}
          emptyTitle="No emergency cases"
        />
        {selectedId && !selectedDetail && !error ? (
          <div className="space-y-4" aria-label="Loading selected case">
            <div className="skeleton h-40" />
            <div className="skeleton h-80" />
          </div>
        ) : selectedDetail ? (
          <div className="space-y-4">
            <section className="strip overflow-hidden">
              <div className="strip-head">
                <div>
                  <h2 className="text-[15px] font-semibold text-[var(--ink)]">
                    Case #{selectedDetail.case.id} · {selectedDetail.ambulance?.vehicle_number ?? 'Ambulance'}
                  </h2>
                  <p className="mt-1 text-[11px] text-[var(--paper-muted)]">
                    {selectedDetail.hospital?.name ?? 'No receiving hospital'}
                  </p>
                </div>
                <CaseStatus detail={selectedDetail} />
              </div>
              <div className="strip-body">
                <CaseProgress detail={selectedDetail} />
              </div>
            </section>
            <PatientOverview detail={selectedDetail} />
            <section className="strip">
              <div className="strip-body space-y-4">
                <div>
                  <h2 className="text-[15px] font-semibold text-[var(--ink)]">Admin case controls</h2>
                  <p className="mt-1 text-[12px] text-[var(--paper-muted)]">
                    Admins may review any case, override handoff requirements, and correct its workflow state.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="paper-label">
                    Priority
                    <select
                      value={selectedDetail.case.priority}
                      disabled={saving}
                      onChange={(event) => updateCase({ priority: event.target.value })}
                      className="field mt-2 min-h-11 w-full"
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </label>
                  <label className="paper-label">
                    Case status
                    <select
                      value={selectedDetail.case.status}
                      disabled={saving}
                      onChange={(event) => updateCase({ status: event.target.value })}
                      className="field mt-2 min-h-11 w-full"
                    >
                      <option value="open">Open</option>
                      <option value="hospital_selected">Hospital selected</option>
                      <option value="acknowledged">Acknowledged</option>
                      <option value="closed">Closed</option>
                    </select>
                  </label>
                  <label className="paper-label">
                    Receiving hospital
                    <select
                      value={selectedDetail.case.hospital_id ?? ''}
                      disabled={saving}
                      onChange={(event) => updateCase({
                        hospital_id: event.target.value ? Number(event.target.value) : null,
                      })}
                      className="field mt-2 min-h-11 w-full"
                    >
                      <option value="">No hospital assigned</option>
                      {hospitals.map((hospital) => (
                        <option key={hospital.id} value={hospital.id}>{hospital.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="paper-label">
                    Emergency category
                    <select
                      value={selectedDetail.case.emergency_category}
                      disabled={saving}
                      onChange={(event) => updateCase({ emergency_category: event.target.value })}
                      className="field mt-2 min-h-11 w-full"
                    >
                      <option value="unknown">Not yet classified</option>
                      <option value="trauma">Trauma / accident</option>
                      <option value="cardiac">Cardiac</option>
                      <option value="respiratory">Respiratory</option>
                      <option value="obstetric">Obstetric</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label className="paper-label">
                    Ambulance movement
                    <select
                      value={selectedDetail.case.ambulance_status}
                      disabled={saving}
                      onChange={(event) => updateCase({ ambulance_status: event.target.value })}
                      className="field mt-2 min-h-11 w-full"
                    >
                      <option value="en_route">En route</option>
                      <option value="arrived">Arrived</option>
                    </select>
                  </label>
                  <label className="paper-label">
                    Hospital preparation
                    <select
                      value={selectedDetail.case.prep_status}
                      disabled={saving}
                      onChange={(event) => updateCase({ prep_status: event.target.value })}
                      className="field mt-2 min-h-11 w-full"
                    >
                      <option value="pending">Pending</option>
                      <option value="requested">Requested</option>
                      <option value="preparing">Preparing</option>
                      <option value="ready">Ready</option>
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={closeCase}
                  disabled={saving || selectedDetail.case.status === 'closed'}
                  className="btn-alarm min-h-11 rounded-lg border px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {selectedDetail.case.status === 'closed' ? 'Case closed' : saving ? 'Saving…' : 'Close case'}
                </button>
              </div>
            </section>
            <CaseMessages
              key={selectedDetail.case.id}
              caseId={selectedDetail.case.id}
              user={user}
              canReply
              replyLabel="Send update"
            />
          </div>
        ) : (
          <EmptyCase
            title="Select a case to manage"
            description="Choose any case to review patient details, communications, and handoff controls."
          />
        )}
      </div>
    </div>
  )
}
