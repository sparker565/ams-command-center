import React, { useState } from "react";
import { APP_VERSION, ROLES } from "./constants";

export function BrandLogo({ role, accent = false, className = "" }) {
  const isOwner = role === ROLES.OWNER;
  const src = isOwner
    ? accent
      ? "/scs_technology_logo.jpeg"
      : "/scs_corporate_logo.jpeg"
    : "/ams_logo.png";
  const alt = isOwner ? "SparkCommand Systems logo" : "AMS logo";

  return (
    <div className={`brand-logo-wrap ${className}`.trim()}>
      <img className={`brand-logo ${accent ? "brand-logo-accent" : ""}`.trim()} src={src} alt={alt} />
    </div>
  );
}

export function SplashScreen() {
  return (
    <div className="splash-screen">
      <div className="splash-card">
        <img className="splash-logo" src="/ams_logo.png" alt="AMS logo" />
        <div className="splash-copy">
          <strong>Command Center</strong>
          <span>Version {APP_VERSION}</span>
        </div>
      </div>
    </div>
  );
}

export function Header({
  currentUser,
  activeScreen,
  onOpenDrawer,
  onGoBack,
  onOpenNotifications,
  onToggleProfileMenu,
  profileMenuOpen,
  onNavigate,
  onLogout,
}) {
  return (
    <header className="topbar">
      <div className="topbar-side topbar-side-left">
        {activeScreen !== "dashboard" ? (
          <button className="text-button back-button" onClick={onGoBack} aria-label="Back to dashboard">
            Back
          </button>
        ) : (
          <button className="icon-button" onClick={onOpenDrawer} aria-label="Open menu">
            <span />
            <span />
            <span />
          </button>
        )}
      </div>

      <div className="topbar-brand-slot">
        <div className="topbar-brand" aria-label="Current portal brand">
          {currentUser?.role === ROLES.OWNER ? (
            <>
              <BrandLogo role={currentUser?.role} />
              <BrandLogo role={currentUser?.role} accent className="topbar-accent" />
            </>
          ) : (
            <a
              className="topbar-logo-link"
              href="https://www.advancedmtnc.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Open Advanced Maintenance Services website"
            >
              <BrandLogo role={currentUser?.role} />
            </a>
          )}
        </div>
      </div>

      <div className="topbar-side topbar-side-right">
        <button className="icon-button bell-button" onClick={onOpenNotifications} aria-label="Notifications">
          <span className="bell-icon" aria-hidden="true">
            🔔
          </span>
        </button>

        <div className="profile-anchor">
          <button
            className="profile-button profile-circle-button"
            onClick={onToggleProfileMenu}
            aria-label="Open profile menu"
          >
            <span className="profile-circle-text">
              {currentUser?.name?.trim()?.charAt(0)?.toUpperCase() || "P"}
            </span>
          </button>

          {profileMenuOpen && (
            <div className="profile-menu">
              <div className="profile-menu-summary">
                <strong>{currentUser.name}</strong>
                <span>{currentUser.displayRole || (currentUser.role === ROLES.VENDOR ? "Crew" : currentUser.role)}</span>
              </div>
              <button className="menu-link" onClick={() => onNavigate("profile")}>
                Profile
              </button>
              <button className="menu-link" onClick={() => onNavigate("settings")}>
                Settings
              </button>
              <button className="menu-link danger-link" onClick={onLogout}>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function Drawer({
  open,
  menuItems,
  activeScreen,
  labels,
  currentUser,
  onNavigate,
  onLogout,
  onClose,
}) {
  return (
    <>
      <aside className={`drawer ${open ? "open" : ""}`}>
        <div className="drawer-top">
          <BrandLogo role={currentUser?.role} />
          <button className="text-button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="drawer-user-card">
          <div className="drawer-user-name">{currentUser.name}</div>
          <div className="drawer-user-meta">{currentUser.email}</div>
          <div className="drawer-user-meta">{currentUser.displayRole || (currentUser.role === ROLES.VENDOR ? "Crew" : currentUser.role)}</div>
        </div>

        <nav className="drawer-nav">
          {menuItems.map((item) => (
            <button
              key={item}
              className={`nav-item ${activeScreen === item ? "active" : ""}`}
              onClick={() => onNavigate(item)}
            >
              {labels[item] || item}
            </button>
          ))}
        </nav>

        <div className="drawer-footer">
          <button className="primary-button danger-button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </aside>

      {open ? <button className="drawer-scrim" onClick={onClose} aria-label="Close menu" /> : null}
    </>
  );
}

export function LoginScreen({ email, password, onChange, onLogin, onDemoLogin, loading = false, errorMessage = "" }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="login-shell">
      <div className="login-panel">
        <BrandLogo />
        <div className="login-caption">Command Center Version {APP_VERSION}</div>

        <label className="field">
          <span>Email</span>
          <input
            value={email}
            onChange={(event) => onChange("email", event.target.value)}
            placeholder="Enter email"
            type="email"
          />
        </label>

        <label className="field">
          <span>Password</span>
          <div className="password-field-wrap">
            <input
              value={password}
              onChange={(event) => onChange("password", event.target.value)}
              placeholder="Enter password"
              type={showPassword ? "text" : "password"}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        {errorMessage ? <div className="login-error" role="alert">{errorMessage}</div> : null}

        <div className="login-actions">
          <button className="primary-button" onClick={onLogin} disabled={loading}>
            {loading ? "Signing in..." : "Login"}
          </button>
          <button className="secondary-button" onClick={() => onDemoLogin("ams")} disabled={loading}>
            AMS Demo
          </button>
          <button className="secondary-button" onClick={() => onDemoLogin("crew")} disabled={loading}>
            Crew Demo
          </button>
        </div>
      </div>
    </div>
  );
}

export function PageSection({ title, action, contentClassName = "", children }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
        {action ? <div>{action}</div> : null}
      </div>
      <div className={contentClassName}>{children}</div>
    </section>
  );
}

export function StatGrid({ items }) {
  return (
    <div className="stat-grid">
      {items.map((item) => {
        const className = `stat-card ${item.featured ? "featured" : ""} ${
          item.onClick ? "interactive" : ""
        }`;

        if (item.onClick) {
          return (
            <button key={item.label} className={className} onClick={item.onClick}>
              <div className="stat-value">{item.value}</div>
              <div className="stat-label">{item.label}</div>
            </button>
          );
        }

        return (
          <div key={item.label} className={className}>
            <div className="stat-value">{item.value}</div>
            <div className="stat-label">{item.label}</div>
          </div>
        );
      })}
    </div>
  );
}

export function UnderConstruction({ title, message }) {
  return (
    <div className="placeholder-screen">
      <div className="placeholder-badge">Under Construction</div>
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}

export function EmptyState({ title, text }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

export function DataTable({
  columns,
  rows,
  emptyTitle,
  emptyText,
  onRowClick,
  selectedRowId,
  stickyHeader = false,
}) {
  if (!rows.length) {
    return <EmptyState title={emptyTitle} text={emptyText} />;
  }

  return (
    <div className={`table-wrap ${stickyHeader ? "sticky-table" : ""}`}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={`${selectedRowId === row.id ? "selected-row" : ""} ${
                onRowClick ? "clickable-row" : ""
              }`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((column) => (
                <td key={`${row.id}-${column.key}`}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InputRow({ children }) {
  return <div className="input-row">{children}</div>;
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function TopActionBar({ actions }) {
  return (
    <div className="top-action-bar">
      {actions.map((action) => (
        <button
          key={action.key}
          className={action.featured ? "primary-button" : "secondary-button"}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

export function FilterRow({ label, value, options, onChange }) {
  return (
    <div className="filter-row">
      <label className="filter-label">
        <span>{label}</span>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function SearchBar({ value, onChange, placeholder = "Search" }) {
  return (
    <label className="search-bar">
      <span>Search</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

export function Modal({ open, title, children, onClose, footer, className = "" }) {
  if (!open) return null;

  return (
    <>
      <div className="modal-scrim" onClick={onClose} />
      <div className={`modal-shell ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-panel">
          <div className="modal-header">
            <h2>{title}</h2>
            <button className="text-button" onClick={onClose}>
              Close
            </button>
          </div>
          <div className="modal-body">{children}</div>
          {footer ? <div className="modal-footer">{footer}</div> : null}
        </div>
      </div>
    </>
  );
}

export function SplitView({ list, detail }) {
  return (
    <div className="split-view">
      <div className="split-view-list">{list}</div>
      <div className="split-view-detail">{detail}</div>
    </div>
  );
}

export function CommandMap({ sites, selectedSiteId, onSelectSite }) {
  return (
    <div className="command-map">
      <div className="command-map-header">
        <div>
          <div className="eyebrow">Operations Map</div>
          <h3>Live Site Coverage</h3>
        </div>
        <div className="map-status">Placeholder Command View</div>
      </div>

      <div className="map-field">
        {sites.map((site, index) => (
          <button
            key={site.id}
            className={`map-marker marker-${(index % 5) + 1} ${
              selectedSiteId === site.id ? "selected" : ""
            }`}
            title={site.name}
            onClick={() => onSelectSite(site.id)}
          >
            <span>{site.name}</span>
          </button>
        ))}
      </div>

      <div className="map-site-panel">
        <div className="map-site-panel-header">
          <span className="detail-label">Site List</span>
          <strong>{sites.length} Sites</strong>
        </div>
        <div className="map-site-list">
          {sites.map((site) => (
            <button
              key={site.id}
              type="button"
              className={`map-site-row ${selectedSiteId === site.id ? "selected" : ""}`}
              onClick={() => onSelectSite(site.id)}
            >
              <strong>{site.name}</strong>
              <span>{site.address}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SiteDetailsCard({ site, relatedWorkOrderCount, needsActionCount = 0 }) {
  if (!site) {
    return (
      <EmptyState
        title="No site selected"
        text="Select a site marker to view location details."
      />
    );
  }

  return (
    <div className="site-details-card">
      <div className="site-details-top">
        <div>
          <strong>{site.name}</strong>
          <p>{site.address}</p>
        </div>
        <span className="status-pill active">{site.state}</span>
      </div>
      <div className="site-details-grid">
        <div>
          <span className="detail-label">State</span>
          <strong>{site.state}</strong>
        </div>
        <div>
          <span className="detail-label">Related Work Orders</span>
          <strong>{relatedWorkOrderCount}</strong>
        </div>
        <div>
          <span className="detail-label">Needs Action</span>
          <strong>{needsActionCount}</strong>
        </div>
      </div>
      <div className="site-notes">
        <span className="detail-label">Internal Notes</span>
        <p>{site.internalNotes || "No internal notes available."}</p>
      </div>
    </div>
  );
}

export function AvailableWorkCard({ workOrder, site, children }) {
  return (
    <article className="available-work-card">
      <div className="available-work-top">
        <strong>{workOrder.siteName}</strong>
        <span className={`status-pill ${workOrder.status.toLowerCase().replace(/\s+/g, "-")}`}>
          {workOrder.status}
        </span>
      </div>
      <div className="available-work-details">
        <div>
          <span className="detail-label">State</span>
          <p>{site?.state || "Unknown"}</p>
        </div>
        <div>
          <span className="detail-label">Service Type</span>
          <p>{workOrder.serviceType || "Not specified"}</p>
        </div>
      </div>
      <div className="available-work-copy">{workOrder.description}</div>
      <div className="available-work-meta">
        <span>Created {new Date(workOrder.createdAt).toLocaleDateString()}</span>
      </div>
      {children ? <div className="available-work-extra">{children}</div> : null}
    </article>
  );
}

export function JobCard({ job, onStart, onComplete }) {
  const scopePreview = job.scope || job.description || "Scope details not provided.";
  const startStatus = job.startTime ? "Started" : "Not Started";
  const completionStatus = job.completedTime ? "Completed" : "Open";

  return (
    <article className="job-card">
      <div className="job-card-top">
        <strong>{job.siteName}</strong>
        <span className={`status-pill ${job.status.toLowerCase().replace(/\s+/g, "-")}`}>
          {job.status}
        </span>
      </div>
      <div className="job-card-service">{job.servicePerformed || job.serviceType}</div>
      <div className="job-card-scope">
        <span className="detail-label">Scope</span>
        <p>{scopePreview}</p>
      </div>
      <div className="job-card-status-grid">
        <div>
          <span className="detail-label">Start Status</span>
          <p>{startStatus}</p>
        </div>
        <div>
          <span className="detail-label">Completion Status</span>
          <p>{completionStatus}</p>
        </div>
      </div>
      <div className="job-card-times">
        <span>Start: {job.startTime ? new Date(job.startTime).toLocaleString() : "Not started"}</span>
        <span>Complete: {job.completedTime ? new Date(job.completedTime).toLocaleString() : "Not completed"}</span>
      </div>
      <div className="job-card-actions">
        {job.status === "Assigned" ? (
          <button className="primary-button" onClick={() => onStart(job.id)}>
            Start Job
          </button>
        ) : null}
        {job.status === "In Progress" ? (
          <button className="secondary-button" onClick={() => onComplete(job.id)}>
            Complete Job
          </button>
        ) : null}
        {!["Assigned", "In Progress"].includes(job.status) ? (
          <span className="detail-muted">Next step available in invoices.</span>
        ) : null}
      </div>
    </article>
  );
}
