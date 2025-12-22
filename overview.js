// overview.js
// ===========
// Overview map that shows ALL swim spots at once.
// Uses the same data + localStorage helpers as the main app so that
// progress (visited / not visited) stays perfectly in sync.

import { loadPools } from './data.js';
import {
  readVisited,
  countVisited
} from './storage.js';

// Keep a reference so we can force Leaflet to recalc size when the view becomes visible.
let overviewMap = null;

/**
 * Wait until an element has a real, non-zero on-screen size.
 * Leaflet can render "missing tiles" (often an L-shaped blank area) if the map
 * is created while the container is hidden or still measuring to 0px.
 *
 * This is common on iOS Safari when switching views.
 */
function waitForVisibleSize(el, {
  minW = 120,
  minH = 240,
  timeoutMs = 2500
} = {}) {
  const start = performance.now();

  return new Promise((resolve, reject) => {
    const tick = () => {
      const w = el.clientWidth || 0;
      const h = el.clientHeight || 0;

      // offsetParent === null is a decent proxy for display:none (except for fixed)
      const looksHidden = (el.offsetParent === null && getComputedStyle(el).position !== 'fixed');

      if (!looksHidden && w >= minW && h >= minH) {
        return resolve({ w, h });
      }

      if (performance.now() - start > timeoutMs) {
        return reject(new Error(`overviewMap container never reached a usable size (w=${w}, h=${h})`));
      }

      requestAnimationFrame(tick);
    };

    tick();
  });
}

/** Force Leaflet to re-measure and re-render tiles/markers. */
function forceLeafletReflow() {
  if (!overviewMap) return;
  try {
    overviewMap.invalidateSize(true);
  } catch (e) {
    // ignore
  }
}

/** Create Raymond head marker with coloured ring (visited = gold, not yet = blue). */
function createOverviewIcon(isVisited) {
  const file = isVisited ? 'raymond-marker-gold.png' : 'raymond-marker-blue.png';

  return L.divIcon({
    className: `raymond-pin ${isVisited ? 'visited' : 'notvisited'}`,
    html: `<img src="assets/${file}" alt="Raymond" />`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
}


/** Update the header badge and subtext message. */
function updateOverviewText(pools, visitedMap) {
  const badgeEl = document.getElementById('overviewBadge');
  const textEl  = document.getElementById('overviewText');

  const visitedCount = countVisited(visitedMap);
  const total = pools.length;

  if (badgeEl) {
    badgeEl.textContent = `${visitedCount} / ${total}`;
  }

  if (textEl) {
    if (total === 0) {
      textEl.textContent = 'No pools configured.';
    } else {
      textEl.textContent = `You’ve explored ${visitedCount} of ${total} swim spots.`;
    }
  }
}

/** Build the Leaflet map and add one marker per pool. */
async function initOverviewMap() {
  const mapEl = document.getElementById('overviewMap');
  if (!mapEl) return;

  // Defensive: make sure the map element has a usable height even if CSS hasn't
  // resolved yet (this is a common culprit for the "missing tiles" quadrant on iOS).
  try {
    const h = mapEl.clientHeight || 0;
    if (h < 200) {
      mapEl.style.width = '100%';
      mapEl.style.minHeight = '360px';
      // Give it a reasonable height that matches your card layout; CSS can override.
      mapEl.style.height = mapEl.style.height || '60vh';
    }
  } catch (e) {
    // ignore
  }

  // IMPORTANT: wait until the overviewMap container has a stable size.
  // Without this, iOS Safari can render a blank "L" shaped area of tiles.
  try {
    await waitForVisibleSize(mapEl);
  } catch (e) {
    console.warn(e);
    // Even if we timed out, continue — later resize observers may fix it.
  }

  let pools;
  try {
    pools = await loadPools();
  } catch (err) {
    console.error(err);
    mapEl.textContent = 'Error loading pools list.';
    return;
  }

  const visitedMap = readVisited();
  updateOverviewText(pools, visitedMap);

  overviewMap = L.map(mapEl, {
    zoomControl: true,
    scrollWheelZoom: true
  }).setView([-33.8688, 151.2093], 11); // Roughly Sydney CBD

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap'
  }).addTo(overviewMap);

  const bounds = [];

  pools.forEach(pool => {
    const info = visitedMap[pool.id];
    const isVisited = !!(info && info.done);

    const icon = createOverviewIcon(isVisited);
    const marker = L.marker([pool.lat, pool.lng], { icon }).addTo(overviewMap);

    marker.bindPopup(`<strong>${pool.name}</strong>`);

    bounds.push([pool.lat, pool.lng]);
  });

  if (bounds.length) {
    overviewMap.fitBounds(bounds, { padding: [40, 40] });
  }

  // Immediate reflow after fitBounds (helps on iOS where fitBounds can change size/zoom)
  forceLeafletReflow();
  requestAnimationFrame(() => forceLeafletReflow());

  // Reflow fixes (iOS / hidden view / orientation changes)
  // 1) After Leaflet reports ready
  overviewMap.whenReady(() => {
    forceLeafletReflow();
    // Some iOS layouts settle late; a couple of delayed reflows help.
    setTimeout(forceLeafletReflow, 150);
    setTimeout(forceLeafletReflow, 350);
    setTimeout(forceLeafletReflow, 700);
  });

  // 2) Watch container resize and reflow tiles
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => forceLeafletReflow());
    ro.observe(mapEl);
  }
}

// Entry point for the overview page.
document.addEventListener('DOMContentLoaded', () => {
  const openBtn = document.getElementById('openAppBtn');
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      window.location.href = 'app.html';
    });
  }

  const changeNameBtn = document.getElementById('changeNameBtn');
  if (changeNameBtn) {
    changeNameBtn.addEventListener('click', () => {
      const LS_KEY = 'passportOwnerName';
      let currentName = null;
      try {
        currentName = localStorage.getItem(LS_KEY);
      } catch (e) {
        currentName = null;
      }

      const defaultName = currentName || 'Carpe Diem Passport';
      const input = prompt('Update passport name:', defaultName);
      if (!input) return;
      const nextName = input.trim();
      if (!nextName) return;

      try {
        localStorage.setItem(LS_KEY, nextName);
      } catch (e) {
        // ignore storage errors
      }

      alert('Passport name updated. You\'ll see it on the cover next time you open the app.');
    });
  }

  initOverviewMap().catch(err =>
    console.error('Error during overview init', err)
  );

  // If the user rotates the phone or returns to the tab, re-measure the map.
  window.addEventListener('resize', () => {
    // Small delay lets Safari finish its resize pass
    setTimeout(forceLeafletReflow, 120);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      setTimeout(forceLeafletReflow, 120);
      setTimeout(forceLeafletReflow, 350);
    }
  });
});
