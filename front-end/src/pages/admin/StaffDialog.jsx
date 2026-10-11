'use strict';

import { useState } from 'react';
import Modal from '../../components/layout/Modal.jsx';
import { api } from '../../api/index.js';
import { toast } from '../../components/feedback/feedback.js';

/** Ported from the #staff-dialog <dialog> in Admin/screen-05-people.html. */
const BLANK = { name: '', email: '', password: '', actor_role: 'HOM' };

export default function StaffDialog({ open, onClose, onSaved }) {
  // Mounted only while open, so every opening starts from a blank form.
  if (!open) return null;
  return <StaffForm onClose={onClose} onSaved={onSaved} />;
}

function StaffForm({ onClose, onSaved }) {
  const [f, setF] = useState(BLANK);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      name: f.name.trim(),
      email: f.email.trim(),
      password: f.password,
      actor_role: f.actor_role,
    };
    if (!payload.name || !payload.email || payload.password.length < 6) return;
    try {
      const created = await api.rbac.createStaff(payload);
      onClose();
      toast(
        created.name + ' can now sign in as ' + created.actor_role + ' with ' + created.email + '.',
        'success',
      );
      await onSaved();
    } catch (err) {
      toast(err.message || 'Could not create this login.', 'error');
    }
  }

  return (
    <Modal open onClose={onClose}>
      <div className="md-native-dialog" style={{ display: 'block' }}>
        <form id="staff-form" className="dialog-form" onSubmit={handleSubmit}>
          <h2 className="md-dialog-title">Add a Person</h2>
          <div className="md-field">
            <label htmlFor="staff-name">Full name</label>
            <input id="staff-name" required placeholder="e.g. Rekha Nair" value={f.name} onChange={set('name')} />
          </div>
          <div className="md-field">
            <label htmlFor="staff-email">Login email</label>
            <input id="staff-email" type="email" required placeholder="name@yourhospital.com" value={f.email} onChange={set('email')} />
          </div>
          <div className="md-field">
            <label htmlFor="staff-password">Temporary password</label>
            <input id="staff-password" required minLength={6} placeholder="At least 6 characters" value={f.password} onChange={set('password')} />
          </div>
          <div className="md-field">
            <label htmlFor="staff-role">Portal role</label>
            <select id="staff-role" className="input" required value={f.actor_role} onChange={set('actor_role')}>
              <option value="HOM">HOM {'—'} Hospital Operations</option>
              <option value="PRE">PRE {'—'} Patient Registration</option>
              <option value="FA">FA {'—'} Finance Associate</option>
            </select>
          </div>
          <p className="cred-hint">
            Share the email + temporary password with the person. They sign in at the login page and
            pick their portal role.
          </p>
          <div className="md-dialog-actions">
            <button type="button" className="btn btn-outline btn-default" id="staff-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-default">Create Login</button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

