'use strict';

import '../css/search-toolbar.css';

/**
 * Universal search and filter toolbar for directory and catalog pages.
 */
export default function SearchToolbar({
  searchQuery = '',
  onSearchChange,
  placeholder = 'Search...',
  filters = [], // [{ id, value, options: [{ value, label }], onChange }]
  actions,
  className = '',
}) {
  return (
    <div className={['search-toolbar-container', className].filter(Boolean).join(' ')}>
      <div className="search-toolbar-inputs">
        <div className="search-toolbar-input-wrap">
          <span className="search-toolbar-search-icon" aria-hidden="true">
            🔍
          </span>
          <input
            type="text"
            className="search-toolbar-input"
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
          />
        </div>

        {filters.map((f) => (
          <select
            key={f.id}
            className="search-toolbar-select"
            value={f.value}
            onChange={(e) => f.onChange && f.onChange(e.target.value)}
          >
            {f.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ))}
      </div>

      {actions ? <div className="search-toolbar-actions">{actions}</div> : null}
    </div>
  );
}
