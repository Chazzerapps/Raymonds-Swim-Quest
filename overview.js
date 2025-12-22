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

/**
 * Leaflet maps render incorrectly if they are created while their container is hidden
 * (e.g. view switched with display:none). This forces a reflow once visible.
 */
function fixMapSize() {
  if (!overviewMap) return;
  try {
    // true = also recalc pixel bounds; helps iOS/Safari.
    overviewMap.invalidateSize(true);
  } catch (e) {
    // ignore
  }
}

/**
 * Leaflet maps render incorrectly if they are created while their container is hidden
 * (e.g. view switched with display:none). This forces a reflow once visible.
 *
 * On iOS Safari, layout often settles over multiple frames, so we combine:
 * - double requestAnimationFrame (after paint)
 * - a few delayed invalidates (after CSS/layout settles)
 */
function scheduleOverviewInvalidate() {
  if (!overviewMap) return;

  // Two RAFs gives the browser a chance to apply layout + styles before Leaflet measures.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fixMapSize();
    });
  });

  // iOS + hidden-view “L-shaped tiles” fix: run a couple more times after layout settles.
  setTimeout(fixMapSize, 150);
  setTimeout(fixMapSize, 350);
  setTimeout(fixMapSize, 700);
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

  // Fix iOS/Safari + hidden-container rendering glitches
  overviewMap.whenReady(() => scheduleOverviewInvalidate());
  scheduleOverviewInvalidate();

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

  scheduleOverviewInvalidate();
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

    // If the user rotates the phone or returns to the tab, re-measure the map.
  window.addEventListener('resize', () => scheduleOverviewInvalidate());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleOverviewInvalidate();
  });

initOverviewMap().catch(err =>
    console.error('Error during overview init', err)
  );
});
