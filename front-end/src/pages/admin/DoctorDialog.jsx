'use strict';

import { useState } from 'react';
import DialogShell from '../../components/layout/DialogShell.jsx';
import { api } from '../../api/index.js';
import { toast } from '../../components/feedback/feedback.js';

/**
 * Ported from the #doctor-dialog <dialog> in Admin/screen-05-people.html.
 *
 * The department <select> is built from ward names, with the doctor's current
 * department unshifted onto the front when it is not among them, so editing a
 * doctor never silently changes their department.
 */
const BLANK = { name: '', specialization: '', department: '', phone: '', email: '' };

export default function DoctorDialog({ open, doctor, wards, onClose, onSaved }) {
  // Mounted only while open (and re-keyed per doctor), so the fields always
  // start from the doctor being edited, or blank for a new one.
  if (!open) return null;
  return (
    <DoctorForm key={doctor ? doctor.doctor_id : 'new'} doctor={doctor} wards={wards} onClose={onClose} onSaved={onSaved} />
  );
}

function DoctorForm({ doctor, wards, onClose, onSaved }) {
  const [f, setF] = useState(() =>
    doctor
      ? {
          name: doctor.name || '',
          specialization: doctor.specialization || '',
          department: doctor.department || '',
          phone: doctor.phone || '',
          email: doctor.email || '',
        }
      : BLANK,
  );
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const names = (wards || []).map((w) => w.ward_name);
  const current = doctor ? doctor.department || '' : '';
  const options = current && !names.includes(current) ? [current, ...names] : names;

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      name: f.name.trim(),
      specialization: f.specialization.trim() || undefined,
      department: f.department || undefined,
      phone: f.phone.trim() || undefined,
      email: f.email.trim() || undefined,
    };
    if (!payload.name) return;
    try {
      if (doctor) {
        await api.doctors.update(doctor.doctor_id, payload);
        toast(payload.name + ' updated.', 'success');
      } else {
        await api.doctors.create(payload);
        toast(payload.name + ' added.', 'success');
      }
      onClose();
      await onSaved();
    } catch (err) {
      toast(err.message || 'Could not save this doctor.', 'error');
    }
  }

  return (
    <DialogShell
      open
      onClose={onClose}
      title={doctor ? 'Edit ' + doctor.name : 'Add a Doctor'}
      subtitle="Configure doctor directory profile and department assignment."
    >
      <form id="doctor-form" className="dialog-form" onSubmit={handleSubmit}>
        <div className="md-field">
          <label htmlFor="doctor-name">Name</label>
          <input id="doctor-name" required placeholder="Dr. …" value={f.name} onChange={set('name')} />
        </div>
        <div className="md-field">
          <label htmlFor="doctor-spec">Specialization</label>
          <input id="doctor-spec" required placeholder="e.g. Cardiology" value={f.specialization} onChange={set('specialization')} />
        </div>
        <div className="md-field">
          <label htmlFor="doctor-dept">Department</label>
          <select id="doctor-dept" className="input" value={f.department} onChange={set('department')}>
            {options.length === 0 ? (
              <option value="">General</option>
            ) : (
              options.map((n) => <option key={n} value={n}>{n}</option>)
            )}
          </select>
        </div>
        <div className="md-field">
          <label htmlFor="doctor-phone">Phone</label>
          <input id="doctor-phone" placeholder="Optional" value={f.phone} onChange={set('phone')} />
        </div>
        <div className="md-field">
          <label htmlFor="doctor-email">Email</label>
          <input id="doctor-email" type="email" placeholder="Optional" value={f.email} onChange={set('email')} />
        </div>
        <div className="md-dialog-actions">
          <button type="button" className="btn btn-outline btn-default" id="doctor-cancel" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-default">Save</button>
        </div>
      </form>
    </DialogShell>
  );
}
