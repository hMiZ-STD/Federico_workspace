'use strict';

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatientStore } from './usePatientStore.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { api } from '../../api/index.js';
import { toast } from '../../components/feedback/feedback.js';
import DepartmentSelect from '../../components/forms/DepartmentSelect.jsx';
import {
  ALLOWED_UPLOAD_EXT,
  MAX_UPLOAD_BYTES,
  DUTY_START,
  DUTY_END,
  DUTY_HOURS_LABEL,
  TIME_WINDOWS,
  windowFor,
  dutyHoursError,
  formatSlotDate,
  normalizeSlotTime,
} from './slotHelpers.js';
import { usePageStyles } from '../../hooks/usePageStyles.js';
import patientBookAppointmentCss from '../../styles/patient/patient-book-appointment.css?inline';

const TODAY = new Date().toISOString().split('T')[0];

const DEFAULT_ERRORS = {
  dept: 'Please select a department.',
  date: 'Please select a date.',
  time: 'Please select a preferred time.',
};

/**
 * The booking form collects a preference - department, date, time and the
 * reason for the visit - and submits it as a pending request. PRE reviews it,
 * allocates an on-duty doctor and confirms the slot, so there is no per-slot
 * capacity matrix here: the backend's availability check at confirmation is
 * the single source of truth for whether a doctor is free.
 */
