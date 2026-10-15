// storage.js
const DB_KEY = 'prado_maintenance_db';

function safeReadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // run migrate and validate
    const migrated = migrateLegacyDB(parsed);
    if (!validateDB(migrated)) {
      console.warn('DB failed validation, returning empty object');
      return {};
    }
    return migrated;
  } catch (err) {
    console.error('Failed to read DB', err);
    return {};
  }
}

function safeWriteDB(data) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error('Unable to write to localStorage', err);
    alert('Unable to save your maintenance data. Please free up storage space or try again.');
    return false;
  }
}

function validateDB(db) {
  if (!db || typeof db !== 'object') return false;
  // km keys should be numbers (as strings) mapping to objects
  for (const key of Object.keys(db)) {
    if (key === '_meta') continue;
    const entry = db[key];
    if (typeof entry !== 'object') return false;
    if ('_meta' in entry && typeof entry._meta !== 'object') return false;
    if ('tasks' in entry && typeof entry.tasks !== 'object') return false;
    if (entry.tasks) {
      for (const tid of Object.keys(entry.tasks)) {
        const t = entry.tasks[tid];
        if (typeof t !== 'object') return false;
        if (!('checked' in t) || !('notes' in t)) return false;
      }
    }
  }
  return true;
}

function migrateLegacyDB(raw) {
  // If already in new format (has tasks under km), return as-is
  if (!raw || typeof raw !== 'object') return {};
  const migrated = {};
  for (const key of Object.keys(raw)) {
    const entry = raw[key];
    // legacy format check: entry has item names as keys (not tasks)
    if (entry && typeof entry === 'object' && !('tasks' in entry)) {
      migrated[key] = { _meta: entry._meta || { completed: false, date: '', actualKm: '', notes: '' }, tasks: {} };
      for (const field of Object.keys(entry)) {
        if (field === '_meta') continue;
        const v = entry[field];
        // try to generate a stable id from the item text
        const id = slugify(field);
        migrated[key].tasks[id] = { checked: !!(v && v.checked), notes: (v && v.notes) ? String(v.notes) : '' };
      }
    } else if (entry && typeof entry === 'object' && 'tasks' in entry) {
      migrated[key] = entry; // already new
    }
  }
  return migrated;
}

function slugify(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function exportData() {
  const db = localStorage.getItem(DB_KEY) || '{}';
  const blob = new Blob([db], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Prado_Service_Backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importDataFile(file, onSuccess, onError) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      const migrated = migrateLegacyDB(parsed);
      if (!validateDB(migrated)) {
        onError && onError('Imported file failed validation');
        return;
      }
      safeWriteDB(migrated);
      onSuccess && onSuccess();
    } catch (err) {
      onError && onError('Invalid JSON file');
    }
  };
  reader.readAsText(file);
}

window.StorageHelpers = {
  safeReadDB,
  safeWriteDB,
  validateDB,
  migrateLegacyDB,
  exportData,
  importDataFile,
};
