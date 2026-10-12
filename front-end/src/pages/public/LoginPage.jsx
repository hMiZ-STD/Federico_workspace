'use strict';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/index.js';
import { useSession } from '../../auth/useSession.js';
import { useSearchParam } from '../../hooks/useSearchParam.js';
import { mockAccountsByOrg, PLATFORM_DEMO_ACCOUNT } from '../../lib/roleProfiles.js';
import { resolveLoginIdentity, PORTAL_LABEL } from '../../lib/emailIdentity.js';
import { getActorHome } from '../../auth/actorHome.js';
import { toast } from '../../components/feedback/feedback.js';
import { usePageStyles } from '../../hooks/usePageStyles.js';
import loginPageCss from '../../styles/login/login-page.css?inline';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

const REMEMBER_KEY = 'FedericoRememberMe';
// How long the email must sit still before the portal chip and the patient
// hospital picker react, so they don't flicker while a domain is half-typed.
const IDENTITY_SETTLE_MS = 350;
const DEMO_ROLE_ORDER = ['Admin', 'HOM', 'PRE', 'FA', 'Patient'];
const PLATFORM_DEMO_TAB = 'platform';

/** The Remember Me entry, or null when absent or corrupt (ignored as before). */
function readRemembered() {
  try {
    const saved = localStorage.getItem(REMEMBER_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

/**
 * The one sign-in page for every actor. There are no role tabs: the email
 * says who you are.
 *
 *   name.hom@citygen.com         → HOM portal of the hospital that owns citygen.com
 *   name.pre / .fa / .admin@...  → that portal, same domain rule
 *   name.platform@federico.com   → Platform Super User console
 *   anything else                → Patient portal; pick your hospital below
 *
 * resolveLoginIdentity() makes that call from the public organization list
 * (each org carries its email_domain); the server enforces it again through
 * the per-actor endpoint it is sent to.
 */
export default function LoginPage() {
  usePageStyles(loginPageCss);
  useDocumentTitle('Federico — Sign In');
  const navigate = useNavigate();
  const { authenticate, getLastAuthError, isPlatformUser } = useSession();
  const preselectOrg = useSearchParam('org');

  // Remembered credentials seed the initial state directly.
  const [remembered] = useState(readRemembered);
  const [organizations, setOrganizations] = useState(null); // null = loading
  const [orgLoadFailed, setOrgLoadFailed] = useState(false);
  const [orgId, setOrgId] = useState('');
  const [orgTouched, setOrgTouched] = useState(false);
  const [email, setEmail] = useState(remembered?.email || '');
  const [settledEmail, setSettledEmail] = useState(remembered?.email || '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(Boolean(remembered));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [demoTab, setDemoTab] = useState(null);

  // Already signed in as platform? Skip straight to the console.
  useEffect(() => {
    if (isPlatformUser) navigate(getActorHome('PLATFORM'), { replace: true });
  }, [isPlatformUser, navigate]);

  useEffect(() => {
    const t = setTimeout(() => setSettledEmail(email), IDENTITY_SETTLE_MS);
    return () => clearTimeout(t);
  }, [email]);

  // Public organization list, with ?org= then the remembered org as the
  // patient hospital preselection.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const orgs = (await api.marketplace.organizations()) || [];
        if (cancelled) return;
        setOrganizations(orgs);

        const rememberedOrgId = readRemembered()?.orgId;
        if (preselectOrg && orgs.some((o) => String(o.organization_id) === preselectOrg)) {
          setOrgId(preselectOrg);
          setOrgTouched(true);
        } else if (
          rememberedOrgId &&
          orgs.some((o) => String(o.organization_id) === String(rememberedOrgId))
        ) {
          setOrgId(String(rememberedOrgId));
          setOrgTouched(true);
        } else if (orgs.length) {
          setOrgId(String(orgs[0].organization_id));
        }
      } catch {
        if (cancelled) return;
        setOrgLoadFailed(true);
        setOrganizations([]);
        toast('Could not load the list of hospitals. Please refresh.', 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preselectOrg]);

  const identity = useMemo(
    () => resolveLoginIdentity(settledEmail, organizations),
    [settledEmail, organizations],
  );
  const isPatient = identity?.actor === 'Patient';

  // A patient whose address sits on a hospital's domain most likely belongs
  // there; preselect it unless the user (or ?org=) already chose.
  const hintedOrgId = isPatient && identity.org ? String(identity.org.organization_id) : null;
  const selectedOrgId = !orgTouched && hintedOrgId ? hintedOrgId : orgId;

  const handleLogin = useCallback(async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Enter both email and password.');
      return;
    }
    if (organizations === null) {
      setError('Still loading hospitals, try again in a moment.');
      return;
    }
    // Resolve from what was typed, not the debounced value.
    const target = resolveLoginIdentity(trimmedEmail, organizations);
    if (!target) {
      setError('Enter a valid email address.');
      return;
    }
    let organizationId = null;
    if (target.actor === 'Patient') {
      const patientOrgId =
        !orgTouched && target.org ? String(target.org.organization_id) : orgId;
      organizationId = patientOrgId ? Number(patientOrgId) : null;
    } else if (target.org) {
      organizationId = target.org.organization_id;
    }

    setSubmitting(true);
    try {
      const authResult = await authenticate(target.actor, trimmedEmail, password, organizationId);
      if (!authResult) {
        setError(getLastAuthError() || 'Invalid email or password.');
        setSubmitting(false);
        return;
      }
      setError('');

      try {
        if (remember) {
          localStorage.setItem(
            REMEMBER_KEY,
            JSON.stringify({
              email: trimmedEmail,
              orgId: target.actor === 'Patient' ? organizationId : null,
            }),
          );
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
      } catch {
        /* storage unavailable; login still succeeded */
      }

      navigate(getActorHome(authResult.actor));
    } catch (err) {
      setError(err?.status === 0 ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }, [email, password, organizations, orgId, orgTouched, remember, authenticate, getLastAuthError, navigate]);

  function fillDemo(account) {
    setEmail(account.email);
    setSettledEmail(account.email);
    setPassword(account.password);
    setError('');
    toast('Demo credentials copied to form', 'info');
  }

  // Demo panel: one tab per hospital with known demo users, plus Platform.
  const demoOrgTabs = (organizations || []).filter((o) => mockAccountsByOrg[o.organization_id]);
  const activeDemoTab =
    demoTab ||
    (identity?.actor === 'PLATFORM'
      ? PLATFORM_DEMO_TAB
      : String(
          identity?.org?.organization_id ||
            (demoOrgTabs.some((o) => String(o.organization_id) === selectedOrgId) ? selectedOrgId : '') ||
            demoOrgTabs[0]?.organization_id ||
            PLATFORM_DEMO_TAB,
        ));
  const demoRows =
    activeDemoTab === PLATFORM_DEMO_TAB
      ? [{ role: 'Platform', account: PLATFORM_DEMO_ACCOUNT }]
      : DEMO_ROLE_ORDER.flatMap((role) =>
          ((mockAccountsByOrg[activeDemoTab] || {})[role] || []).map((account) => ({ role, account })),
        );

  let portalChip;
  if (!identity) {
    portalChip = (
      <span className="portal-chip portal-chip-idle">
        Staff: name.role@your-hospital domain · Patients: your personal email
      </span>
    );
  } else if (identity.actor === 'PLATFORM') {
    portalChip = (
      <span className="portal-chip">
        Signing in to <strong>{PORTAL_LABEL.PLATFORM}</strong>
      </span>
    );
  } else if (isPatient) {
    portalChip = (
      <span className="portal-chip">
        Signing in to the <strong>{PORTAL_LABEL.Patient}</strong>. Choose your hospital below.
      </span>
    );
  } else {
    portalChip = (
      <span className="portal-chip">
        Signing in to <strong>{identity.org.name}</strong> · {PORTAL_LABEL[identity.actor]}
      </span>
    );
  }

  return (
    <>
      <header className="topbar">
        <Link to="/landing/landing-page.html" className="brand" title="Back to Home">
          <div className="brand-icon">F</div>
          <div className="brand-name">Federico Cloud</div>
        </Link>
      </header>

      <main className="login-wrapper">
        <div
          className="md-blur-shape md-blur-primary"
          style={{ width: 420, height: 420, top: -120, left: -160 }}
          aria-hidden="true"
        />
        <div
          className="md-blur-shape md-blur-tertiary"
          style={{ width: 340, height: 340, bottom: -100, right: -140 }}
          aria-hidden="true"
        />

        <section className="login-card">
          <div className="card-head">
            <h1 className="card-title">Sign In</h1>
            <p className="card-subtitle">One sign-in for patients, hospital staff and platform admins</p>
          </div>

          <form
            id="login-form"
            className="login-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            <div id="login-error" className="login-error" aria-live="polite">
              {error}
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                placeholder="Enter your email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setDemoTab(null);
                }}
                onBlur={() => setSettledEmail(email)}
              />
              <div className="portal-chip-row" aria-live="polite">
                {portalChip}
              </div>
            </div>

            {isPatient && (
              <div className="form-group">
                <label htmlFor="organization">Hospital</label>
                <select
                  id="organization"
                  value={selectedOrgId}
                  onChange={(e) => {
                    setOrgId(e.target.value);
                    setOrgTouched(true);
                  }}
                  disabled={organizations === null}
                >
                  {organizations === null ? (
                    <option value="">Loading hospitals&hellip;</option>
                  ) : orgLoadFailed ? (
                    <option value="">Could not load hospitals {'—'} refresh to retry</option>
                  ) : (
                    organizations.map((org) => (
                      <option key={org.organization_id} value={String(org.organization_id)}>
                        {org.name}
                      </option>
                    ))
                  )}
                </select>
                <span className="field-hint">
                  Choose the hospital you registered with.{' '}
                  <Link to="/marketplace/marketplace-page.html">Browse all</Link>.
                </span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="form-row">
              <label className="checkbox-wrap">
                <input
                  type="checkbox"
                  id="remember-me"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>Remember me</span>
              </label>

              <a href="#" className="forgot-link" onClick={(e) => e.preventDefault()}>
                Forgot Password?
              </a>
            </div>

            <button
              className="login-btn primary-btn login-submit"
              type="submit"
              disabled={submitting}
            >
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="demo-credential-card">
            <div className="demo-credential-title">Demo Access</div>
            <div className="demo-credential-copy">
              Click any account below to autofill demo credentials:
            </div>
            <div className="demo-tabs" role="tablist">
              {demoOrgTabs.map((org) => (
                <button
                  key={org.organization_id}
                  type="button"
                  role="tab"
                  aria-selected={activeDemoTab === String(org.organization_id)}
                  className={'demo-tab' + (activeDemoTab === String(org.organization_id) ? ' active' : '')}
                  onClick={() => setDemoTab(String(org.organization_id))}
                >
                  {org.name}
                </button>
              ))}
              <button
                type="button"
                role="tab"
                aria-selected={activeDemoTab === PLATFORM_DEMO_TAB}
                className={'demo-tab' + (activeDemoTab === PLATFORM_DEMO_TAB ? ' active' : '')}
                onClick={() => setDemoTab(PLATFORM_DEMO_TAB)}
              >
                Platform
              </button>
            </div>
            <div id="login-credential-helper" className="demo-credential-list md-fade-switch">
              {demoRows.map(({ role, account }) => (
                <div
                  key={account.email}
                  className="demo-credential-row"
                  style={{ cursor: 'pointer' }}
                  title="Click to fill credentials"
                  onClick={() => fillDemo(account)}
                >
                  <strong>
                    <span className="demo-role-badge">{role}</span> {account.displayName}
                  </strong>
                  <span>{account.email}</span>
                  <code>{account.password}</code>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
