'use strict';

import { useState } from 'react';
import { api } from '../../api/index.js';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useSession } from '../../auth/useSession.js';
import Button from '../../components/ui/Button.jsx';
import ModuleLock from '../../components/layout/ModuleLock.jsx';
import { toast, confirm } from '../../components/feedback/feedback.js';
import StaffDialog from './StaffDialog.jsx';
import DoctorDialog from './DoctorDialog.jsx';
import BrandingCard from './BrandingCard.jsx';

/** The portal roles a staff login can hold (Admin is the provisioned owner). */
const STAFF_ROLES = [
  { value: 'PRE', label: 'PRE' },
  { value: 'HOM', label: 'HOM' },
  { value: 'FA', label: 'FA' },
];

/**
 * Ported from Admin/screen-05-people.html + people.js.
 *
 * The organization's single Staff & Doctors directory. It replaced the
 * separate Roles & Staff screen and its 24-checkbox custom-RBAC matrix: each
 * staff login now has one portal role, changed from the dropdown in its row,
 * and a one-click enable/disable.
 *
 * The DOCTOR module gate applies in two places, exactly as before: the
 * "+ Add Doctor" button, and the doctors table which shows an explanatory row
 * instead of loading.
 */
export default function PeoplePage() {
  useDocumentTitle('People | Federico Hospital Admin');
  const { hasModule, tenant } = useSession();
  const emailDomain = tenant?.email_domain || null;
  const doctorModule = hasModule('DOCTOR');

  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [editingDoctorId, setEditingDoctorId] = useState(undefined);

  // staff / doctors: null = loading, false = failed, array = loaded.
  const staffLoad = useApi(async () => {
    try {
      return await api.rbac.staff();
    } catch (err) {
      toast(err.message || 'Could not load staff.', 'error');
      throw err;
    }
  }, []);
  const staff = staffLoad.error ? false : staffLoad.data;
  const loadStaff = staffLoad.reload;

  // Without the DOCTOR module nothing is fetched; the table shows the locked row.
  const doctorsLoad = useApi(async () => {
    if (!doctorModule) return null;
    try {
      const [d, w] = await Promise.all([api.doctors.list(), api.wards.list().catch(() => [])]);
      return { doctors: d || [], wards: w || [] };
    } catch (err) {
      toast(err.message || 'Could not load doctors.', 'error');
      throw err;
    }
  }, [doctorModule]);
  const doctors = doctorsLoad.error ? false : doctorsLoad.data ? doctorsLoad.data.doctors : null;
  const wards = doctorsLoad.data ? doctorsLoad.data.wards : [];
  const loadDoctors = doctorsLoad.reload;

  async function toggleStaff(userId, next) {
    try {
      await api.rbac.setStaffActive(userId, next);
      toast(next ? 'Login enabled.' : 'Login disabled.', next ? 'success' : 'warning');
      await loadStaff();
    } catch (err) {
      toast(err.message || 'Could not update this login.', 'error');
    }
  }

  async function changeRole(member, nextRole) {
    if (nextRole === member.actor_role) return;
    try {
      const updated = await api.rbac.setStaffRole(member.user_id, nextRole);
      // The login email's tag follows the role (rekha.pre@ → rekha.hom@).
      toast(
        member.name + ' is now ' + nextRole + '. They now sign in as ' + (updated?.email || member.email) + '.',
        'success',
      );
      await loadStaff();
    } catch (err) {
      toast(err.message || 'Could not change this role.', 'error');
    }
  }

  async function deleteDoctor(doctorId) {
    const doc = (doctors || []).find((d) => d.doctor_id === doctorId);
    if (!doc) return;
    const ok = await confirm({
      title: 'Remove ' + doc.name + '?',
      body: 'The doctor will no longer be available for new appointments.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.doctors.remove(doctorId);
      toast(doc.name + ' removed.', 'warning');
      await loadDoctors();
    } catch (err) {
      toast(err.message || 'Could not remove this doctor.', 'error');
    }
  }

  return (
    <main className="dashboard-container">
      <div className="header-section">
        <div>
          <h1 className="h1" style={{ marginBottom: 8 }}>People</h1>
          <p className="body-text">
            Add staff logins for your organization and manage doctors by department. Staff sign in
            to their own portal with the email and password you set here.
          </p>
          {emailDomain && (
            <p className="body-text" style={{ marginTop: 4 }}>
              Staff email domain: <strong>@{emailDomain}</strong> {'—'} logins look like{' '}
              <code>name.hom@{emailDomain}</code>. Only Federico platform staff can change the domain.
            </p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 className="card-title">Staff Accounts</h2>
            <p className="card-description">
              HOM (operations), PRE (registration) and FA (finance) logins for this organization.
            </p>
          </div>
          <button className="btn btn-primary btn-default" id="new-staff-btn" onClick={() => setStaffDialogOpen(true)}>
            + Add Person
          </button>
        </div>
        <div className="card-content" style={{ padding: 0 }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Portal Role</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody id="staff-tbody">
                {staff === null ? null : staff === false ? (
                  <tr><td colSpan="5">Could not load staff.</td></tr>
                ) : staff.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No staff logins yet. Use {'“'}Add Person{'”'}.
                    </td>
                  </tr>
                ) : (
                  staff.map((m) => {
                    const active = m.is_active !== false;
                    return (
                      <tr key={m.user_id}>
                        <td style={{ fontWeight: 500 }}>{m.name}</td>
                        <td>{m.email}</td>
                        <td>
                          <select
                            className="input"
                            aria-label={'Portal role for ' + m.name}
                            style={{ width: 'auto', minWidth: 96 }}
                            value={m.actor_role || ''}
                            onChange={(e) => changeRole(m, e.target.value)}
                          >
                            {STAFF_ROLES.map((r) => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        </td>
                        <td><span className={'status-pill ' + (active ? 'active' : 'inactive')}>{active ? 'Active' : 'Disabled'}</span></td>
                        <td>
                          <Button
                            variant={active ? 'outline' : 'primary'}
                            size="sm"
                            onClick={() => toggleStaff(m.user_id, !active)}
                          >
                            {active ? 'Disable' : 'Enable'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 className="card-title">Doctors &amp; Departments</h2>
            <p className="card-description">
              Assign doctors to a department/ward. Locked when the Doctor Management module
              isn&apos;t in your subscription.
            </p>
          </div>
          <ModuleLock module="DOCTOR">
            <button className="btn btn-primary btn-default" id="new-doctor-btn" onClick={() => setEditingDoctorId(null)}>
              + Add Doctor
            </button>
          </ModuleLock>
        </div>
        <div className="card-content" style={{ padding: 0 }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr><th>Name</th><th>Specialization</th><th>Department</th><th>Contact</th><th>Action</th></tr>
              </thead>
              <tbody id="doctors-tbody">
                {!doctorModule ? (
                  <tr>
                    <td colSpan="5" style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
                      The Doctor Management module is not enabled for your organization.
                    </td>
                  </tr>
                ) : doctors === null ? null : doctors === false ? (
                  <tr><td colSpan="5">Could not load doctors.</td></tr>
                ) : doctors.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No doctors yet. Use {'“'}Add Doctor{'”'}.
                    </td>
                  </tr>
                ) : (
                  doctors.map((d) => (
                    <tr key={d.doctor_id}>
                      <td style={{ fontWeight: 500 }}>{d.name}</td>
                      <td>{d.specialization || '—'}</td>
                      <td>{d.department || '—'}</td>
                      <td>{d.phone || d.email || '—'}</td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <Button variant="outline" size="sm" onClick={() => setEditingDoctorId(d.doctor_id)}>Edit</Button>
                        <Button variant="danger" size="sm" onClick={() => deleteDoctor(d.doctor_id)}>Delete</Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <BrandingCard />

      <StaffDialog
        open={staffDialogOpen}
        emailDomain={emailDomain}
        onClose={() => setStaffDialogOpen(false)}
        onSaved={loadStaff}
      />
      <DoctorDialog
        open={editingDoctorId !== undefined}
        doctor={editingDoctorId ? (doctors || []).find((d) => d.doctor_id === editingDoctorId) : null}
        wards={wards}
        onClose={() => setEditingDoctorId(undefined)}
        onSaved={loadDoctors}
      />
    </main>
  );
}

