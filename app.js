(function () {
  // Custom KM modal dropdown component
  function formatKmLabel(km, meta) {
    let text = km.toLocaleString() + ' km';
    if (meta && meta.actualKm) text += ` (Actual: ${meta.actualKm} km)`;
    if (meta && meta.notes && meta.notes.trim() !== '') text += ' 📝';
    if (meta && meta.completed) text = '✅ ' + text;
    return text;
  }

  function initKmDropdown(ui, state) {
    const btn = document.getElementById('km-dropdown-btn');
    const label = document.getElementById('km-dropdown-label');
    const modal = document.getElementById('km-modal');
    const closeBtn = document.getElementById('km-modal-close');
    const search = document.getElementById('km-search');
    const list = document.getElementById('km-list');
    const hiddenSelect = document.getElementById('km-select');

    function openModal() {
      modal.classList.remove('hidden');
      btn.setAttribute('aria-expanded', 'true');
      search.focus();
      populateList(search.value);
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      modal.classList.add('hidden');
      btn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    function populateList(filter) {
      const db = state.db || {};
      const fragment = document.createDocumentFragment();
      const values = [];
      for (let i = 5000; i <= 1000000; i += 5000) values.push(i);

      const q = String(filter || '').replace(/[^0-9]/g, '');

      values.forEach((km) => {
        if (q && !String(km).includes(q)) return;
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'km-list-item';
        item.setAttribute('data-km', String(km));
        item.setAttribute('role', 'option');

        const meta = db[km] && db[km]._meta ? db[km]._meta : null;
        const left = document.createElement('div');
        left.className = 'km-left';
        left.textContent = formatKmLabel(km, meta);

        const right = document.createElement('div');
        right.className = 'meta';
        if (meta && meta.date) right.textContent = meta.date;

        item.appendChild(left);
        item.appendChild(right);

        item.addEventListener('click', () => {
          // Update hidden select for compatibility
          if (hiddenSelect) {
            hiddenSelect.value = String(km);
            const ev = new Event('change', { bubbles: true });
            hiddenSelect.dispatchEvent(ev);
          }

          // Update visible label
          label.textContent = formatKmLabel(km, meta) ;
          state.selectedKm = String(km);

          closeModal();
        });

        fragment.appendChild(item);
      });

      list.innerHTML = '';
      list.appendChild(fragment);
    }

    btn.addEventListener('click', (e) => {
      const isOpen = !modal.classList.contains('hidden');
      if (isOpen) closeModal(); else openModal();
    });

    closeBtn.addEventListener('click', closeModal);

    search.addEventListener('input', () => populateList(search.value));

    // keyboard handling
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    // sync initial label from select value
    function syncLabelFromSelect() {
      const v = hiddenSelect && hiddenSelect.value ? hiddenSelect.value : '';
      if (!v) {
        label.textContent = '-- Tap to Select Interval --';
      } else {
        const km = Number(v);
        const meta = state.db[km] && state.db[km]._meta ? state.db[km]._meta : null;
        label.textContent = formatKmLabel(km, meta);
      }
    }

    // when the select changes (by code), update UI
    if (hiddenSelect) {
      hiddenSelect.addEventListener('change', () => {
        syncLabelFromSelect();
        // trigger existing render behavior by dispatching change (already done when items clicked)
      });
    }

    // expose populate so caller can refresh when DB changes
    return { populateList, syncLabelFromSelect };
  }

  // Integrate component with existing app initialization
  // Wait for app.js to set window.__APP_INIT and state/db
  document.addEventListener('DOMContentLoaded', () => {
    // If the app exposes its UI/state on window, hook directly
    const appWindow = window || {};
    const tryInit = () => {
      const ui = {
        kmSelect: document.getElementById('km-select')
      };
      const state = {
        db: (window.MaintenanceStorage ? window.MaintenanceStorage.getDB() : {}) || {},
        selectedKm: ui.kmSelect && ui.kmSelect.value ? ui.kmSelect.value : ''
      };

      const dropdown = initKmDropdown(ui, state);

      // Whenever the storage is updated by app, refresh dropdown contents and label
      // Hook into native select change as single source-of-truth
      const hiddenSelect = document.getElementById('km-select');
      if (hiddenSelect) {
        hiddenSelect.addEventListener('change', () => {
          // reload db from storage and resync
          state.db = (window.MaintenanceStorage ? window.MaintenanceStorage.getDB() : {}) || {};
          dropdown.syncLabelFromSelect && dropdown.syncLabelFromSelect();
        });
      }

      // Also provide global refresh function the app can call after updating DB
      window.refreshKmDropdown = () => {
        state.db = (window.MaintenanceStorage ? window.MaintenanceStorage.getDB() : {}) || {};
        dropdown.populateList('');
        dropdown.syncLabelFromSelect && dropdown.syncLabelFromSelect();
      };
    };

    tryInit();
  });
})();
