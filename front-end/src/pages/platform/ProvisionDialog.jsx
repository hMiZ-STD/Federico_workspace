'use strict';

import { useState } from 'react';
import Modal from '../../components/layout/Modal.jsx';
import { MODULE_CATALOG } from './platformHelpers.js';
import { api } from '../../api/index.js';
import { toast } from '../../components/feedback/feedback.js';
import TaggedEmailInput from '../../components/forms/TaggedEmailInput.jsx';
import {
  suggestEmailDomain,
  emailDomainProblem,
  normalizeDomain,
  buildTaggedEmail,
} from '../../lib/emailIdentity.js';

const BLANK = { name: '', emailDomain: '', domainEdited: false, adminName: '', adminPassword: '' };

/**
 * Ported from the #provision-dialog form in platform-dashboard.html, reduced
 * to what a provisioning actually needs: the hospital's name, its staff email
 * domain, and its first admin's login. The admin's display name defaults to
 * "<Hospital> Admin" (they can change it after signing in), and the city was
 * optional server-side and never used by the dashboard.
 *
 * The email domain follows the name (City General Hospital → citygen.com)
 * until it is edited by hand; the admin login is fixed to name.admin@<domain>
 * so the unified login page can route it.
 */
export default function ProvisionDialog({ open, organizations, onClose, onProvisioned }) {
  const [f, setF] = useState(BLANK);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const emailDomain = f.domainEdited
    ? normalizeDomain(f.emailDomain)
    : f.name.trim()
      ? suggestEmailDomain(f.name, organizations)
      : '';
  const domainProblem = emailDomain ? emailDomainProblem(emailDomain, organizations) : null;

  async function handleSubmit(e) {
    e.preventDefault();
    const name = f.name.trim();
    const adminEmail = buildTaggedEmail(f.adminName, 'admin', emailDomain);
    if (domainProblem || !adminEmail) return;
    try {
      await api.platform.organizations.provision({
        name,
        email_domain: emailDomain,
        admin_name: name + ' Admin',
        admin_email: adminEmail,
        admin_password: f.adminPassword,
        plan_id: 1,
        modules: MODULE_CATALOG.map((m) => m.code),
      });
      onClose();
      setF(BLANK);
      toast('Organization provisioned. Admin login: ' + adminEmail, 'success');
      onProvisioned();
    } catch (err) {
      toast(err.message || 'Failed to provision organization.', 'error');
    }
  }

  if (!open) return null;

  return (
    <Modal open onClose={onClose}>
      <div className="md-native-dialog" style={{ display: 'block' }}>
        <form id="provision-form" className="dialog-form" onSubmit={handleSubmit}>
          <h2 className="md-dialog-title">Provision a New Hospital</h2>
          <div className="md-field"><label htmlFor="p-name">Hospital / organization name</label><input id="p-name" required placeholder="Enter organization name" value={f.name} onChange={set('name')} /></div>
          <div className="md-field">
            <label htmlFor="p-email-domain">Staff email domain</label>
            <input
              id="p-email-domain"
              required
              placeholder="yourhospital.com"
              value={emailDomain}
              onChange={(e) => setF((p) => ({ ...p, emailDomain: e.target.value, domainEdited: true }))}
            />
            <span style={{ fontSize: 12, opacity: domainProblem ? 1 : 0.7, color: domainProblem ? 'var(--status-error, #b3261e)' : undefined }}>
              {domainProblem || 'Every staff login uses this domain, e.g. name.hom@' + (emailDomain || 'yourhospital.com')}
            </span>
          </div>
          <div className="md-field">
            <label htmlFor="p-admin-email">Admin email</label>
            <TaggedEmailInput
              id="p-admin-email"
              value={f.adminName}
              onChange={(v) => setF((p) => ({ ...p, adminName: v }))}
              tag="admin"
              domain={emailDomain}
              placeholder="e.g. owner"
            />
          </div>
          <div className="md-field"><label htmlFor="p-admin-password">Admin password</label><input id="p-admin-password" type="password" required placeholder="Enter secure password" value={f.adminPassword} onChange={set('adminPassword')} /></div>
          <div className="md-dialog-actions">
            <button type="button" className="md-btn md-btn-text" id="provision-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="md-btn md-btn-filled" id="provision-submit" disabled={Boolean(domainProblem)}>Provision</button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
