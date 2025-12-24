// overview.js
// ===========

import { loadPools } from './data.js';
import { readVisited, countVisited } from './storage.js';

function scheduleOverviewInvalidate(map) {
  if (!map) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try { map.invalidateSize(true); } catch (e) {}
    });
  });
  setTimeout(() => { try { map.invalidateSize(true); } catch (e) {} }, 150);
  setTimeout(() => { try { map.invalidateSize(true); } catch (e) {} }, 350);
  setTimeout(() => { try { map.invalidateSize(true); } catch (e) {} }, 700);
}

/** Create Raymond head marker (PNG) */
function createRaymondIcon(isVisited) {
  return L.icon({
    iconUrl: './assets/raymond-head.png',
    iconSize: [60, 60],
    iconAnchor: [30, 30],
    popupAnchor: [0, -22],
    className: isVisited ? 'raymond-visited' : 'raymond-notvisited'
  });
}

function updateOverviewText(pools, visitedMap) {
  const badgeEl = document.getElementById('overviewBadge');
  const textEl  = document.getElementById('overviewText');

  const visitedCount = countVisited(visitedMap);
  const total = pools.length;

  if (badgeEl) badgeEl.textContent = `${visitedCount} / ${total}`;

  if (textEl) {
    textEl.textContent =
      total === 0
        ? 'No pools configured.'
        : `You’ve visited ${visitedCount} of ${total} harbour pools.`;
  }
}

async function initOverviewMap() {
  const mapEl = document.getElementById('overviewMap');
  if (!mapEl) return;

  // 1) Create map immediately (prevents "stuck loading" feeling)
  const map = L.map(mapEl, {
    zoomControl: true,
    scrollWheelZoom: true
  }).setView([-33.8688, 151.2093], 11); // ✅ nicer overview zoom

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  map.whenReady(() => scheduleOverviewInvalidate(map));

  // 2) Load pools after map exists
  let pools = [];
  try {
    pools = await loadPools();
  } catch (err) {
    console.error(err);
    mapEl.textContent = 'Error loading pools list.';
    return;
  }

  const visitedMap = readVisited();
  updateOverviewText(pools, visitedMap);

  // 3) Add markers
  for (const pool of pools) {
    const latOk = typeof pool.lat === 'number' && Number.isFinite(pool.lat);
    const lngOk = typeof pool.lng === 'number' && Number.isFinite(pool.lng);
    if (!latOk || !lngOk) continue;

    const info = visitedMap[pool.id];
    const isVisited = !!(info && info.done);

    const icon = createRaymondIcon(isVisited);
    const marker = L.marker([pool.lat, pool.lng], { icon }).addTo(map);
    marker.bindPopup(`<strong>${pool.name}</strong>`);
  }

  scheduleOverviewInvalidate(map);
}

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
      try { currentName = localStorage.getItem(LS_KEY); } catch (e) {}

      const defaultName = currentName || 'Carpe Diem Passport';
      const input = prompt('Update passport name:', defaultName);
      if (!input) return;

      const nextName = input.trim();
      if (!nextName) return;

      try { localStorage.setItem(LS_KEY, nextName); } catch (e) {}
      alert("Passport name updated. You'll see it on the cover next time you open the app.");
    });
  }

  initOverviewMap().catch(err => console.error('Error during overview init', err));
});
