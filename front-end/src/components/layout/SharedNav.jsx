'use strict';

import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useSession } from '../../auth/useSession.js';
import ModuleLock from './ModuleLock.jsx';
import { LOGIN_PATH } from '../../auth/actorHome.js';
import { usePageStyles } from '../../hooks/usePageStyles.js';
import sharedNavCss from './SharedNav.css?inline';

/**
 * Ported from shared/shared-nav.js#renderNavbar, which built the whole bar -
 * including its own <style> tag - as an innerHTML string.
 *
 * Active-link detection used to compare location.pathname.split('/').pop()
 * against each link's href; NavLink does it properly now. Links carrying a
 * `module` are wrapped in ModuleLock, which replaces the
 * [data-requires-module] DOM sweep rbac.js ran after the nav was injected.
 */
export default function SharedNav({ roleName = 'Staff', brandName = 'Federico', hospitalName, links = [] }) {
  // shared-nav.js injected this <style> only on the pages that rendered the
  // navbar, and .nav-link / .nav-links collide with the PRE and Patient
  // stylesheets, so it has to come and go with the navbar.
  usePageStyles(sharedNavCss);
  const navigate = useNavigate();
  const { logout } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  // Any click outside closes the menu - the legacy code bound this on document.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDocClick = () => setMenuOpen(false);
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [menuOpen]);

  const safeBrand = brandName || 'Federico';
  const safeRole = roleName || 'HOM';
  const brandInitial = safeBrand.charAt(0) || 'F';
  const roleInitial = safeRole.slice(0, 2).toUpperCase() || 'HO';

  async function handleSignOut() {
    try {
      await logout();
    } catch {
      /* best effort, as before */
    }
    navigate(LOGIN_PATH);
  }

  return (
    <nav id="main-nav">
      <div className="top-nav">
        <div className="nav-logo-group">
          <div className="nav-logo-icon">{brandInitial}</div>
          <div className="nav-logo-text">
            <div className="nav-brand-row">
              <span className="brand-title">{safeBrand}</span>
              <span className="nav-role-badge">{safeRole}</span>
            </div>
            <span className="hospital-subtitle">{hospitalName || 'City General Hospital'}</span>
          </div>
        </div>

        <div className="nav-links">
          {links.map((item) => {
            const link = (
              <NavLink
                key={item.href}
                className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
                to={item.href}
              >
                {item.label}
              </NavLink>
            );
            return item.module ? (
              <ModuleLock key={item.href} module={item.module}>
                {link}
              </ModuleLock>
            ) : (
              link
            );
          })}
        </div>

        <div className="nav-actions">
          <div
            className="nav-profile"
            id="nav-profile-btn"
            role="button"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
          >
            <div className="nav-avatar">{roleInitial}</div>
            <span className="nav-profile-text">{safeRole}</span>
          </div>
          <div className={'nav-overlay' + (menuOpen ? ' active' : '')} id="nav-profile-menu" role="menu">
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--color-border)',
                fontSize: 11,
                color: 'var(--color-muted-fg)',
              }}
            >
              Signed in as <strong>{safeRole}</strong>
            </div>
            <button className="profile-item danger" id="nav-signout-btn" role="menuitem" onClick={handleSignOut}>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

