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

function createOverviewIcon(isVisited) {
  return L.divIcon({
    className: isVisited
      ? 'overview-marker overview-marker-visited'
      : 'overview-marker overview-marker-notvisited',
    html: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11]
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

  // 1) Create map immediately so the page doesn't look "stuck"
  const map = L.map(mapEl, {
    zoomControl: true,
    scrollWheelZoom: true
  }).setView([-33.8688, 151.2093], 12); // ✅ closer default

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 12,
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

  // 3) Add markers (guard against bad coords)
  for (const pool of pools) {
    if (typeof pool.lat !== 'number' || typeof pool.lng !== 'number') continue;

    const info = visitedMap[pool.id];
    const isVisited = !!(info && info.done);

    const icon = createOverviewIcon(isVisited);
    const marker = L.marker([pool.lat, pool.lng], { icon }).addTo(map);
    marker.bindPopup(`<strong>${pool.name}</strong>`);
  }

  scheduleOverviewInvalidate(map);
}

document.addEventListener('DOMContentLoaded', () => {
  const openBtn = document.getElementById('openAppBtn');
  if (openBtn) openBtn.addEventListener('click', () => (window.location.href = 'app.html'));

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
