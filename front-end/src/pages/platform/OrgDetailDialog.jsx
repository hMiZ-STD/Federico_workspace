'use strict';

import Modal from '../../components/layout/Modal.jsx';
import { statusChipClass, inr } from './platformHelpers.js';

/**
 * Ported from platform-dashboard.js#openOrgDetail, which used a native
 * <dialog>.showModal().
 *
 * The legacy dialog also had Modules / API Keys / Provisioning Log tabs whose
 * panels were never filled in; they are gone, and the enabled modules are
 * listed in the summary instead.
 */
export default function OrgDetailDialog({ org, onClose }) {
  if (!org) return null;
  const modules = org.enabled_modules || [];

  return (
    <Modal open onClose={onClose} className="platform-detail-overlay">
      <div className="md-native-dialog md-native-dialog-wide" style={{ display: 'block' }}>
        <div className="dialog-form">
          <div className="detail-header">
            <h2 className="md-dialog-title" id="detail-org-name" style={{ margin: 0 }}>
              {org.name}
            </h2>
            <button type="button" className="md-btn md-btn-text" id="detail-close" onClick={onClose}>
              Close
            </button>
          </div>

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
        </div>
      </div>
    </Modal>
  );
}
