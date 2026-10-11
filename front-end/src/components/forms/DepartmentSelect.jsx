'use strict';

/**
 * Ported from shared/department-options.js#populateDepartmentSelect.
 *
 * Options are the distinct, trimmed, non-empty `specialization` values across
 * the doctor list, sorted with localeCompare - same derivation as before. The
 * placeholder stays disabled+selected.
 */
export default function DepartmentSelect({
  doctors,
  value,
  onChange,
  placeholder = 'Select department',
  id,
  className = '',
  style,
}) {
  const specializations = Array.from(
    new Set((doctors || []).map((d) => (d.specialization || '').trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  return (
    <select
      id={id}
      className={className}
      style={style}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {specializations.map((spec) => (
        <option key={spec} value={spec}>
          {spec}
        </option>
      ))}
    </select>
  );
}

