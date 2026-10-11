'use strict';

import { useState } from 'react';
import { api } from '../../api/index.js';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { escapeHtml } from '../../lib/formatters.js';
import Button from '../../components/ui/Button.jsx';
import { toast, confirm } from '../../components/feedback/feedback.js';
import WardDialog from './WardDialog.jsx';

/** Ported from Admin/screen-02-departments.html + departments.js. */
export default function DepartmentsPage() {
  useDocumentTitle('Departments & Wards | Federico Hospital Admin');
  const [editingWard, setEditingWard] = useState(undefined); // undefined = closed, null = new

  const { data, reload } = useApi(
    async () => {
      const [wards, beds] = await Promise.all([api.wards.list(), api.wards.beds()]);
      return { wards: wards || [], beds: beds || [] };
    },
    [],
  );

  const wards = data?.wards || [];
  const beds = data?.beds || [];
  const bedsForWard = (wardId) => beds.filter((b) => b.ward_id === wardId);

  const totalBeds = beds.length;
  const occupied = beds.filter((b) => b.status === 'OCCUPIED').length;

  async function deleteWard(wardId) {
    const ward = wards.find((w) => w.ward_id === wardId);
    if (!ward) return;
    const ok = await confirm({
      title: 'Delete ' + ward.ward_name + '?',
      body: 'This cannot be undone. Wards with any occupied bed cannot be deleted.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    try {
      // The API client throws on error, so this defensive branch is dead -
      // kept because the legacy code had it and removing it changes nothing.
      const result = await api.wards.remove(wardId);
      if (result && result.error) {
        toast(result.message, 'error');
        return;
      }
      toast(ward.ward_name + ' deleted.', 'warning');
      await reload();
    } catch (err) {
      toast(err.message || 'Could not delete this ward.', 'error');
    }
  }

  return (
    <main className="dashboard-container">
      <div className="header-section">
        <div>
          <h1 className="h1" style={{ marginBottom: 8 }}>Departments &amp; Wards</h1>
          <p className="body-text">
            Add, resize, or remove the wards patients get admitted into. Every hospital starts with
            6 standard departments {'—'} adjust the list to fit yours.
          </p>
        </div>
        <button className="btn btn-primary btn-default" id="new-ward-btn" onClick={() => setEditingWard(null)}>
          + Add Ward
        </button>
      </div>

      <div className="metrics-grid" id="metrics-container">
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Departments / Wards</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>{wards.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Configured clinical units</div>
        </div>
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Beds Capacity</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>{totalBeds}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Across all hospital wards</div>
        </div>
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bed Occupancy Rate</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>
            {totalBeds ? Math.round((occupied / totalBeds) * 100) : 0}%
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{occupied} of {totalBeds} beds occupied</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Wards</h2>
          <p className="card-description">Bed counts include both available and occupied beds.</p>
        </div>
        <div className="card-content" style={{ padding: 0 }}>
          <div id="wards-list">
            {!data ? (
              <div className="md-empty-state"><span>Loading wards&hellip;</span></div>
            ) : wards.length === 0 ? (
              <div className="md-empty-state">
                <strong>No wards yet.</strong>
                <span>Add one to start allocating beds.</span>
              </div>
            ) : (
              wards.map((ward) => {
                const wardBeds = bedsForWard(ward.ward_id);
                const wardOccupied = wardBeds.filter((b) => b.status === 'OCCUPIED').length;
                return (
                  <div className="ward-card" key={ward.ward_id}>
                    <div>
                      <div className="ward-card-name">{escapeHtml(ward.ward_name)}</div>
                      <div className="ward-card-meta">{ward.description || 'No description'}</div>
                    </div>
                    <div className="ward-card-stats">
                      <div className="ward-stat">
                        <div className="ward-stat-value">{wardBeds.length}</div>
                        <div className="ward-stat-label">Beds</div>
                      </div>
                      <div className="ward-stat">
                        <div className="ward-stat-value">{wardOccupied}</div>
                        <div className="ward-stat-label">Occupied</div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setEditingWard(ward.ward_id)}>Edit</Button>
                      <Button variant="danger" size="sm" onClick={() => deleteWard(ward.ward_id)}>Delete</Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <WardDialog
        open={editingWard !== undefined}
        ward={editingWard ? wards.find((w) => w.ward_id === editingWard) : null}
        bedCount={editingWard ? bedsForWard(editingWard).length : ''}
        onClose={() => setEditingWard(undefined)}
        onSaved={reload}
      />
    </main>
  );
}

