// app.js - main UI logic
(function () {
  const RULES = window.RULES || [];
  const Storage = window.StorageHelpers;

  // Theme
  const themeToggleBtn = document.getElementById('theme-toggle');
  function applyTheme(isDark) {
    if (isDark) document.body.classList.add('dark-mode'); else document.body.classList.remove('dark-mode');
  }
  const savedTheme = localStorage.getItem('prado_theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (savedTheme === 'dark' || (savedTheme === null && prefersDark)) applyTheme(true);
  themeToggleBtn && themeToggleBtn.addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark-mode');
    applyTheme(!isDark);
    localStorage.setItem('prado_theme', !isDark ? 'dark' : 'light');
  });

  // Elements
  const kmSelect = document.getElementById('km-select');
  const resultsDiv = document.getElementById('results');
  const additionalCheck = document.getElementById('additional-check');
  const anthonyCheck = document.getElementById('anthony-check');
  const bulkToggle = document.getElementById('bulk-toggle');
  const mainView = document.getElementById('main-view');
  const bulkView = document.getElementById('bulk-view');
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importFile = document.getElementById('import-file');
  const clearBtn = document.getElementById('clear-btn');

  function getDB() { return Storage.safeReadDB(); }
  function saveDB(db) { return Storage.safeWriteDB(db); }

  function updateDropdown() {
    const db = getDB();
    const cur = kmSelect.value;
    kmSelect.innerHTML = '';
    const defaultOpt = document.createElement('option'); defaultOpt.value = ''; defaultOpt.textContent = '-- Tap to Select Interval --'; kmSelect.appendChild(defaultOpt);
    for (let i = 5000; i <= 1000000; i += 5000) {
      const option = document.createElement('option');
      option.value = String(i);
      const meta = db[i] && db[i]._meta ? db[i]._meta : {};
      let text = i.toLocaleString() + ' km';
      if (meta.actualKm) text += ` (Actual: ${meta.actualKm} km)`;
      if (meta.notes && meta.notes.trim() !== '') text += ' 📝';
      if (meta.completed) text = '✅ ' + text;
      option.textContent = text;
      kmSelect.appendChild(option);
    }
    if (cur) kmSelect.value = cur;
  }

  function getActionClass(action) {
    if (!action) return '';
    if (action.includes('Replace') || action.includes('Clean & install')) return 'action-replace';
    if (action.includes('Inspect') || action.includes('Clean')) return 'action-inspect';
    if (action.includes('Lubricate') || action.includes('Tighten')) return 'action-lubricate';
    return '';
  }

  function getRuleMatches(km, includeAdditional, includeAnthony) {
    const matches = [];
    RULES.forEach(rule => {
      let isActionable = false;
      let matchType = 'standard';
      if (rule.isAnthony) {
        if (!includeAnthony) return;
        if (rule.custom) isActionable = rule.custom(km, includeAdditional);
        else if (includeAdditional && rule.additional && km % rule.additional === 0) isActionable = true;
        else if (rule.standard && km % rule.standard === 0) isActionable = true;
        if (isActionable) matchType = 'anthony';
      } else if (rule.custom) {
        if (rule.custom(km, includeAdditional)) { isActionable = true; matchType = rule.custom(km, false) ? 'standard' : 'additional'; }
      } else {
        const hitsStandard = rule.standard && km % rule.standard === 0;
        const hitsAdditional = includeAdditional && rule.additional && km % rule.additional === 0;
        if (hitsStandard) { isActionable = true; matchType = 'standard'; }
        else if (hitsAdditional) { isActionable = true; matchType = 'additional'; }
      }
      if (isActionable) matches.push(Object.assign({}, rule, { matchType }));
    });
    return matches;
  }

  function renderTasks() {
    const kmStr = kmSelect.value;
    const includeAdditional = additionalCheck.checked;
    const includeAnthony = anthonyCheck.checked;
    resultsDiv.innerHTML = '';
    if (!kmStr) return;
    const km = parseInt(kmStr, 10);
    const db = getDB();
    const tasks = getRuleMatches(km, includeAdditional, includeAnthony);
    if (tasks.length === 0) {
      const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'No specific scheduled maintenance items fall on this exact interval.'; resultsDiv.appendChild(empty); return;
    }

    const meta = (db[km] && db[km]._meta) ? db[km]._meta : { completed: false, date: '', actualKm: '', notes: '' };
    const metaCard = document.createElement('div'); metaCard.className = 'card card-meta';
    const titleWrap = document.createElement('div'); titleWrap.className = 'card-title-wrapper';
    const h3 = document.createElement('h3'); h3.style.color = 'var(--meta-text)'; h3.style.fontSize = '16px'; h3.textContent = 'Interval Completion Details';
    titleWrap.appendChild(h3);
    metaCard.appendChild(titleWrap);

    // completion checkbox
    const inputRow = document.createElement('div'); inputRow.className = 'input-row'; inputRow.style.marginBottom = '16px';
    const label = document.createElement('label'); label.style.fontSize = '15px'; label.style.fontWeight = '700'; label.style.color = 'var(--meta-text)';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = !!meta.completed; checkbox.addEventListener('change', (e) => {
      const db2 = getDB(); if (!db2[km]) db2[km] = { _meta: { completed: false, date: '', actualKm: '', notes: '' }, tasks: {} };
      db2[km]._meta.completed = e.target.checked;
      if (e.target.checked && !db2[km]._meta.date) {
        const today = new Date().toISOString().split('T')[0]; db2[km]._meta.date = today;
      }
      saveDB(db2);
      updateDropdown();
    });
    label.appendChild(checkbox); label.appendChild(document.createTextNode(' Mark Entire Service Complete'));
    inputRow.appendChild(label); metaCard.appendChild(inputRow);

    // date and actual km
    const flex = document.createElement('div'); flex.style.display = 'flex'; flex.style.gap = '12px'; flex.style.marginBottom = '12px';
    const d1 = document.createElement('div'); d1.style.flex = '1';
    const d1label = document.createElement('label'); d1label.style.fontSize='12px'; d1label.style.color='var(--text-muted)'; d1label.textContent='Service Date';
    const dateIn = document.createElement('input'); dateIn.type='date'; dateIn.value = meta.date || ''; dateIn.addEventListener('change', (e) => { const db2=getDB(); if(!db2[km]) db2[km]={_meta:{completed:false,date:'',actualKm:'',notes:''},tasks:{}}; db2[km]._meta.date=e.target.value; saveDB(db2); updateDropdown(); });
    d1.appendChild(d1label); d1.appendChild(dateIn);
    const d2 = document.createElement('div'); d2.style.flex='1';
    const d2label = document.createElement('label'); d2label.style.fontSize='12px'; d2label.style.color='var(--text-muted)'; d2label.textContent='Actual Odometer';
    const odoin = document.createElement('input'); odoin.type='number'; odoin.placeholder='e.g. 10250'; odoin.value=meta.actualKm||''; odoin.addEventListener('input', (e) => { const db2=getDB(); if(!db2[km]) db2[km]={_meta:{completed:false,date:'',actualKm:'',notes:''},tasks:{}}; db2[km]._meta.actualKm=e.target.value; saveDB(db2); updateDropdown(); });
    d2.appendChild(d2label); d2.appendChild(odoin);
    flex.appendChild(d1); flex.appendChild(d2); metaCard.appendChild(flex);

    const notesLabel = document.createElement('label'); notesLabel.style.fontSize='12px'; notesLabel.style.color='var(--text-muted)'; notesLabel.textContent='Interval Notes';
    const notesArea = document.createElement('textarea'); notesArea.className='note-input'; notesArea.value = meta.notes || ''; notesArea.addEventListener('input', (e) => { const db2=getDB(); if(!db2[km]) db2[km]={_meta:{completed:false,date:'',actualKm:'',notes:''},tasks:{}}; db2[km]._meta.notes=e.target.value; saveDB(db2); updateDropdown(); });
    metaCard.appendChild(notesLabel); metaCard.appendChild(notesArea);

    resultsDiv.appendChild(metaCard);

    // tasks
    tasks.forEach(task => {
      const taskState = (db[km] && db[km].tasks && db[km].tasks[task.id]) ? db[km].tasks[task.id] : { checked: false, notes: '' };
      const card = document.createElement('div'); card.className = 'card card-' + task.matchType;
      const wrap = document.createElement('div'); wrap.className = 'card-title-wrapper';
      const title = document.createElement('h3'); title.textContent = task.item; wrap.appendChild(title);
      if (task.matchType === 'additional') { const badge = document.createElement('span'); badge.className='badge badge-additional'; badge.textContent='Severe / Off-Road'; wrap.appendChild(badge); }
      if (task.matchType === 'anthony') { const badge = document.createElement('span'); badge.className='badge badge-anthony'; badge.textContent="Anthony's Advice"; wrap.appendChild(badge); }
      card.appendChild(wrap);
      const catP = document.createElement('p'); catP.innerHTML = '<strong>Category:</strong> ' + task.category; card.appendChild(catP);
      const actionP = document.createElement('p'); actionP.innerHTML = '<strong>Action required:</strong> <span class="' + getActionClass(task.action) + '">' + task.action + '</span>'; card.appendChild(actionP);
      if (task.part && task.part !== 'N/A') { const partP = document.createElement('p'); partP.innerHTML = '<strong>OEM / Ref Part:</strong> <span class="part-no">' + task.part + '</span>'; card.appendChild(partP); }

      const inputs = document.createElement('div'); inputs.className='task-inputs';
      const row = document.createElement('div'); row.className='input-row';
      const lbl = document.createElement('label'); const cb = document.createElement('input'); cb.type='checkbox'; cb.checked = !!taskState.checked; cb.addEventListener('change', (e)=>{ const db2=getDB(); if(!db2[km]) db2[km]={_meta:{completed:false,date:'',actualKm:'',notes:''},tasks:{}}; if(!db2[km].tasks) db2[km].tasks = {}; db2[km].tasks[task.id] = db2[km].tasks[task.id] || {checked:false,notes:''}; db2[km].tasks[task.id].checked = e.target.checked; saveDB(db2); });
      lbl.appendChild(cb); lbl.appendChild(document.createTextNode(' Task Completed'));
      row.appendChild(lbl); inputs.appendChild(row);
      const noteT = document.createElement('textarea'); noteT.className='note-input'; noteT.value = taskState.notes || ''; noteT.placeholder='Add service notes or part brands used...'; noteT.addEventListener('input', (e)=>{ const db2=getDB(); if(!db2[km]) db2[km]={_meta:{completed:false,date:'',actualKm:'',notes:''},tasks:{}}; if(!db2[km].tasks) db2[km].tasks = {}; db2[km].tasks[task.id] = db2[km].tasks[task.id] || {checked:false,notes:''}; db2[km].tasks[task.id].notes = e.target.value; saveDB(db2); });
      inputs.appendChild(noteT);
      card.appendChild(inputs);
      resultsDiv.appendChild(card);
    });
  }

  function renderBulkList() {
    const container = document.getElementById('bulk-list'); container.innerHTML = '';
    const db = getDB();
    for (let i = 5000; i <= 1000000; i += 5000) {
      const meta = (db[i] && db[i]._meta) ? db[i]._meta : { completed: false, date: '', actualKm: '', notes: '' };
      const row = document.createElement('div'); row.className = 'bulk-row';
      const kmBox = document.createElement('div'); kmBox.className='bulk-km'; kmBox.textContent = i.toLocaleString();
      const cbWrap = document.createElement('div'); cbWrap.className='bulk-cb-wrapper';
      const cb = document.createElement('input'); cb.type='checkbox'; cb.checked = !!meta.completed; cb.className='bulk-checkbox'; cb.addEventListener('change', (e)=>{ const db2=getDB(); if(!db2[i]) db2[i] = { _meta: { completed: false, date: '', actualKm: '', notes: '' }, tasks: {} }; db2[i]._meta.completed = e.target.checked; if(e.target.checked && !db2[i]._meta.date) { db2[i]._meta.date = new Date().toISOString().split('T')[0]; } saveDB(db2); updateDropdown(); });
      cbWrap.appendChild(cb);
      const inputs = document.createElement('div'); inputs.style.display='flex'; inputs.style.flexDirection='column'; inputs.style.flex='1'; inputs.style.gap='8px';
      const inner = document.createElement('div'); inner.className='bulk-inputs';
      const dateIn = document.createElement('input'); dateIn.type='date'; dateIn.className='bulk-input'; dateIn.value = meta.date || ''; dateIn.addEventListener('change', (e)=>{ const db2=getDB(); if(!db2[i]) db2[i] = { _meta: { completed: false, date: '', actualKm: '', notes: '' }, tasks: {} }; db2[i]._meta.date = e.target.value; saveDB(db2); updateDropdown(); });
      const odoIn = document.createElement('input'); odoIn.type='number'; odoIn.className='bulk-input'; odoIn.placeholder='Odo km'; odoIn.value = meta.actualKm || ''; odoIn.addEventListener('input',(e)=>{ const db2=getDB(); if(!db2[i]) db2[i] = { _meta: { completed: false, date: '', actualKm: '', notes: '' }, tasks: {} }; db2[i]._meta.actualKm = e.target.value; saveDB(db2); updateDropdown(); });
      inner.appendChild(dateIn); inner.appendChild(odoIn);
      const notes = document.createElement('textarea'); notes.className='note-input bulk-meta-input'; notes.value = meta.notes || ''; notes.placeholder = 'Interval notes...'; notes.addEventListener('input', (e)=>{ const db2=getDB(); if(!db2[i]) db2[i] = { _meta: { completed: false, date: '', actualKm: '', notes: '' }, tasks: {} }; db2[i]._meta.notes = e.target.value; saveDB(db2); updateDropdown(); });
      inputs.appendChild(inner); inputs.appendChild(notes);
      row.appendChild(kmBox); row.appendChild(cbWrap); row.appendChild(inputs); container.appendChild(row);
    }
  }

  // Event bindings
  kmSelect && kmSelect.addEventListener('change', renderTasks);
  additionalCheck && additionalCheck.addEventListener('change', renderTasks);
  anthonyCheck && anthonyCheck.addEventListener('change', renderTasks);
  bulkToggle && bulkToggle.addEventListener('click', () => {
    if (bulkView.style.display === 'none') { mainView.style.display='none'; bulkView.style.display='block'; bulkToggle.innerHTML='🔙 Back'; renderBulkList(); }
    else { bulkView.style.display='none'; mainView.style.display='block'; bulkToggle.innerHTML='📝 Bulk Edit'; updateDropdown(); renderTasks(); }
  });

  exportBtn && exportBtn.addEventListener('click', () => Storage.exportData());
  importBtn && importBtn.addEventListener('click', () => importFile.click());
  importFile && importFile.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return; Storage.importDataFile(file, () => { alert('Service history backup restored successfully!'); updateDropdown(); renderTasks(); }, (err) => { alert(err); }); importFile.value='';
  });
  clearBtn && clearBtn.addEventListener('click', () => {
    const dbraw = localStorage.getItem('prado_maintenance_db'); if (!dbraw || dbraw === '{}') { alert('No saved service history found to clear.'); return; }
    if (confirm('⚠️ Are you sure you want to clear all saved service history and notes?\n\nWould you like to export a backup file first before clearing?')) {
      Storage.exportData(); setTimeout(() => { if (confirm('Backup downloaded! Proceed with clearing all local data now?')) { localStorage.removeItem('prado_maintenance_db'); updateDropdown(); kmSelect.value=''; renderTasks(); alert('All local service data has been cleared.'); } }, 500);
    } else {
      if (confirm('⚠️ WARNING: You chose not to export a backup. Are you completely sure you want to permanently delete all local service data?')) { localStorage.removeItem('prado_maintenance_db'); updateDropdown(); kmSelect.value=''; renderTasks(); alert('All local service data has been cleared.'); }
    }
  });

  // Initialize
  updateDropdown();

  // Try to register service worker (simple)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW failed:', err));
    });
  }

})();
