import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import AdminCaseManager from '../components/AdminCaseManager'
import { ErrorNotice } from '../components/StatusPill'

const SECTIONS = [
  { key: 'hospitals', label: 'Hospitals', columns: [['name', 'Hospital'], ['address', 'Address'], ['phone', 'Phone']] },
  { key: 'ambulances', label: 'Ambulances', columns: [['vehicle_number', 'Vehicle'], ['hospital_id', 'Home hospital ID'], ['is_active', 'Status']] },
  { key: 'users', label: 'Users', columns: [['name', 'Name'], ['email', 'Email'], ['role', 'Role'], ['is_active', 'Status']] },
  { key: 'patients', label: 'Patients', columns: [['name', 'Name'], ['age', 'Age'], ['sex', 'Sex'], ['blood_group', 'Blood group']] },
  { key: 'cases', label: 'Cases', columns: [['id', 'Case'], ['patient_name', 'Patient'], ['status', 'Handoff'], ['ambulance_status', 'Ambulance'], ['prep_status', 'Preparation']] },
]

function valueFor(row, key) {
  const value = row[key]
  if (key === 'role') return value?.replaceAll('_', ' ')
  if (key === 'patient_name') return row.patient?.name ?? '—'
  if (key === 'status' || key === 'ambulance_status' || key === 'prep_status') return value?.replaceAll('_', ' ') ?? '—'
  if (key === 'is_active') return value ? 'Active' : 'Inactive'
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

export default function Admin() {
  const [overview, setOverview] = useState(null)
  const [directories, setDirectories] = useState({})
  const [activeSection, setActiveSection] = useState('cases')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [counts, ...lists] = await Promise.all([
        api('/api/admin/overview'),
        ...SECTIONS.map((section) => api(`/api/admin/${section.key}`)),
      ])
      setOverview(counts)
      setDirectories(Object.fromEntries(SECTIONS.map((section, index) => [section.key, lists[index]])))
      setError('')
    } catch (reason) {
      setError(reason.message || 'Admin dashboard data could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const active = SECTIONS.find((section) => section.key === activeSection) ?? SECTIONS[0]
  const rows = directories[active.key] ?? []

  return (
    <div className="space-y-6">
      <header className="dashboard-hero rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="display text-3xl text-[var(--ink)]">Platform overview</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">Review platform totals and manage every emergency case across hospitals and ambulances.</p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="primary-button disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>
      {error ? <ErrorNotice onDismiss={() => setError('')}>{error}</ErrorNotice> : null}
      <div className="sr-only" aria-live="polite">
        {directories.cases?.length ?? 0} cases available to administrators
      </div>

      {loading && !overview ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Loading overview">
          {SECTIONS.map((section) => <div key={section.key} className="h-24 animate-pulse rounded-2xl bg-slate-200" />)}
        </div>
      ) : overview ? (
        <section aria-label="Platform totals" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            ['Users', overview.users],
            ['Hospitals', overview.hospitals],
            ['Ambulances', overview.ambulances],
            ['Patients', overview.patients],
            ['Emergency cases', overview.cases],
          ].map(([label, count]) => (
            <div key={label} className="metric-card px-4 py-4">
              <p className="text-sm font-medium text-slate-600">{label}</p>
              <p className="mt-2 text-2xl font-black tabular-nums text-slate-950">{count}</p>
            </div>
          ))}
        </section>
      ) : null}

      <section className="dashboard-panel table-shell overflow-hidden rounded-[28px]">
        <div className="border-b border-[var(--paper-line)] bg-[var(--paper-band)] px-4 pt-4 sm:px-5">
          <h2 className="text-base font-bold text-slate-950">{active.key === 'cases' ? 'Case management' : 'Directory'}</h2>
          <div className="mt-3 flex gap-1 overflow-x-auto" role="tablist" aria-label="Admin directories">
            {SECTIONS.map((section) => (
              <button
                type="button"
                key={section.key}
                role="tab"
                aria-selected={activeSection === section.key}
                onClick={() => setActiveSection(section.key)}
                className={`directory-tab shrink-0 ${activeSection === section.key ? 'active' : ''}`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>
        {active.key !== 'cases' ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th scope="col" className="px-4 py-3 sm:px-5">ID</th>
                    {active.columns.map(([, label]) => <th key={label} scope="col" className="px-4 py-3 sm:px-5">{label}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.id} className="text-slate-800">
                      <td className="px-4 py-3 font-semibold tabular-nums text-slate-700 sm:px-5">{row.id}</td>
                      {active.columns.map(([key]) => (
                        <td key={key} className={`px-4 py-3 sm:px-5 ${key === 'role' || key === 'sex' ? 'capitalize' : ''}`}>{valueFor(row, key)}</td>
                      ))}
                    </tr>
                  ))}
                  {!loading && rows.length === 0 ? (
                    <tr><td colSpan={active.columns.length + 1} className="px-4 py-8 text-center text-slate-600">No {active.label.toLowerCase()} found.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <p className="border-t border-slate-200 px-4 py-3 text-xs text-slate-600 sm:px-5">Platform directories are read-only in this prototype. Administrators can review and manage all emergency cases in the Cases tab.</p>
          </>
        ) : null}
      </section>
      {active.key === 'cases' ? (
        <AdminCaseManager
          cases={directories.cases ?? []}
          hospitals={directories.hospitals ?? []}
          onRefresh={load}
        />
      ) : null}
    </div>
  )
}
