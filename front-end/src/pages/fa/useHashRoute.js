'use strict';

import { useCallback, useEffect, useState } from 'react';

/**
 * Replaces FA/js/router.js. The FA portal is the one page in the app that was
 * already a SPA; its views live at `fa-dashboard.html#/ledger`, `#/charges`
 * and `#/eod`, with an optional admission id as a third segment
 * (`#/ledger/42`). This is a hash listener rather than a nested router - a
 * HashRouter inside the BrowserRouter would fight over `location`.
 *
 * The portal had six views; three were folded into the others, and their
 * hashes still resolve (admission id included) through ROUTE_ALIASES.
 */
export const DEFAULT_ROUTE = '#/ledger';

const ROUTE_ALIASES = {
  '#/dashboard': '#/ledger', // work queues now head the Ledger view
  '#/discharge': '#/eod', // settlement is part of EOD & Settlement
  '#/receipts': '#/eod', // so is the receipts register
};

export function parseHashRoute(rawHashInput) {
  const rawHash = rawHashInput || DEFAULT_ROUTE;
  const parts = rawHash.split('/');
  const route = parts.slice(0, 2).join('/');
  const mainRoute = ROUTE_ALIASES[route] || route;
  const param = parts[2] ? Number(parts[2].split('?')[0]) : null;
  return { rawHash, mainRoute, param };
}

export function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash || DEFAULT_ROUTE);

  useEffect(() => {
    function onHashChange() {
      setHash(window.location.hash || DEFAULT_ROUTE);
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  /**
   * navigate(hash, admissionId): appends the id to the hash unless it is
   * already there, same as the legacy router. The caller sets
   * currentAdmissionId; here we only move the URL.
   */
  const navigate = useCallback((target, admissionId = null) => {
    let targetHash = target;
    if (admissionId && !targetHash.includes('/' + admissionId)) {
      targetHash = target + '/' + admissionId;
    }
    if (window.location.hash === targetHash) {
      // Same hash means no hashchange event, so nudge state directly.
      setHash(targetHash);
      return;
    }
    window.location.hash = targetHash;
  }, []);

  return { ...parseHashRoute(hash), navigate, setHash };
}

