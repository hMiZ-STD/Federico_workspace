'use strict';

import DialogShell from '../../components/layout/DialogShell.jsx';

/** Ported from #searchResultPopup in PRE/pages/APPointment.html. */
export default function SearchResultPopup({ patient, onClose }) {
  if (!patient) return null;

  return (
    <DialogShell
      open
      onClose={onClose}
      size="sm"
      title="Patient Record Found"
      subtitle="Verified profile linked to this contact number."
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
          <button className="btn green" type="button" onClick={onClose}>Continue Booking</button>
        </div>
      }
    >
      <div className="quick-patient-box" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: 'var(--color-muted-fg)', fontSize: 12 }}>Patient UHID:</span>
          <strong id="searchResultPatientId" style={{ color: 'var(--md-primary, #0f766e)' }}>{patient.patientId || '-'}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--color-muted-fg)', fontSize: 12 }}>Full Name:</span>
          <strong id="searchResultPatientName">{patient.name || '-'}</strong>
        </div>
      </div>
    </DialogShell>
  );
}
