import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import Icon from './Icons'
import { ADMIN_ROLES, AMBULANCE_ROLES, DOCTOR_ROLES, HOSPITAL_ROLES } from '../roleRoutes'

const NAV = [
  { to: '/ambulance', label: 'Ambulance', icon: 'activity', roles: AMBULANCE_ROLES },
  { to: '/hospital', label: 'Hospital', icon: 'hospital', roles: HOSPITAL_ROLES },
  { to: '/doctor', label: 'Doctor', icon: 'shield', roles: DOCTOR_ROLES },
  { to: '/admin', label: 'Admin', icon: 'activity', roles: ADMIN_ROLES },
]

export default function Shell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function signOut() {
    logout()
    navigate('/login', { replace: true })
  }

  const visible = NAV.filter((item) => item.roles.includes(user.role))
  const links = (className) =>
    visible.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        className={({ isActive }) => `${className} ${isActive ? 'active' : ''}`}
      >
        <Icon name={item.icon} />
        <span>{item.label}</span>
      </NavLink>
    ))

  return (
    <div className="app-shell">
      <aside className="app-rail">
        <div className="app-brand">
          <img className="app-brand-mark" src="/swarakshak-mark.png" alt="" />
          <span>SWARAKSHAK</span>
        </div>
        <p className="nav-caption">Workspaces</p>
        <nav aria-label="Primary navigation" className="workspace-nav">
          {links('workspace-link')}
        </nav>
        <div className="operator-card">
          <p className="chrome-label">Signed in</p>
          <p className="operator-name truncate">{user.name}</p>
          <p className="operator-role capitalize">{user.role.replaceAll('_', ' ')}</p>
        </div>
        <button type="button" onClick={signOut} className="btn-ghost mt-3 w-full">
          Sign out
        </button>
      </aside>

      <div className="app-frame">
        <header className="mobile-header">
          <div className="mobile-topbar">
            <div className="app-brand">
              <img className="app-brand-mark" src="/swarakshak-mark.png" alt="" />
              <span>SWARAKSHAK</span>
            </div>
            <button type="button" onClick={signOut} className="mobile-signout">Sign out</button>
          </div>
          <nav aria-label="Primary navigation" className="mobile-nav">
            {links('workspace-link')}
          </nav>
        </header>
        <main className="app-main">
          <div className="app-content"><Outlet /></div>
        </main>
      </div>
    </div>
  )
}
