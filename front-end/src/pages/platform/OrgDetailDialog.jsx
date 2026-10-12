'use strict';

import { useState } from 'react';
import DialogShell from '../../components/layout/DialogShell.jsx';
import { statusChipClass, inr } from './platformHelpers.js';
import { api } from '../../api/index.js';
import { toast, confirm } from '../../components/feedback/feedback.js';
import { emailDomainProblem, normalizeDomain } from '../../lib/emailIdentity.js';

/**
 * Ported from platform-dashboard.js#openOrgDetail, which used a native
 * <dialog>.showModal().
 *
 * The legacy dialog also had Modules / API Keys / Provisioning Log tabs whose
 * panels were never filled in; they are gone, and the enabled modules are
 * listed in the summary instead.
 */
export default function OrgDetailDialog({ org, organizations, onClose, onChanged }) {
  if (!org) return null;
  const modules = org.enabled_modules || [];

  return (
    <DialogShell
      open
      onClose={onClose}
      size="lg"
      title={org.name}
      subtitle={'Tenant: tenant_' + org.organization_id}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="md-btn md-btn-text" id="detail-close" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div className="detail-panel" id="detail-summary">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: '0.9rem' }}>
          <div><strong>Tenant ID:</strong> <code>tenant_{org.organization_id}</code></div>
          <div>
            <strong>Status:</strong>{' '}
            <span className={'md-chip ' + statusChipClass(org.status)}>{org.status}</span>
          </div>
          <div><strong>Hospital Branches:</strong> {org.hospitals}</div>
          <div><strong>Total Registered Patients:</strong> {org.patients}</div>
          <div><strong>Staff Accounts:</strong> {org.users}</div>
          <div><strong>Bed Occupancy:</strong> {org.beds_occupied} / {org.beds} beds</div>
          <div><strong>Monthly Subscription Fee:</strong> {inr(org.subscription ? org.subscription.price_monthly : 0)}/mo</div>
          <div><strong>Payments Collected:</strong> {inr(org.revenue ? org.revenue.payments_collected : 0)}</div>
        </div>
        <EmailDomainSection
          key={org.organization_id}
          org={org}
          organizations={organizations}
          onChanged={onChanged}
        />
        <div style={{ marginTop: 16, fontSize: '0.9rem' }}>
          <strong>Enabled Modules:</strong>
          <div className="module-pill-list" style={{ marginTop: 8, maxWidth: 'none' }}>
            {modules.length ? (
              modules.map((m) => (
                <span className="module-pill active" key={m}>{m}</span>
              ))
            ) : (
              <span className="module-pill">None</span>
            )}
          </div>
        </div>
      </div>
    </DialogShell>
  );
}

/**
 * The hospital's staff email domain (name.role@<domain> logins on the unified
 * login page). Only Platform Super Users can change it: the server renames
 * every staff/admin login on the old domain and signs those users out, so the
 * confirm step says how many people that affects. Patients are untouched.
 */
function EmailDomainSection({ org, organizations, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(org.email_domain || '');
  const [saving, setSaving] = useState(false);

  const normalized = normalizeDomain(draft);
  const unchanged = normalized === (org.email_domain || '');
  const problem = unchanged ? null : emailDomainProblem(normalized, organizations, org.organization_id);

  async function save() {
    if (unchanged || problem) return;
    setSaving(true);
    try {
      const impact = await api.platform.organizations.emailDomainImpact(org.organization_id);
      const count = impact ? impact.staff_logins : 0;
      const ok = await confirm({
        title: 'Change email domain to @' + normalized + '?',
        body:
          count +
          ' staff/admin login' +
          (count === 1 ? '' : 's') +
          ' will be renamed from @' +
          (org.email_domain || '?') +
          ' to @' +
          normalized +
          ' and signed out. Let them know their new sign-in address. Patients are not affected.',
        confirmLabel: 'Change domain',
      });
      if (!ok) {
        setSaving(false);
        return;
      }
      const result = await api.platform.organizations.changeEmailDomain(org.organization_id, normalized);
      toast(
        'Email domain is now @' +
          normalized +
          ' (' +
          ((result && result.renamedUsers && result.renamedUsers.length) || 0) +
          ' logins renamed).',
        'success',
      );
      setEditing(false);
      if (onChanged) await onChanged();
    } catch (err) {
      toast(err.message || 'Could not change the email domain.', 'error');
    }
    setSaving(false);
  }

  return (
    <div style={{ marginTop: 16, fontSize: '0.9rem' }}>
      <strong>Staff Email Domain:</strong>{' '}
      {editing ? (
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span>@</span>
          <input
            aria-label="Email domain"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            style={{ padding: '4px 8px', fontSize: '0.9rem' }}
          />
          <button
            type="button"
            className="md-btn md-btn-filled md-btn-sm"
            disabled={saving || unchanged || Boolean(problem)}
            onClick={save}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            className="md-btn md-btn-text md-btn-sm"
            disabled={saving}
            onClick={() => {
              setEditing(false);
              setDraft(org.email_domain || '');
            }}
          >
            Cancel
          </button>
          {problem && <span style={{ color: 'var(--status-error, #b3261e)', fontSize: 12 }}>{problem}</span>}
        </span>
      ) : (
        <>
          <code>@{org.email_domain || '—'}</code>{' '}
          <button type="button" className="md-btn md-btn-text md-btn-sm" onClick={() => setEditing(true)}>
            Edit
          </button>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
            Staff sign in as name.hom@, name.pre@, name.fa@ or name.admin@ this domain.
          </div>
        </>
      )}
    </div>
  );
}
