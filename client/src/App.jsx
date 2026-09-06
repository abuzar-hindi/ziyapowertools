import { useEffect, useState } from 'react'
import './App.css'
import { getCurrentAdmin, login, logout } from './services/auth'
import { apiFetch } from './services/api'

const emptyBusiness = {
  name: '', logo: '', address: { line1: '', line2: '', city: '', postalCode: '', country: '' },
  phone: '', whatsappNumber: '', googleReviewUrl: '', socialLinks: { instagram: '', facebook: '' },
}
const defaultShopDays = [0, 1, 2, 3, 4, 5, 6]

function App() {
  const [admin, setAdmin] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [section, setSection] = useState('overview')
  const isCustomerPage = window.location.pathname === '/customer'

  useEffect(() => {
    getCurrentAdmin()
      .then(({ admin: currentAdmin }) => setAdmin(currentAdmin))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }

    setSubmitting(true)
    try {
      const { admin: currentAdmin } = await login(email, password)
      setAdmin(currentAdmin)
      setPassword('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogout() {
    await logout().catch(() => {})
    setAdmin(null)
  }

  if (isCustomerPage) return <CustomerExperience />
  if (loading) return <main className="min-h-screen bg-stone-50 p-8 text-stone-700">Loading...</main>

  if (admin) {
    return <AdminWorkspace admin={admin} section={section} setSection={setSection} onLogout={handleLogout} />
  }

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-12 text-stone-900 sm:px-10 sm:py-20">
      <section className="mx-auto max-w-md">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">LoyaltyOS</p>
        <h1 className="mt-8 text-4xl font-semibold tracking-tight">Welcome back.</h1>
        <p className="mt-3 leading-7 text-stone-600">Sign in to continue to your business workspace.</p>
        <form onSubmit={handleSubmit} className="mt-10 space-y-5 border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <div>
            <label htmlFor="email" className="block text-sm font-medium">Email</label>
            <input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full border border-stone-300 px-3 py-3 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium">Password</label>
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full border border-stone-300 px-3 py-3 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100" />
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={submitting} className="w-full bg-stone-900 px-4 py-3 font-medium text-white hover:bg-stone-700 disabled:cursor-wait disabled:opacity-60">
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}

const adminNavigation = [
  ['overview', '▦', 'Overview'],
  ['approvals', '✓', 'Approvals'],
  ['customers', '♙', 'Customers'],
  ['loyalty', '◉', 'Loyalty'],
  ['rewards', '◇', 'Rewards'],
  ['qr', '⌁', 'QR / Check-in'],
  ['settings', '⚙', 'Settings'],
]

function AdminWorkspace({ admin, section, setSection, onLogout }) {
  const [businessName, setBusinessName] = useState('Your business')
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    apiFetch('/business')
      .then((response) => response.json())
      .then((body) => setBusinessName(body.data?.business?.name || 'Your business'))
      .catch(() => {})
  }, [])

  useEffect(() => {
    apiFetch('/dashboard?period=30d')
      .then((res) => res.json())
      .then((body) => {
        if (body.data?.metrics?.pendingApprovalsCount !== undefined) {
          setPendingCount(body.data.metrics.pendingApprovalsCount)
        }
      })
      .catch(() => {})
  }, [section])

  const sectionTitle = adminNavigation.find(([key]) => key === section)?.[2] || 'Overview'

  return (
    <main className="admin-app">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark">D</span>
          <div>
            <strong>DigiStamp</strong>
            <small>Business workspace</small>
          </div>
        </div>
        <nav aria-label="Admin navigation">
          {adminNavigation.map(([key, icon, label]) => (
            <button type="button" className={section === key ? 'active' : ''} onClick={() => setSection(key)} key={key}>
              <span>{icon}</span>
              {label}
              {key === 'approvals' && pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <span className="admin-avatar">{admin.email.charAt(0).toUpperCase()}</span>
          <div>
            <strong>{admin.email}</strong>
            <small>Administrator</small>
          </div>
          <button type="button" onClick={onLogout} aria-label="Log out">↪</button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-mobile-header">
          <div className="admin-brand">
            <span className="admin-brand-mark">D</span>
            <strong>DigiStamp</strong>
          </div>
          <button type="button" onClick={onLogout} aria-label="Log out">↪</button>
        </header>
        <div className="admin-content">
          <div className="admin-page-kicker">{businessName} <span>·</span> {sectionTitle}</div>
          {section === 'overview' && <AdminOverview businessName={businessName} onNavigate={setSection} />}
          {section === 'approvals' && <AdminApprovals onCountChange={setPendingCount} />}
          {section === 'customers' && <AdminCustomers />}
          {section === 'loyalty' && <AdminLoyalty />}
          {section === 'rewards' && <AdminRewards />}
          {section === 'qr' && <AdminQr />}
          {section === 'settings' && <AdminSettings admin={admin} />}
        </div>
      </div>
      <nav className="admin-mobile-nav" aria-label="Admin navigation">
        {adminNavigation.map(([key, icon, label]) => (
          <button type="button" className={section === key ? 'active' : ''} onClick={() => setSection(key)} key={key}>
            <span>{icon}</span>
            {label.replace(' / Check-in', '')}
            {key === 'approvals' && pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
          </button>
        ))}
      </nav>
    </main>
  )
}

function AdminOverview({ businessName, onNavigate }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch('/dashboard?period=30d')
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error?.message || 'Unable to load dashboard.')
        setData(body.data)
      })
      .catch((requestError) => setError(requestError.message))
  }, [])

  if (error) return <AdminError message={error} />
  if (!data) return <AdminLoading label="Loading your overview..." />

  const metrics = [
    ['Total Customers', data.metrics.totalCustomers, '◉'],
    ['Visits Today', data.metrics.visitsToday, '⌁'],
    ['Active Customers', data.metrics.activeCustomers, '↗'],
    ['Inactive Customers', data.metrics.inactiveCustomers, '◌'],
    ['Rewards Ready', data.metrics.rewardsWaiting, '◇'],
  ]

  const pendingCount = data.metrics.pendingApprovalsCount || 0

  return (
    <>
      <div className="admin-heading-row">
        <div>
          <span className="admin-eyebrow">OVERVIEW</span>
          <h1>Good morning <span className="wave">✦</span></h1>
          <p>Here is what is happening at {businessName}.</p>
        </div>
        <button className="admin-primary" type="button" onClick={() => onNavigate('qr')}>＋ Generate QR</button>
      </div>

      {pendingCount > 0 && (
        <div className="overview-highlight-banner">
          <div className="highlight-content">
            <span className="highlight-badge">✦ Action required</span>
            <strong>{pendingCount} {pendingCount === 1 ? 'approval' : 'approvals'} waiting</strong>
            <p>{data.metrics.pendingRegistrations || 0} new customer{data.metrics.pendingRegistrations === 1 ? '' : 's'}, {data.metrics.pendingStampRequests || 0} pending stamp{data.metrics.pendingStampRequests === 1 ? '' : 's'}</p>
          </div>
          <button type="button" className="admin-primary" onClick={() => onNavigate('approvals')}>Review approvals →</button>
        </div>
      )}

      <div className="admin-metric-grid">
        {metrics.map(([label, value, icon]) => (
          <div className="admin-metric" key={label}>
            <span className="metric-icon">{icon}</span>
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-dashboard-grid">
        <section className="admin-panel activity-panel">
          <PanelTitle title="Customer activity" action="View all" onClick={() => onNavigate('customers')} />
          <div className="activity-list">
            {data.recentActivity.map((item) => (
              <div className="activity-row" key={`${item.type}-${item.id}`}>
                <span className="activity-avatar">{item.customer?.charAt(0) || 'C'}</span>
                <div>
                  <strong>{item.customer}</strong>
                  <span>{item.type.replace('_', ' ')}</span>
                </div>
                <time>{new Date(item.occurredAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>
              </div>
            ))}
            {!data.recentActivity.length && <AdminEmpty title="No recent activity" text="Customer check-ins will appear here." />}
          </div>
        </section>
        <section className="admin-panel insight-panel">
          <PanelTitle title="Customer insights" />
          <InsightRow icon="↗" label="Most visited" value={data.topCustomers?.[0]?.name || 'No visits yet'} action="View customers" onClick={() => onNavigate('customers')} />
          <InsightRow icon="◇" label="Almost reward" value={`${data.segments?.almostReward?.length || 0} customers`} action="View group" onClick={() => onNavigate('customers')} />
          <InsightRow icon="◌" label="Inactive customers" value={`${data.metrics.inactiveCustomers} customers`} action="View group" onClick={() => onNavigate('customers')} />
          <InsightRow icon="＋" label="Recent customers" value={`${data.metrics.newCustomers} this month`} action="View group" onClick={() => onNavigate('customers')} />
        </section>
      </div>

      <section className="quick-actions">
        <span className="admin-eyebrow">QUICK ACTIONS</span>
        <div>
          {[
            ['⌁', 'Generate QR', 'qr'],
            ['✓', 'Approvals', 'approvals'],
            ['♙', 'View customers', 'customers'],
            ['◇', 'Manage rewards', 'rewards'],
          ].map(([icon, label, target]) => (
            <button type="button" onClick={() => onNavigate(target)} key={label}>
              <span>{icon}</span>{label}<b>→</b>
            </button>
          ))}
        </div>
      </section>
    </>
  )
}

function AdminApprovals({ onCountChange }) {
  const [registrations, setRegistrations] = useState([])
  const [stamps, setStamps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadData() {
    setError('')
    try {
      const [regRes, stampRes] = await Promise.all([
        apiFetch('/customer-registrations/pending'),
        apiFetch('/stamp-requests/pending'),
      ])
      const regBody = await regRes.json().catch(() => ({}))
      const stampBody = await stampRes.json().catch(() => ({}))

      if (!regRes.ok) throw new Error(regBody.error?.message || 'Unable to load customer registrations.')
      if (!stampRes.ok) throw new Error(stampBody.error?.message || 'Unable to load stamp requests.')

      const regList = regBody.data?.registrations || []
      const stampList = stampBody.data?.requests || []
      setRegistrations(regList)
      setStamps(stampList)
      if (onCountChange) onCountChange(regList.length + stampList.length)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  async function reviewRegistration(id, action) {
    try {
      const response = await apiFetch(`/customer-registrations/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (response.ok) {
        setRegistrations((current) => {
          const next = current.filter((item) => item.id !== id)
          if (onCountChange) onCountChange(next.length + stamps.length)
          return next
        })
      } else {
        const body = await response.json().catch(() => ({}))
        setError(body.error?.message || 'Unable to review registration.')
      }
    } catch (err) {
      setError(err.message)
    }
  }

  async function reviewStamp(id, action) {
    try {
      const response = await apiFetch(`/stamp-requests/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (response.ok) {
        setStamps((current) => {
          const next = current.filter((item) => item.id !== id)
          if (onCountChange) onCountChange(registrations.length + next.length)
          return next
        })
      } else {
        const body = await response.json().catch(() => ({}))
        setError(body.error?.message || 'Unable to review stamp request.')
      }
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <AdminLoading label="Loading pending approvals..." />

  return (
    <div className="approvals-container">
      <div className="admin-heading-row">
        <div>
          <span className="admin-eyebrow">APPROVALS</span>
          <h1>Approvals</h1>
          <p>Review new customer registrations and pending stamp requests.</p>
        </div>
      </div>
      {error && <p className="admin-form-error mb-4">{error}</p>}

      <section className="admin-panel approval-section-panel">
        <div className="panel-title">
          <h2>New Customer Registrations</h2>
          <span className="status-badge ready">{registrations.length} new</span>
        </div>
        <div className="approval-list">
          {registrations.map((item) => (
            <div className="pending-row" key={item.id}>
              <span className="customer-avatar">{item.name?.charAt(0) || '?'}</span>
              <div>
                <strong>{item.name}</strong>
                <span>{item.phone} · New customer registration</span>
              </div>
              <time>{new Date(item.requestedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
              <button type="button" className="approve-button" onClick={() => reviewRegistration(item.id, 'approve')}>Approve</button>
              <button type="button" className="reject-button" onClick={() => reviewRegistration(item.id, 'reject')}>Reject</button>
            </div>
          ))}
          {!registrations.length && <AdminEmpty title="No new customer requests" text="Genuinely new customers scanning the QR will appear here for approval." />}
        </div>
      </section>

      <section className="admin-panel approval-section-panel mt-6">
        <div className="panel-title">
          <h2>Pending Stamp Requests</h2>
          <span className="status-badge ready">{stamps.length} pending</span>
        </div>
        <div className="approval-list">
          {stamps.map((item) => (
            <div className="pending-row" key={item.id}>
              <span className="customer-avatar">{item.customer?.name?.charAt(0) || '?'}</span>
              <div>
                <strong>{item.customer?.name || 'Customer'}</strong>
                <span>{item.customer?.phone || ''} · Stamp request</span>
              </div>
              <time>{new Date(item.requestedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
              <button type="button" className="approve-button" onClick={() => reviewStamp(item.id, 'approve')}>Approve</button>
              <button type="button" className="reject-button" onClick={() => reviewStamp(item.id, 'reject')}>Reject</button>
            </div>
          ))}
          {!stamps.length && <AdminEmpty title="No pending stamp requests" text="Customer stamp requests will appear here for confirmation." />}
        </div>
      </section>
    </div>
  )
}

function PendingRequests() {
  const [requests, setRequests] = useState([])
  const [error, setError] = useState('')
  async function load() {
    try { const response = await apiFetch('/stamp-requests/pending'); const body = await response.json(); if (!response.ok) throw new Error(body.error?.message || 'Unable to load pending requests.'); setRequests(body.data.requests || []) } catch (requestError) { setError(requestError.message) }
  }
  useEffect(() => { load() }, [])
  async function review(id, action) {
    const response = await apiFetch(`/stamp-requests/${id}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
    if (response.ok) setRequests((current) => current.filter((request) => request.id !== id))
    else { const body = await response.json().catch(() => ({})); setError(body.error?.message || 'Unable to review request.') }
  }
  return <section className="admin-panel pending-panel"><PanelTitle title="Pending stamps" action={`${requests.length} pending`} />{error && <p className="admin-form-error">{error}</p>}{requests.map((request) => <div className="pending-row" key={request.id}><span className="customer-avatar">{request.customer?.name?.charAt(0) || '?'}</span><div><strong>{request.customer?.name || 'Customer'}</strong><span>{request.customer?.phone || ''}</span></div><time>{new Date(request.requestedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time><button type="button" className="approve-button" onClick={() => review(request.id, 'approve')}>Approve</button><button type="button" className="reject-button" onClick={() => review(request.id, 'reject')}>Reject</button></div>)}{!requests.length && !error && <AdminEmpty title="No pending stamps" text="New requests will appear here for review." />}</section>
}

function PanelTitle({ title, action, onClick }) { return <><div className="panel-title"><h2>{title}</h2>{action && <button type="button" onClick={onClick}>{action} →</button>}</div>{title === 'Customer activity' && <PendingRequests />}</> }
function InsightRow({ icon, label, value, action, onClick }) { return <div className="insight-row"><span className="insight-icon">{icon}</span><div><strong>{label}</strong><span>{value}</span></div><button type="button" onClick={onClick}>{action} →</button></div> }
function AdminLoading({ label }) { return <div className="admin-state"><span className="state-spinner">◌</span><p>{label}</p></div> }
function AdminError({ message }) { return <div className="admin-state error-state"><strong>Something went wrong</strong><p>{message}</p></div> }
function AdminEmpty({ title, text }) { return <div className="admin-empty"><span>◌</span><strong>{title}</strong><p>{text}</p></div> }

function AdminCustomers() {
  const [customers, setCustomers] = useState([]); const [pagination, setPagination] = useState(null); const [search, setSearch] = useState(''); const [filter, setFilter] = useState('all'); const [page, setPage] = useState(1); const [selected, setSelected] = useState(null); const [error, setError] = useState('')
  useEffect(() => { const query = new URLSearchParams({ search, filter: filter === 'active' ? 'recently-active' : filter === 'new' ? 'new' : filter === 'inactive' ? 'inactive' : 'all', page, limit: 10 }); apiFetch(`/customers?${query}`).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error?.message || 'Unable to load customers.'); setCustomers(body.data.customers); setPagination(body.data.pagination) }).catch((requestError) => setError(requestError.message)) }, [search, filter, page])
  if (selected) return <CustomerDetail customerId={selected} onBack={() => setSelected(null)} />
  return <><div className="admin-heading-row"><div><span className="admin-eyebrow">CUSTOMER MANAGEMENT</span><h1>Customers</h1><p>Manage your customers and understand their activity.</p></div><button className="admin-secondary" type="button">Filter <span>≡</span></button></div><div className="customer-toolbar"><label className="admin-search"><span>⌕</span><input aria-label="Search customers" placeholder="Search customers..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></label><div className="filter-pills">{[['all', 'All'], ['active', 'Active'], ['inactive', 'Inactive'], ['new', 'New'], ['reward', 'Reward ready']].map(([value, label]) => <button type="button" className={filter === value ? 'active' : ''} onClick={() => { setFilter(value); setPage(1) }} key={value}>{label}</button>)}</div></div>{error && <AdminError message={error} />}<section className="customer-table admin-panel"><div className="customer-table-head"><span>Customer</span><span>Visits</span><span>Progress</span><span>Last visit</span><span>Status</span><span>Action</span></div>{customers.map((customer) => <div className="customer-row" key={customer.id}><div className="customer-identity"><span className="customer-avatar">{customer.name.charAt(0)}</span><div><button type="button" onClick={() => setSelected(customer.id)}>{customer.name}</button><small>{customer.phone}</small></div></div><span data-label="Visits">{customer.totalVisits}</span><span data-label="Progress"><b className="progress-text">{customer.progress.current}/{customer.progress.required}</b><i className="progress-line"><em style={{ width: `${Math.min(100, (customer.progress.current / Math.max(customer.progress.required, 1)) * 100)}%` }} /></i></span><span data-label="Last visit">{customer.lastVisitAt ? new Date(customer.lastVisitAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}</span><span data-label="Status">{customer.rewardReady ? <b className="status-badge ready">Reward ready</b> : <b className="status-badge">Active</b>}</span><a className="row-action" href={`https://wa.me/${customer.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">Message ↗</a></div>)}{!customers.length && !error && <AdminEmpty title="No customers yet" text="Customers will appear here after their first check-in." />}</section>{pagination && <div className="pagination"><span>Page {pagination.page} of {pagination.pages}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>←</button><button type="button" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)}>→</button></div></div>}</>
}

function CustomerDetail({ customerId, onBack }) { const [data, setData] = useState(null); const [error, setError] = useState(''); useEffect(() => { Promise.all([apiFetch(`/customers/${customerId}`), apiFetch(`/customers/${customerId}/history`)]).then(async ([profile, history]) => { if (!profile.ok || !history.ok) throw new Error('Unable to load customer details.'); setData({ ...(await profile.json()).data, history: (await history.json()).data }) }).catch((requestError) => setError(requestError.message)) }, [customerId]); if (error) return <AdminError message={error} />; if (!data) return <AdminLoading label="Loading customer details..." />; const progress = data.customer.progress; return <><button className="back-link" type="button" onClick={onBack}>← Back to customers</button><div className="detail-heading"><span className="customer-avatar large">{data.customer.name.charAt(0)}</span><div><span className="admin-eyebrow">CUSTOMER PROFILE</span><h1>{data.customer.name}</h1><p>{data.customer.phone}</p></div><a className="admin-primary" href={`https://wa.me/${data.customer.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">Message on WhatsApp</a></div><div className="detail-stats"><div><span>Total visits</span><strong>{data.customer.activitySummary?.totalVisits || data.history.visits.length}</strong></div><div><span>Progress</span><strong>{progress.current}/{progress.required}</strong></div><div><span>Joined</span><strong>{new Date(data.customer.createdAt).toLocaleDateString()}</strong></div></div><section className="admin-panel detail-history"><PanelTitle title="Visit history" /><div className="activity-list">{data.history.visits.map((visit) => <div className="activity-row" key={visit._id}><span className="activity-avatar success">✓</span><div><strong>Stamp collected</strong><span>{visit.stampDay}</span></div><time>{new Date(visit.occurredAt).toLocaleDateString()}</time></div>)}{!data.history.visits.length && <AdminEmpty title="No activity yet" text="This customer's visits will appear here." />}</div></section></> }

function AdminLoyalty() {
  const initial = { active: true, stampsRequired: 6 }; const [form, setForm] = useState(initial); const [savedForm, setSavedForm] = useState(initial); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const dirty = JSON.stringify(form) !== JSON.stringify(savedForm)
  useEffect(() => { apiFetch('/loyalty-program').then((response) => response.json()).then((body) => { if (body.data?.program) { const nextForm = { active: body.data.program.active, stampsRequired: body.data.program.stampsRequired }; setForm(nextForm); setSavedForm(nextForm) } }).catch(() => setError('Unable to load loyalty settings.')).finally(() => setLoading(false)) }, [])
  async function save(event) { event.preventDefault(); if (!dirty) return; setSaving(true); setMessage(''); setError(''); try { const response = await apiFetch('/loyalty-program', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: form.active, stampsRequired: Number(form.stampsRequired) }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error?.message || 'Unable to save settings.'); const nextForm = { active: body.data.program.active, stampsRequired: body.data.program.stampsRequired }; setForm(nextForm); setSavedForm(nextForm); setMessage('Changes saved') } catch (saveError) { setError(saveError.message) } finally { setSaving(false) } }
  if (loading) return <AdminLoading label="Loading loyalty program..." />
  return <form className="admin-panel admin-form loyalty-manager" onSubmit={save}><div className="admin-heading-row compact"><div><span className="admin-eyebrow">LOYALTY PROGRAM</span><h1>Loyalty</h1><p>Set the milestone customers are working toward.</p></div><label className="toggle-control"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span>{form.active ? 'Active' : 'Inactive'}</span></label></div><div className="loyalty-setting-row"><div><span className="form-label">Collect</span><strong>{form.stampsRequired} stamps</strong></div><input aria-label="Required stamps" type="number" min="1" max="100" value={form.stampsRequired} onChange={(event) => setForm({ ...form, stampsRequired: Number(event.target.value) })} /></div><div className="loyalty-preview"><div><span className="admin-eyebrow">CUSTOMER CARD PREVIEW</span><h2>{form.stampsRequired} visits to a reward</h2><p>Informational preview of the current program.</p></div><div className="preview-stamps">{Array.from({ length: Math.min(Number(form.stampsRequired) || 6, 12) }, (_, index) => <span className={index < Math.min(3, Number(form.stampsRequired) || 6) ? 'filled' : ''} key={index}>{index < 3 ? '●' : '○'}</span>)}</div></div>{error && <p role="alert" className="admin-form-error">{error}</p>}{message && <p role="status" className="admin-success">{message}</p>}<button type="submit" className="admin-primary" disabled={saving || !dirty}>{saving ? 'Saving...' : dirty ? 'Save changes' : 'Changes saved'} <span>→</span></button></form>
}

function AdminRewards() {
  const [rewards, setRewards] = useState([])
  const [form, setForm] = useState({ description: '', status: 'active', milestoneStamps: 6 })
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loadRewards() {
    try {
      const response = await apiFetch('/rewards/manage')
      const body = await response.json()
      setRewards(body.data?.rewards || [])
    } catch {
      setError('Unable to load reward settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRewards() }, [])

  function startAdd() {
    setEditingId(null)
    setForm({ description: '', status: 'active', milestoneStamps: 6 })
    setShowForm(true)
    setMessage('')
    setError('')
  }

  function startEdit(reward) {
    setEditingId(reward._id)
    setForm({ description: reward.description, status: reward.status, milestoneStamps: reward.milestoneStamps || 6 })
    setShowForm(true)
    setMessage('')
    setError('')
  }

  async function toggleStatus(reward) {
    const nextStatus = reward.status === 'active' ? 'inactive' : 'active'
    try {
      const response = await apiFetch(`/rewards/manage/${reward._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: reward.description, status: nextStatus, milestoneStamps: reward.milestoneStamps || 6 }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error?.message || 'Unable to update status.')
      setRewards((current) => current.map((r) => (r._id === reward._id ? body.data.reward : r)))
    } catch (err) {
      setError(err.message)
    }
  }

  async function saveReward(event) {
    event.preventDefault()
    if (!form.description.trim()) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const path = editingId ? `/rewards/manage/${editingId}` : '/rewards/manage'
      const response = await apiFetch(path, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, milestoneStamps: Number(form.milestoneStamps) }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error?.message || 'Unable to save reward.')
      
      setRewards((current) => editingId ? current.map((r) => r._id === editingId ? body.data.reward : r) : [...current, body.data.reward].sort((a,b) => a.milestoneStamps - b.milestoneStamps))
      setShowForm(false)
      setMessage('Reward saved successfully.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <AdminLoading label="Loading rewards..." />

  return (
    <section className="rewards-workspace">
      <div className="admin-heading-row">
        <div>
          <span className="admin-eyebrow">REWARD MANAGEMENT</span>
          <h1>Rewards</h1>
          <p>Create and manage milestone rewards that keep customers coming back.</p>
        </div>
        <button type="button" className="admin-primary" onClick={startAdd}>
          ＋ Add Reward
        </button>
      </div>

      {error && <p className="admin-form-error mb-4">{error}</p>}
      {message && <p className="admin-success mb-4">{message}</p>}

      <div className="rewards-grid">
        {rewards.map((reward) => (
          <div className="reward-card-panel admin-panel" key={reward._id}>
            <div className="reward-card-header">
              <span className="reward-icon-badge">◇</span>
              <span className={`status-badge ${reward.status === 'active' ? 'ready' : ''}`}>
                {reward.status === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="reward-card-body">
              <strong className="reward-title">{reward.description}</strong>
              <p className="reward-milestone">Unlock at <b>{reward.milestoneStamps || 6}</b> stamps</p>
            </div>
            <div className="reward-card-actions">
              <button type="button" className="admin-secondary" onClick={() => toggleStatus(reward)}>
                {reward.status === 'active' ? 'Disable' : 'Enable'}
              </button>
              <button type="button" className="admin-primary" onClick={() => startEdit(reward)}>
                Edit
              </button>
            </div>
          </div>
        ))}
        {!rewards.length && (
          <AdminEmpty title="No rewards configured" text="Click '+ Add Reward' above to create your first milestone reward." />
        )}
      </div>

      {showForm && (
        <form className="reward-editor-modal admin-panel mt-6" onSubmit={saveReward}>
          <div className="panel-title">
            <h2>{editingId ? 'Edit Reward' : 'Add New Reward'}</h2>
            <button type="button" onClick={() => setShowForm(false)}>✕ Close</button>
          </div>
          <div className="form-group mt-4">
            <label className="form-label">Reward Name / Description</label>
            <input
              type="text" required maxLength="240"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. Free Artisanal Coffee or 20% Off Pastry"
              className="admin-input"
            />
          </div>
          <div className="form-row mt-4">
            <label className="form-label">Required Stamps</label>
            <input
              type="number" min="1" max="100" required
              value={form.milestoneStamps}
              onChange={(e) => setForm({ ...form, milestoneStamps: e.target.value })}
              className="admin-input"
            />
          </div>
          <div className="form-row mt-4">
            <label className="toggle-control">
              <input
                type="checkbox"
                checked={form.status === 'active'}
                onChange={(e) => setForm({ ...form, status: e.target.checked ? 'active' : 'inactive' })}
              />
              <span>Active</span>
            </label>
          </div>
          <div className="modal-actions mt-6">
            <button type="button" className="admin-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="admin-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Reward'}</button>
          </div>
        </form>
      )}
    </section>
  )
}

function AdminQr() { return <PermanentQrPanel /> }

function AdminSettings({ section = 'business', admin }) { return <>{section === 'business' && <ShopSettings /> }<SettingsPanel section={section} admin={admin} /></> }

function PermanentQrPanel() {
  const [qr, setQr] = useState(null); const [loading, setLoading] = useState(false); const [error, setError] = useState('')
  async function load() { setLoading(true); setError(''); try { const response = await apiFetch('/qr/permanent'); const body = await response.json(); if (!response.ok) throw new Error(body.error?.message || 'Unable to load permanent QR.'); setQr(body.data.qr) } catch (requestError) { setError(requestError.message) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  return <section className="admin-panel qr-panel"><div className="admin-heading-row compact"><div><span className="admin-eyebrow">PERMANENT CUSTOMER CHECK-IN</span><h1>QR / Check-in</h1><p>Print this one QR and display it at your business permanently.</p></div><span className="status-badge ready">Permanent</span></div><div className="qr-content">{qr ? <><div className="qr-frame"><img src={qr.qrImage} alt="Permanent customer QR code" /></div><div className="qr-meta"><span className="status-badge ready">Never expires</span><p>Customers scan, identify, and request today's stamp.</p><a href={qr.customerUrl} target="_blank" rel="noreferrer">Open customer flow ↗</a></div></> : <div className="qr-empty"><span>⌁</span><strong>{loading ? 'Preparing your QR...' : 'Permanent QR unavailable'}</strong><p>{error || 'Try again.'}</p></div>}</div>{error && <p role="alert" className="admin-form-error">{error}</p>}<button type="button" className="admin-primary" onClick={load} disabled={loading}>{loading ? 'Loading...' : 'Refresh QR'} <span>→</span></button></section>
}

function ShopSettings() {
  const initial = { manualStatus: 'auto', days: defaultShopDays, openTime: '09:00', closeTime: '21:00' }; const [form, setForm] = useState(initial); const [savedForm, setSavedForm] = useState(initial); const [photo, setPhoto] = useState(null); const [file, setFile] = useState(null); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const dirty = JSON.stringify(form) !== JSON.stringify(savedForm)
  useEffect(() => { Promise.all([apiFetch('/shop'), apiFetch('/featured-photo')]).then(async ([shopResponse, photoResponse]) => { const shop = await shopResponse.json(); const photoBody = await photoResponse.json(); if (shop.data?.settings) { const nextForm = { manualStatus: shop.data.settings.manualStatus || 'auto', days: shop.data.settings.operatingHours?.days || defaultShopDays, openTime: shop.data.settings.operatingHours?.openTime || '09:00', closeTime: shop.data.settings.operatingHours?.closeTime || '21:00' }; setForm(nextForm); setSavedForm(nextForm) } setPhoto(photoBody.data?.photo || null) }).catch(() => setError('Unable to load shop settings.')) }, [])
  async function saveShop(event) { event.preventDefault(); if (!dirty) return; setMessage(''); const response = await apiFetch('/shop', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); const body = await response.json(); if (!response.ok) return setError(body.error?.message || 'Unable to save shop hours.'); setSavedForm(form); setMessage('Changes saved') }
  async function uploadPhoto(event) { event.preventDefault(); if (!file) return setError('Choose a landscape photo first.'); if (photo && !window.confirm('A featured photo already exists. Replace it?')) return; const payload = new FormData(); payload.append('photo', file); if (photo) payload.append('replace', 'true'); const response = await apiFetch('/featured-photo', { method: 'POST', body: payload }); const body = await response.json(); if (!response.ok) return setError(body.error?.message || 'Unable to upload photo.'); setPhoto(body.data.photo); setFile(null); event.target.reset(); setMessage('Featured photo saved.') }
  return <section className="shop-settings admin-panel"><div className="admin-eyebrow">SHOP EXPERIENCE</div><h2>Opening hours & featured photo</h2><p className="settings-help">Give customers a clear sense of when you are open and what to expect.</p><form onSubmit={saveShop} className="shop-hours-form"><label>Status<select value={form.manualStatus} onChange={(event) => setForm({ ...form, manualStatus: event.target.value })}><option value="auto">Use opening hours</option><option value="open">Manually open</option><option value="closed">Manually closed</option></select></label><div className="day-picker"><span>Open days</span><div>{[['Sun', 0], ['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6]].map(([label, day]) => <button type="button" className={form.days.includes(day) ? 'selected' : ''} onClick={() => setForm({ ...form, days: form.days.includes(day) ? form.days.filter((value) => value !== day) : [...form.days, day] })} key={label}>{label}</button>)}</div></div><label>Opening time<input type="time" value={form.openTime} onChange={(event) => setForm({ ...event, openTime: event.target.value })} /></label><label>Closing time<input type="time" value={form.closeTime} onChange={(event) => setForm({ ...form, closeTime: event.target.value })} /></label><button className="admin-primary" type="submit" disabled={!dirty}>{dirty ? 'Save changes' : 'Changes saved'} →</button></form><div className="photo-manager"><div><span className="admin-eyebrow">FEATURED PHOTO</span><strong>{photo ? 'One photo is active' : 'No featured photo yet'}</strong><p>Landscape JPEG, PNG, or WebP up to 5 MB.</p></div>{photo && <img src={photo.url} alt="Current featured business" />}</div><form onSubmit={uploadPhoto} className="photo-upload"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} /><button className="admin-secondary" type="submit">{photo ? 'Choose replacement' : 'Upload photo'}</button></form>{error && <p role="alert" className="admin-form-error">{error}</p>}{message && <p role="status" className="admin-success">{message}</p>}</section>
}

function CustomerExperience() {
  const qrToken = new URLSearchParams(window.location.search).get('qr') || ''
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [business, setBusiness] = useState(null)
  const [identified, setIdentified] = useState(false)
  const [registrationPending, setRegistrationPending] = useState(false)
  const [progress, setProgress] = useState(null)
  const [rewards, setRewards] = useState([])
  const [activity, setActivity] = useState({ visits: [], rewards: [] })
  const [stampRequest, setStampRequest] = useState(null)
  const [featuredPhoto, setFeaturedPhoto] = useState('')
  const [rewardReveal, setRewardReveal] = useState(null)
  const [screen, setScreen] = useState('home')
  const [loading, setLoading] = useState(Boolean(qrToken))
  const [error, setError] = useState(qrToken ? '' : 'This QR code is invalid or expired. Please ask the business for a new one.')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [stamping, setStamping] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)

  async function refreshProgress() {
    const response = await apiFetch('/stamps/progress')
    if (response.ok) setProgress((await response.json()).data.progress)
  }

  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine)
    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    return () => { window.removeEventListener('online', updateConnection); window.removeEventListener('offline', updateConnection) }
  }, [])

  useEffect(() => {
    if (!qrToken) return
    apiFetch('/qr/sessions/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: qrToken }) })
      .then(async (response) => { const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error('This QR code has expired. Please ask the business for a new one.'); setBusiness(body.data.business); if (body.data.business?.featuredPhotoUrl) setFeaturedPhoto(body.data.business.featuredPhotoUrl) })
      .catch((requestError) => setError(requestError.message)).finally(() => setLoading(false))
  }, [qrToken])

  useEffect(() => {
    if (!qrToken) return
    Promise.all([
      apiFetch('/customers/me'),
      apiFetch('/rewards'),
      apiFetch('/customers/me/history'),
      apiFetch('/stamp-requests/current'),
    ]).then(async ([profileResponse, rewardsResponse, historyResponse, requestResponse]) => {
      if (!profileResponse.ok) return
      const profile = await profileResponse.json()
      setName(profile.data.customer.name); setPhone(profile.data.customer.phone); setBusiness(profile.data.business); setIdentified(true)
      if (profile.data.business?.featuredPhotoUrl) setFeaturedPhoto(profile.data.business.featuredPhotoUrl)
      if (rewardsResponse.ok) setRewards((await rewardsResponse.json()).data.rewards || [])
      if (historyResponse.ok) setActivity((await historyResponse.json()).data)
      if (requestResponse.ok) setStampRequest((await requestResponse.json()).data.request)
      await refreshProgress()
    }).catch(() => {})
  }, [qrToken])

  async function refreshData() {
    await refreshProgress()
    const [rewardResponse, historyResponse, requestResponse] = await Promise.all([apiFetch('/rewards'), apiFetch('/customers/me/history'), apiFetch('/stamp-requests/current')])
    if (rewardResponse.ok) {
      const nextRewards = (await rewardResponse.json()).data.rewards || []
      const newlyUnlocked = nextRewards.find((reward) => reward.status === 'unlocked' && !rewards.some((currentReward) => currentReward._id === reward._id && currentReward.status === 'unlocked'))
      if (newlyUnlocked) setRewardReveal(newlyUnlocked)
      setRewards(nextRewards)
    }
    if (historyResponse.ok) setActivity((await historyResponse.json()).data)
    if (requestResponse.ok) setStampRequest((await requestResponse.json()).data.request)
  }

  async function identify(event) {
    if (event && event.preventDefault) event.preventDefault()
    setError(''); setMessage('')
    if (!online) return setError('You are offline. Reconnect before continuing.')
    if (!name.trim() || !phone.trim()) return setError('Enter your name and phone number.')
    setSaving(true)
    try {
      const response = await apiFetch('/customers/identify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qrToken, name, phone }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error?.message || 'Unable to save your details.')

      if (body.data?.registrationPending) {
        setRegistrationPending(true)
        if (body.data.business) setBusiness(body.data.business)
        return
      }

      setRegistrationPending(false)
      setName(body.data.customer.name); setPhone(body.data.customer.phone); setBusiness(body.data.business); setIdentified(true); setMessage('Your loyalty card is ready.')
      if (body.data.business?.featuredPhotoUrl) setFeaturedPhoto(body.data.business.featuredPhotoUrl)
      await refreshData()
    } catch (requestError) { setError(requestError.message.includes('Failed to fetch') ? 'Unable to reach the server.' : requestError.message) } finally { setSaving(false) }
  }

  async function collectStamp() {
    if (!online) return setMessage('Reconnect before collecting a stamp.')
    setStamping(true); setMessage('')
    try {
      const response = await apiFetch('/stamp-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qrToken }) })
      const body = await response.json().catch(() => ({}))
      if (response.status === 409) setMessage(body.error?.code === 'STAMP_REQUEST_PENDING' ? 'Stamp requested · waiting for confirmation.' : "Today's stamp is already collected.")
      else if (!response.ok) throw new Error(body.error?.message || 'Unable to collect today\'s stamp.')
      else { setStampRequest(body.data.request); setMessage('Stamp requested · waiting for confirmation.') }
      await refreshData()
    } catch (requestError) { setMessage(requestError.message) } finally { setStamping(false) }
  }

  async function redeem(rewardId) {
    if (!online) return setMessage('Reconnect before redeeming a reward.')
    const response = await apiFetch(`/rewards/${rewardId}/redeem`, { method: 'POST' })
    const body = await response.json().catch(() => ({})); if (!response.ok) return setMessage(body.error?.message || 'Unable to redeem this reward.')
    setMessage('Reward redeemed. Your next card has started.'); await refreshData()
  }

  if (loading) return <main className="customer-app customer-centered"><div className="loading-orb">✦</div><p>Preparing your loyalty card...</p></main>
  if (error && !business) return <main className="customer-app customer-centered"><div className="error-card"><span className="brand-mark">✦</span><p role="alert">{error}</p></div></main>
  if (!business) return null
  if (registrationPending) return <main className="customer-app customer-centered"><div className="identity-card"><div className="brand-lockup"><span className="brand-mark">✦</span><span>DigiStamp</span></div><span className="eyebrow">{business.name}</span><h1>Registration Pending</h1><p>Your registration is waiting for approval.</p><button type="button" className="primary-action" onClick={() => identify(null)} disabled={saving}>{saving ? 'Checking status...' : 'Check Approval Status'}<b>↻</b></button></div></main>
  if (!identified) return <main className="customer-app customer-centered"><div className="identity-card"><div className="brand-lockup"><span className="brand-mark">✦</span><span>DigiStamp</span></div><span className="eyebrow">{business.name}</span><h1>Your visits, your rewards.</h1><p>Tell us who you are to start your digital loyalty card.</p><form onSubmit={identify}><label>Name<input required maxLength="120" value={name} onChange={(event) => setName(event.target.value)} /></label><label>Phone number<input required type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>{error && <p role="alert" className="form-error">{error}</p>}<button type="submit" className="primary-action" disabled={saving || !online}>{saving ? 'Setting up your card...' : 'Start collecting'}<b>→</b></button></form></div></main>


  const requiredProgramStamps = progress?.required || 6
  const current = progress?.current || 0
  const unlocked = rewards.filter((reward) => reward.status === 'unlocked')
  const locked = rewards.filter((reward) => reward.status !== 'unlocked' && reward.status !== 'redeemed')
  const redeemed = rewards.filter((reward) => reward.status === 'redeemed')

  const activeRewards = rewards.filter((reward) => reward.status !== 'inactive' && reward.status !== 'archived')
  const activeMilestones = activeRewards
    .map((r) => r.milestoneStamps)
    .filter((m) => typeof m === 'number' && m > 0)

  const milestoneSet = new Set(activeMilestones)
  if (milestoneSet.size === 0 && requiredProgramStamps) {
    milestoneSet.add(requiredProgramStamps)
  }

  const maxRewardMilestone = activeMilestones.length ? Math.max(...activeMilestones) : 0
  const required = Math.max(requiredProgramStamps, maxRewardMilestone)

  const stampSlots = Array.from({ length: required }, (_, index) => index)
  const stampActionLocked = stampRequest?.status === 'pending' || stampRequest?.status === 'approved' || current >= required

  const nextMilestone = activeMilestones.sort((a, b) => a - b).find((m) => m > current) || required
  const stampsToGo = Math.max(nextMilestone - current, 0)

  const linkItems = [
    ['instagram', '◎', business.socialLinks?.instagram], ['facebook', 'f', business.socialLinks?.facebook],
    ['whatsapp', '◌', business.whatsappNumber ? `https://wa.me/${business.whatsappNumber.replace(/\D/g, '')}` : ''],
    ['review', '★', business.googleReviewUrl], ['call', '⌕', business.phone ? `tel:${business.phone}` : ''],
  ]
  const greeting = name ? `Hey ${name.split(' ')[0]}!` : 'Welcome back!'

  const timelineEvents = [
    ...(activity.visits || []).map((visit) => ({
      id: visit._id || `visit-${visit.createdAt}`,
      date: new Date(visit.createdAt || visit.visitedAt || 0),
      title: 'Stamp collected',
      type: 'stamp',
      icon: '✓',
    })),
    ...(activity.rewards || [])
      .filter((r) => r.status === 'unlocked' || r.status === 'redeemed')
      .map((reward) => ({
        id: reward._id || `reward-${reward.updatedAt}`,
        date: new Date(reward.redeemedAt || reward.unlockedAt || reward.updatedAt || 0),
        title: reward.status === 'redeemed'
          ? `Reward redeemed · ${reward.description || 'Loyalty Reward'}`
          : `Reward unlocked · ${reward.description || 'Loyalty Reward'}`,
        type: reward.status,
        icon: reward.status === 'redeemed' ? '🎁' : '🎉',
      })),
  ].sort((a, b) => b.date - a.date)

  return <main className="customer-app">
    <div className="customer-shell">
      <header className="customer-topbar"><div className="brand-lockup"><span className="brand-mark">✦</span><span>DigiStamp</span></div><span className={`connection-dot ${online ? 'is-online' : ''}`} title={online ? 'Connected' : 'Offline'} /></header>
      {!online && <div className="offline-banner" role="status">Offline mode · your card is safe, but new stamps need a connection.</div>}
      {screen === 'home' && <section className="customer-screen home-screen">
        <div className="business-header">
          <p className="eyebrow">{business.name}</p>
          <div className="business-status"><strong className={business.shopStatus?.status === 'open' ? 'open' : 'closed'}>{business.shopStatus?.status === 'open' ? '● Open now' : '● Closed'}</strong><span>{business.shopStatus?.detail || 'Hours unavailable'}</span></div>
        </div>
        {featuredPhoto && <img className="featured-business-photo" src={featuredPhoto} alt={`${business.name} featured`} />}
        <div className="welcome-copy"><h1>{greeting}</h1><p>{stampRequest?.status === 'pending' ? 'Your stamp request is waiting for the team.' : stampRequest?.status === 'rejected' ? 'Your last request was declined. You can try again today.' : stampRequest?.status === 'approved' ? 'Today\'s stamp is confirmed.' : current >= required ? 'Your reward is ready to enjoy.' : current ? `${stampsToGo} more ${stampsToGo === 1 ? 'visit' : 'visits'} to unlock your reward.` : 'Your next little treat starts here.'}</p></div>
        <div className="loyalty-card">
          <div className="card-glow" />
          <div className="card-header"><span>VISIT CLUB</span><span>{current}/{required} visits</span></div>
          <div className="stamp-grid-container">
            <div className="stamp-grid">
              {stampSlots.map((index) => {
                const pos = index + 1
                const isCollected = pos <= current
                const isMilestone = milestoneSet.has(pos)
                let slotClass = `stamp-slot`
                if (isCollected) slotClass += ` collected`
                if (isMilestone) {
                  slotClass += ` reward-slot`
                  if (!isCollected) slotClass += ` mystery`
                }

                return (
                  <div className={slotClass} key={index}>
                    <span>
                      {isMilestone ? '🎁' : isCollected ? '✓' : '＋'}
                    </span>
                  </div>
                )
              })}
            </div>
            {required > 9 && <div className="stamp-scroll-hint"><span>scroll for more stamps</span> ↓</div>}
          </div>
          <div className="card-footer"><span>{current >= required ? 'Reward unlocked' : `${current} / ${required} visits`}</span><span>✦</span></div>
        </div>
        <button type="button" className="primary-action" onClick={() => { if (stampRequest?.status === 'pending') setMessage('Today\'s stamp is already requested.'); else if (stampRequest?.status === 'approved') setMessage("Today's stamp is already collected. You can collect another stamp tomorrow."); else collectStamp() }} disabled={stamping || !online || stampActionLocked}><span>{stamping ? 'Requesting...' : stampRequest?.status === 'pending' ? 'Stamp pending' : stampRequest?.status === 'approved' ? 'Stamp collected today' : current >= required ? 'Reward ready' : 'Collect Today\'s Stamp'}</span><b>→</b></button>
        {message && <p role="status" className="celebration">{message}</p>}
        <div className="next-reward"><div className="gift-icon">🎁</div><div><span className="eyebrow">{unlocked.length ? 'Your reward' : 'Next reward'}</span><strong>{unlocked.length ? unlocked[0].description : `${stampsToGo} more to go`}</strong></div><span className="chevron">›</span></div>
        <ContactRow items={linkItems} /><div className="business-footer">{business.address?.line1 && <span>{business.address.line1}{business.address.city ? `, ${business.address.city}` : ''}</span>}{business.phone && <span>{business.phone}</span>}<span>{business.shopStatus?.timezone ? `Hours · ${business.shopStatus.timezone}` : 'Business hours available above'}</span></div>
      </section>}
      {screen === 'rewards' && <section className="customer-screen"><ScreenHeading eyebrow="YOUR PERKS" title="Rewards" subtitle="Little moments worth coming back for." /><div className="progress-strip"><div><span>Current progress</span><strong>{current} <small>/ {required} visits</small></strong></div><div className="mini-progress">{stampSlots.slice(0, 12).map((index) => <i className={index < current ? 'filled' : ''} key={index} />)}</div></div><div className="section-label">Your rewards</div>{unlocked.map((reward) => <RewardCard key={reward._id} reward={reward} onRedeem={redeem} />)}{locked.length === 0 && unlocked.length === 0 && <div className="mystery-card"><span>🎁</span><div><strong>Something lovely is waiting</strong><p>Keep collecting to reveal it.</p></div><b>?</b></div>}{locked.map((reward) => <RewardCard key={reward._id} reward={reward} />)}{redeemed.map((reward) => <RewardCard key={reward._id} reward={reward} />)}</section>}
      {screen === 'activity' && <section className="customer-screen"><ScreenHeading eyebrow="YOUR JOURNEY" title="Activity" subtitle="A timeline of your visits and rewards." /><div className="cycle-summary"><span className="eyebrow">CURRENT CYCLE</span><strong>{current} / {required} stamps</strong><div className="mini-progress">{stampSlots.slice(0, 12).map((index) => <i className={index < current ? 'filled' : ''} key={index} />)}</div></div><div className="section-label">Timeline History</div><div className="timeline-container">{timelineEvents.length > 0 ? <div className="timeline-list">{timelineEvents.map((evt) => <div className="timeline-row" key={evt.id}><div className="timeline-marker-col"><div className={`timeline-dot ${evt.type}`}>{evt.icon}</div><div className="timeline-line" /></div><div className="timeline-body"><div className="timeline-meta"><span className="timeline-date">{evt.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span><span className="timeline-time">{evt.date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span></div><strong className="timeline-title">{evt.title}</strong></div></div>)}</div> : <div className="empty-state"><span>✦</span><p>Your first visit will appear here.</p></div>}</div></section>}
      {screen === 'profile' && <section className="customer-screen"><ScreenHeading eyebrow="YOUR DETAILS" title="Profile" subtitle="Your card, your local favorites." /><div className="profile-card"><div className="avatar">{name ? name.charAt(0).toUpperCase() : 'D'}</div><div><strong>{name || 'Your name'}</strong><span>{phone || 'Your phone number'}</span></div></div><div className="business-block"><span className="eyebrow">BUSINESS</span><h2>{business.name}</h2>{business.address?.line1 && <p>{business.address.line1}{business.address.city ? `, ${business.address.city}` : ''}</p>}{business.phone && <p>{business.phone}</p>}{business.shopStatus?.detail && <p>{business.shopStatus.detail}</p>}</div><ContactRow items={linkItems} large /><div className="powered-by">Powered by DigiStamp</div></section>}
      {rewardReveal && <div className="reward-reveal" role="dialog" aria-modal="true"><div className="reward-reveal-card"><button type="button" className="reveal-close" aria-label="Close reward reveal" onClick={() => setRewardReveal(null)}>×</button><span className="reveal-gift">🎁</span><span className="eyebrow">REWARD UNLOCKED</span><h2>Your reward is unlocked!</h2><p>{rewardReveal.description}</p><button type="button" className="primary-action" onClick={() => { setRewardReveal(null); setScreen('rewards') }}>View reward <b>→</b></button></div></div>}
      {screen === 'home' && message && unlocked[0] && <div className="reward-toast">🎉 <span><strong>You unlocked your reward!</strong><small>{unlocked[0].description}</small></span></div>}
      <nav className="bottom-nav" aria-label="Customer navigation">{[['home', '⌂', 'Home'], ['rewards', '✦', 'Rewards'], ['activity', '◷', 'Activity'], ['profile', '○', 'Profile']].map(([key, icon, label]) => <button type="button" className={screen === key ? 'active' : ''} onClick={() => setScreen(key)} key={key}><span>{icon}</span>{label}</button>)}</nav>
    </div>
  </main>
}

function ScreenHeading({ eyebrow, title, subtitle }) { return <div className="screen-heading"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div> }

function ContactRow({ items, large = false }) { return <div className={`contact-row ${large ? 'contact-row-large' : ''}`}>{items.filter(([, , href]) => href).map(([label, icon, href]) => <a href={href} aria-label={label} target={label === 'call' ? undefined : '_blank'} rel="noreferrer" key={label}><span>{icon}</span><small>{label === 'review' ? 'Review' : label.charAt(0).toUpperCase() + label.slice(1)}</small></a>)}</div> }

function RewardCard({ reward, onRedeem }) { const isRedeemed = reward.status === 'redeemed'; return <div className={`reward-card ${isRedeemed ? 'is-redeemed' : reward.status === 'unlocked' ? 'is-unlocked' : 'is-locked'}`}><div className="reward-art">{isRedeemed ? '✓' : reward.status === 'unlocked' ? '🎉' : '🎁'}</div><div><span>{isRedeemed ? 'Redeemed' : reward.status === 'unlocked' ? 'Unlocked' : 'Locked'}</span><strong>{isRedeemed ? 'Enjoyed reward' : reward.description || 'Keep collecting'}</strong>{isRedeemed && reward.redeemedAt && <small>{new Date(reward.redeemedAt).toLocaleDateString()}</small>}</div>{reward.status === 'unlocked' && <button type="button" onClick={() => onRedeem(reward._id)}>Redeem</button>}</div> }

export function CustomerRegistration() {
  const qrToken = new URLSearchParams(window.location.search).get('qr') || ''
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [business, setBusiness] = useState(null)
  const [loading, setLoading] = useState(Boolean(qrToken))
  const [error, setError] = useState(qrToken ? '' : 'This QR code is invalid or expired. Please ask the business for a new one.')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(null)
  const [stamping, setStamping] = useState(false)
  const [stampMessage, setStampMessage] = useState('')
  const [rewards, setRewards] = useState([])
  const [links, setLinks] = useState(null)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine)
    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    return () => {
      window.removeEventListener('online', updateConnection)
      window.removeEventListener('offline', updateConnection)
    }
  }, [])

  useEffect(() => {
    if (!qrToken) return
    apiFetch('/qr/sessions/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: qrToken }) })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error('This QR code has expired. Please ask the business for a new one.')
        setBusiness(body.data.business)
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false))
  }, [qrToken])

  useEffect(() => {
    if (!qrToken) return
    Promise.all([apiFetch('/customers/me'), apiFetch('/rewards')])
      .then(async ([profileResponse, rewardsResponse]) => {
        if (!profileResponse.ok) return
        const profile = await profileResponse.json()
        setName(profile.data.customer.name)
        setPhone(profile.data.customer.phone)
        setLinks(profile.data.business)
        setMessage('Welcome back. Your loyalty card is ready.')
        await refreshProgress()
        if (rewardsResponse.ok) setRewards((await rewardsResponse.json()).data.rewards || [])
      })
      .catch(() => {})
  }, [qrToken])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!online) {
      setError('You are offline. Reconnect before continuing so your details can be confirmed.')
      return
    }
    if (!name.trim() || !phone.trim()) {
      setError('Enter your name and phone number.')
      return
    }
    setSaving(true)
    try {
      const response = await apiFetch('/customers/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken, name, phone }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error?.message || 'Unable to save your details.')

      if (body.data?.registrationPending) {
        setMessage('Your registration is waiting for approval.')
        return
      }

      setMessage(`Thanks, ${body.data.customer.name}. Your profile is ready.`)
      setLinks(body.data.business)
      await refreshProgress()
      await refreshRewards()
    } catch (requestError) {
      setError(requestError.message.includes('Failed to fetch') ? 'Unable to reach the server. Check that the API is running.' : requestError.message)
    } finally {
      setSaving(false)
    }
  }

  async function refreshProgress() {
    const response = await apiFetch('/stamps/progress')
    if (response.ok) setProgress((await response.json()).data.progress)
  }

  async function refreshRewards() {
    const response = await apiFetch('/rewards')
    if (response.ok) setRewards((await response.json()).data.rewards || [])
  }

  async function redeem(rewardId) {
    const response = await apiFetch(`/rewards/${rewardId}/redeem`, { method: 'POST' })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) return setStampMessage(body.error?.message || 'Unable to redeem this reward.')
    setStampMessage('Reward redeemed. Your next loyalty cycle has started.')
    await refreshRewards()
    await refreshProgress()
  }

  async function collectStamp() {
    if (!online) {
      setStampMessage('You are offline. Reconnect before collecting a stamp.')
      return
    }
    setStamping(true)
    setStampMessage('')
    try {
      const response = await apiFetch('/stamps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qrToken }) })
      const body = await response.json().catch(() => ({}))
      if (response.status === 409) {
        setStampMessage("Today's stamp is already collected.")
        await refreshProgress()
        return
      }
      if (!response.ok) throw new Error(body.error?.message || 'Unable to collect today\'s stamp.')
      setProgress(body.data.progress)
      await refreshRewards()
      setStampMessage("Stamp added! Today's stamp is collected.")
    } catch (requestError) {
      setStampMessage(requestError.message)
    } finally {
      setStamping(false)
    }
  }

  if (loading) return <main className="min-h-screen bg-stone-50 p-8 text-stone-700">Checking QR code...</main>
  if (error && !business) return <main className="min-h-screen bg-stone-50 px-6 py-12 text-stone-900 sm:px-10 sm:py-20"><section className="mx-auto max-w-md border border-stone-200 bg-white p-6 shadow-sm"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">LoyaltyOS</p><p role="alert" className="mt-8 text-lg leading-7 text-stone-700">{error}</p></section></main>

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-12 text-stone-900 sm:px-10 sm:py-20">
      <section className="mx-auto max-w-md">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">LoyaltyOS</p>
        <h1 className="mt-8 text-4xl font-semibold tracking-tight">Get your loyalty stamp.</h1>
        <p className="mt-3 leading-7 text-stone-600">{business.name} · Tell us who you are to get started.</p>
        {!online && <p role="status" className="mt-4 border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">You are offline. Loyalty actions need a connection and no stamp will be created until the server confirms it.</p>}
        <form onSubmit={handleSubmit} className="mt-10 space-y-5 border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <label className="block text-sm font-medium">Name<input required maxLength="120" value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full border border-stone-300 px-3 py-3 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100" /></label>
          <label className="block text-sm font-medium">Phone number<input required type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-2 w-full border border-stone-300 px-3 py-3 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100" /></label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
          <button type="submit" disabled={saving || !online} className="w-full bg-stone-900 px-4 py-3 font-medium text-white hover:bg-stone-700 disabled:opacity-60">{saving ? 'Saving...' : 'Continue'}</button>
          {message && <div className="border-t border-stone-200 pt-5"><p className="text-sm font-medium text-stone-700">{progress ? `${progress.current} / ${progress.required} stamps` : 'Your progress is ready.'}</p><div className="mt-4 grid grid-cols-6 gap-2" aria-label="Stamp progress">{Array.from({ length: progress?.required || 0 }, (_, index) => <span key={index} className={`h-3 border ${index < (progress?.current || 0) ? 'border-amber-700 bg-amber-600' : 'border-stone-300 bg-stone-100'}`} />)}</div><button type="button" onClick={collectStamp} disabled={stamping || !online} className="mt-4 w-full border border-amber-700 px-4 py-3 font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-60">{stamping ? 'Collecting...' : 'Collect today\'s stamp'}</button>{rewards.filter((reward) => reward.status === 'unlocked').map((reward) => <div key={reward._id} className="mt-5 border border-amber-200 bg-amber-50 p-4"><p className="font-medium">Reward ready</p><p className="mt-1 text-sm text-stone-700">{reward.description || 'Your loyalty reward is ready.'}</p><button type="button" onClick={() => redeem(reward._id)} disabled={!online} className="mt-3 border border-stone-900 px-4 py-2 text-sm font-medium disabled:opacity-60">Redeem reward</button></div>)}{stampMessage && <p role="status" className="mt-3 text-sm text-emerald-700">{stampMessage}</p>}{links && <div className="mt-6 flex flex-wrap gap-4 border-t border-stone-200 pt-4 text-sm">{links.phone && <a href={`tel:${links.phone}`} className="underline">Call</a>}{links.whatsappNumber && <a href={`https://wa.me/${links.whatsappNumber.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a>}{links.googleReviewUrl && <a href={links.googleReviewUrl} target="_blank" rel="noreferrer">Leave us a Google Review</a>}{links.socialLinks?.instagram && <a href={links.socialLinks.instagram} target="_blank" rel="noreferrer">Instagram</a>}{links.socialLinks?.facebook && <a href={links.socialLinks.facebook} target="_blank" rel="noreferrer">Facebook</a>}</div>}</div>}
        </form>
      </section>
    </main>
  )
}

function InsightsPanel() {
  const [insights, setInsights] = useState(null)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState('30d')

  useEffect(() => {
    apiFetch(`/dashboard?period=${period}`).then(async (response) => {
      const body = await response.json()
      if (!response.ok) throw new Error(body.error?.message || 'Unable to load insights.')
      setInsights(body.data)
    }).catch((requestError) => setError(requestError.message))
  }, [period])

  if (error) return <p role="alert" className="mt-8 text-sm text-red-700">{error}</p>
  if (!insights) return <p className="mt-8 text-stone-600">Loading overview...</p>
  return <section className="mt-8"><div className="flex items-center justify-between gap-4"><h2 className="text-2xl font-semibold">Dashboard overview</h2><select aria-label="Dashboard period" value={period} onChange={(event) => setPeriod(event.target.value)} className="border border-stone-300 px-3 py-2"><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{Object.entries(insights.metrics).map(([label, value]) => <div key={label} className="border border-stone-200 bg-white p-5"><p className="text-sm capitalize text-stone-500">{label.replace(/([A-Z])/g, ' $1')}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>)}</div><h3 className="mt-8 text-lg font-semibold">Recent activity</h3><div className="mt-3 divide-y divide-stone-200 border-y border-stone-200 bg-white">{insights.recentActivity.map((item) => <p key={`${item.type}-${item.id}`} className="p-3 text-sm">{item.customer} · {item.type.replace('_', ' ')} · {new Date(item.occurredAt).toLocaleString()}</p>)}{!insights.recentActivity.length && <p className="p-3 text-sm text-stone-600">No recent activity.</p>}</div><h3 className="mt-8 text-lg font-semibold">Top customers</h3><div className="mt-3 divide-y divide-stone-200 border-y border-stone-200 bg-white">{insights.topCustomers.map((customer) => <p key={customer.id} className="p-3 text-sm">{customer.name} · {customer.visits} visits</p>)}{!insights.topCustomers.length && <p className="p-3 text-sm text-stone-600">No customer activity in this period.</p>}</div></section>
}

function CustomersPanel() {
  const [customers, setCustomers] = useState([])
  const [pagination, setPagination] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')

  useEffect(() => {
    const query = new URLSearchParams({ search, filter, page, limit: 10 })
    apiFetch(`/customers?${query}`).then(async (response) => {
      const body = await response.json()
      if (!response.ok) throw new Error(body.error?.message || 'Unable to load customers.')
      setCustomers(body.data.customers); setPagination(body.data.pagination)
    }).catch((requestError) => setError(requestError.message))
  }, [search, filter, page])

  function whatsapp(phone) { return `https://wa.me/${phone.replace(/\D/g, '')}` }
  return <section className="mt-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-2xl font-semibold">Customers</h2><p className="mt-1 text-stone-600">Find customers and follow up thoughtfully.</p></div><div className="flex gap-2"><input aria-label="Search customers" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Name or phone" className="border border-stone-300 px-3 py-2" /><select aria-label="Customer filter" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1) }} className="border border-stone-300 px-3 py-2"><option value="all">Everyone</option><option value="recently-active">Active this week</option><option value="inactive">Inactive</option><option value="new">New this month</option></select></div></div>{error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}<div className="mt-5 divide-y divide-stone-200 border-y border-stone-200 bg-white">{customers.map((customer) => <div key={customer.id} className="flex flex-wrap items-center justify-between gap-4 p-4"><div><p className="font-medium">{customer.name}</p><p className="text-sm text-stone-500">{customer.phone} · {customer.progress.current}/{customer.progress.required} stamps</p></div><div className="flex items-center gap-4 text-sm">{customer.rewardReady && <span className="font-medium text-amber-800">Reward ready</span>}<a href={whatsapp(customer.phone)} target="_blank" rel="noreferrer" className="underline">WhatsApp</a></div></div>)}{!customers.length && !error && <p className="p-6 text-stone-600">No customers match this view.</p>}</div>{pagination && <div className="mt-4 flex items-center justify-between text-sm text-stone-600"><span>Page {pagination.page} of {pagination.pages}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="border border-stone-300 px-3 py-2 disabled:opacity-40">Previous</button><button type="button" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)} className="border border-stone-300 px-3 py-2 disabled:opacity-40">Next</button></div></div>}</section>
}

void InsightsPanel
void CustomersPanel
void QrPanel

function SettingsPanel({ section }) {
  const [form, setForm] = useState(section === 'business' ? emptyBusiness : section === 'loyalty' ? { active: true, stampsRequired: 6 } : { description: '', status: 'active' })
  const [savedForm, setSavedForm] = useState(form)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const path = section === 'business' ? '/business' : section === 'loyalty' ? '/loyalty-program' : '/reward-settings'
    apiFetch(path).then((response) => response.json()).then((body) => {
      const value = body.data?.business || body.data?.program || body.data?.reward
      if (value) {
        const nextForm = section === 'business' ? { name: value.name || '', logo: value.logo || '', address: { ...emptyBusiness.address, ...(value.address || {}) }, phone: value.phone || '', whatsappNumber: value.whatsappNumber || '', googleReviewUrl: value.googleReviewUrl || '', socialLinks: { ...emptyBusiness.socialLinks, ...(value.socialLinks || {}) } } : section === 'loyalty' ? { active: value.active, stampsRequired: value.stampsRequired } : { description: value.description, status: value.status }
        setForm(nextForm); setSavedForm(nextForm)
      }
    }).catch(() => setError('Unable to load settings.')).finally(() => setLoading(false))
  }, [section])

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm)

  async function save(event) {
    event.preventDefault()
    setSaving(true); setError(''); setMessage('')
    const path = section === 'business' ? '/business' : section === 'loyalty' ? '/loyalty-program' : '/reward-settings'
    try {
      const response = await apiFetch(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error?.message || 'Unable to save settings.')
      setMessage('Changes saved'); setSavedForm(form)
    } catch (saveError) { setError(saveError.message) } finally { setSaving(false) }
  }

  if (loading) return <div className="mt-10 border border-stone-200 bg-white p-6 text-stone-600">Loading settings...</div>
  const inputClass = 'mt-2 w-full border border-stone-300 px-3 py-3 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100'
  return <form onSubmit={save} className="admin-panel admin-form">
    <div className="admin-heading-row compact"><div><span className="admin-eyebrow">{section === 'business' ? 'BUSINESS PROFILE' : section === 'loyalty' ? 'LOYALTY PROGRAM' : 'REWARD MANAGEMENT'}</span><h1>{section === 'business' ? 'Business settings' : section === 'loyalty' ? 'Loyalty program' : 'Rewards'}</h1><p>{section === 'reward' ? 'Create rewards that keep customers coming back.' : 'Keep your public business experience current.'}</p></div>{section === 'loyalty' && <span className="status-badge ready">{form.active ? 'Active' : 'Inactive'}</span>}</div>
    {section === 'business' && <>
      <label className="block text-sm font-medium">Business name<input required className={inputClass} value={form.name} onChange={(event) => updateField('name', event.target.value)} /></label>
      <label className="block text-sm font-medium">Logo URL<input type="url" className={inputClass} value={form.logo} onChange={(event) => updateField('logo', event.target.value)} placeholder="https://..." /></label>
      <label className="block text-sm font-medium">Address<input className={inputClass} value={form.address.line1} onChange={(event) => updateField('address', { ...form.address, line1: event.target.value })} placeholder="Street address" /></label>
      <div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-medium">City<input className={inputClass} value={form.address.city} onChange={(event) => updateField('address', { ...form.address, city: event.target.value })} /></label><label className="block text-sm font-medium">Postal code<input className={inputClass} value={form.address.postalCode} onChange={(event) => updateField('address', { ...form.address, postalCode: event.target.value })} /></label></div>
      <div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-medium">Phone<input className={inputClass} value={form.phone} onChange={(event) => updateField('phone', event.target.value)} /></label><label className="block text-sm font-medium">WhatsApp number<input className={inputClass} value={form.whatsappNumber} onChange={(event) => updateField('whatsappNumber', event.target.value)} /></label></div>
      <label className="block text-sm font-medium">Instagram URL<input type="url" className={inputClass} value={form.socialLinks.instagram} onChange={(event) => updateField('socialLinks', { ...form.socialLinks, instagram: event.target.value })} /></label>
      <label className="block text-sm font-medium">Facebook URL<input type="url" className={inputClass} value={form.socialLinks.facebook} onChange={(event) => updateField('socialLinks', { ...form.socialLinks, facebook: event.target.value })} /></label>
      <label className="block text-sm font-medium">Google Review URL<input type="url" className={inputClass} value={form.googleReviewUrl} onChange={(event) => updateField('googleReviewUrl', event.target.value)} /></label>
    </>}
    {section === 'loyalty' && <><label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={form.active} onChange={(event) => updateField('active', event.target.checked)} /> Loyalty program enabled</label><label className="block text-sm font-medium">Required stamps<input required type="number" min="1" max="100" className={inputClass} value={form.stampsRequired} onChange={(event) => updateField('stampsRequired', Number(event.target.value))} /></label></>}
    {section === 'reward' && <><label className="block text-sm font-medium">Reward name or description<textarea required maxLength="240" rows="3" className={inputClass} value={form.description} onChange={(event) => updateField('description', event.target.value)} /></label><label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={form.status === 'active'} onChange={(event) => updateField('status', event.target.checked ? 'active' : 'inactive')} /> Reward enabled</label></>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
    <button type="submit" disabled={saving || !dirty} className="admin-primary">{saving ? 'Saving...' : dirty ? 'Save changes' : 'Changes saved'} <span>→</span></button>
  </form>
}

function QrPanel() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setLoading(true); setError('')
    try {
      const response = await apiFetch('/qr/sessions', { method: 'POST' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error?.message || 'Unable to create QR code.')
      setSession(body.data.session)
    } catch (requestError) { setError(requestError.message) } finally { setLoading(false) }
  }

  return <section className="admin-panel qr-panel">
    <div className="admin-heading-row compact"><div><span className="admin-eyebrow">CUSTOMER CHECK-IN</span><h1>QR / Check-in</h1><p>Use this temporary QR at your business for customer check-ins.</p></div><span className="status-badge">Secure session</span></div>
    <div className="qr-content">{session ? <><div className="qr-frame"><img src={session.qrImage} alt="Temporary customer QR code" /></div><div className="qr-meta"><span className="status-badge ready">Active now</span><p>Expires {new Date(session.expiresAt).toLocaleString()}</p><a href={session.customerUrl} target="_blank" rel="noreferrer">Open customer flow ↗</a></div></> : <div className="qr-empty"><span>⌁</span><strong>No active check-in yet</strong><p>Generate a fresh QR for the next customer visit.</p></div>}</div>
    {error && <p role="alert" className="admin-form-error">{error}</p>}
    <button type="button" onClick={generate} disabled={loading} className="admin-primary">{loading ? 'Generating...' : session ? 'Generate fresh QR' : 'Generate QR'} <span>→</span></button>
  </section>
}

export default App
