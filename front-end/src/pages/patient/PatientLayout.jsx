'use strict';

import { Fragment } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PatientStoreProvider } from './PatientStoreContext.jsx';
import { usePatientStore } from './usePatientStore.js';
import ModuleLock from '../../components/layout/ModuleLock.jsx';
import { useSession } from '../../auth/useSession.js';
import { toast } from '../../components/feedback/feedback.js';

const DASHBOARD = '/Patient/patient-dashboard.html';
const BOOK = '/Patient/patient-book-appointment.html';
const BILLING = '/Patient/patient-billing.html';
const PROFILE = '/Patient/patient-profile.html';

/**
 * The four Patient pages each hand-wrote their own top bar, and they are not
 * identical: the brand subtitle, the element ids the old scripts targeted, the
 * chip's aria-label, whose name the chip shows, and whether there is a LOG OUT
 * button all differ per page. Constraint 4 ("same visible text") makes those
 * differences load-bearing, so the bar is parameterised rather than unified -
 * unifying it is Phase 2 work.
 */
const TOPBARS = {
  [DASHBOARD]: {
    brandSub: 'Hospital Admin',
    avatarId: 'topbar-avatar',
    nameId: 'topbar-name',
    chipAria: 'Go to profile',
    profileLinkId: 'nav-profile-link',
    gated: true,
    chipIsButton: true,
    showLogout: false,
    displayName: (p) => p.firstName,
  },
  [BOOK]: {
    brandSub: 'Hospital Portal',
    avatarId: 'topbar-initials',
    nameId: 'topbar-name',
    chipAria: 'Go to My Profile',
    profileLinkId: 'nav-profile',
    gated: true,
    chipIsButton: true,
    showLogout: false,
    // populatePatientSidebar(): firstName, falling back to the full name.
    displayName: (p) => p.firstName || p.name || 'Patient',
  },
  [BILLING]: {
    brandSub: 'Hospital Portal',
    avatarId: 'bill-avatar',
    nameId: 'bill-topbar-name',
    chipAria: 'Go to My Profile',
    profileLinkId: 'nav-profile',
    gated: true,
    chipIsButton: true,
    showLogout: false,
    // renderPatientHeader() writes the *full* name here, unlike the others.
    displayName: (p) => String(p.name || 'Patient').trim(),
  },
  [PROFILE]: {
    brandSub: 'Hospital Admin',
    avatarId: null,
    nameId: null,
    chipAria: null,
    profileLinkId: null,
    gated: false,
    chipIsButton: false,
    showLogout: true,
    displayName: (p) => p.firstName || (p.name || '').split(' ')[0] || 'Patient',
  },
};

function TopBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { profile } = usePatientStore();
  const { logout, tenant } = useSession();

  const cfg = TOPBARS[pathname] || TOPBARS[DASHBOARD];

  const links = [
    { href: DASHBOARD, label: 'Dashboard', id: 'nav-dashboard' },
    { href: BOOK, label: 'Book Appointment', id: 'nav-book', module: 'APPOINTMENTS' },
    { href: BILLING, label: 'My Bill', id: 'nav-bill', module: 'BILLING' },
    { href: PROFILE, label: 'My Profile', id: cfg.profileLinkId },
  ];

  const chipInner = (
    <>
      <div className="user-avatar" id={cfg.avatarId || undefined}>
        {profile ? profile.initials || 'P' : '--'}
      </div>
      <div className="user-meta">
        <strong id={cfg.nameId || undefined}>{profile ? cfg.displayName(profile) : 'Loading...'}</strong>
        <span>Patient</span>
      </div>
    </>
  );

  // patient-profile.js#setupLogout: toast, then 900 ms later clear the session
  // and land on the public landing page.
  function onLogout() {
    toast('Logging out...', 'success');
    setTimeout(() => {
      logout();
      navigate('/landing/landing-page.html');
    }, 900);
  }

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-icon">F</div>
        <div className="brand-text">
          <strong>Federico</strong>
          {/* rbac.js#applyTenantBranding overwrote `.brand-text span` with the
              organization name on every Patient page, so the per-page defaults
              below are only ever seen when the tenant has no name. */}
          <span>{tenant?.organization_name || cfg.brandSub}</span>
        </div>
      </div>

      <nav className="main-nav">
        {links.map((item) => {
          const btn = (
            <button
              className={'nav-link' + (pathname === item.href ? ' active' : '')}
              type="button"
              id={item.id || undefined}
              onClick={() => navigate(item.href)}
            >
              {item.label}
            </button>
          );
          return item.module && cfg.gated ? (
            <ModuleLock key={item.label} module={item.module}>
              {btn}
            </ModuleLock>
          ) : (
            <Fragment key={item.label}>{btn}</Fragment>
          );
        })}
      </nav>

      <div className="topbar-right">
        {cfg.showLogout ? (
          <button className="logout-btn" type="button" id="logout-btn" onClick={onLogout}>
            LOG OUT
          </button>
        ) : null}
        {cfg.chipIsButton ? (
          <button
            className="user-chip"
            type="button"
            id="profile-chip"
            aria-label={cfg.chipAria}
            onClick={() => navigate(PROFILE)}
          >
            {chipInner}
          </button>
        ) : (
          <div className="user-chip">{chipInner}</div>
        )}
      </div>
    </header>
  );
}

export default function PatientLayout() {
  return (
    <PatientStoreProvider>
      <TopBar />
      <Outlet />
    </PatientStoreProvider>
  );
}
