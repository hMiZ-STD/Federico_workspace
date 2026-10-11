'use strict';

import Modal from '../../components/layout/Modal.jsx';
import AppointmentRows from './AppointmentRows.jsx';
import VisitItems from './VisitItems.jsx';

/**
 * The dashboard's encounter-history modal, in one of two views:
 *
 *  - view="appointments"  every booked appointment, with "+ Book New"
 *  - view="visits"        the full visit history (formerly VisitsModal.jsx)
 *
 * Both rendered the same dash-modal shell around a list of past doctor
 * encounters, so they share it here.
 */
const TITLES = {
  appointments: 'All Appointments',
  visits: 'Full Visit History',
};

export default function AppointmentsModal({ open, view = 'appointments', onClose, appointments, visits, onBookNew }) {
  const titleId = view === 'visits' ? 'modal-visits-title' : 'modal-appt-title';

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId}>
      <div className="dash-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-head">
          <h2 id={titleId}>{TITLES[view]}</h2>
          <button className="modal-close" type="button" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {view === 'visits' ? (
            <div className="visit-list modal-visit-list">
              <VisitItems
                visits={visits}
                emptyMessage="No visit history recorded yet."
                departmentFontSize="12px"
              />
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Department / Doctor</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AppointmentRows appointments={appointments} emptyMessage="No appointments found." />
                  </tbody>
                </table>
              </div>
              <div className="modal-footer-action">
                <button className="modal-book-btn" type="button" id="modal-book-new" onClick={onBookNew}>
                  + Book New Appointment
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