export default function BookAppointmentPage() {
  usePageStyles(patientBookAppointmentCss);
  useDocumentTitle('Book Appointment – Federico Cloud');
  const navigate = useNavigate();
  const { profile, doctors, addAppointment } = usePatientStore();

  // The time panel's caption keeps its default until the date or department
  // actually changes.
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [selectedTime, setSelectedTime] = useState(''); // 24-hour "HH:MM" from <input type="time">
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState(null);
  const [selectedDoctorName, setSelectedDoctorName] = useState('Any Specialist');
  const [slotMetaTouched, setSlotMetaTouched] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitLabel, setSubmitLabel] = useState('Confirm Booking');
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState(false);
  const [note, setNote] = useState('');

  const deptDoctors = useMemo(() => {
    if (!selectedDept || selectedDept === 'none') return [];
    const target = selectedDept.toLowerCase();
    return doctors.filter((d) => {
      const docDept = (d.department || '').toLowerCase();
      const docSpec = (d.specialization || '').toLowerCase();
      return (
        docDept === target || docSpec === target || docSpec.includes(target) || docDept.includes(target)
      );
    });
  }, [doctors, selectedDept]);

  function onDepartmentChange(value) {
    setSelectedDept(value || null);
    setErrors((e) => ({ ...e, dept: undefined }));
    // updateDoctorOptions() resets the doctor whenever the department changes.
    setSelectedDoctorId(null);
    setSelectedDoctorName('Any Specialist');
    setSlotMetaTouched(true);
  }

  function onDoctorChange(value) {
    const id = value ? Number(value) : null;
    setSelectedDoctorId(id);
    if (id) {
      const doc = doctors.find((d) => d.doctor_id === id);
      setSelectedDoctorName(doc ? 'Dr. ' + doc.name.replace(/^Dr\.\s*/i, '') : 'Any Specialist');
    } else {
      setSelectedDoctorName('Any Specialist');
    }
  }

  function onDateChange(value) {
    setSelectedDate(value || null);
    setErrors((e) => ({ ...e, date: undefined, time: undefined }));
    setSlotMetaTouched(true);
  }

  function onTimeChange(value) {
    setSelectedTime(value || '');
    setErrors((e) => ({ ...e, time: undefined }));
  }

  function onFilesChange(event) {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) {
      setAttachedFiles([]);
      return;
    }

    const rejected = [];
    const accepted = files.filter((file) => {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (!ALLOWED_UPLOAD_EXT.includes(ext)) {
        rejected.push('"' + file.name + '" — unsupported type (PDF, JPG, PNG only)');
        return false;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        rejected.push('"' + file.name + '" — larger than 5 MB');
        return false;
      }
      return true;
    });

    rejected.forEach((msg) => toast(msg, 'warning'));
    setAttachedFiles(accepted);

    if (accepted.length === 0) return;

    const names = accepted.map((f) => f.name).join(', ');
    toast(
      accepted.length === 1
        ? 'File "' + names + '" attached to appointment.'
        : accepted.length + ' files attached to appointment.',
      'success',
    );
  }

  function validateForm() {
    const next = {};
    if (!selectedDept || selectedDept === 'none') next.dept = 'Please select a department.';
    if (!selectedDate) next.date = 'Please select a preferred date.';
    else if (selectedDate < TODAY) next.date = 'Please choose today or a future date.';
    if (!selectedTime) next.time = 'Please select a preferred time.';
    if (selectedDate && selectedTime && !next.date) {
      const dutyError = dutyHoursError(selectedDate, selectedTime);
      if (dutyError) next.time = dutyError;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onConfirm() {
    if (!validateForm()) return;

    setSubmitting(true);
    setSubmitLabel('Submitting Request…');

    try {
      const noteText = note.trim();

      // Upload any attached medical documents first; abort the booking if an
      // upload fails so we never create a request that references files that
      // aren't actually stored.
      const documentUrls = [];
      if (attachedFiles.length > 0) {
        setSubmitLabel(
          'Uploading ' + attachedFiles.length + ' document' + (attachedFiles.length > 1 ? 's' : '') + '…',
        );
        for (const file of attachedFiles) {
          const uploaded = await api.uploads.document(file);
          const url = (uploaded && uploaded.file && uploaded.file.url) || (uploaded && uploaded.url);
          if (!url) throw new Error('Upload of "' + file.name + '" did not return a file URL.');
          documentUrls.push(url);
        }
        setSubmitLabel('Submitting Request…');
      }

      const attachedNames = attachedFiles.map((f) => f.name).join(', ');
      const newRequestId = await addAppointment({
        date: selectedDate,
        displayDate: formatSlotDate(selectedDate),
        // Stored in the same "hh:mm AM" form PRE and the dashboards display.
        time: normalizeSlotTime(selectedTime),
        department: selectedDept,
        doctorId: selectedDoctorId,
        type: 'Consultation',
        note: noteText || (attachedNames ? 'Attached: ' + attachedNames : undefined),
        documents: documentUrls,
      });

      setBooked(true);
      setSubmitLabel('Booked ✓');
      toast('Appointment request submitted! Reference #' + newRequestId, 'success');

      setTimeout(() => {
        navigate('/Patient/patient-dashboard.html');
      }, 1500);
    } catch (err) {
      setSubmitting(false);
      setSubmitLabel('Confirm Booking');
      toast(err?.message || 'Could not schedule appointment. Please try again.', 'warning');
    }
  }

  function onSaveDraft() {
    if (!selectedDept && !selectedDate && !selectedTime) {
      toast('Select at least a department or date to save draft.', 'info');
      return;
    }
    toast('Appointment draft saved. Complete booking when ready.', 'info');
  }

  const slotMeta = slotMetaTouched
    ? (selectedDate ? formatSlotDate(selectedDate) : 'No date selected') +
      ' · ' +
      (selectedDept && selectedDept !== 'none' ? selectedDept : 'No department')
    : 'Select department and date above';

  const uploadLabel = (() => {
    if (attachedFiles.length === 0) return <strong id="upload-label-text">Choose files or drag &amp; drop here</strong>;
    const names = attachedFiles.map((f) => f.name).join(', ');
    if (attachedFiles.length === 1) {
      return (
        <strong id="upload-label-text">
          Attached: <span style={{ color: 'var(--primary)' }}>{names}</span> (
          {(attachedFiles[0].size / 1024).toFixed(0)} KB)
        </strong>
      );
    }
    return (
      <strong id="upload-label-text">
        Attached {attachedFiles.length} files: <span style={{ color: 'var(--primary)' }}>{names}</span>
      </strong>
    );
  })();

  return (
    <main className="page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <button
          type="button"
          className="breadcrumb-link"
          id="breadcrumb-home"
          onClick={() => navigate('/Patient/patient-dashboard.html')}
        >
          Dashboard
        </button>
        <span aria-hidden="true">›</span>
        <span>Book Appointment</span>
      </nav>

      <section className="page-heading">
        <h1>Book an Appointment</h1>
        <p>
          Select your preferred department, date, and time. Our pre-registration team (PRE) will
          confirm your booking promptly.
        </p>
      </section>

      <section className="layout">
        <div className="main-column">
          <section className="panel">
            <div className="panel-head">
              <h2>1. Select Department &amp; Date</h2>
            </div>
            <div className="filter-grid">
              <div className="form-group">
                <label htmlFor="department">
                  Department <span className="req">*</span>
                </label>
                <DepartmentSelect
                  id="department"
                  doctors={doctors}
                  value={selectedDept ?? ''}
                  onChange={onDepartmentChange}
                  placeholder="Select department"
                />
                <span className={'field-error' + (errors.dept ? '' : ' hidden')} id="error-dept">
                  {errors.dept || DEFAULT_ERRORS.dept}
                </span>
              </div>

              <div className="form-group">
                <label htmlFor="doctor-select">Doctor / Specialist</label>
                <select
                  id="doctor-select"
                  value={selectedDoctorId ?? ''}
                  onChange={(e) => onDoctorChange(e.target.value)}
                >
                  <option value="">Any Available Specialist</option>
                  {deptDoctors.map((doc) => {
                    const docTitle = doc.name.startsWith('Dr.') ? doc.name : 'Dr. ' + doc.name;
                    return (
                      <option key={doc.doctor_id} value={doc.doctor_id}>
                        {docTitle} ({doc.qualification || doc.specialization || selectedDept})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="appointment-date">
                  Preferred Date <span className="req">*</span>
                </label>
                <input
                  id="appointment-date"
                  type="date"
                  min={TODAY}
                  value={selectedDate ?? ''}
                  onChange={(e) => onDateChange(e.target.value)}
                />
                <span className={'field-error' + (errors.date ? '' : ' hidden')} id="error-date">
                  {errors.date || DEFAULT_ERRORS.date}
                </span>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head panel-head-between">
              <h2>2. Preferred Time</h2>
              <span className="panel-meta" id="slot-meta">
                {slotMeta}
              </span>
            </div>

            <div className="filter-grid">
              <div className="form-group">
                <label htmlFor="appointment-time">
                  Preferred Time <span className="req">*</span>
                </label>
                <input
                  id="appointment-time"
                  type="time"
                  min={DUTY_START}
                  max={DUTY_END}
                  step="900"
                  value={selectedTime}
                  onChange={(e) => onTimeChange(e.target.value)}
                />
                <span className={'field-error' + (errors.time ? '' : ' hidden')} id="error-time">
                  {errors.time || DEFAULT_ERRORS.time}
                </span>
              </div>

              <div className="form-group">
                <label htmlFor="time-window">Time of Day</label>
                <select
                  id="time-window"
                  value={selectedTime ? windowFor(selectedTime) : ''}
                  onChange={(e) => {
                    const win = TIME_WINDOWS.find((w) => w.id === e.target.value);
                    if (win) onTimeChange(win.pick);
                  }}
                >
                  <option value="">Any time</option>
                  {TIME_WINDOWS.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="panel-meta" style={{ margin: '0 0 20px' }}>
              Doctors are on duty {DUTY_HOURS_LABEL}. Our reception team (PRE) will assign an
              available doctor and confirm your exact time.
            </p>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>3. Symptoms &amp; Medical Documents</h2>
              <span className="muted-tag">Optional</span>
            </div>
            <div className="file-section">
              <label className="section-label">Upload Previous Prescriptions / Lab Reports</label>
              <label className="upload-box" htmlFor="file-upload" id="upload-label">
                {uploadLabel}
                <small>
                  Attach previous prescriptions, discharge notes, or lab test reports (PDF, JPG, PNG up
                  to 5 MB)
                </small>
                <input
                  type="file"
                  id="file-upload"
                  accept=".pdf,.jpg,.jpeg,.png"
                  multiple
                  style={{ display: 'none' }}
                  onChange={onFilesChange}
                />
              </label>

              <div className="form-group note-group">
                <label htmlFor="short-note">Describe Symptoms / Reason for Visit</label>
                <textarea
                  id="short-note"
                  rows="3"
                  placeholder="e.g. Mild chest discomfort, routine follow-up, viral fever symptoms..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>
          </section>
        </div>

        <aside className="side-column">
          <section className="panel side-panel">
            <div className="panel-head">
              <h2>Patient Details</h2>
            </div>
            <div className="profile-head">
              <div className="profile-avatar" id="sidebar-initials">
                {profile ? profile.initials || '--' : '--'}
              </div>
              <div className="profile-meta">
                <strong id="sidebar-name">{profile ? profile.name || 'Patient' : 'Loading...'}</strong>
                <span id="sidebar-uhid">UHID: {profile ? profile.uhid || '--' : '--'}</span>
              </div>
            </div>
            <div className="details-grid">
              <div className="label">Age / Gender</div>
              <div className="value" id="sidebar-age-gender">
                {profile ? (profile.age ? profile.age + ' yrs' : '--') + ' / ' + (profile.gender || '--') : '--'}
              </div>
              <div className="label">Blood Group</div>
              <div className="value" id="sidebar-blood">
                {profile ? profile.bloodGroup || '--' : '--'}
              </div>
              <div className="label">Contact</div>
              <div className="value" id="sidebar-phone">
                {profile ? profile.phone || '--' : '--'}
              </div>
              <div className="label">Insurance</div>
              <div className="value">
                <span className="verify-badge" id="sidebar-ins-status">
                  {profile ? (profile.insurance && profile.insurance.verified ? 'Verified' : 'Unverified') : '--'}
                </span>
              </div>
              <div className="label">Provider</div>
              <div className="value" id="sidebar-ins-provider">
                {profile ? (profile.insurance && profile.insurance.provider) || 'Self Pay' : '--'}
              </div>
            </div>
          </section>

          <section className="panel side-panel selected-slot">
            <div className="panel-head">
              <h2>Selected Slot</h2>
            </div>
            <div className="details-grid">
              <div className="label">Date</div>
              <div className="value" id="slot-date">
                {selectedDate ? formatSlotDate(selectedDate) : '—'}
              </div>
              <div className="label">Time</div>
              <div className="value" id="slot-time">
                {selectedTime ? normalizeSlotTime(selectedTime) : '—'}
              </div>
              <div className="label">Department</div>
              <div className="value" id="slot-dept">
                {selectedDept && selectedDept !== 'none' ? selectedDept : '—'}
              </div>
              <div className="label">Doctor</div>
              <div className="value" id="slot-doctor">
                {selectedDoctorName || 'Any Specialist'}
              </div>
              <div className="label">Visit Type</div>
              <div className="value" id="slot-visit">
                Consultation
              </div>
            </div>
            <div className="fee-row">
              <span>Consultation Fee</span>
              <strong>₹500</strong>
            </div>
          </section>

          <div className="action-stack">
            <button
              className="confirm-btn"
              type="button"
              id="confirm-booking"
              disabled={submitting}
              style={booked ? { opacity: '0.7' } : undefined}
              onClick={onConfirm}
            >
              {submitLabel}
            </button>
            <button className="draft-btn" type="button" id="save-draft" onClick={onSaveDraft}>
              Save as Draft
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}
