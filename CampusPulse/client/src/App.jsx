import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, CalendarDays, Check, ChevronDown, Clock3, Code2,
  Download, Filter, GraduationCap, LayoutDashboard, LogOut, MapPin, Menu,
  Plus, Search, ShieldCheck, Sparkles, Ticket, Trash2, Users, X, Pencil,
  CalendarCheck, AlertCircle, CheckCircle2, PartyPopper, BriefcaseBusiness
} from "lucide-react";

const API = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");
const categories = ["All", "Technology", "Cultural", "Career", "Sports", "Community", "Workshop", "Other"];
const categoryIcons = { Technology: Code2, Cultural: PartyPopper, Career: BriefcaseBusiness, Sports: Activity, Community: Users, Workshop: GraduationCap, Other: Sparkles };
const emptyForm = { title: "", description: "", category: "Technology", venue: "", event_date: "", start_time: "10:00", end_time: "12:00", organizer: "CampusPulse Team", capacity: 100 };

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
function getAttendeeId() {
  let id = localStorage.getItem("cp_attendee_id");
  if (!id) {
    id = window.crypto?.randomUUID?.() || `attendee-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("cp_attendee_id", id);
  }
  return id;
}
function prettyDate(value) {
  if (!value) return "Date to be announced";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function initials(text = "") {
  return text.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join("").toUpperCase() || "CP";
}
function Toast({ toast, onClose }) {
  if (!toast) return null;
  return <div className={`toast ${toast.type || "success"}`} role="status">
    {toast.type === "error" ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>}
    <span>{toast.message}</span><button className="icon-btn" onClick={onClose} aria-label="Dismiss"><X size={16}/></button>
  </div>;
}
function EventCard({ event, registered, onRegister, onCancel, onDetails, isAdmin }) {
  const Icon = categoryIcons[event.category] || Sparkles;
  const full = event.attendee_count >= event.capacity;
  const past = event.event_date < new Date().toISOString().slice(0, 10);
  return <article className="event-card">
    <div className={`event-art art-${(event.id % 5) + 1}`}>
      <span className="art-glow" /><span className="art-symbol"><Icon size={35}/></span>
      <span className="category-chip">{event.category}</span>
      <span className="art-date"><CalendarDays size={13}/>{prettyDate(event.event_date)}</span>
    </div>
    <div className="event-body">
      <div className="event-title-row"><h3>{event.title}</h3><button className="arrow-btn" onClick={() => onDetails(event)} aria-label="View details"><ArrowUpRight size={18}/></button></div>
      <p className="event-description">{event.description || "Join your campus community for this upcoming event."}</p>
      <div className="event-meta"><span><MapPin size={14}/>{event.venue}</span><span><Clock3 size={14}/>{event.start_time}–{event.end_time}</span></div>
      <div className="event-footer">
        <div className="capacity"><div className="avatar-stack"><span>{initials(event.organizer)}</span><span><Users size={12}/></span></div><div><b>{event.attendee_count}/{event.capacity}</b><small>registered</small></div></div>
        {isAdmin ? <button className="btn btn-light btn-sm" onClick={() => onDetails(event)}>Manage <ArrowUpRight size={14}/></button> :
          registered ? <button className="btn btn-outline btn-sm" onClick={() => onCancel(event)}><Check size={15}/> Registered</button> :
          <button className="btn btn-primary btn-sm" disabled={full || past} onClick={() => onRegister(event)}>{past ? "Event ended" : full ? "Event full" : "Register"} <ArrowUpRight size={14}/></button>}
      </div>
    </div>
  </article>;
}
function Modal({ title, subtitle, onClose, children, wide = false }) {
  useEffect(() => {
    const fn = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <section className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20}/></button></div>
      {children}
    </section>
  </div>;
}
function Field({ label, children, full = false }) {
  return <label className={`field ${full ? "field-full" : ""}`}><span>{label}</span>{children}</label>;
}

export default function App() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("upcoming");
  const [activeTab, setActiveTab] = useState("discover");
  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem("cp_admin_token") || "");
  const [adminEmail, setAdminEmail] = useState(() => sessionStorage.getItem("cp_admin_email") || "");
  const [registrations, setRegistrations] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [profile, setProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cp_profile") || '{"name":"","email":""}'); } catch { return { name: "", email: "" }; }
  });
  const [profileDraft, setProfileDraft] = useState({ name: "", email: "" });
  const [login, setLogin] = useState({ email: "admin@campuspulse.local", password: "" });
  const [loginBusy, setLoginBusy] = useState(false);

  const notify = useCallback((message, type = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4200);
  }, []);
  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request("/events");
      setEvents(data);
    } catch (e) { notify(e.message, "error"); }
    finally { setLoading(false); }
  }, [notify]);
  const loadRegistrations = useCallback(async () => {
    if (!adminToken) return;
    try {
      const data = await request("/admin/registrations", { headers: { Authorization: `Bearer ${adminToken}` } });
      setRegistrations(data);
    } catch (e) {
      if (e.message.toLowerCase().includes("session") || e.message.toLowerCase().includes("sign-in")) logoutAdmin();
      notify(e.message, "error");
    }
  }, [adminToken]);
  useEffect(() => { loadEvents(); }, [loadEvents]);
  useEffect(() => { if (activeTab === "admin" && adminToken) loadRegistrations(); }, [activeTab, adminToken, loadRegistrations]);

  const attendeeId = getAttendeeId();
  const registeredIds = useMemo(() => new Set(events.filter(e => e.my_registered).map(e => e.id)), [events]);
  const [myRegistrations, setMyRegistrations] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cp_registered_ids") || "[]"); } catch { return []; }
  });
  const myRegistered = useMemo(() => new Set(myRegistrations), [myRegistrations]);
  const filtered = useMemo(() => events.filter(e => {
    const matchesText = `${e.title} ${e.description} ${e.venue} ${e.organizer}`.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === "All" || e.category === category;
    const matchesStatus = status === "all" || (status === "upcoming" ? e.event_date >= new Date().toISOString().slice(0, 10) : e.event_date < new Date().toISOString().slice(0, 10));
    return matchesText && matchesCategory && matchesStatus;
  }), [events, query, category, status]);
  const upcomingCount = events.filter(e => e.event_date >= new Date().toISOString().slice(0, 10)).length;
  const totalSeats = events.reduce((sum, e) => sum + Number(e.attendee_count || 0), 0);
  const stats = [{ label: "Upcoming events", value: upcomingCount, icon: CalendarDays, tone: "violet" }, { label: "Student registrations", value: totalSeats, icon: Users, tone: "mint" }, { label: "Event categories", value: new Set(events.map(e => e.category)).size, icon: Sparkles, tone: "blue" }];

  function logoutAdmin() {
    setAdminToken(""); setAdminEmail(""); setRegistrations([]);
    sessionStorage.removeItem("cp_admin_token"); sessionStorage.removeItem("cp_admin_email");
  }
  async function registerEvent(event) {
    if (!profile.name.trim() || !profile.email.trim()) {
      setProfileDraft(profile); setModal({ type: "profile", event }); return;
    }
    await doRegister(event, profile);
  }
  async function doRegister(event, attendee) {
    try {
      await request(`/events/${event.id}/register`, { method: "POST", body: JSON.stringify({ attendee_id: attendeeId, attendee_name: attendee.name, attendee_email: attendee.email }) });
      const next = [...new Set([...myRegistrations, event.id])];
      setMyRegistrations(next); localStorage.setItem("cp_registered_ids", JSON.stringify(next));
      notify("You're registered! See you at the event.");
      setModal(null); await loadEvents();
    } catch (e) { notify(e.message, "error"); }
  }
  async function cancelRegistration(event) {
    if (!window.confirm(`Cancel your registration for "${event.title}"?`)) return;
    try {
      await request(`/events/${event.id}/register`, { method: "DELETE", body: JSON.stringify({ attendee_id: attendeeId }) });
      const next = myRegistrations.filter(id => id !== event.id);
      setMyRegistrations(next); localStorage.setItem("cp_registered_ids", JSON.stringify(next));
      notify("Registration cancelled."); await loadEvents();
    } catch (e) { notify(e.message, "error"); }
  }
  async function saveProfile(e) {
    e.preventDefault();
    const next = { name: profileDraft.name.trim(), email: profileDraft.email.trim() };
    if (!next.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email)) return notify("Enter your name and a valid email.", "error");
    setProfile(next); localStorage.setItem("cp_profile", JSON.stringify(next));
    if (modal?.event) await doRegister(modal.event, next); else setModal(null);
  }
  function openCreate() { setEditingId(null); setForm({ ...emptyForm, event_date: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10) }); setModal({ type: "event-form" }); }
  function openEdit(event) {
    setEditingId(event.id);
    setForm({ title: event.title, description: event.description, category: event.category, venue: event.venue, event_date: event.event_date, start_time: event.start_time, end_time: event.end_time, organizer: event.organizer, capacity: event.capacity });
    setModal({ type: "event-form" });
  }
  async function saveEvent(e) {
    e.preventDefault();
    try {
      const editing = Boolean(editingId);
      await request(editing ? `/events/${editingId}` : "/events", {
        method: editing ? "PUT" : "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ ...form, capacity: Number(form.capacity) })
      });
      notify(editing ? "Event updated successfully." : "New event published.");
      setModal(null); await loadEvents();
    } catch (e2) { notify(e2.message, "error"); }
  }
  async function deleteEvent(event) {
    if (!window.confirm(`Delete "${event.title}" and all its registrations? This cannot be undone.`)) return;
    try {
      await request(`/events/${event.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${adminToken}` } });
      notify("Event deleted."); await loadEvents(); await loadRegistrations();
    } catch (e) { notify(e.message, "error"); }
  }
  async function signIn(e) {
    e.preventDefault(); setLoginBusy(true);
    try {
      const data = await request("/admin/login", { method: "POST", body: JSON.stringify(login) });
      setAdminToken(data.token); setAdminEmail(data.email);
      sessionStorage.setItem("cp_admin_token", data.token); sessionStorage.setItem("cp_admin_email", data.email);
      notify("Welcome to the admin workspace."); setActiveTab("admin");
    } catch (e2) { notify(e2.message, "error"); }
    finally { setLoginBusy(false); }
  }
  async function exportCsv(event) {
    try {
      const response = await fetch(`${API}/admin/events/${event.id}/registrations.csv`, { headers: { Authorization: `Bearer ${adminToken}` } });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "Export failed."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `event-${event.id}-registrations.csv`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { notify(e.message, "error"); }
  }
  function details(event) { setModal({ type: "details", event }); }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark"><Activity size={22}/></div><div><strong>Campus<span>Pulse</span></strong><small>EVENTS, CONNECTED.</small></div><button className="icon-btn sidebar-close" onClick={() => setMobileNav(false)}><X size={18}/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="side-nav">
        <button className={activeTab === "discover" ? "nav-item active" : "nav-item"} onClick={() => { setActiveTab("discover"); setMobileNav(false); }}><LayoutDashboard size={18}/>Discover events</button>
        <button className={activeTab === "my-events" ? "nav-item active" : "nav-item"} onClick={() => { setActiveTab("my-events"); setStatus("all"); setMobileNav(false); }}><Ticket size={18}/>My registrations<span className="nav-count">{myRegistrations.length}</span></button>
        <button className={activeTab === "admin" ? "nav-item active" : "nav-item"} onClick={() => { setActiveTab("admin"); setMobileNav(false); }}><ShieldCheck size={18}/>Admin workspace</button>
      </nav>
      <div className="sidebar-bottom">
        <div className="help-card"><div className="help-icon"><Sparkles size={17}/></div><strong>Make campus life count.</strong><p>Find your people. Learn something new. Make memories.</p><button onClick={() => { setActiveTab("discover"); setStatus("upcoming"); }}>Explore events <ArrowUpRight size={14}/></button></div>
        <div className="sidebar-user"><div className="user-avatar">{initials(profile.name || "Campus User")}</div><div className="user-info"><b>{profile.name || "Campus guest"}</b><small>{profile.email || "Discover your next event"}</small></div><button className="icon-btn" title="Edit profile" onClick={() => { setProfileDraft(profile); setModal({ type: "profile" }); }}><Pencil size={15}/></button></div>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <button className="icon-btn mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={21}/></button>
        <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><b>{activeTab === "discover" ? "Discover events" : activeTab === "my-events" ? "My registrations" : "Admin workspace"}</b></div>
        <div className="topbar-right"><span className="live-dot"/><span className="live-label">Campus is active</span><button className="top-avatar" onClick={() => { setProfileDraft(profile); setModal({ type: "profile" }); }}>{initials(profile.name || "Guest")}</button></div>
      </header>

      {activeTab !== "admin" && <div className="page-content">
        <section className="hero">
          <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line"/> YOUR CAMPUS, YOUR MOMENT</div><h1>Make room for<br/><span>what moves you.</span></h1><p>Discover experiences, meet your people, and make your campus days count. Your next big moment starts here.</p>
            <div className="hero-actions"><button className="btn btn-white" onClick={() => { document.getElementById("event-explorer")?.scrollIntoView({ behavior: "smooth" }); }}><CalendarCheck size={16}/>Explore events <ArrowUpRight size={16}/></button><span className="hero-note"><span className="tiny-avatars"><i>J</i><i>A</i><i>S</i></span> Built for campus communities</span></div>
          </div>
          <div className="hero-visual"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-glass"><div className="glass-top"><span>UP NEXT</span><span className="glass-live"><i/> LIVE</span></div><div className="glass-icon"><Sparkles size={25}/></div><h3>{events.find(e => e.event_date >= new Date().toISOString().slice(0, 10))?.title || "Your next big moment"}</h3><div className="glass-meta"><span><CalendarDays size={13}/>{prettyDate(events.find(e => e.event_date >= new Date().toISOString().slice(0, 10))?.event_date)}</span><span><MapPin size={13}/>{events.find(e => e.event_date >= new Date().toISOString().slice(0, 10))?.venue || "On campus"}</span></div><div className="glass-progress"><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/></div><div className="glass-foot"><span>Good things happen together.</span><ArrowUpRight size={15}/></div></div><div className="floating-badge badge-top"><span className="float-icon"><PartyPopper size={17}/></span><div><b>Find your spark</b><small>Explore something new</small></div></div><div className="floating-badge badge-bottom"><div className="float-check"><Check size={16}/></div><div><b>You're on the list!</b><small>Make it official</small></div></div></div>
        </section>

        <section className="stats-grid">{stats.map(s => <div className="stat-card" key={s.label}><div className={`stat-icon ${s.tone}`}><s.icon size={19}/></div><div className="stat-copy"><span>{s.label}</span><strong>{s.value.toLocaleString("en-IN")}</strong></div><span className="stat-decoration"><ArrowUpRight size={17}/></span></div>)}</section>

        <section id="event-explorer" className="events-section">
          <div className="section-heading"><div><div className="eyebrow muted"><span className="eyebrow-line"/> THE CAMPUS CALENDAR</div><h2>{activeTab === "my-events" ? "Your registered events" : "Find your next thing."}</h2><p>{activeTab === "my-events" ? "Every great campus memory starts with showing up." : "From big ideas to good times, there's a place for you."}</p></div><div className="section-side"><span className="event-count">{activeTab === "my-events" ? myRegistrations.length : filtered.length} <small>events</small></span></div></div>
          <div className="filter-panel">
            <div className="search-box"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search events, venues, organizers..." aria-label="Search events"/>{query && <button className="icon-btn" onClick={() => setQuery("")}><X size={15}/></button>}</div>
            <div className="filter-divider"/>
            <label className="select-wrap"><Filter size={16}/><select value={category} onChange={e => setCategory(e.target.value)} aria-label="Filter category">{categories.map(c => <option key={c}>{c}</option>)}</select><ChevronDown size={15}/></label>
            <div className="filter-divider"/>
            <div className="segmented"><button className={status === "upcoming" ? "selected" : ""} onClick={() => setStatus("upcoming")}>Upcoming</button><button className={status === "all" ? "selected" : ""} onClick={() => setStatus("all")}>All events</button><button className={status === "past" ? "selected" : ""} onClick={() => setStatus("past")}>Past</button></div>
          </div>
          {activeTab === "my-events" && <div className="inline-notice"><Ticket size={17}/><span>Your registrations are saved in this browser. Use the same browser to cancel a registration.</span></div>}
          {loading ? <div className="loading-state"><div className="spinner"/><span>Finding campus moments...</span></div> :
            <div className="event-grid">{filtered.filter(e => activeTab !== "my-events" || myRegistered.has(e.id)).map(event =>
              <EventCard key={event.id} event={event} registered={myRegistered.has(event.id)} onRegister={registerEvent} onCancel={cancelRegistration} onDetails={details} isAdmin={false}/>
            )}</div>}
          {!loading && filtered.filter(e => activeTab !== "my-events" || myRegistered.has(e.id)).length === 0 && <div className="empty-state"><div className="empty-icon"><CalendarDays size={24}/></div><h3>{activeTab === "my-events" ? "No registrations yet" : "No events found"}</h3><p>{activeTab === "my-events" ? "Find an event that sounds like you and register to see it here." : "Try another search or switch up your filters."}</p><button className="btn btn-primary" onClick={() => { setQuery(""); setCategory("All"); setStatus("all"); setActiveTab("discover"); }}>Show all events</button></div>}
        </section>
        <footer className="footer"><div className="footer-brand"><div className="brand-mark small"><Activity size={16}/></div><b>CampusPulse</b></div><span>Made for the moments between classes.</span><span>© {new Date().getFullYear()} CampusPulse</span></footer>
      </div>}

      {activeTab === "admin" && <div className="page-content admin-page">
        {!adminToken ? <section className="login-layout"><div className="login-intro"><div className="admin-emblem"><ShieldCheck size={30}/></div><div className="eyebrow"><span className="eyebrow-line"/> ADMINISTRATION</div><h1>Your campus.<br/><span>Your command center.</span></h1><p>Manage event listings, keep an eye on registrations, and bring the campus calendar to life.</p><div className="login-benefits"><span><CheckCircle2 size={17}/> Publish and update events</span><span><CheckCircle2 size={17}/> Monitor registrations</span><span><CheckCircle2 size={17}/> Export attendee lists</span></div></div>
          <form className="login-card" onSubmit={signIn}><div className="login-card-icon"><ShieldCheck size={22}/></div><h2>Admin sign in</h2><p>Sign in to manage your campus events.</p><Field label="ADMIN EMAIL"><input type="email" value={login.email} onChange={e => setLogin({ ...login, email: e.target.value })} required autoComplete="username"/></Field><Field label="PASSWORD"><input type="password" value={login.password} onChange={e => setLogin({ ...login, password: e.target.value })} required autoComplete="current-password" placeholder="Enter admin password"/></Field><button className="btn btn-primary login-submit" disabled={loginBusy}>{loginBusy ? "Signing in..." : "Sign in to dashboard"} <ArrowUpRight size={16}/></button><div className="login-security"><ShieldCheck size={15}/> Protected admin workspace</div><details className="demo-hint"><summary>Demo credentials</summary><p>Email: <code>admin@campuspulse.local</code><br/>Password: <code>CampusAdmin@123</code></p><small>Change the demo credentials before public deployment.</small></details></form></section> :
          <><div className="admin-welcome"><div><div className="eyebrow muted"><span className="eyebrow-line"/> ADMIN CONTROL CENTER</div><h1>Good work starts <span>with a plan.</span></h1><p>Signed in as {adminEmail}. Here's what's happening across your campus.</p></div><div className="admin-actions"><button className="btn btn-outline" onClick={logoutAdmin}><LogOut size={16}/> Sign out</button><button className="btn btn-primary" onClick={openCreate}><Plus size={17}/> Create event</button></div></div>
            <div className="admin-stats"><div className="admin-stat"><span className="admin-stat-icon violet"><CalendarDays size={19}/></span><div><small>Total events</small><strong>{events.length}</strong></div></div><div className="admin-stat"><span className="admin-stat-icon mint"><Users size={19}/></span><div><small>Total registrations</small><strong>{totalSeats}</strong></div></div><div className="admin-stat"><span className="admin-stat-icon blue"><Activity size={19}/></span><div><small>Upcoming events</small><strong>{upcomingCount}</strong></div></div></div>
            <section className="admin-table-card"><div className="table-heading"><div><h2>Event management</h2><p>Create, edit, publish and manage registrations.</p></div><button className="btn btn-light btn-sm" onClick={loadEvents}><Activity size={15}/> Refresh</button></div>
              <div className="table-scroll"><table><thead><tr><th>EVENT</th><th>DATE & TIME</th><th>REGISTRATIONS</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{events.map(event => <tr key={event.id}><td><div className="table-event"><div className={`table-event-icon art-${(event.id % 5) + 1}`}>{(() => { const I = categoryIcons[event.category] || Sparkles; return <I size={18}/>; })()}</div><div><b>{event.title}</b><small>{event.category} · {event.venue}</small></div></div></td><td><b>{prettyDate(event.event_date)}</b><small className="table-sub">{event.start_time}–{event.end_time}</small></td><td><div className="registration-meter"><div><b>{event.attendee_count}</b><span> / {event.capacity}</span></div><div className="meter-track"><span style={{ width: `${Math.min(100, event.attendee_count / event.capacity * 100)}%` }}/></div></div></td><td><span className={`status-pill ${event.event_date < new Date().toISOString().slice(0, 10) ? "past" : "published"}`}><i/>{event.event_date < new Date().toISOString().slice(0, 10) ? "Past" : "Published"}</span></td><td><div className="row-actions"><button title="Export registrations CSV" className="icon-btn" onClick={() => exportCsv(event)}><Download size={16}/></button><button title="Edit event" className="icon-btn" onClick={() => openEdit(event)}><Pencil size={16}/></button><button title="Delete event" className="icon-btn danger" onClick={() => deleteEvent(event)}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div>
              {events.length === 0 && <div className="empty-state"><h3>No events yet</h3><p>Create your first event to get started.</p></div>}
            </section>
            <section className="admin-table-card registrations-card"><div className="table-heading"><div><h2>Recent registrations</h2><p>Students signed up across all events.</p></div><span className="event-count">{registrations.length} <small>total</small></span></div>
              {registrations.length ? <div className="table-scroll"><table><thead><tr><th>STUDENT</th><th>EVENT</th><th>EVENT DATE</th><th>REGISTERED ON</th></tr></thead><tbody>{registrations.map(r => <tr key={r.id}><td><div className="student-cell"><span className="student-avatar">{initials(r.attendee_name)}</span><div><b>{r.attendee_name}</b><small>{r.attendee_email}</small></div></div></td><td>{r.event_title}</td><td>{prettyDate(r.event_date)}</td><td>{new Date(r.created_at + (r.created_at.endsWith("Z") ? "" : "Z")).toLocaleDateString("en-IN")}</td></tr>)}</tbody></table></div> : <div className="empty-registrations"><Users size={22}/><span>Registrations will appear here when students sign up.</span></div>}
            </section>
          </>}
        <footer className="footer"><div className="footer-brand"><div className="brand-mark small"><Activity size={16}/></div><b>CampusPulse</b></div><span>Admin workspace</span><span>© {new Date().getFullYear()} CampusPulse</span></footer>
      </div>}
    </main>

    <Toast toast={toast} onClose={() => setToast(null)}/>
    {mobileNav && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileNav(false)}/>}
    {modal?.type === "profile" && <Modal title="Your student profile" subtitle="Use these details when registering for events." onClose={() => setModal(null)}><form className="modal-form" onSubmit={saveProfile}><Field label="FULL NAME"><input value={profileDraft.name} onChange={e => setProfileDraft({ ...profileDraft, name: e.target.value })} placeholder="Your name" required autoFocus/></Field><Field label="EMAIL ADDRESS"><input type="email" value={profileDraft.email} onChange={e => setProfileDraft({ ...profileDraft, email: e.target.value })} placeholder="you@example.com" required/></Field><div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-primary">{modal.event ? "Save & register" : "Save profile"} <ArrowUpRight size={15}/></button></div><p className="form-note">Your profile is stored in this browser for this demo.</p></form></Modal>}
    {modal?.type === "event-form" && <Modal title={editingId ? "Edit event" : "Create an event"} subtitle="Fill in the details students will see on the event listing." onClose={() => setModal(null)} wide><form className="modal-form event-form" onSubmit={saveEvent}>
      <Field label="EVENT TITLE" full><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Annual Tech Fest" required maxLength={120}/></Field>
      <Field label="DESCRIPTION" full><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What should students know about this event?" rows={3}/></Field>
      <Field label="CATEGORY"><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{categories.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}</select></Field>
      <Field label="VENUE"><input value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} placeholder="Auditorium / Seminar hall" required/></Field>
      <Field label="EVENT DATE"><input type="date" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} required/></Field>
      <Field label="CAPACITY"><input type="number" min="1" max="100000" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} required/></Field>
      <Field label="START TIME"><input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} required/></Field>
      <Field label="END TIME"><input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} required/></Field>
      <Field label="ORGANIZER" full><input value={form.organizer} onChange={e => setForm({ ...form, organizer: e.target.value })} placeholder="Club / committee name"/></Field>
      <div className="modal-actions field-full"><button type="button" className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-primary"><Check size={16}/>{editingId ? "Save changes" : "Publish event"}</button></div>
    </form></Modal>}
    {modal?.type === "details" && <Modal title="Event details" subtitle={modal.event.category} onClose={() => setModal(null)}><div className="details-modal"><div className={`details-art art-${(modal.event.id % 5) + 1}`}><Sparkles size={34}/></div><h2>{modal.event.title}</h2><p>{modal.event.description || "Join your campus community for this event."}</p><div className="detail-line"><CalendarDays size={17}/><div><b>{prettyDate(modal.event.event_date)}</b><small>{modal.event.start_time}–{modal.event.end_time}</small></div></div><div className="detail-line"><MapPin size={17}/><div><b>{modal.event.venue}</b><small>Venue</small></div></div><div className="detail-line"><Users size={17}/><div><b>{modal.event.attendee_count} of {modal.event.capacity} registered</b><small>Organized by {modal.event.organizer}</small></div></div><div className="modal-actions"><button className="btn btn-outline" onClick={() => setModal(null)}>Close</button>{adminToken && activeTab === "admin" ? <><button className="btn btn-outline" onClick={() => openEdit(modal.event)}><Pencil size={15}/> Edit</button><button className="btn btn-primary" onClick={() => exportCsv(modal.event)}><Download size={15}/> Export CSV</button></> : myRegistered.has(modal.event.id) ? <button className="btn btn-outline" onClick={() => { setModal(null); cancelRegistration(modal.event); }}><Check size={15}/> Registered</button> : <button className="btn btn-primary" onClick={() => registerEvent(modal.event)}>Register <ArrowUpRight size={15}/></button>}</div></div></Modal>}
  </div>;
}
