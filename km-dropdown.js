(function () {
  const START = 5000;
  const END = 1000000;
  const STEP = 5000;

  function formatKmLabel(km, meta) {
    let text = km.toLocaleString() + ' km';
    if (meta && meta.actualKm) text += ` (Actual: ${meta.actualKm} km)`;
    if (meta && meta.notes && meta.notes.trim() !== '') text += ' 📝';
    if (meta && meta.completed) text = '✅ ' + text;
    return text;
  }

  function buildListItem(km, meta) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'km-list-item';
    btn.setAttribute('data-km', String(km));
    btn.setAttribute('role', 'option');
    btn.tabIndex = -1;

    const left = document.createElement('div');
    left.className = 'km-left';
    left.textContent = formatKmLabel(km, meta);

    const right = document.createElement('div');
    right.className = 'meta';
    if (meta && meta.date) right.textContent = meta.date;

    btn.appendChild(left);
    btn.appendChild(right);
    return btn;
  }

  function init() {
    const btn = document.getElementById('km-dropdown-btn');
    const label = document.getElementById('km-dropdown-label');
    const modal = document.getElementById('km-modal');
    const closeBtn = document.getElementById('km-modal-close');
    const search = document.getElementById('km-search');
    const list = document.getElementById('km-list');
    const hiddenSelect = document.getElementById('km-select');

    if (!btn || !modal || !list || !search || !hiddenSelect) return;

    function readDB() {
      return (window.MaintenanceStorage ? window.MaintenanceStorage.getDB() : {}) || {};
    }

    function openModal() {
      modal.classList.remove('hidden');
      btn.setAttribute('aria-expanded', 'true');
      search.value = '';
      populateList('');
      search.focus();
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      modal.classList.add('hidden');
      btn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      btn.focus();
    }

    function chooseKm(km) {
      if (hiddenSelect) {
        hiddenSelect.value = String(km);
        hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const meta = readDB()[km] && readDB()[km]._meta ? readDB()[km]._meta : null;
      label.textContent = formatKmLabel(Number(km), meta);

      document.dispatchEvent(new CustomEvent('km-selected', { detail: { km: Number(km), meta } }));
      closeModal();
    }

    function populateList(filter) {
      const db = readDB();
      const q = String(filter || '').replace(/[^
0-9]/g, '');
      list.innerHTML = '';
      const fragment = document.createDocumentFragment();

      for (let i = START; i <= END; i += STEP) {
        if (q && !String(i).includes(q)) continue;
        const meta = db[i] && db[i]._meta ? db[i]._meta : null;
        const item = buildListItem(i, meta);
        item.addEventListener('click', () => chooseKm(i));
        fragment.appendChild(item);
      }

      if (!fragment.childElementCount) {
        const empty = document.createElement('div');
        empty.className = 'km-list-item';
        empty.textContent = 'No intervals found';
        fragment.appendChild(empty);
      }

      list.appendChild(fragment);
      const first = list.querySelector('.km-list-item[role="option"]');
      if (first) first.tabIndex = 0;
    }

    btn.addEventListener('click', () => {
      const open = !modal.classList.contains('hidden');
      if (open) closeModal(); else openModal();
    });

    closeBtn.addEventListener('click', closeModal);

    search.addEventListener('input', () => populateList(search.value));

    list.addEventListener('keydown', (e) => {
      const items = Array.from(list.querySelectorAll('.km-list-item'));
      if (!items.length) return;
      const idx = items.findIndex((it) => it.tabIndex === 0);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = items[Math.min(Math.max(idx, 0) + 1, items.length - 1)];
        if (next) {
          items.forEach((it) => (it.tabIndex = -1));
          next.tabIndex = 0;
          next.focus();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = items[Math.max((idx === -1 ? 1 : idx) - 1, 0)];
        if (prev) {
          items.forEach((it) => (it.tabIndex = -1));
          prev.tabIndex = 0;
          prev.focus();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const focused = document.activeElement;
        if (focused && focused.classList.contains('km-list-item')) {
          const km = focused.getAttribute('data-km');
          chooseKm(Number(km));
        }
      } else if (e.key === 'Escape') {
        closeModal();
      }
    });

    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    hiddenSelect.addEventListener('change', () => {
      const v = hiddenSelect.value;
      if (!v) {
        document.getElementById('km-dropdown-label').textContent = '-- Tap to Select Interval --';
        return;
      }
      const km = Number(v);
      const meta = readDB()[km] && readDB()[km]._meta ? readDB()[km]._meta : null;
      label.textContent = formatKmLabel(km, meta);
    });

    window.refreshKmDropdown = function () {
      populateList(search.value || '');
      const v = hiddenSelect.value;
      if (v) hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
    };

    populateList('');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
