'use strict';

import { useSession } from '../../auth/useSession.js';
import { MODULE_UNAVAILABLE_BODY } from '../../lib/entitlements.js';
import { alert } from '../feedback/feedback.js';
import './ModuleLock.css';

/**
 * Replaces shared/rbac.js#lockElement / applyModuleLocks.
 *
 * The legacy version walked the DOM for [data-requires-module], greyed matching
 * elements, attached a capturing click listener and overwrote any inline
 * onclick with "return false;". Here a component wraps the thing being gated
 * and simply doesn't let the click through.
 *
 * `mode="hide"` mirrors the old data-lock-mode="hide" opt-in.
 */
function showModuleUnavailable() {
  alert({ title: 'Module Not Available', body: MODULE_UNAVAILABLE_BODY });
}

export default function ModuleLock({ module: moduleCode, mode = 'lock', children, className = '' }) {
  const { hasModule } = useSession();

  if (!moduleCode || hasModule(moduleCode)) return children;
  if (mode === 'hide') return null;

  return (
    <span
      className={['module-locked', className].filter(Boolean).join(' ')}
      aria-disabled="true"
      onClickCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
        showModuleUnavailable();
      }}
    >
      {children}
    </span>
  );
}

