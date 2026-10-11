'use strict';

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/index.js';
import { useSession } from '../../auth/useSession.js';
import { useSearchParam } from '../../hooks/useSearchParam.js';
import { mockAccountsFor } from '../../lib/roleProfiles.js';
import { getActorHome } from '../../auth/actorHome.js';
import { toast } from '../../components/feedback/feedback.js';
import { usePageStyles } from '../../hooks/usePageStyles.js';
import loginPageCss from '../../styles/login/login-page.css?inline';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

const ROLES = ['Patient', 'PRE', 'HOM', 'FA', 'Admin'];
const REMEMBER_KEY = 'FedericoRememberMe';

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
 * Ported from login/login-page.html + login-page.js.
 *
 * Preserved exactly: the five role tabs and their order, ?org= preselection,
 * the Remember Me round-trip through localStorage under the same key and shape,
 * the click-to-autofill demo panel, and all three error strings.
 */
export default function LoginPage() {
  usePageStyles(loginPageCss);
  useDocumentTitle('Federico — Sign In');
  const navigate = useNavigate();
  const { authenticate, getLastAuthError } = useSession();
  const preselectOrg = useSearchParam('org');

  // Remembered credentials seed the initial state directly.
  const [remembered] = useState(readRemembered);
  const [role, setRole] = useState(
    () =>
      ROLES.find((r) => r.toLowerCase() === String(remembered?.role || '').toLowerCase()) || 'Patient',
  );
  const [organizations, setOrganizations] = useState(null); // null = loading
  const [orgLoadFailed, setOrgLoadFailed] = useState(false);
  const [orgId, setOrgId] = useState('');
  const [email, setEmail] = useState(remembered?.email || '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(Boolean(remembered));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Public organization list, with ?org= then the remembered org as preselection.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const orgs = await api.marketplace.organizations();
        if (cancelled) return;
        setOrganizations(orgs || []);

        let rememberedOrgId = null;
        try {
          const saved = localStorage.getItem(REMEMBER_KEY);
          if (saved) rememberedOrgId = JSON.parse(saved).orgId;
        } catch {
          /* ignore */
        }

        if (preselectOrg && (orgs || []).some((o) => String(o.organization_id) === preselectOrg)) {
          setOrgId(preselectOrg);
        } else if (
          rememberedOrgId &&
          (orgs || []).some((o) => String(o.organization_id) === String(rememberedOrgId))
        ) {
          setOrgId(String(rememberedOrgId));
        } else if ((orgs || []).length) {
          // A native <select> shows its first option when nothing is chosen;
          // mirror that so the demo panel keys off the same org the user sees.
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

  const demoAccounts = (mockAccountsFor(orgId ? Number(orgId) : 1) || {})[role] || [];

  const handleLogin = useCallback(async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Enter both email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const authResult = await authenticate(
        role,
        trimmedEmail,
        password,
        orgId ? Number(orgId) : null,
      );
      if (!authResult) {
        setError(getLastAuthError() || 'Invalid ' + role + ' credentials.');
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
              orgId: orgId ? Number(orgId) : null,
              role,
            }),
          );
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
      } catch {
        /* storage unavailable; login still succeeded */
      }

      navigate(getActorHome(role));
    } catch (err) {
      setError(err?.status === 0 ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }, [email, password, role, orgId, remember, authenticate, getLastAuthError, navigate]);

  function fillDemo(account) {
    setEmail(account.email);
    setPassword(account.password);
    setError('');
    toast('Demo credentials copied to form', 'info');
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
            <p className="card-subtitle">Select your role to access your portal</p>
          </div>

          <div className="role-tabs">
            {ROLES.map((r) => (
              <button
                key={r}
                className={'role-tab' + (r === role ? ' active' : '')}
                type="button"
                onClick={() => {
                  setRole(r);
                  setError('');
                }}
              >
                {r}
              </button>
            ))}
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
              <label htmlFor="organization">Hospital</label>
              <select
                id="organization"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
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
                Patients: choose your registered hospital.{' '}
                <Link to="/marketplace/marketplace-page.html">Browse all</Link>.
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                placeholder="Enter your email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
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
            <div id="login-credential-helper" className="demo-credential-list md-fade-switch">
              {demoAccounts.length === 0 ? (
                <div
                  style={{
                    padding: '10px 12px',
                    fontSize: 12,
                    color: 'var(--md-on-surface-variant)',
                    textAlign: 'center',
                    background: 'var(--md-surface)',
                    borderRadius: 'var(--radius-sm)',
                    borderLeft: '3px solid var(--md-outline-variant)',
                  }}
                >
                  No pre-configured demo users for this hospital. Please sign in with your
                  registered account.
                </div>
              ) : (
                demoAccounts.map((account) => (
                  <div
                    key={account.email}
                    className="demo-credential-row"
                    style={{ cursor: 'pointer' }}
                    title="Click to fill credentials"
                    onClick={() => fillDemo(account)}
                  >
                    <strong>{account.displayName}</strong>
                    <span>{account.email}</span>
                    <code>{account.password}</code>
                  </div>
                ))
              )}
            </div>
          </div>

          <p className="field-hint" style={{ textAlign: 'center', marginTop: 14 }}>
            Federico platform staff?{' '}
            <Link to="/platform/platform-login.html">Open the Platform Super User console</Link>
          </p>
        </section>
      </main>
    </>
  );
}
