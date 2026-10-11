'use strict';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api/index.js';
import { toast } from '../../components/feedback/feedback.js';

/**
 * Ported from #patientPopup plus registerPatient in PRE/js/Appointment.js.
 *
 * Fields accept whatever is typed and are validated once, on submit. (The
 * original rewrote the name and age fields on every keystroke and fired an
 * error toast each time a character was stripped.)
 */
const BLANK = { name: '', age: '', gender: '', phone: '', address: '' };

const isValidPhone = (p) => /^[0-9]{10}$/.test(String(p || '').trim());
const isValidAge = (a) => /^[1-9]\d*$/.test(String(a || '').trim()) && Number(a) <= 120;
const isValidName = (n) => /^[A-Za-z\s.'-]+$/.test(String(n || '').trim());

/** The first problem with the form, or null when it can be submitted. */
function validate(f) {
  if (!f.name.trim() || !f.age.trim() || !f.gender || !f.phone.trim() || !f.address.trim()) {
    return 'Please fill all required patient demographic fields';
  }
  if (!isValidName(f.name)) return 'Name should contain letters only';
  if (!isValidAge(f.age)) return 'Enter age as a whole number between 1 and 120';
  if (!isValidPhone(f.phone)) return 'Phone number must be exactly 10 digits';
  return null;
}

export default function RegisterWalkInPopup({ open, onClose, onRegistered }) {
  // Mounting the form only while open gives every opening a blank form.
  if (!open) return null;
  return <WalkInForm onClose={onClose} onRegistered={onRegistered} />;
}

function WalkInForm({ onClose, onRegistered }) {
  const [f, setF] = useState(BLANK);
  const set = (key) => (e) => setF((p) => ({ ...p, [key]: e.target.value }));

  useEffect(() => {
    function onKeydown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  }, [onClose]);

  async function submit() {
    const problem = validate(f);
    if (problem) {
      toast(problem, 'error');
      return;
    }

    const birthYear = new Date().getFullYear() - Number(f.age.trim());

    try {
      const patient = await api.patients.create({
        name: f.name.trim(),
        dob: birthYear + '-01-01',
        gender: f.gender,
        phone: f.phone.trim(),
        address: f.address.trim(),
      });
      onClose();
      toast('Patient registered successfully with UHID ' + patient.uhid, 'success');
      await onRegistered(patient);
    } catch (err) {
      toast(err.message || 'Could not register patient', 'error');
    }
  }

  return createPortal(
    <div id="patientPopup" className="popup active" role="dialog" aria-modal="true" style={{ display: 'flex' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="emergency-modal-content" style={{ maxWidth: 560 }}>
        <div className="emergency-modal-head">
          <div>
            <h2 id="patientModalTitle" style={{ color: 'var(--md-primary, #0f766e)' }}>Register Walk-In Patient</h2>
            <p>Create verified hospital record for new walk-in patient.</p>
          </div>
          <button className="emergency-modal-close" type="button" onClick={onClose} aria-label="Close modal">{'✕'}</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div className="emergency-form-group" style={{ marginBottom: 0 }}>
            <label className="emergency-form-label" htmlFor="newName">Full Name *</label>
            <input type="text" id="newName" placeholder="e.g. Rahul Sharma" className="emergency-form-control" value={f.name} onChange={set('name')} />
          </div>
          <div className="emergency-form-group" style={{ marginBottom: 0 }}>
            <label className="emergency-form-label" htmlFor="newAge">Age (Years) *</label>
            <input type="number" id="newAge" placeholder="e.g. 35" min="1" max="120" step="1" className="emergency-form-control" value={f.age} onChange={set('age')} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div className="emergency-form-group" style={{ marginBottom: 0 }}>
            <label className="emergency-form-label" htmlFor="newGender">Gender *</label>
            <select id="newGender" className="emergency-form-control" value={f.gender} onChange={set('gender')}>
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="emergency-form-group" style={{ marginBottom: 0 }}>
            <label className="emergency-form-label" htmlFor="newPhone">Phone Number *</label>
            <input type="tel" id="newPhone" placeholder="10-digit mobile" maxLength={10} className="emergency-form-control"
              value={f.phone} onChange={set('phone')} />
          </div>
        </div>

        <div className="emergency-form-group" style={{ marginBottom: 16 }}>
          <label className="emergency-form-label" htmlFor="newAddress">Residential Address *</label>
          <input type="text" id="newAddress" placeholder="e.g. 45 Green Park, New Delhi" className="emergency-form-control"
            value={f.address} onChange={set('address')} />
        </div>

        <div className="emergency-modal-actions">
          <button className="btn suggest" type="button" onClick={onClose}>Cancel</button>
          <button className="btn green" type="button" onClick={submit}>Register &amp; Select</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
