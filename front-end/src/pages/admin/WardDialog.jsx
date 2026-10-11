'use strict';

import { useState } from 'react';
import Modal from '../../components/layout/Modal.jsx';
import { api } from '../../api/index.js';
import { toast } from '../../components/feedback/feedback.js';

/** Ported from the #ward-dialog <dialog> in Admin/screen-02-departments.html. */
export default function WardDialog({ open, ward, bedCount, onClose, onSaved }) {
  // Mounted only while open (and re-keyed per ward), so the fields always
  // start from the ward being edited, or blank for a new one.
  if (!open) return null;
  return (
    <WardForm key={ward ? ward.ward_id : 'new'} ward={ward} bedCount={bedCount} onClose={onClose} onSaved={onSaved} />
  );
}

function WardForm({ ward, bedCount, onClose, onSaved }) {
  const [name, setName] = useState(ward ? ward.ward_name : '');
  const [description, setDescription] = useState(ward ? ward.description || '' : '');
  const [beds, setBeds] = useState(ward ? String(bedCount) : '');

  async function handleSubmit(e) {
    e.preventDefault();
    const totalBeds = Number(beds);
    if (!name.trim() || !totalBeds || totalBeds < 1) return;

    try {
      if (ward) {
        const result = await api.wards.update(ward.ward_id, {
          ward_name: name.trim(),
          description: description.trim() || undefined,
          total_beds: totalBeds,
        });
        if (result && result.error) {
          toast(result.message, 'error');
          return;
        }
        toast(name.trim() + ' updated.', 'success');
      } else {
        await api.wards.create({
          ward_name: name.trim(),
          description: description.trim() || undefined,
          total_beds: totalBeds,
        });
        toast(name.trim() + ' created.', 'success');
      }
      onClose();
      await onSaved();
    } catch (err) {
      toast(err.message || 'Could not save this ward.', 'error');
    }
  }

  return (
    <Modal open onClose={onClose}>
      <div className="md-native-dialog" style={{ display: 'block' }}>
        <form id="ward-form" className="dialog-form" onSubmit={handleSubmit}>
          <h2 className="md-dialog-title" id="ward-dialog-title">
            {ward ? 'Edit ' + ward.ward_name : 'Add a Ward'}
          </h2>
          <div className="md-field">
            <label htmlFor="ward-name">Department / ward name</label>
            <input id="ward-name" required placeholder="e.g. Neurology Ward" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="md-field">
            <label htmlFor="ward-description">Description</label>
            <input id="ward-description" placeholder="Optional" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="md-field">
            <label htmlFor="ward-beds">Total beds</label>
            <input id="ward-beds" type="number" min="1" required placeholder="e.g. 10" value={beds} onChange={(e) => setBeds(e.target.value)} />
          </div>
          <div className="md-dialog-actions">
            <button type="button" className="btn btn-outline btn-default" id="ward-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-default">Save</button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

