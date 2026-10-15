(function () {
  const STORAGE = window.MaintenanceStorage;
  const DB_KEY = STORAGE.STORAGE_KEY;

  const state = {
    selectedKm: "",
    includeAdditional: true,
    includeAnthony: true,
    bulkEditMode: false,
    db: {}
  };

  const elements = {};

  function initializeTheme() {
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const savedTheme = localStorage.getItem("prado-theme");
    const dark = savedTheme ? savedTheme === "dark" : prefersDark;

    document.body.classList.toggle("dark-mode", dark);
    const checkbox = document.getElementById("theme-toggle");
    if (checkbox) {
      checkbox.checked = dark;
    }
  }

  function saveTheme() {
    try {
      localStorage.setItem("prado-theme", document.body.classList.contains("dark-mode") ? "dark" : "light");
    } catch (err) {
      console.warn("Unable to save theme preference", err);
    }
  }

  function loadData() {
    const db = STORAGE.getDB();
    state.db = db || {};
  }

  function getDistinctKmValues() {
    return Object.keys(state.db)
      .map((key) => Number(key))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b)
      .map(String);
  }

  function renderDropdown() {
    const kmValues = getDistinctKmValues();
    const current = state.selectedKm || (kmValues.length ? kmValues[kmValues.length - 1] : "");

    elements.kmSelect.innerHTML = "";
    if (!kmValues.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "-- Tap to Select Interval --";
      elements.kmSelect.appendChild(option);
      state.selectedKm = "";
      return;
    }

    kmValues.forEach((km) => {
      const option = document.createElement("option");
      option.value = km;
      option.textContent = km + " km";
      if (km === current) option.selected = true;
      elements.kmSelect.appendChild(option);
    });

    state.selectedKm = current;
  }

  function getRuleMatches(km, includeAdditional, includeAnthony) {
    const matched = [];

    MAINTENANCE_RULES.forEach((rule) => {
      const serviceKm = Number(km);
      const isStandard = typeof rule.standard === 'number' && serviceKm % rule.standard === 0 && rule.standard > 0;
      const isAdditional = includeAdditional && typeof rule.additional === 'number' && serviceKm % rule.additional === 0 && rule.additional > 0;
      const isAnthony = !!rule.isAnthony && includeAnthony && ( (typeof rule.standard === 'number' && serviceKm % rule.standard === 0) || (typeof rule.additional === 'number' && serviceKm % rule.additional === 0) );

      if (rule.custom) {
        const customStandard = rule.custom(serviceKm, false);
        const customAdditional = includeAdditional && rule.custom(serviceKm, true);
        if (rule.isAnthony && includeAnthony) {
          if (customStandard || customAdditional) matched.push({ ...rule, matchType: 'anthony' });
        } else if (customStandard) matched.push({ ...rule, matchType: 'standard' });
        else if (customAdditional) matched.push({ ...rule, matchType: 'additional' });
      } else {
        if (isAnthony) matched.push({ ...rule, matchType: 'anthony' });
        else if (isStandard) matched.push({ ...rule, matchType: 'standard' });
        else if (isAdditional) matched.push({ ...rule, matchType: 'additional' });
      }
    });

    return matched;
  }

  function buildTaskCard(task, km, taskState) {
    const card = document.createElement("div");
    card.className = "task-card";

    const header = document.createElement("div");
    header.className = "task-header";

    const titleWrap = document.createElement("div");
    const title = document.createElement("div");
    title.className = "task-title";
    title.textContent = task.item;

    const summary = document.createElement("div");
    summary.className = "task-summary";
    summary.textContent = `${task.action} • ${task.category} • ${task.part}`;

    titleWrap.appendChild(title);
    titleWrap.appendChild(summary);

    const status = document.createElement("div");
    status.className = "task-check";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(taskState && taskState.checked);
    checkbox.addEventListener("change", () => {
      saveTaskState(km, task.id, "checked", checkbox.checked);
    });

    const label = document.createElement("label");
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode("Done"));
    status.appendChild(label);

    header.appendChild(titleWrap);
    header.appendChild(status);

    const noteWrap = document.createElement("div");
    noteWrap.className = "task-note";

    const textarea = document.createElement("textarea");
    textarea.placeholder = "Notes";
    textarea.value = taskState && typeof taskState.notes === "string" ? taskState.notes : "";
    textarea.addEventListener("input", () => {
      saveTaskState(km, task.id, "notes", textarea.value);
    });

    noteWrap.appendChild(textarea);
    card.appendChild(header);
    card.appendChild(noteWrap);

    return card;
  }

  function renderTasksForSelectedKm() {
    const container = elements.taskList;
    container.innerHTML = "";

    const km = state.selectedKm;
    if (!km) {
      container.innerHTML = "<p>No maintenance data available.</p>";
      return;
    }

    const rules = getRuleMatches(km, state.includeAdditional, state.includeAnthony);
    const entry = state.db[km] || STORAGE.createEmptyKmEntry();

    if (!state.db[km]) {
      state.db[km] = entry;
    }

    rules.forEach((rule) => {
      const taskState = entry.tasks && entry.tasks[rule.id] ? entry.tasks[rule.id] : { checked: false, notes: "" };
      if (!entry.tasks[rule.id]) {
        entry.tasks[rule.id] = taskState;
      }
      const card = buildTaskCard(rule, km, taskState);
      container.appendChild(card);
    });

    if (!rules.length) {
      const empty = document.createElement("p");
      empty.textContent = "No maintenance tasks match the selected interval.";
      container.appendChild(empty);
    }
  }

  function updateSelectedIntervalMeta() {
    const km = state.selectedKm;
    const container = document.getElementById("metaPanel");
    if (!container) return;

    const entry = state.db[km] || STORAGE.createEmptyKmEntry();

    container.innerHTML = "";

    const fields = [
      { label: "Completed", key: "completed", type: "checkbox" },
      { label: "Date", key: "date", type: "text" },
      { label: "Actual KM", key: "actualKm", type: "text" },
      { label: "Notes", key: "notes", type: "textarea" }
    ];

    fields.forEach((field) => {
      const block = document.createElement("div");
      block.className = "meta-field";

      const label = document.createElement("label");
      label.textContent = field.label;

      if (field.type === "checkbox") {
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = Boolean(entry._meta && entry._meta.completed);
        input.addEventListener("change", () => {
          if (!state.db[km]) state.db[km] = STORAGE.createEmptyKmEntry();
          state.db[km]._meta = state.db[km]._meta || {};
          state.db[km]._meta.completed = input.checked;
          saveCurrentDB();
        });
        block.appendChild(label);
        block.appendChild(input);
        return;
      }

      const input = field.type === "textarea"
        ? document.createElement("textarea")
        : document.createElement("input");

      if (field.type !== "textarea") {
        input.type = "text";
      }

      const value = entry._meta && entry._meta[field.key] ? entry._meta[field.key] : "";
      input.value = value;

      input.addEventListener("input", () => {
        if (!state.db[km]) state.db[km] = STORAGE.createEmptyKmEntry();
        state.db[km]._meta = state.db[km]._meta || {};
        state.db[km]._meta[field.key] = input.value;
        saveCurrentDB();
      });

      block.appendChild(label);
      block.appendChild(input);
      container.appendChild(block);
    });
  }

  function saveCurrentDB() {
    if (!STORAGE.saveDB(state.db)) {
      return;
    }
  }

  function saveTaskState(km, ruleId, field, value) {
    if (!state.db[km]) {
      state.db[km] = STORAGE.createEmptyKmEntry();
    }

    state.db[km].tasks = state.db[km].tasks || {};
    if (!state.db[km].tasks[ruleId]) {
      state.db[km].tasks[ruleId] = { checked: false, notes: "" };
    }

    state.db[km].tasks[ruleId][field] = value;
    saveCurrentDB();
  }

  function exportData() {
    const data = JSON.stringify(state.db, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "prado-maintenance-export.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importData(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
      try {
        const parsed = JSON.parse(event.target.result);

        if (!STORAGE.validateDB(parsed)) {
          alert("Import failed: invalid maintenance data format.");
          return;
        }

        state.db = parsed;
        saveCurrentDB();
        renderAll();
      } catch (error) {
        alert("Import failed: invalid JSON file.");
      }
    };
    reader.readAsText(file);
  }

  function clearAllData() {
    if (!window.confirm("Clear all maintenance data?")) {
      return;
    }

    localStorage.removeItem(DB_KEY);
    state.db = {};
    renderAll();
  }

  function bindEvents() {
    elements.kmSelect.addEventListener("change", (event) => {
      state.selectedKm = event.target.value;
      renderTasksForSelectedKm();
      updateSelectedIntervalMeta();
    });

    elements.includeAdditional.addEventListener("change", () => {
      state.includeAdditional = elements.includeAdditional.checked;
      renderTasksForSelectedKm();
    });

    elements.includeAnthony.addEventListener("change", () => {
      state.includeAnthony = elements.includeAnthony.checked;
      renderTasksForSelectedKm();
    });

    elements.exportBtn.addEventListener("click", exportData);
    elements.importBtn.addEventListener("click", () => {
      elements.importFileInput.click();
    });

    elements.importFileInput.addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) importData(file);
      event.target.value = "";
    });

    elements.clearDataBtn.addEventListener("click", clearAllData);

    const themeToggle = document.getElementById("theme-toggle");
    themeToggle.addEventListener("change", () => {
      document.body.classList.toggle("dark-mode", themeToggle.checked);
      saveTheme();
    });
  }

  function renderAll() {
    renderDropdown();
    renderTasksForSelectedKm();
    updateSelectedIntervalMeta();
    // refresh custom km modal if present
    if (window.refreshKmDropdown) window.refreshKmDropdown();
  }

  function init() {
    elements.kmSelect = document.getElementById("km-select");
    elements.includeAdditional = document.getElementById("additional-check");
    elements.includeAnthony = document.getElementById("anthony-check");
    elements.taskList = document.getElementById("results");
    elements.exportBtn = document.querySelector(".btn-export");
    elements.importBtn = document.querySelector(".btn-import");
    elements.importFileInput = document.getElementById("import-file");
    elements.clearDataBtn = document.querySelector(".btn-clear");

    initializeTheme();
    loadData();
    bindEvents();
    renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
