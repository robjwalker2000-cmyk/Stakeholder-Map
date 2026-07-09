// =========================
// FULL WORKING script.js
// (Owners+Stakeholders in one file + Save As + Delete stakeholder + PhotoURL after X,Y)
// =========================

// ---------- DOM ----------
const canvas = document.getElementById("canvas");
const svg = document.getElementById("lines");
const addBtn = document.getElementById("addStakeholder");
const linkBtn = document.getElementById("linkMode");
const resetBtn = document.getElementById("resetMap");
const relMenu = document.getElementById("relMenu");
const importOwnersBtn = document.getElementById("importOwners");
const csvHelp = document.getElementById("csvHelp");

// Import/Export dropdown menu
const importExportMenuBtn = document.getElementById("importExportMenuBtn");
const importExportMenu = document.getElementById("importExportMenu");
function hideImportExportMenu() {
  if (!importExportMenu) return;
  importExportMenu.classList.remove("show");
  importExportMenu.setAttribute("aria-hidden", "true");
}
if (importExportMenuBtn && importExportMenu) {
  importExportMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const willShow = !importExportMenu.classList.contains("show");
    importExportMenu.classList.toggle("show", willShow);
    importExportMenu.setAttribute("aria-hidden", String(!willShow));
  });
  importExportMenu.addEventListener("click", (e) => {
    if (e.target.closest("button")) hideImportExportMenu();
  });
}

// Stakeholder context menu (right-click)
const stakeMenu = document.getElementById("stakeMenu");
let selectedStakeholderForMenu = null;

// Hovercard
const hovercard = document.getElementById("hovercard");
const hcAvatar = document.getElementById("hcAvatar");
const hcName = document.getElementById("hcName");
const hcTitle = document.getElementById("hcTitle");
const hcRoleDot = document.getElementById("hcRoleDot");
const hcOwnerDot = document.getElementById("hcOwnerDot");
const hcInfluenceDot = document.getElementById("hcInfluenceDot");
const hcContactDot = document.getElementById("hcContactDot");
const hcViewDot = document.getElementById("hcViewDot");
const hcRole = document.getElementById("hcRole");
const hcOwner = document.getElementById("hcOwner");
const hcInfluence = document.getElementById("hcInfluence");
const hcContact = document.getElementById("hcContact");
const hcView = document.getElementById("hcView");
const hcAdvice = document.getElementById("hcAdvice");
const hcReportsTo = document.getElementById("hcReportsTo");
const hcDirectReports = document.getElementById("hcDirectReports");
const toggleOwnersBtn = document.getElementById("toggleOwners");
const toggleLinkedInBtn = document.getElementById("toggleLinkedIn");
const ownersPanel = document.getElementById("ownersPanel");

if (toggleOwnersBtn && ownersPanel) {
  const saved = localStorage.getItem("ownersVisible");
  if (saved === "false") ownersPanel.classList.add("hidden");

  toggleOwnersBtn.onclick = () => {
    ownersPanel.classList.toggle("hidden");
    localStorage.setItem(
      "ownersVisible",
      !ownersPanel.classList.contains("hidden")
    );
  };
}

if (toggleOwnersBtn && ownersPanel) {
  toggleOwnersBtn.onclick = () => {
    ownersPanel.classList.toggle("hidden");
  };
}
// ---------- STATE ----------
let nextId = 1;
let zIndex = 1;
let relationshipMode = false;
let selectedManager = null;
let selectedConnectionStart = null;
let selectedRelationshipId = null;
let showLinkedInUrl = localStorage.getItem("showLinkedInUrl") === "true";
const multiSelected = new Set();

function toggleMultiSelect(el) {
  if (multiSelected.has(el)) {
    multiSelected.delete(el);
    el.classList.remove("multi-selected");
  } else {
    multiSelected.add(el);
    el.classList.add("multi-selected");
  }
}

function clearMultiSelect() {
  multiSelected.forEach((el) => el.classList.remove("multi-selected"));
  multiSelected.clear();
}
const GRID = 20;
const relationships = [];
const AUTOSAVE_KEY = "stakeholderMapAutosave:v1";
let autosaveTimer = null;
let isRestoringAutosave = false;

// ---------- MAPS ----------
const maps = {
  role: { S: "Stakeholder", I: "Influencer", F: "Finance", D: "Decision Maker", C: "Coach",T:"Team Member" },
  influence: { H: "High Influence", M: "Medium Influence", L: "Low Influence" },
  view: { "+": "Positive View", 0: "Neutral View", "-": "Negative View" },
  contact: { H: "High Contact", M: "Medium Contact", L: "Low Contact", N: "No Contact" },
  owner: { HA: "HA", RW: "RW", RS: "RS" }
};

// Owner list used by the Owner status-box cycle
let OWNER_VALUES = ["HA", "RS", "RW"]; // default

// Which mode the CSV panel is in
let csvMode = "stakeholders"; // or "owners"

// ---------- Lazy loaders ----------
const LIB_URLS = {
  html2canvas: [
    "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"
  ],
  pptxgen: [
    "https://cdn.jsdelivr.net/npm/pptxgenjs/dist/pptxgen.bundle.js",
    "https://unpkg.com/pptxgenjs@3.13.0/dist/pptxgen.bundle.js"
  ]
};

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
async function loadFirstAvailable(urls) {
  let lastError;
  for (const url of urls) {
    try {
      await loadScript(url);
      return true;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
async function ensureHtml2Canvas() {
  if (window.html2canvas) return true;
  await loadFirstAvailable(LIB_URLS.html2canvas);
  return !!window.html2canvas;
}
async function ensurePptxGen() {
  if (window.PptxGenJS) return true;
  await loadFirstAvailable(LIB_URLS.pptxgen);
  return !!window.PptxGenJS;
}

// ---------- UTILS ----------
function snap(v) {
  return Math.round(v / GRID) * GRID;
}
function isValidLinkedIn(url) {
  try {
    return new URL(url).hostname.includes("linkedin.com");
  } catch {
    return false;
  }
}
function getStatus(el, type) {
  const b = el.querySelector(`.status-box[data-type="${type}"]`);
  return b ? b.textContent : "";
}
function colorClass(type, val) {
  // ✅ Special case: Role T (Team Member) should be white
  if (type === "role" && val === "T") return "white";

  // Default behaviour
  if (type === "role") return "green";

  // ✅ Optional: if you want Owner "-" to be white too (you asked this earlier)
  if (type === "owner" && val === "") return "white";
  if (type === "owner") return "green";

  if (type === "influence") return val === "H" ? "green" : val === "M" ? "amber" : "red";
  if (type === "view") return val === "+" ? "green" : val === "0" ? "amber" : "red";
  if (type === "contact") return val === "H" ? "green" : val === "M" ? "amber" : "red";
  return "amber";
}
function advice(v) {
  if (v === "+") return "Suggested: leverage support and advocacy.";
  if (v === "0") return "Suggested: keep engaged and share progress.";
  if (v === "-") return "Suggested: address objections early.";
  return "";
}
function escapeHtml(str) {
  return (str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getLinkedInValue(el) {
  const field = el.querySelector(".linkedinInput");
  const display = el.querySelector(".linkedinDisplay");
  const value = field?.value || display?.href || el.dataset.linkedin || "";
  return value.trim();
}

function attachLinkedInInputHandlers(el, input) {
  input.oninput = () => {
    el.dataset.linkedin = input.value.trim();
    scheduleAutosave();
  };

  input.onchange = () => {
    el.dataset.linkedin = input.value.trim();
    renderLinkedInField(el);
    scheduleAutosave();
  };
}

function renderLinkedInField(el) {
  const meta = el.querySelector(".meta");
  if (!meta) return;

  const url = getLinkedInValue(el);
  el.dataset.linkedin = url;

  const existing = meta.querySelector(".linkedinInput, .linkedinDisplay");
  if (showLinkedInUrl && isValidLinkedIn(url)) {
    const link = document.createElement("a");
    link.className = "linkedinDisplay";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = url;
    link.title = url;
    link.onclick = (e) => e.stopPropagation();
    link.onmousedown = (e) => e.stopPropagation();
    if (existing) existing.replaceWith(link);
    else meta.appendChild(link);
    return;
  }

  const input = document.createElement("input");
  input.className = "linkedinInput";
  input.placeholder = url ? "LinkedIn URL saved" : "LinkedIn URL";
  input.value = showLinkedInUrl ? url : "";
  attachLinkedInInputHandlers(el, input);
  if (existing) existing.replaceWith(input);
  else meta.appendChild(input);
}

function updateLinkedInToggleButton() {
  if (!toggleLinkedInBtn) return;
  toggleLinkedInBtn.style.background = showLinkedInUrl ? "#22c55e" : "";
}

function updateLinkedInVisibility() {
  updateLinkedInToggleButton();
  canvas.querySelectorAll(".stakeholder").forEach((el) => renderLinkedInField(el));
}

function collectMapState() {
  return {
    version: 1,
    nextId,
    zIndex,
    showLinkedInUrl,
    owners: getOwnersModel(),
    stakeholders: [...canvas.querySelectorAll(".stakeholder")].map((el) => ({
      id: el.dataset.id,
      csvId: getCardExportId(el),
      x: parseInt(el.style.left || "0", 10),
      y: parseInt(el.style.top || "0", 10),
      zIndex: parseInt(el.style.zIndex || "1", 10),
      name: el.querySelector(".name")?.value || "",
      title: el.querySelector(".titleInput")?.value || "",
      linkedin: el.dataset.linkedin || getLinkedInValue(el),
      photoUrl: el.dataset.photo || el.querySelector(".photo img")?.src || "",
      role: getStatus(el, "role"),
      influence: getStatus(el, "influence"),
      view: getStatus(el, "view"),
      contact: getStatus(el, "contact"),
      owner: getStatus(el, "owner")
    })),
    relationships: relationships.map((rel) => ({
      managerId: rel.managerId,
      reportId: rel.reportId,
      managerAnchor: rel.managerAnchor || "bottom",
      reportAnchor: rel.reportAnchor || "top"
    }))
  };
}

function saveMapStateNow() {
  if (isRestoringAutosave) return;
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(collectMapState()));
  } catch (error) {
    console.warn("Map autosave failed.", error);
  }
}

function scheduleAutosave() {
  if (isRestoringAutosave) return;
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(saveMapStateNow, 250);
}

function clearAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = null;
  localStorage.removeItem(AUTOSAVE_KEY);
}

function restoreMapFromAutosave() {
  const raw = localStorage.getItem(AUTOSAVE_KEY);
  if (!raw) return false;

  let state;
  try {
    state = JSON.parse(raw);
  } catch {
    clearAutosave();
    return false;
  }

  if (!state || !Array.isArray(state.stakeholders)) return false;

  isRestoringAutosave = true;
  try {
    canvas.querySelectorAll(".stakeholder").forEach((e) => e.remove());
    svg.querySelectorAll(".relationship-line, .relationship-endpoint").forEach((node) => node.remove());
    relationships.length = 0;

    if (state.owners && typeof state.owners === "object") {
      ownersToModel(state.owners);
    }

    const idMap = {};
    state.stakeholders.forEach((item) => {
      const el = createStakeholderFromData({
        name: item.name,
        title: item.title,
        role: item.role,
        influence: item.influence,
        view: item.view,
        contact: item.contact,
        owner: item.owner,
        linkedin: item.linkedin,
        x: item.x,
        y: item.y,
        photoUrl: item.photoUrl,
        cardId: item.csvId
      });
      if (!el) return;
      if (item.id) {
        const oldId = el.dataset.id;
        el.dataset.id = String(item.id);
        idMap[oldId] = el.dataset.id;
      }
      if (Number.isFinite(Number(item.zIndex))) el.style.zIndex = String(item.zIndex);
    });

    nextId = Math.max(
      Number(state.nextId) || 1,
      ...[...canvas.querySelectorAll(".stakeholder")].map((el) => Number(el.dataset.id) + 1).filter(Number.isFinite)
    );
    zIndex = Math.max(Number(state.zIndex) || 1, nextId);
    showLinkedInUrl = !!state.showLinkedInUrl;
    updateLinkedInVisibility();

    (state.relationships || []).forEach((rel) => {
      const managerId = idMap[rel.managerId] || rel.managerId;
      const reportId = idMap[rel.reportId] || rel.reportId;
      if (!managerId || !reportId) return;
      addRelationship(managerId, reportId, rel.managerAnchor || "bottom", rel.reportAnchor || "top", { toggleExisting: false });
    });

    redraw();
    return true;
  } finally {
    isRestoringAutosave = false;
  }
}

// ---------- BUTTONS ----------
addBtn.onclick = () => {
  createStakeholder(40, 40);
  scheduleAutosave();
};

if (toggleLinkedInBtn) {
  updateLinkedInToggleButton();
  toggleLinkedInBtn.onclick = () => {
    showLinkedInUrl = !showLinkedInUrl;
    localStorage.setItem("showLinkedInUrl", String(showLinkedInUrl));
    updateLinkedInVisibility();
    scheduleAutosave();
  };
}

linkBtn.onclick = () => {
  relationshipMode = !relationshipMode;
  clearSelectedManager();
  linkBtn.style.background = relationshipMode ? "#22c55e" : "";
  hideHovercard();
  hideRelMenu();
  hideStakeMenu();
  updateRelationshipModeVisuals();
};

resetBtn.onclick = () => {
  if (!confirm("Reset stakeholder map?")) return;
  clearAll();
  clearAutosave();
};

// ---------- REL MENU ----------
function clearSelectedManager() {
  if (selectedManager) selectedManager.classList.remove("selecting");
  document.querySelectorAll(".connection-anchor.active").forEach((anchor) => {
    anchor.classList.remove("active");
  });
  selectedManager = null;
  selectedConnectionStart = null;
}

function getStakeholderNameById(id) {
  const el = document.querySelector(`.stakeholder[data-id="${id}"]`);
  return el?.querySelector(".name")?.value || "Unnamed";
}

function getReportsToNames(el) {
  const id = el.dataset.id;
  return relationships.filter((r) => r.reportId === id).map((r) => getStakeholderNameById(r.managerId));
}

function getDirectReportNames(el) {
  const id = el.dataset.id;
  return relationships.filter((r) => r.managerId === id).map((r) => getStakeholderNameById(r.reportId));
}

function deleteRelationshipById(id) {
  const index = relationships.findIndex((rel) => rel.id === id);
  if (index === -1) return;

  deleteRelationshipAt(index);
  hideRelMenu();
  updateLines();
  scheduleAutosave();
}

function deleteRelationshipAt(index) {
  const rel = relationships[index];
  [rel.line, rel.startHandle, rel.endHandle].forEach((node) => {
    if (node && node.parentNode) node.parentNode.removeChild(node);
  });
  relationships.splice(index, 1);
}

function showRelMenu(x, y, relId = selectedRelationshipId) {
  selectedRelationshipId = relId;
  const rel = relationships.find((item) => item.id === selectedRelationshipId);
  if (!rel) return;

  const managerName = getStakeholderNameById(rel.managerId);
  const reportName = getStakeholderNameById(rel.reportId);
  relMenu.innerHTML = `
    <button id="relDeleteBtn" type="button">🗑️ Delete connection</button>
    <div class="rel-menu-note">${escapeHtml(managerName)} → ${escapeHtml(reportName)}</div>
  `;

  const r = canvas.getBoundingClientRect();
  relMenu.style.left = x - r.left + canvas.scrollLeft + 10 + "px";
  relMenu.style.top = y - r.top + canvas.scrollTop + 10 + "px";
  relMenu.classList.add("show");

  relMenu.querySelector("#relDeleteBtn").onclick = (e) => {
    e.stopPropagation();
    deleteRelationshipById(selectedRelationshipId);
  };
}
function hideRelMenu() {
  relMenu.classList.remove("show");
  selectedRelationshipId = null;
}

// Stakeholder menu
function hideStakeMenu() {
  if (!stakeMenu) return;
  stakeMenu.classList.remove("show");
  selectedStakeholderForMenu = null;
}

// Global click: hide menus/cards when clicking outside
document.addEventListener("click", (e) => {
  const insideStake = e.target.closest(".stakeholder");
  const insideHover = e.target.closest("#hovercard");
  const insideRel = e.target.closest("#relMenu");
  const insideStakeMenu = e.target.closest("#stakeMenu");
  const insideImportExportMenu = e.target.closest(".menu-dropdown");

  if (!insideStake && !insideHover && !insideRel && !insideStakeMenu) {
    hideHovercard();
    hideRelMenu();
    hideStakeMenu();
  }
  if (!insideStake && multiSelected.size) clearMultiSelect();
  if (!insideImportExportMenu) hideImportExportMenu();
});

// ---------- CREATE STAKEHOLDER ----------
function createStakeholder(x, y) {
  const el = document.createElement("div");
  el.className = "stakeholder";
  el.dataset.id = String(nextId++);
  el.dataset.linkedin = "";
  el.dataset.photo = "";
  
  el.style.left = snap(x) + "px";
  el.style.top = snap(y) + "px";
  el.style.zIndex = zIndex++;

  el.innerHTML = `
    <div class="stakeholder-header">
      <div class="photo">
        <input type="file" hidden>
        <span class="initials">AB</span>
      </div>
      <div class="meta">
        <input class="name" placeholder="Name">
        <input class="titleInput" placeholder="Role / Title">
        <input class="linkedinInput" placeholder="LinkedIn URL">
      </div>
    </div>
    <div class="divider"></div>
    <div class="status-row">
      ${statusBox(["S", "I", "F", "D", "C","T"], "role", true)}
      ${statusBox(["H", "M", "L"], "influence", false)}
      ${statusBox(["+", "0", "-"], "view", false)}
      ${statusBox(["H", "M", "L", "N"], "contact", false)}
      ${statusBox([...OWNER_VALUES, ""], "owner", true)}
    </div>
    ${connectionAnchors()}
  `;

  enableDrag(el);
  enablePhotoUpload(el);
  enableStatus(el);
  enableLinkedIn(el);
  enableClick(el);
  enableRelationshipAnchors(el);
  enableStakeholderContextMenu(el);

  canvas.appendChild(el);
  updateRelationshipModeVisuals();
}

function statusBox(v, t, a) {
  return `<div class="status-box" data-values='${JSON.stringify(v)}' data-type="${t}" data-always-green="${a}"></div>`;
}

function connectionAnchors() {
  return `
    <button class="connection-anchor anchor-top hidden" type="button" data-anchor="top" aria-label="Top connection point"></button>
    <button class="connection-anchor anchor-right hidden" type="button" data-anchor="right" aria-label="Right connection point"></button>
    <button class="connection-anchor anchor-bottom hidden" type="button" data-anchor="bottom" aria-label="Bottom connection point"></button>
    <button class="connection-anchor anchor-left hidden" type="button" data-anchor="left" aria-label="Left connection point"></button>
  `;
}

// ---------- LINKEDIN ----------
function enableLinkedIn(el) {
  renderLinkedInField(el);
}

// ---------- DRAG ----------
function enableDrag(el) {
  let drag = false, ox = 0, oy = 0;
  let groupStart = null; // Map(cardEl -> {left, top}) when dragging a multi-selection
  let groupOriginX = 0, groupOriginY = 0;

  el.addEventListener("mousedown", (e) => {
    if (e.target.closest("input") || e.target.closest("a") || e.target.closest(".status-box") || e.target.closest(".connection-anchor")) return;
    if (e.shiftKey) return; // shift+click toggles selection instead of dragging
    drag = true;
    el.style.zIndex = zIndex++;

    if (multiSelected.has(el)) {
      groupOriginX = e.clientX;
      groupOriginY = e.clientY;
      groupStart = new Map();
      multiSelected.forEach((card) => {
        groupStart.set(card, { left: card.offsetLeft, top: card.offsetTop });
      });
    } else {
      groupStart = null;
      ox = e.clientX - el.offsetLeft;
      oy = e.clientY - el.offsetTop;
    }
  });

  document.addEventListener("mousemove", (e) => {
    if (!drag) return;
    if (groupStart) {
      const dx = e.clientX - groupOriginX;
      const dy = e.clientY - groupOriginY;
      groupStart.forEach((pos, card) => {
        card.style.left = snap(pos.left + dx) + "px";
        card.style.top = snap(pos.top + dy) + "px";
      });
    } else {
      el.style.left = snap(e.clientX - ox) + "px";
      el.style.top = snap(e.clientY - oy) + "px";
    }
    updateLines();
  });

  document.addEventListener("mouseup", () => {
    if (!drag) return;
    drag = false;
    groupStart = null;
    scheduleAutosave();
  });
}

// ---------- PHOTO (Upload by file click) ----------
function enablePhotoUpload(el) {
  const p = el.querySelector(".photo");
  const i = p.querySelector("input");
  const s = p.querySelector(".initials");
  const n = el.querySelector(".name");

  n.oninput = () => {
    const a = n.value.trim().split(" ");
    s.textContent = ((a[0]?.[0] || "") + (a[1]?.[0] || "")).toUpperCase();
    scheduleAutosave();
  };

  const titleInput = el.querySelector(".titleInput");
  if (titleInput) titleInput.oninput = scheduleAutosave;

  p.onclick = () => i.click();
  i.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") return;

      const img = document.createElement("img");
      img.src = dataUrl;
      el.dataset.photo = dataUrl;

      s?.remove();
      // clear any existing image
      p.querySelector("img")?.remove();
      p.appendChild(img);
      scheduleAutosave();
    };
    reader.readAsDataURL(file);
  };
}

// ---------- STATUS ----------
function enableStatus(el) {
  el.querySelectorAll(".status-box").forEach((b) => {
    let idx = -1;

    b.onclick = () => {
      if (relationshipMode) return;

      const vals = JSON.parse(b.dataset.values || "[]");
      if (!vals.length) return;

      // Sync idx to current displayed value on first interaction
      if (idx === -1) {
        const cur = vals.indexOf(b.textContent.trim());
        if (cur !== -1) idx = cur;
      }

      idx = (idx + 1) % vals.length;
      const v = vals[idx];

      b.textContent = v;

      // Special white cases
      if (
        (b.dataset.type === "role" && v === "T") ||
        (b.dataset.type === "owner" && v === "")
      ) {
        b.textContent = "";
        b.className = "status-box white";
        scheduleAutosave();
        return;
      }

      b.className =
        "status-box " +
        (b.dataset.alwaysGreen === "true"
          ? "green"
          : colorClass(b.dataset.type, v));
      scheduleAutosave();
    };
  });
}

// ---------- CLICK / HOVERCARD / LINKING ----------
function setConnectionStart(el, anchor) {
  clearSelectedManager();
  selectedManager = el;
  selectedConnectionStart = { el, anchor };
  el.classList.add("selecting");
  el.querySelector(`.connection-anchor[data-anchor="${anchor}"]`)?.classList.add("active");
}

function completeConnectionTo(el, anchor) {
  if (!selectedConnectionStart) {
    setConnectionStart(el, anchor);
    return;
  }

  if (selectedConnectionStart.el === el) {
    if (selectedConnectionStart.anchor === anchor) {
      clearSelectedManager();
      return;
    }

    setConnectionStart(el, anchor);
    return;
  }

  addRelationship(
    selectedConnectionStart.el.dataset.id,
    el.dataset.id,
    selectedConnectionStart.anchor,
    anchor
  );
  clearSelectedManager();
}

function enableRelationshipAnchors(el) {
  el.querySelectorAll(".connection-anchor").forEach((anchorBtn) => {
    anchorBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!relationshipMode) return;

      hideHovercard();
      hideRelMenu();
      hideStakeMenu();
      completeConnectionTo(el, anchorBtn.dataset.anchor || "bottom");
    };
  });
}

function enableClick(el) {
  el.addEventListener("click", (e) => {
    e.stopPropagation();

    // Hide stake menu if it is open
    hideStakeMenu();

    if (relationshipMode) {
      completeConnectionTo(el, selectedConnectionStart ? "top" : "bottom");
      return;
    }

    // Status boxes, photo, inputs and links handle their own clicks
    if (
      e.target.closest(".status-box") ||
      e.target.closest(".photo") ||
      e.target.closest("input") ||
      e.target.closest("a") ||
      e.target.closest(".connection-anchor")
    ) return;

    if (e.shiftKey) {
      toggleMultiSelect(el);
      return;
    }

    if (multiSelected.size) clearMultiSelect();

    updateHovercard(el);
    positionHovercard(el);
    showHovercard();
  });
}

// ---------- RELATIONSHIPS ----------
function addRelationship(m, r, managerAnchor = "bottom", reportAnchor = "top", options = {}) {
  const toggleExisting = options.toggleExisting !== false;
  const existingIndex = relationships.findIndex((x) =>
    x.managerId === m &&
    x.reportId === r &&
    (x.managerAnchor || "bottom") === managerAnchor &&
    (x.reportAnchor || "top") === reportAnchor
  );

  if (existingIndex !== -1) {
    if (!toggleExisting) return;
    deleteRelationshipAt(existingIndex);
    updateLines();
    scheduleAutosave();
    return;
  }

  relationships.push({
    id: "rel_" + Math.random(),
    managerId: m,
    reportId: r,
    managerAnchor,
    reportAnchor,
    line: null,
    startHandle: null,
    endHandle: null
  });
  redraw();
  scheduleAutosave();
}

function openRelationshipMenu(rel, event) {
  event.stopPropagation();
  selectedRelationshipId = rel.id;
  showRelMenu(event.clientX, event.clientY, rel.id);
}

function createRelationshipEndpoint(rel, position) {
  const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  c.setAttribute("r", "7");
  c.setAttribute("data-rel-id", rel.id);
  c.setAttribute("data-endpoint", position);
  c.classList.add("relationship-endpoint");
  if (!relationshipMode) c.classList.add("hidden");
  c.onclick = (e) => openRelationshipMenu(rel, e);
  return c;
}

function updateRelationshipModeVisuals() {
  canvas.classList.toggle("reporting-mode", relationshipMode);
  canvas.querySelectorAll(".connection-anchor").forEach((anchor) => {
    anchor.classList.toggle("hidden", !relationshipMode);
  });
  svg.querySelectorAll(".relationship-endpoint").forEach((handle) => {
    handle.classList.toggle("hidden", !relationshipMode);
  });
}

function getCardAnchorPoint(el, anchor) {
  const x = parseInt(el.style.left || "0", 10);
  const y = parseInt(el.style.top || "0", 10);
  const w = el.offsetWidth || 340;
  const h = el.offsetHeight || 160;

  if (anchor === "top") return { x: x + w / 2, y };
  if (anchor === "right") return { x: x + w, y: y + h / 2 };
  if (anchor === "left") return { x, y: y + h / 2 };
  return { x: x + w / 2, y: y + h };
}

function updateLineLayerSize() {
  let maxX = canvas.clientWidth;
  let maxY = canvas.clientHeight;

  canvas.querySelectorAll(".stakeholder").forEach((el) => {
    const x = parseInt(el.style.left || "0", 10);
    const y = parseInt(el.style.top || "0", 10);
    maxX = Math.max(maxX, x + el.offsetWidth + 80);
    maxY = Math.max(maxY, y + el.offsetHeight + 80);
  });

  svg.style.width = maxX + "px";
  svg.style.height = maxY + "px";
  svg.setAttribute("width", maxX);
  svg.setAttribute("height", maxY);
}

function redraw() {
  svg.querySelectorAll(".relationship-line, .relationship-endpoint").forEach((node) => node.remove());
  relationships.forEach((rel) => {
    const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
    l.setAttribute("stroke", "#111");
    l.setAttribute("stroke-width", "2");
    l.setAttribute("marker-end", "url(#arrow)");
    l.setAttribute("data-rel-id", rel.id);
    l.classList.add("relationship-line");
    l.onclick = (e) => openRelationshipMenu(rel, e);
    svg.appendChild(l);
    rel.line = l;

    rel.startHandle = createRelationshipEndpoint(rel, "manager");
    rel.endHandle = createRelationshipEndpoint(rel, "report");
    svg.appendChild(rel.startHandle);
    svg.appendChild(rel.endHandle);
  });
  updateLines();
}

function updateLines() {
  updateLineLayerSize();

  relationships.forEach((r) => {
    const m = document.querySelector(`.stakeholder[data-id="${r.managerId}"]`);
    const d = document.querySelector(`.stakeholder[data-id="${r.reportId}"]`);
    if (!m || !d) return;
    const start = getCardAnchorPoint(m, r.managerAnchor || "bottom");
    const end = getCardAnchorPoint(d, r.reportAnchor || "top");
    r.line.setAttribute("x1", start.x);
    r.line.setAttribute("y1", start.y);
    r.line.setAttribute("x2", end.x);
    r.line.setAttribute("y2", end.y);
    if (r.startHandle) {
      r.startHandle.setAttribute("cx", start.x);
      r.startHandle.setAttribute("cy", start.y);
    }
    if (r.endHandle) {
      r.endHandle.setAttribute("cx", end.x);
      r.endHandle.setAttribute("cy", end.y);
    }
  });
}

// ---------- HOVERCARD ----------
function showHovercard() {
  hovercard.classList.add("show");
}
function hideHovercard() {
  hovercard.classList.remove("show");
}

function setField(dot, text, type, val) {
  dot.className = "dot " + colorClass(type, val);
  text.textContent = val ? `${maps[type][val]} (${val})` : "—";
}

function updateHovercard(el) {
  const name = el.querySelector(".name").value || "Unnamed";
  const title = el.querySelector(".titleInput").value || "Role / Title";
  hcName.textContent = name;
  hcTitle.textContent = title;

  hcAvatar.innerHTML = "";
  const img = el.querySelector(".photo img");
  if (img) {
    const i = document.createElement("img");
    i.src = img.src;
    hcAvatar.appendChild(i);
  } else {
    hcAvatar.textContent = name[0] || "—";
  }

  setField(hcRoleDot, hcRole, "role", getStatus(el, "role"));
  setField(hcOwnerDot, hcOwner, "owner", getStatus(el, "owner"));
  setField(hcInfluenceDot, hcInfluence, "influence", getStatus(el, "influence"));
  setField(hcContactDot, hcContact, "contact", getStatus(el, "contact"));
  setField(hcViewDot, hcView, "view", getStatus(el, "view"));
  hcAdvice.textContent = advice(getStatus(el, "view"));

  hovercard.querySelectorAll(".hc-linkedin").forEach((n) => n.remove());
  if (el.dataset.linkedin) {
    const a = document.createElement("a");
    a.className = "hc-linkedin";
    a.href = el.dataset.linkedin;
    a.target = "_blank";
    a.innerHTML = `<img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" width="20">`;
    hovercard.querySelector(".hc-top").appendChild(a);
  }

  const reportsTo = getReportsToNames(el);
  const directReports = getDirectReportNames(el);
  hcReportsTo.textContent = reportsTo.length ? reportsTo.join(", ") : "—";
  hcDirectReports.textContent = directReports.length ? directReports.join(", ") : "—";
}

function positionHovercard(el) {
  const cr = canvas.getBoundingClientRect();
  const sr = el.getBoundingClientRect();
  hovercard.style.left = sr.right - cr.left + canvas.scrollLeft + 12 + "px";
  hovercard.style.top = sr.top - cr.top + canvas.scrollTop + "px";
}

// ---------- DELETE STAKEHOLDER ----------
function deleteStakeholder(el) {
  if (!el) return;

  const id = el.dataset.id;

  // Remove relationships that involve this stakeholder
  for (let i = relationships.length - 1; i >= 0; i--) {
    const r = relationships[i];
    if (r.managerId === id || r.reportId === id) {
      if (r.line && r.line.parentNode) r.line.parentNode.removeChild(r.line);
      relationships.splice(i, 1);
    }
  }

  multiSelected.delete(el);
  el.remove();
  redraw();

  hideHovercard();
  hideRelMenu();
  hideStakeMenu();
  scheduleAutosave();
}

function enableStakeholderContextMenu(el) {
  if (!stakeMenu) return;

  el.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();

    selectedStakeholderForMenu = el;

    const name = el.querySelector(".name")?.value || "this stakeholder";
    const hasPhoto = !!(el.dataset.photo && el.dataset.photo.trim());

    stakeMenu.innerHTML = `
      <button id="stakeSetPhotoBtn" style="width:100%; padding:8px 10px; cursor:pointer; text-align:left;">
        🖼️ Set photo URL…
      </button>

      <button id="stakeAdjustPhotoBtn" style="width:100%; padding:8px 10px; cursor:pointer; text-align:left; ${hasPhoto ? "" : "opacity:.5;"}">
        🎛️ Adjust photo…
      </button>

      <button id="stakeClearPhotoBtn" style="width:100%; padding:8px 10px; cursor:pointer; text-align:left; ${hasPhoto ? "" : "opacity:.5;"}">
        ❌ Clear photo
      </button>

      <div style="height:1px; background:rgba(0,0,0,0.12); margin:6px 0;"></div>

      <button id="stakeDeleteBtn" style="width:100%; padding:8px 10px; cursor:pointer; text-align:left;">
        🗑️ Delete stakeholder
      </button>
    `;

    const r = canvas.getBoundingClientRect();
    stakeMenu.style.left = e.clientX - r.left + canvas.scrollLeft + 10 + "px";
    stakeMenu.style.top  = e.clientY - r.top  + canvas.scrollTop  + 10 + "px";
    stakeMenu.classList.add("show");

    stakeMenu.querySelector("#stakeSetPhotoBtn").onclick = () => {
      const current = el.dataset.photo || "";
      const url = prompt(
        `Paste an image URL (https://...) or a data URL.\n\nCurrent:\n${current || "(none)"}`,
        current
      );
      if (url == null) return;

      const clean = url.trim();
      if (!clean) return;

      if (!isValidImageUrl(clean)) {
        alert("That doesn’t look like a valid URL. Please paste a full https:// image address.");
        return;
      }

      setStakeholderPhotoFromUrl(el, clean);
      hideStakeMenu();
    };

    stakeMenu.querySelector("#stakeAdjustPhotoBtn").onclick = () => {
      if (!hasPhoto) return;
      hideStakeMenu();
      openPhotoAdjust(el);
    };

    stakeMenu.querySelector("#stakeClearPhotoBtn").onclick = () => {
      if (!hasPhoto) return;
      clearStakeholderPhoto(el);
      hideStakeMenu();
    };

    stakeMenu.querySelector("#stakeDeleteBtn").onclick = () => {
      if (!confirm(`Delete ${name}? This will remove linked reporting lines too.`)) return;
      deleteStakeholder(el);
    };
  });
} // ✅ IMPORTANT: close function here
// ---------- OWNERS IMPORT ----------
function normalizeOwnerCode(code) {
  return String(code || "").trim().toUpperCase();
}

function refreshOwnerStatusValues() {
  document.querySelectorAll('.status-box[data-type="owner"]').forEach((box) => {
    box.dataset.values = JSON.stringify([...OWNER_VALUES, ""]);

    // If current selection isn't in new allowed list, clear it
    if (box.textContent && !OWNER_VALUES.includes(box.textContent)) {
      box.textContent = "";
      box.className = "status-box green";
    }
  });
}
// =====================
// OWNERS: persistent model + panel
// =====================
const OWNERS_STORAGE_KEY = "stakeholderMap.owners.v1";

//const ownersPanel = document.getElementById("ownersPanel");
const ownersList = document.getElementById("ownersList");
const ownersAddBtn = document.getElementById("ownersAddBtn");
const ownersImportBtn = document.getElementById("ownersImportBtn");
const ownersClearBtn = document.getElementById("ownersClearBtn");

// ---- core owner model ----
function ownersToModel(ownerMap) {
  // ownerMap: { CODE: "Label" }
  const codes = Object.keys(ownerMap || {}).map(c => normalizeOwnerCode(c)).filter(Boolean);
  const cleanMap = {};
  codes.forEach(c => cleanMap[c] = String(ownerMap[c] || c).trim() || c);

  OWNER_VALUES = codes;
  maps.owner = cleanMap;
  refreshOwnerStatusValues();
  renderOwnersPanel();
  saveOwnersToStorage();
  scheduleAutosave();
}

function getOwnersModel() {
  // returns { CODE: Label }
  const out = {};
  (OWNER_VALUES || []).forEach(code => {
    out[code] = (maps.owner && maps.owner[code]) ? maps.owner[code] : code;
  });
  return out;
}

function saveOwnersToStorage() {
  try {
    localStorage.setItem(OWNERS_STORAGE_KEY, JSON.stringify(getOwnersModel()));
  } catch {}
}

function loadOwnersFromStorage() {
  try {
    const raw = localStorage.getItem(OWNERS_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return false;
    ownersToModel(parsed);
    return true;
  } catch {
    return false;
  }
}
const ownersCloseBtn = document.getElementById("ownersClose");

function setOwnersVisible(visible) {
  if (!ownersPanel) return;
  ownersPanel.classList.toggle("hidden", !visible);
  localStorage.setItem("ownersVisible", String(visible));
}

if (toggleOwnersBtn && ownersPanel) {
  const saved = localStorage.getItem("ownersVisible");
  if (saved === "false") ownersPanel.classList.add("hidden");

  toggleOwnersBtn.onclick = () => {
    const visible = ownersPanel.classList.contains("hidden");
    setOwnersVisible(visible);
  };
}

if (ownersCloseBtn && ownersPanel) {
  ownersCloseBtn.onclick = () => setOwnersVisible(false);
}
// Call once on startup (after your defaults exist)
(function initOwnersPersistence() {
  const ok = loadOwnersFromStorage();
  if (!ok) {
    // seed storage with your current defaults
    saveOwnersToStorage();
    renderOwnersPanel();
  }
})();

// ---- panel UI ----
function renderOwnersPanel() {
  if (!ownersList) return;

  const model = getOwnersModel();
  const codes = Object.keys(model);

  ownersList.innerHTML = codes.map(code => {
    const label = model[code] || "";
    return `
      <div class="owner-row" data-code="${escapeHtml(code)}">
        <input class="owner-code" value="${escapeHtml(code)}" placeholder="Code (e.g. RW)" />
        <input class="owner-label" value="${escapeHtml(label)}" placeholder="Label (e.g. Rob Walker)" />
        <button class="owner-del" title="Delete owner">🗑️</button>
      </div>
    `;
  }).join("");

  // + add row at the bottom
  const addRow = document.createElement("div");
  addRow.className = "owner-add-row";
  addRow.innerHTML = `<button class="owner-add-btn" title="Add owner">+</button>`;
  addRow.querySelector(".owner-add-btn").addEventListener("click", () => {
    addRow.remove();
    const newRow = document.createElement("div");
    newRow.className = "owner-row owner-row--new";
    newRow.dataset.code = "";
    newRow.innerHTML = `
      <input class="owner-code" placeholder="Code" />
      <input class="owner-label" placeholder="Label" />
      <button class="owner-del" title="Delete owner">🗑️</button>
    `;
    ownersList.appendChild(newRow);
    ownersList.appendChild(addRow);
    const codeInput = newRow.querySelector(".owner-code");
    const labelInput = newRow.querySelector(".owner-label");
    codeInput.focus();

    function commitNewRow() {
      const code = normalizeOwnerCode(codeInput.value);
      if (!code) return;
      const label = String(labelInput.value || "").trim() || code;
      const current = getOwnersModel();
      current[code] = label;
      ownersToModel(current);
    }

    labelInput.addEventListener("blur", commitNewRow);

    newRow.querySelector(".owner-del").addEventListener("click", () => newRow.remove());
  });
  ownersList.appendChild(addRow);

  // wire events for existing rows
  ownersList.querySelectorAll(".owner-row").forEach(row => {
    const codeInput = row.querySelector(".owner-code");
    const labelInput = row.querySelector(".owner-label");
    const delBtn = row.querySelector(".owner-del");

    function commitRow() {
      const oldCode = row.dataset.code || "";
      const newCode = normalizeOwnerCode(codeInput.value);
      const newLabel = String(labelInput.value || "").trim() || newCode;

      if (!newCode) return;

      const current = getOwnersModel();

      if (oldCode && oldCode !== newCode) delete current[oldCode];

      current[newCode] = newLabel;

      ownersToModel(current);

      if (oldCode && oldCode !== newCode) {
        document.querySelectorAll('.status-box[data-type="owner"]').forEach(box => {
          if (box.textContent === oldCode) {
            box.textContent = newCode;
          }
        });
      }
    }

    codeInput.addEventListener("change", commitRow);
    labelInput.addEventListener("change", commitRow);

    delBtn.addEventListener("click", () => {
      const code = row.dataset.code;
      if (!code) return;
      const current = getOwnersModel();
      delete current[code];
      ownersToModel(current);
    });
  });
}

if (ownersImportBtn) {
  ownersImportBtn.onclick = () => {
    const txt = prompt(
      "Paste owners (one per line):\nRW=Rob Walker\nor OWNER:RW=Rob Walker\nor RW,Rob Walker",
      ""
    );
    if (txt == null) return;

    // accept both OWNER: and non-OWNER formats
    const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const imported = {};
    const errors = [];

    lines.forEach((raw, i) => {
      let line = raw.replace(/^OWNER\s*:\s*/i, "").trim();

      let code = "", label = "";
      if (line.includes("=")) {
        const parts = line.split("=");
        code = parts[0];
        label = parts.slice(1).join("=");
      } else if (line.includes(",")) {
        const parts = line.split(",");
        code = parts[0];
        label = parts.slice(1).join(",");
      } else {
        errors.push(`Line ${i + 1}: "${raw}"`);
        return;
      }

      code = normalizeOwnerCode(code);
      label = String(label || "").trim();

      if (!code || !label) {
        errors.push(`Line ${i + 1}: "${raw}"`);
        return;
      }
      imported[code] = label;
    });

    if (errors.length) {
      alert("Some lines could not be parsed:\n\n" + errors.slice(0, 20).join("\n"));
      return;
    }

    // merge into current model
    const current = getOwnersModel();
    Object.assign(current, imported);
    ownersToModel(current);
  };
}

if (ownersClearBtn) {
  ownersClearBtn.onclick = () => {
    if (!confirm("Clear all owners?")) return;
    ownersToModel({});
  };
}

// ---- IMPORTANT: make CSV import merge owner lines BEFORE parsing stakeholders ----
// Put this near the start of importCSV() for stakeholder mode:
function mergeOwnersFromCsvText(csvText) {
  // uses your existing parseOwnerLines() if present:
  if (typeof parseOwnerLines !== "function") return;

  const { ownerMap, errors } = parseOwnerLines(csvText);
  if (errors?.length) return;

  const incoming = ownerMap || {};
  const codes = Object.keys(incoming);
  if (!codes.length) return;

  const current = getOwnersModel();
  codes.forEach(c => {
    const code = normalizeOwnerCode(c);
    const label = String(incoming[c] || "").trim() || code;
    current[code] = label;
  });

  ownersToModel(current);
}
// ONLY parses lines beginning with OWNER:
function parseOwnerLines(text) {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("#") && /^OWNER\s*:/i.test(l));

  const ownerMap = {};
  const errors = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/^OWNER\s*:\s*/i, "").trim();

    let code = "";
    let label = "";

    if (line.includes("=")) {
      const parts = line.split("=");
      code = parts[0];
      label = parts.slice(1).join("=");
    } else if (line.includes(",")) {
      const parts = line.split(",");
      code = parts[0];
      label = parts.slice(1).join(",");
    } else {
      errors.push(`Line ${i + 1}: expected OWNER:CODE=Name or OWNER:CODE,Name (got "${raw}")`);
      continue;
    }

    code = normalizeOwnerCode(code);
    label = String(label || "").trim();

    if (!code) errors.push(`Line ${i + 1}: missing owner CODE (got "${raw}")`);
    if (!label) errors.push(`Line ${i + 1}: missing owner Name/Label (got "${raw}")`);

    if (code && label) ownerMap[code] = label;
  }

  return { ownerMap, errors };
}

function applyOwners(ownerMap) {
  const codes = Object.keys(ownerMap);
  if (!codes.length) return;

  OWNER_VALUES = codes;

  // update labels
  maps.owner = codes.reduce((acc, c) => {
    acc[c] = ownerMap[c];
    return acc;
  }, {});

  refreshOwnerStatusValues();
  scheduleAutosave();
}

// ---------- CLEAR ----------
function clearAll() {
  canvas.querySelectorAll(".stakeholder").forEach((e) => e.remove());
  svg.querySelectorAll(".relationship-line, .relationship-endpoint").forEach((node) => node.remove());
  relationships.length = 0;
  relationshipMode = false;
  multiSelected.clear();
  clearSelectedManager();
  linkBtn.style.background = "";
  hideHovercard();
  hideRelMenu();
  hideStakeMenu();
}

// ---------- CSV IMPORT DOM ----------
const csvPanel = document.getElementById("csvPanel");
const csvInput = document.getElementById("csvInput");
const csvClose = document.getElementById("csvClose");
const csvPreviewBtn = document.getElementById("csvPreview");
const csvImportBtn = document.getElementById("csvImport");
const csvPreviewOut = document.getElementById("csvPreviewOut");

function openCSVPanel(mode = "stakeholders", prefill = "") {
csvMode = mode;

csvPreviewOut.innerHTML = "";
// Always start blank unless explicitly given prefill text
csvInput.value = prefill ?? "";

  if (csvHelp) {
    if (csvMode === "owners") {
      csvHelp.innerHTML = `
        Owners import format (one per line):<br>
        <code>OWNER:HA=Helen A</code> or <code>OWNER:HA,Helen A</code><br>
        These codes become the allowed values in the Owner status box.
      `;
    } else {
      csvHelp.innerHTML = `
        Format: <code>Name,Title,Role,Influence,View,Contact,Owner,LinkedIn,X,Y,PhotoURL,CardID</code><br>
        Relationship rows: <code>RELATIONSHIP,FromCardID,FromAnchor,ToCardID,ToAnchor</code><br>
        Example: <code>Jane Smith,CIO,D,H,+,M,RW,https://linkedin.com/in/janesmith,60,60,https://example.com/jane.jpg,card-1</code><br>
        Example relationship: <code>RELATIONSHIP,card-1,bottom,card-2,top</code><br>
        (Owners can be included in the same file using <code>OWNER:XX=Name</code> lines above the stakeholders.)
      `;
    }
  }

  csvPanel.classList.add("show");
  csvPanel.setAttribute("aria-hidden", "false");
  csvInput.focus();
}

function closeCSVPanel() {
  csvPanel.classList.remove("show");
  csvPanel.setAttribute("aria-hidden", "true");
}

csvClose.onclick = closeCSVPanel;
csvPanel.addEventListener("click", (e) => {
  if (e.target === csvPanel) closeCSVPanel();
});

// ---------- SET A SPECIFIC STATUS VALUE ----------
function setStatus(stakeholderEl, type, value) {
  const box = stakeholderEl.querySelector(`.status-box[data-type="${type}"]`);
  if (!box) return;

  const vals = JSON.parse(box.dataset.values || "[]");
  if (!vals.length) return;

  const v = String(value ?? "").trim().toUpperCase();
  const idx = vals.indexOf(v);
  if (idx === -1) return;

  box.textContent = v;

  // ✅ Force white for special values (works for import + manual set)
  if ((type === "role" && v === "T") || (type === "owner" && v === "")) {
    box.textContent = "";
    box.className = "status-box white";
    return;
  }

  // otherwise keep existing behaviour
  box.className =
    "status-box " +
    (box.dataset.alwaysGreen === "true"
      ? "green"
      : colorClass(type, v));
}

// ---------- CREATE STAKEHOLDER FROM DATA ----------
function createStakeholderFromData(data) {
  createStakeholder(data.x ?? 40, data.y ?? 40);

  const el = canvas.querySelector(".stakeholder:last-of-type");
  if (!el) return;
  el.dataset.csvId = data.cardId || `card-${el.dataset.id}`;

  const nameInput = el.querySelector(".name");
  const titleInput = el.querySelector(".titleInput");

  nameInput.oninput = () => {
    const initials = el.querySelector(".initials");
    if (initials) {
      const a = nameInput.value.trim().split(" ");
      initials.textContent = ((a[0]?.[0] || "") + (a[1]?.[0] || "")).toUpperCase();
    }
    scheduleAutosave();
  };

  titleInput.oninput = scheduleAutosave;

  nameInput.value = data.name ?? "";
  titleInput.value = data.title ?? "";

  // update initials
  nameInput.dispatchEvent(new Event("input"));

  // LinkedIn (your enableLinkedIn removes input if valid)
  if (data.linkedin) {
    const li = el.querySelector(".linkedinInput");
    if (li) {
      li.value = data.linkedin;
      li.dispatchEvent(new Event("change"));
    } else {
      el.dataset.linkedin = data.linkedin;
    }
  }

  // PhotoURL (after X,Y in CSV)
  if (data.photoUrl) {
    const photoDiv = el.querySelector(".photo");
    const initials = photoDiv.querySelector(".initials");
    const oldImg = photoDiv.querySelector("img");

    const img = document.createElement("img");
    img.src = data.photoUrl;
    img.crossOrigin = "anonymous"; // helps some exporters

    initials?.remove();
    oldImg?.remove();
    photoDiv.appendChild(img);
    el.dataset.photo = data.photoUrl;
  }

  // statuses
  if (data.role) setStatus(el, "role", data.role);
  if (data.influence) setStatus(el, "influence", data.influence);
  if (data.view) setStatus(el, "view", data.view);
  if (data.contact) setStatus(el, "contact", data.contact);
  if (data.owner) setStatus(el, "owner", data.owner);

  updateLines();
  return el;
}

// ---------- CSV PARSE (Stakeholders) ----------
// ---------- CSV PARSE (Stakeholders) ----------
function parseCSVLines(text) {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l =>
      l &&
      !l.startsWith("#") &&
      !/^OWNER\s*:/i.test(l) &&               // ignore OWNER lines here
      !/^RELATIONSHIP\s*,/i.test(l) &&        // ignore relationship lines here
      !/^Name\s*,\s*Title\s*,/i.test(l)       // ignore header row
    );

  return lines.map((line, idx) => {
    const cols = splitCSVLine(line);

    // Name,Title,Role,Influence,View,Contact,Owner,LinkedIn,X,Y,PhotoURL,CardID
    const [
      name,
      title,
      roleRaw,
      influenceRaw,
      viewRaw,
      contactRaw,
      ownerRaw,
      linkedin = "",
      xRaw = "",
      yRaw = "",
      photoUrl = "",
      cardId = ""
    ] = cols;

    // ---- normalise codes ----
    const role = String(roleRaw || "").trim().toUpperCase();
    const influence = String(influenceRaw || "").trim().toUpperCase();
    const view = String(viewRaw || "").trim(); // keep + 0 - as-is
    const contact = String(contactRaw || "").trim().toUpperCase();
    const owner = String(ownerRaw || "").trim().toUpperCase();

    const errors = [];
    if (!name) errors.push("Missing name");
    if (!title) errors.push("Missing title");

    // ✅ allow T
    const okRole = !role || ["S","I","F","D","C","T"].includes(role);
    const okInf  = !influence || ["H","M","L"].includes(influence);
    const okView = !view || ["+","0","-"].includes(view);
    const okCon  = !contact || ["H","M","L","N"].includes(contact);
    const okOwn  = !owner || OWNER_VALUES.includes(owner);

    if (!okRole) errors.push(`Role must be S/I/F/D/C/T (got ${roleRaw})`);
    if (!okInf)  errors.push(`Influence must be H/M/L (got ${influenceRaw})`);
    if (!okView) errors.push(`View must be +/0/- (got ${viewRaw})`);
    if (!okCon)  errors.push(`Contact must be H/M/L/N (got ${contactRaw})`);
    if (!okOwn)  errors.push(`Owner must be one of: ${OWNER_VALUES.join("/")} (got ${ownerRaw})`);

    const x = xRaw !== "" ? Number(xRaw) : null;
    const y = yRaw !== "" ? Number(yRaw) : null;
    if (xRaw !== "" && Number.isNaN(x)) errors.push(`X not a number (got ${xRaw})`);
    if (yRaw !== "" && Number.isNaN(y)) errors.push(`Y not a number (got ${yRaw})`);

    return {
      lineNo: idx + 1,
      raw: line,
      data: { name, title, role, influence, view, contact, owner, linkedin, x, y, photoUrl, cardId },
      errors
    };
  });
}

function parseRelationshipLines(text) {
  const validAnchors = ["top", "right", "bottom", "left"];
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l =>
      l &&
      !l.startsWith("#") &&
      /^RELATIONSHIP\s*,/i.test(l)
      && !/^RELATIONSHIP\s*,\s*FromCardID\s*,/i.test(l)
    );

  return lines.map((line, idx) => {
    const cols = splitCSVLine(line);
    const [, fromCardId = "", fromAnchorRaw = "", toCardId = "", toAnchorRaw = ""] = cols;
    const fromAnchor = String(fromAnchorRaw || "").trim().toLowerCase();
    const toAnchor = String(toAnchorRaw || "").trim().toLowerCase();
    const errors = [];

    if (!fromCardId) errors.push("Missing from CardID");
    if (!toCardId) errors.push("Missing to CardID");
    if (!validAnchors.includes(fromAnchor)) errors.push(`Start anchor must be ${validAnchors.join("/")}`);
    if (!validAnchors.includes(toAnchor)) errors.push(`End anchor must be ${validAnchors.join("/")}`);

    return {
      lineNo: idx + 1,
      raw: line,
      data: { fromCardId, fromAnchor, toCardId, toAnchor },
      errors
    };
  });
}

function findStakeholderByCsvId(cardId) {
  return [...canvas.querySelectorAll(".stakeholder")]
    .find((el) => el.dataset.csvId === cardId || el.dataset.id === cardId);
}

function importRelationshipsFromCSV(text) {
  const parsed = parseRelationshipLines(text);
  const good = parsed.filter(p => p.errors.length === 0);

  good.forEach((p) => {
    const d = p.data;
    const from = findStakeholderByCsvId(d.fromCardId);
    const to = findStakeholderByCsvId(d.toCardId);
    if (!from || !to) return;
    addRelationship(from.dataset.id, to.dataset.id, d.fromAnchor, d.toAnchor, { toggleExisting: false });
  });

  return {
    imported: good.length,
    errors: parsed.filter(p => p.errors.length > 0)
  };
}

// ---------- CSV PREVIEW ----------
function previewCSV() {
  if (csvMode === "owners") {
    const { ownerMap, errors } = parseOwnerLines(csvInput.value);

    const codes = Object.keys(ownerMap);
    if (!codes.length && !errors.length) {
      csvPreviewOut.innerHTML = `<div class="bad">Nothing to import.</div>`;
      return;
    }

    const ok = codes.length;
    const bad = errors.length;

    const rows = [
      `<div><b>${ok}</b> valid, <b>${bad}</b> invalid</div><br>`,
      ...codes.slice(0, 50).map(c => `<div><span class="ok">✓</span> ${c} = ${escapeHtml(ownerMap[c])}</div>`),
      ...(bad ? [`<br>`, ...errors.slice(0, 50).map(e => `<div><span class="bad">✗</span> ${escapeHtml(e)}</div>`)] : [])
    ].join("");

    csvPreviewOut.innerHTML = rows;
    return;
  }
  // ✅ If the text includes OWNER: lines, apply them  BEFORE validating stakeholders
  const { ownerMap, errors: ownerErrors } =       parseOwnerLines(csvInput.value);
if (ownerErrors.length === 0 && Object.keys(ownerMap).length) {
  applyOwners(ownerMap);
}
  const parsed = parseCSVLines(csvInput.value);
  const relationshipParsed = parseRelationshipLines(csvInput.value);

  if (!parsed.length) {
    csvPreviewOut.innerHTML = `<div class="bad">Nothing to import.</div>`;
    return;
  }

  const okCount = parsed.filter(p => p.errors.length === 0).length;
  const badCount = parsed.length - okCount;
  const relOkCount = relationshipParsed.filter(p => p.errors.length === 0).length;
  const relBadCount = relationshipParsed.length - relOkCount;

  const rows = parsed.slice(0, 50).map(p => {
    if (p.errors.length) {
      return `<div><span class="bad">Line ${p.lineNo} ✗</span> — ${p.errors.join("; ")}<br><code>${escapeHtml(p.raw)}</code></div>`;
    }
    const d = p.data;
    return `<div><span class="ok">Line ${p.lineNo} ✓</span> — ${escapeHtml(d.name)} (${escapeHtml(d.title)})</div>`;
  }).join("");

  csvPreviewOut.innerHTML =
    `<div><b>${okCount}</b> stakeholders valid, <b>${badCount}</b> invalid. ` +
    `<b>${relOkCount}</b> relationships valid, <b>${relBadCount}</b> invalid (showing up to 50 stakeholder lines)</div><br>` + rows;
}

// ---------- CSV IMPORT ----------
function importCSV() {
  if (csvMode === "owners") {
    const { ownerMap, errors } = parseOwnerLines(csvInput.value);

    if (errors.length) { previewCSV(); return; }
    if (!Object.keys(ownerMap).length) {
      csvPreviewOut.innerHTML = `<div class="bad">Nothing to import.</div>`;
      return;
    }

    applyOwners(ownerMap);
    closeCSVPanel();
    return;
  }
  
  // If the pasted file also contains OWNER: lines, apply them first
  const { ownerMap, errors: ownerErrors } = parseOwnerLines(csvInput.value);
  if (ownerErrors.length === 0 && Object.keys(ownerMap).length) {
    applyOwners(ownerMap);
  }
  mergeOwnersFromCsvText(csvInput.value);
  const parsed = parseCSVLines(csvInput.value);
  const good = parsed.filter(p => p.errors.length === 0);
  const IMPORT_COLS = 6;     // cards per row
  const IMPORT_START_X = 60;
  const IMPORT_START_Y = 60;
  const IMPORT_STEP_X = 380; // card width (~340) + spacing
  const IMPORT_STEP_Y = 180; // card height + spacing
  if (!good.length) { previewCSV(); return; }

 let gridIndex = 0;

good.forEach((p) => {
  const d = p.data;

  let useX, useY;

  // If coordinates exist → use them
  if (d.x != null && d.y != null) {
    useX = d.x;
    useY = d.y;
  } else {
    // Auto-grid layout
    const col = gridIndex % IMPORT_COLS;
    const row = Math.floor(gridIndex / IMPORT_COLS);

    useX = IMPORT_START_X + col * IMPORT_STEP_X;
    useY = IMPORT_START_Y + row * IMPORT_STEP_Y;

    gridIndex++;
  }

  createStakeholderFromData({
    name: d.name,
    title: d.title,
    role: d.role,
    influence: d.influence,
    view: d.view,
    contact: d.contact,
    owner: d.owner,
    linkedin: d.linkedin,
    x: useX,
    y: useY,
    photoUrl: d.photoUrl,
    cardId: d.cardId
  });
});

  importRelationshipsFromCSV(csvInput.value);
  redraw();
  scheduleAutosave();
  closeCSVPanel();
}

// wire buttons
csvPreviewBtn.onclick = previewCSV;
csvImportBtn.onclick = importCSV;

// Keyboard shortcut (Ctrl/Cmd+I to open)
document.addEventListener("keydown", (e) => {
  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const mod = isMac ? e.metaKey : e.ctrlKey;
  if (mod && e.key.toLowerCase() === "i") {
    e.preventDefault();
    openCSVPanel();
  }
});

document.getElementById("importCSV").onclick = () => openCSVPanel("stakeholders");

if (importOwnersBtn) {
  importOwnersBtn.onclick = () => {
    hideHovercard();
    hideRelMenu();
    hideStakeMenu();
    openCSVPanel("owners");
  };
}

// ---------- CSV EXPORT DOM ----------
const exportCSVBtn = document.getElementById("exportCSV");

const csvExportPanel = document.getElementById("csvExportPanel");
const csvExportClose = document.getElementById("csvExportClose");
const csvExportGenerateBtn = document.getElementById("csvExportGenerate");
const csvExportCopyBtn = document.getElementById("csvExportCopy");
const csvExportDownloadBtn = document.getElementById("csvExportDownload");
const csvExportOut = document.getElementById("csvExportOut");

// Import from file input
const csvFileInput = document.getElementById("csvFileInput");
const browseCSVBtn = document.getElementById("browseCSV");

if (browseCSVBtn && csvFileInput) {
  browseCSVBtn.onclick = () => {
    csvFileInput.value = ""; // allow re-selecting same file
    csvFileInput.click();
  };
}

if (csvFileInput) {
  csvFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (evt) => {
      csvInput.value = evt.target.result;
      previewCSV();
      csvFileInput.value = ""; // reset after reading
    };

    reader.onerror = () => {
      alert("Could not read CSV file.");
      csvFileInput.value = ""; // reset on error
    };

    reader.readAsText(file);
  });
}

function openCSVExportPanel() {
  csvExportOut.value = "";
  csvExportPanel.classList.add("show");
  csvExportPanel.setAttribute("aria-hidden", "false");
  generateCSVExport(); // auto-generate
  csvExportOut.focus();
  csvExportOut.select();
}

function closeCSVExportPanel() {
  csvExportPanel.classList.remove("show");
  csvExportPanel.setAttribute("aria-hidden", "true");
}

exportCSVBtn.onclick = () => {
  hideHovercard();
  hideRelMenu();
  hideStakeMenu();
  openCSVExportPanel();
};

csvExportClose.onclick = closeCSVExportPanel;
csvExportPanel.addEventListener("click", (e) => {
  if (e.target === csvExportPanel) closeCSVExportPanel();
});

csvExportGenerateBtn.onclick = generateCSVExport;

csvExportCopyBtn.onclick = async () => {
  const text = csvExportOut.value || "";
  if (!text.trim()) return;
  try {
    await navigator.clipboard.writeText(text);
    csvExportCopyBtn.textContent = "✅ Copied";
    setTimeout(() => (csvExportCopyBtn.textContent = "📋 Copy"), 900);
  } catch {
    csvExportOut.focus();
    csvExportOut.select();
    document.execCommand("copy");
  }
};

// Download with “Save As…” where supported
csvExportDownloadBtn.onclick = async () => {
  const text = csvExportOut.value || "";
  if (!text.trim()) return;

  // Best UX (Chrome/Edge): real Save As dialog
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: "stakeholders.csv",
        types: [{ description: "CSV file", accept: { "text/csv": [".csv"] } }]
      });

      const writable = await handle.createWritable();
      await writable.write(new Blob([text], { type: "text/csv;charset=utf-8" }));
      await writable.close();
      return;
    } catch (err) {
      if (err?.name === "AbortError") return; // cancelled
      console.warn("Save picker failed, falling back:", err);
    }
  }

  // Fallback (Safari/Firefox): normal download (fixed filename)
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "stakeholders.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// ---------- CSV EXPORT GENERATION ----------
function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function splitCSVLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === "," && !inQ) { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }

  out.push(cur.trim());
  return out;
}

function getCardExportId(el) {
  if (!el.dataset.csvId) el.dataset.csvId = `card-${el.dataset.id}`;
  return el.dataset.csvId;
}

function generateCSVExport() {
  const rows = [];

  // Owners block
  rows.push("# Owners (one per line)");
  const ownerCodes = Object.keys(maps.owner || {});
  ownerCodes.forEach(code => {
    const label = maps.owner[code];
    if (code && label) rows.push(`OWNER:${code}=${label}`);
  });

  rows.push(""); // separator

  // Stakeholders block
  rows.push("# Stakeholders");
  rows.push(["Name","Title","Role","Influence","View","Contact","Owner","LinkedIn","X","Y","PhotoURL","CardID"].join(","));

  const stakeholders = [...canvas.querySelectorAll(".stakeholder")];

  stakeholders.forEach((el) => {
    const name = el.querySelector(".name")?.value ?? "";
    const title = el.querySelector(".titleInput")?.value ?? "";

    const role = getStatus(el, "role");
    const influence = getStatus(el, "influence");
    const view = getStatus(el, "view");
    const contact = getStatus(el, "contact");
    const owner = getStatus(el, "owner");

    const linkedin = el.dataset.linkedin || "";

    const x = parseInt(el.style.left || "0", 10);
    const y = parseInt(el.style.top || "0", 10);

    // photo URL or data URL
    const photoImg = el.querySelector(".photo img");
    const photoUrl = photoImg?.src || "";

    const row = [
      csvEscape(name),
      csvEscape(title),
      csvEscape(role),
      csvEscape(influence),
      csvEscape(view),
      csvEscape(contact),
      csvEscape(owner),
      csvEscape(linkedin),
      csvEscape(Number.isFinite(x) ? x : ""),
      csvEscape(Number.isFinite(y) ? y : ""),
      csvEscape(photoUrl),
      csvEscape(getCardExportId(el))
    ].join(",");

    rows.push(row);
  });

  rows.push("");
  rows.push("# Relationships");
  rows.push(["RELATIONSHIP","FromCardID","FromAnchor","ToCardID","ToAnchor"].join(","));

  relationships.forEach((rel) => {
    const from = document.querySelector(`.stakeholder[data-id="${rel.managerId}"]`);
    const to = document.querySelector(`.stakeholder[data-id="${rel.reportId}"]`);
    if (!from || !to) return;

    rows.push([
      "RELATIONSHIP",
      csvEscape(getCardExportId(from)),
      csvEscape(rel.managerAnchor || "bottom"),
      csvEscape(getCardExportId(to)),
      csvEscape(rel.reportAnchor || "top")
    ].join(","));
  });

  csvExportOut.value = rows.join("\n");
}
function toSlideX(x, bounds, scale, offsetX) { return (x - bounds.x) * scale + offsetX; }
function toSlideY(y, bounds, scale, offsetY) { return (y - bounds.y) * scale + offsetY; }
function toSlideW(w, scale) { return w * scale; }
function toSlideH(h, scale) { return h * scale; }

function hexFromStatus(type, val) {
  const c = colorClass(type, val);
  if (c === "green") return "22C55E";
  if (c === "amber") return "F59E0B";
  if (c === "red") return "EF4444";
  if (c === "white") return "FFFFFF";
  return "FFFFFF";
}
function textColorForFill(hex) { return hex === "FFFFFF" ? "111111" : "FFFFFF"; }

function computeInitials(name) {
  const parts = (name || "").trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

async function tryGetImageDataUrl(src) {
  if (!src) return null;
  if (/^data:/i.test(src)) return src;
  // blob: from file uploads can't be fetched reliably; skip
  if (/^blob:/i.test(src)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(src, { mode: "cors", signal: controller.signal });
    const blob = await res.blob();
    return await new Promise((r) => {
      const fr = new FileReader();
      fr.onloadend = () => r(fr.result);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function createCircularImageDataUrl(src, size = 256) {
  try {
    const img = await loadImageElement(src);
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = size;
    exportCanvas.height = size;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return null;

    const sourceSize = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const sx = ((img.naturalWidth || img.width) - sourceSize) / 2;
    const sy = ((img.naturalHeight || img.height) - sourceSize) / 2;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#f3f4f6";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, (size / 2) - 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, (size / 2) - 3, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, sx, sy, sourceSize, sourceSize, 0, 0, size, size);
    ctx.restore();

    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, (size / 2) - 3, 0, Math.PI * 2);
    ctx.stroke();

    return exportCanvas.toDataURL("image/png");
  } catch {
    return null;
  }
}
// ---------- EXPORT PPTX ----------
const exportPPTXBtn = document.getElementById("exportPPTX");
if (exportPPTXBtn) exportPPTXBtn.onclick = exportToPPTX;

const exportPPTXBetaBtn = document.getElementById("exportPPTXa");
if (exportPPTXBetaBtn) exportPPTXBetaBtn.onclick = exportToPPTXBeta;

function getNormalExportStakeholderById(id) {
  return canvas.querySelector(`.stakeholder[data-id="${id}"]`);
}

function getNormalExportAnchorPoint(el, anchor) {
  return getCardAnchorPoint(el, anchor);
}

function getNormalExportBounds(stakeholders) {
  const bounds = getStakeholderBounds(stakeholders);
  let minX = bounds.x;
  let minY = bounds.y;
  let maxX = bounds.x + bounds.w;
  let maxY = bounds.y + bounds.h;
  const points = [];

  relationships.forEach((rel) => {
    const manager = getNormalExportStakeholderById(rel.managerId);
    const report = getNormalExportStakeholderById(rel.reportId);
    if (!manager || !report) return;

    points.push(getNormalExportAnchorPoint(manager, rel.managerAnchor || "bottom"));
    points.push(getNormalExportAnchorPoint(report, rel.reportAnchor || "top"));
  });

  points.forEach((point) => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function syncClonedFormValues(source, clone) {
  const sourceInputs = [...source.querySelectorAll("input, textarea")];
  const cloneInputs = [...clone.querySelectorAll("input, textarea")];

  cloneInputs.forEach((input, i) => {
    const sourceInput = sourceInputs[i];
    if (!sourceInput) return;
    if (input.type === "file" || sourceInput.type === "file") return;
    input.value = sourceInput.value;
    input.setAttribute("value", sourceInput.value);
  });
}

function waitForSnapshotImages(root) {
  const images = [...root.querySelectorAll("img")];
  return Promise.all(images.map((img) => {
    // img.complete is true once loading has settled, whether it succeeded or
    // already failed — in the failure case onerror already fired and attaching
    // a new handler below would never resolve, hanging the export forever.
    if (img.complete) {
      if (img.naturalWidth === 0) img.remove();
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const done = () => resolve();
      img.onload = done;
      img.onerror = () => {
        img.remove();
        done();
      };
      // Safety net: never let one slow/hanging image block the whole export.
      setTimeout(done, 8000);
    });
  }));
}

function replaceSnapshotTextInputs(clone) {
  clone.querySelectorAll("input:not([type='file']), textarea").forEach((input) => {
    const field = document.createElement("div");
    field.className = `${input.className} snapshot-text-field`.trim();
    field.textContent = input.value || input.placeholder || "";
    field.style.width = "100%";
    field.style.minHeight = "22px";
    field.style.border = "1px solid rgba(0, 0, 0, 0.18)";
    field.style.borderRadius = "8px";
    field.style.padding = "3px 8px";
    field.style.fontSize = input.classList.contains("name") ? "13px" : "12px";
    field.style.fontWeight = input.classList.contains("name") ? "700" : "400";
    field.style.lineHeight = "16px";
    field.style.color = "#000";
    field.style.background = "#fff";
    field.style.display = "flex";
    field.style.alignItems = "center";
    field.style.overflow = "hidden";
    field.style.whiteSpace = "nowrap";
    field.style.textOverflow = "ellipsis";
    input.replaceWith(field);
  });
}

function syncClonedRelationshipLines(canvasClone) {
  const clonedLines = [...canvasClone.querySelectorAll(".relationship-line")];
  relationships.forEach((rel, i) => {
    const manager = canvasClone.querySelector(`.stakeholder[data-id="${rel.managerId}"]`);
    const report = canvasClone.querySelector(`.stakeholder[data-id="${rel.reportId}"]`);
    const line = canvasClone.querySelector(`.relationship-line[data-rel-id="${rel.id}"]`) || clonedLines[i];
    if (!manager || !report || !line) return;

    const start = getNormalExportAnchorPoint(manager, rel.managerAnchor || "bottom");
    const end = getNormalExportAnchorPoint(report, rel.reportAnchor || "top");
    line.setAttribute("x1", start.x);
    line.setAttribute("y1", start.y);
    line.setAttribute("x2", end.x);
    line.setAttribute("y2", end.y);
  });
}

function createNormalExportSurface(stakeholders, bounds) {
  const padding = 40;
  const surface = document.createElement("div");
  surface.style.position = "absolute";
  surface.style.left = "-100000px";
  surface.style.top = "0";
  surface.style.width = bounds.w + padding * 2 + "px";
  surface.style.height = bounds.h + padding * 2 + "px";
  surface.style.background = "#ffffff";
  surface.style.overflow = "hidden";

  const canvasClone = canvas.cloneNode(true);
  canvasClone.removeAttribute("id");
  canvasClone.style.position = "absolute";
  canvasClone.style.left = padding - bounds.x + "px";
  canvasClone.style.top = padding - bounds.y + "px";
  canvasClone.style.width = canvas.scrollWidth + "px";
  canvasClone.style.height = canvas.scrollHeight + "px";
  canvasClone.style.overflow = "visible";
  canvasClone.style.background = "#ffffff";

  const sourceStakeholders = [...canvas.querySelectorAll(".stakeholder")];
  const clonedStakeholders = [...canvasClone.querySelectorAll(".stakeholder")];
  clonedStakeholders.forEach((clone, i) => {
    const source = sourceStakeholders[i];
    if (!source) return;
    syncClonedFormValues(source, clone);
    clone.querySelectorAll('input[type="file"]').forEach((input) => input.remove());
    replaceSnapshotTextInputs(clone);
    clone.querySelectorAll(".connection-anchor").forEach((anchor) => anchor.remove());
    clone.classList.remove("selecting");
  });

  canvasClone.querySelectorAll(".relationship-endpoint, #hovercard, #relMenu, #stakeMenu").forEach((node) => node.remove());
  syncClonedRelationshipLines(canvasClone);
  surface.appendChild(canvasClone);
  document.body.appendChild(surface);
  return surface;
}

async function exportToPPTX() {
  try {
    await ensureHtml2Canvas();
  } catch (e) {
    console.error("Failed to load html2canvas:", e);
  }

  try {
    await ensurePptxGen();
  } catch (e) {
    console.error("Failed to load PptxGenJS:", e);
  }

  if (!window.html2canvas) {
    alert("html2canvas failed to load. Check the GitHub page script tags or CDN access.");
    return;
  }

  if (!window.PptxGenJS) {
    alert("PptxGenJS failed to load. Check the GitHub page script tags, or try unpkg/jsdelivr.");
    return;
  }

  try {
    const stakeholders = [...canvas.querySelectorAll(".stakeholder")];
    if (!stakeholders.length) {
      alert("No stakeholders on canvas.");
      return;
    }

    const bounds = getNormalExportBounds(stakeholders);
    const exportSurface = createNormalExportSurface(stakeholders, bounds);
    await waitForSnapshotImages(exportSurface);
    let shot;
    try {
      shot = await html2canvas(exportSurface, {
        backgroundColor: "#ffffff",
        scale: 3,
        useCORS: true,
        allowTaint: false,
        logging: false,
        onclone: (doc) => {
          doc.querySelectorAll("img").forEach(img => {
            const src = img.getAttribute("src") || "";
            // remove remote images if they might taint
            if (/^https?:\/\//i.test(src)) {
              // keep them if you trust your CORS setup; remove if you hit tainting
              // img.remove();
            }
          });
        }
      });
    } finally {
      exportSurface.remove();
    }

    let dataUrl;
    try {
      dataUrl = shot.toDataURL("image/png");
    } catch (e) {
      throw new Error(
        "Screenshot canvas could not be exported (often due to a cross-origin image). " +
        "Remove remote images/icons or use local/data-uri images. Details: " + (e?.message || e)
      );
    }

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";

    const slide = pptx.addSlide();
    // ---- Put CSV export into slide speaker notes ----
    generateCSVExport();                 // ensures latest map data
    const csvText = csvExportOut.value || "";
    const MAX_CHARS = 20000;
    slide.addNotes(csvText.slice(0, MAX_CHARS));
    
    const SLIDE_W = 13.333;
    const SLIDE_H = 7.5;
    const imgW = shot.width;
    const imgH = shot.height;
    const imgAspect = imgW / imgH;
    const slideAspect = SLIDE_W / SLIDE_H;

    let w, h, x, y;
    if (imgAspect > slideAspect) {
      w = SLIDE_W;
      h = w / imgAspect;
      x = 0;
      y = (SLIDE_H - h) / 2;
    } else {
      h = SLIDE_H;
      w = h * imgAspect;
      x = (SLIDE_W - w) / 2;
      y = 0;
    }

    slide.addImage({ data: dataUrl, x, y, w, h });

    const r = pptx.writeFile({ fileName: "stakeholder-map.pptx" });
    if (r && typeof r.then === "function") await r;

  } catch (err) {
    console.error("PPTX export failed:", err);
    alert("PowerPoint export failed:\n\n" + (err?.message || err));
  }
}

// ---------- EXPORT FULL HTML ----------
const exportFullHTMLBtn = document.getElementById("exportFullHTML");
if (exportFullHTMLBtn) exportFullHTMLBtn.onclick = exportToFullHTML;

// Bundled copy of style.css used when the page can't read its own stylesheet at
// export time (e.g. some browsers block CSSOM/fetch access to file:// resources).
const FALLBACK_STYLESHEET_CSS = `
:root {
  --green: #19c463;
  --yellow: #f2c230;
  --red: #ef4444;

  --ink: #111;
  --muted: #4b5563;
  --shadow: 0 10px 22px rgba(0, 0, 0, 0.12);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: #f4f6f8;
  color: var(--ink);
}

header {
  background: #1f2937;
  color: #fff;
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

header h1 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.brand-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.version-badge {
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 999px;
  padding: 2px 7px;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.2;
}

.controls button {
  margin-left: 6px;
  padding: 8px 10px;
  cursor: pointer;
}

#canvas {
  position: relative;
  height: calc(100vh - 56px);
  background: #ffffff;
  overflow: auto;
}

#lines {
  position: absolute;
  width: 100%;
  height: 100%;
  pointer-events: auto;
}

#lines line {
  pointer-events: stroke;
  cursor: pointer;
}

.relationship-endpoint {
  fill: #fff;
  stroke: #111;
  stroke-width: 2;
  cursor: pointer;
  pointer-events: all;
}

.relationship-endpoint:hover {
  fill: #fee2e2;
  stroke: #b91c1c;
}

.relationship-endpoint.hidden {
  display: none;
}

/* FIXED STAKEHOLDER CARD WIDTH */
.stakeholder {
  width: 340px !important;
  position: absolute;
  background: #fff;
  border: 2px solid #111;
  border-radius: 10px;
  box-shadow: var(--shadow);
  cursor: move;
  user-select: none;
  font-size: 14px;
}

.stakeholder.selecting {
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.28), var(--shadow);
}

.connection-anchor {
  position: absolute;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 2px solid #111;
  border-radius: 999px;
  background: #fff;
  cursor: crosshair;
  z-index: 5;
}

.connection-anchor:hover,
.connection-anchor.active {
  background: #22c55e;
  border-color: #14532d;
}

.connection-anchor.active {
  box-shadow: 0 0 0 5px rgba(34, 197, 94, 0.26);
}

.anchor-top {
  left: 50%;
  top: -10px;
  transform: translateX(-50%);
}

.anchor-right {
  right: -10px;
  top: 50%;
  transform: translateY(-50%);
}

.anchor-bottom {
  left: 50%;
  bottom: -10px;
  transform: translateX(-50%);
}

.anchor-left {
  left: -10px;
  top: 50%;
  transform: translateY(-50%);
}

.stakeholder-header {
  display: flex;
  gap: 10px;
  padding: 12px 12px 10px;
  align-items: center;
}

.photo {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #e9e7ff, #d7d4ff);
  border: 1px solid rgba(0, 0, 0, 0.12);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
}

.photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.meta {
  flex: 1;
  min-width: 0;
}

/* NAME TEXT BOLD */
.stakeholder-header input.name {
  font-weight: 700; /* Bold */
  color: #000;
}

/* OTHER INPUTS */
.stakeholder-header input {
  width: 100%;
  border: 1px solid rgba(0, 0, 0, 0.18);
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 13px;
  color: #000;
}

.titleInput,
.linkedinInput {
  color: var(--muted);
  font-size: 13px;
}

.linkedinDisplay {
  display: block;
  width: 100%;
  border: 1px solid rgba(0, 0, 0, 0.18);
  border-radius: 8px;
  padding: 6px 8px;
  background: #fff;
  color: #2563eb;
  font-size: 13px;
  line-height: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-decoration: none;
}

.linkedinDisplay:hover {
  text-decoration: underline;
}

/* Divider */
.divider {
  height: 1px;
  background: #111;
  opacity: 0.15;
}

/* Status row */
.status-row {
  display: flex;
  border-top: 1px solid rgba(0, 0, 0, 0.18);
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
}

.status-box {
  flex: 1;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  border-right: 1px solid #111;
  cursor: pointer;
}

.status-box:last-child {
  border-right: none;
}

.green {
  background: var(--green);
}
.amber {
  background: var(--yellow);
}
.red {
  background: var(--red);
}

/* Hovercard */
.hovercard {
  position: absolute;
  min-width: 320px;
  max-width: 380px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.18);
  border-radius: 12px;
  box-shadow: var(--shadow);
  padding: 12px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.14s ease;
  z-index: 9999;
}

.hovercard.show {
  opacity: 1;
  pointer-events: auto;
}

.hc-top {
  display: flex;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  margin-bottom: 10px;
  position: relative;
}

.hc-avatar {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: radial-gradient(circle at 30% 30%, #e9e7ff, #d7d4ff);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.12);
}

.hc-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hc-name {
  font-weight: 900;
  font-size: 15px;
}
.hc-title {
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
}

.hc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.hc-item {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 10px;
  padding: 8px;
  background: #fafafa;
}

.hc-wide {
  grid-column: 1 / -1;
}

.hc-label {
  font-size: 11px;
  color: var(--muted);
  font-weight: 800;
  text-transform: uppercase;
}

.hc-value {
  margin-top: 4px;
  font-weight: 900;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #e5e7eb;
  border: 1px solid rgba(0, 0, 0, 0.25);
}

.dot.green {
  background: var(--green);
}
.dot.amber {
  background: var(--yellow);
}
.dot.red {
  background: var(--red);
}

.hc-muted {
  margin-top: 6px;
  font-size: 12px;
  color: var(--muted);
}

.hc-rel {
  margin-top: 10px;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
  padding-top: 10px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.hc-rel-box {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 10px;
  padding: 8px;
  background: #fff;
}

.hc-rel-value {
  margin-top: 6px;
  font-weight: 700;
  font-size: 12px;
}
.status-box.white {
  background: #fff;
  color: #000;
  border: 1px solid #ccc;
}
/* LinkedIn Icon in hovercard - top right */
.hovercard .hc-linkedIn {
  position: absolute;
  top: 12px;
  right: 12px;
  cursor: pointer;
}
/* ---------- CSV Import Panel ---------- */
.csv-panel {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.csv-panel.show {
  display: flex;
}

.csv-panel-inner {
  width: min(900px, 92vw);
  max-height: 86vh;
  background: #fff;
  border-radius: 16px;
  box-shadow: var(--shadow);
  border: 1px solid rgba(0,0,0,0.15);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.csv-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.csv-title {
  font-weight: 900;
  font-size: 14px;
}

.csv-close {
  border: 1px solid rgba(0,0,0,0.18);
  background: #fff;
  border-radius: 10px;
  padding: 6px 10px;
  cursor: pointer;
}

.csv-help {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.4;
}

#csvInput {
  width: 100%;
  min-height: 220px;
  resize: vertical;
  border-radius: 12px;
  border: 1px solid rgba(0,0,0,0.18);
  padding: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 12px;
}

.csv-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.csv-actions button {
  padding: 8px 10px;
  cursor: pointer;
}

.csv-actions .primary {
  background: #22c55e;
  border: 1px solid rgba(0,0,0,0.18);
  border-radius: 10px;
  font-weight: 800;
}

.csv-preview {
  border-top: 1px solid rgba(0,0,0,0.12);
  padding-top: 10px;
  font-size: 12px;
  color: var(--ink);
  max-height: 200px;
  overflow: auto;
}

.csv-preview .bad {
  color: #b91c1c;
  font-weight: 800;
}

.csv-preview .ok {
  color: #065f46;
  font-weight: 800;
}
#csvExportOut {
  width: 100%;
  min-height: 260px;
  resize: vertical;
  border-radius: 12px;
  border: 1px solid rgba(0,0,0,0.18);
  padding: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 12px;
}
/* ---------- Context menus (relationships + stakeholders) ---------- */
.rel-menu{
  position: absolute;
  display: none;
  z-index: 11000;            /* above hovercard (9999) and safe vs panels */
  background: #fff;
  border: 1px solid rgba(0,0,0,0.18);
  border-radius: 12px;
  box-shadow: var(--shadow);
  padding: 6px;
  min-width: 200px;
}

.rel-menu.show{
  display: block;
}

.rel-menu button{
  width: 100%;
  padding: 8px 10px;
  background: #fff;
  border: 0;
  border-radius: 10px;
  text-align: left;
  cursor: pointer;
  font-weight: 700;
}

.rel-menu button:hover{
  background: #f3f4f6;
}

.rel-menu-note {
  max-width: 260px;
  padding: 4px 10px 6px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.3;
}

.owners-panel{
  position: fixed;
  left: 12px;
  bottom: 12px;
  width: 360px;
  max-height: 40vh;
  overflow: auto;
  background: #fff;
  border: 1px solid rgba(0,0,0,0.18);
  border-radius: 14px;
  box-shadow: var(--shadow);
  padding: 10px;
  z-index: 9999;
}

/* Owners panel header + close button */
.owners-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  margin-bottom:10px;
}

.owners-title{ font-weight: 900; }
.owners-actions{ display:flex; gap:6px; flex-wrap:wrap; }
.owners-actions button{ padding:6px 8px; cursor:pointer; }

#ownersPanel {
  position: relative; /* anchor for absolute button */
}
.owners-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  border: 1px solid rgba(0,0,0,0.18);
  background: #fff;
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
  z-index: 10;
}
.owners-list{
  display:flex;
  flex-direction:column;
  gap:8px;
}

.owner-row{
  display:grid;
  grid-template-columns: 70px 1fr auto;
  gap:8px;
  align-items:center;
}

.owner-row input{
  width: 100%;
  border: 1px solid rgba(0,0,0,0.18);
  border-radius: 10px;
  padding: 6px 8px;
}

.owner-row .owner-del{
  padding: 6px 8px;
  border-radius: 10px;
  cursor: pointer;
}

/* ---------- Photo adjust modal ---------- */
#photoAdjustModal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.55);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.photo-adjust-inner {
  background: #fff;
  border-radius: 18px;
  padding: 20px;
  width: 280px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.3);
}

.photo-adjust-title {
  margin: 0 0 14px;
  font-size: 15px;
  font-weight: 700;
}

.photo-adjust-clip {
  border-radius: 50%;
  overflow: hidden;
  position: relative;
  margin: 0 auto 14px;
  cursor: grab;
  background: #ddd;
  user-select: none;
}

.photo-adjust-img {
  position: absolute;
  pointer-events: none;
}

.photo-adjust-zoom-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.photo-adjust-slider {
  flex: 1;
}

.photo-adjust-zoom-label {
  font-size: 12px;
  width: 36px;
  text-align: right;
  color: var(--muted);
}

.photo-adjust-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.photo-adjust-actions button {
  padding: 8px 18px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
}

.photo-adjust-save {
  background: #2563eb;
  color: #fff;
  border: none;
}

.photo-adjust-cancel {
  background: #fff;
  border: 1px solid rgba(0,0,0,0.18);
}

.owner-add-row{
  display: flex;
  justify-content: center;
  padding-top: 4px;
}

.owner-add-btn{
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.18);
  background: #fff;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #555;
  transition: background 0.15s;
}

.owner-add-btn:hover{
  background: #f0f0f0;
}

.owners-hint{
  margin-top: 8px;
  font-size: 12px;
  color: var(--muted);
}
.hidden {
  display: none !important;
}
`;

function getInlineStylesheetText() {
  let css = "";
  try {
    for (const sheet of document.styleSheets) {
      try {
        const rules = sheet.cssRules || sheet.rules;
        for (const rule of rules) css += rule.cssText + "\n";
      } catch {
        // Cross-origin or file:// restricted stylesheet; handled by getExportCss() fallback.
      }
    }
  } catch {
    // Accessing document.styleSheets itself failed; handled by getExportCss() fallback.
  }
  return css;
}

async function getExportCss() {
  const liveCss = getInlineStylesheetText();
  if (liveCss.trim()) return liveCss;

  try {
    const res = await fetch("style.css");
    const text = await res.text();
    if (text.trim()) return text;
  } catch {
    // fetch of local files is blocked in some browsers under file://.
  }

  return FALLBACK_STYLESHEET_CSS;
}

async function embedImagesAsDataUrls(root) {
  const images = [...root.querySelectorAll("img")];
  await Promise.all(images.map(async (img) => {
    const src = img.getAttribute("src") || "";
    if (!src || /^data:/i.test(src)) return;
    const dataUrl = await tryGetImageDataUrl(src);
    if (dataUrl) img.setAttribute("src", dataUrl);
  }));
}

function createFullExportSurface(stakeholders, bounds) {
  const padding = 40;
  const surface = document.createElement("div");
  surface.classList.add("export-surface");
  surface.style.position = "relative";
  surface.style.width = bounds.w + padding * 2 + "px";
  surface.style.height = bounds.h + padding * 2 + "px";
  surface.style.background = "#ffffff";

  const canvasClone = canvas.cloneNode(true);
  canvasClone.removeAttribute("id");
  canvasClone.classList.add("export-canvas");
  canvasClone.style.position = "absolute";
  canvasClone.style.left = padding - bounds.x + "px";
  canvasClone.style.top = padding - bounds.y + "px";
  canvasClone.style.width = canvas.scrollWidth + "px";
  canvasClone.style.height = canvas.scrollHeight + "px";
  canvasClone.style.overflow = "visible";
  canvasClone.style.background = "transparent";

  const sourceStakeholders = [...canvas.querySelectorAll(".stakeholder")];
  const clonedStakeholders = [...canvasClone.querySelectorAll(".stakeholder")];
  clonedStakeholders.forEach((clone, i) => {
    const source = sourceStakeholders[i];
    if (!source) return;
    syncClonedFormValues(source, clone);
    clone.querySelectorAll('input[type="file"]').forEach((input) => input.remove());
    replaceSnapshotTextInputs(clone);
    clone.querySelectorAll(".connection-anchor").forEach((anchor) => anchor.remove());
    clone.classList.remove("selecting");
  });

  canvasClone.querySelectorAll(".relationship-endpoint, #relMenu, #stakeMenu").forEach((node) => node.remove());
  const clonedHovercard = canvasClone.querySelector("#hovercard");
  if (clonedHovercard) clonedHovercard.classList.remove("show");
  syncClonedRelationshipLines(canvasClone);
  surface.appendChild(canvasClone);
  return surface;
}

function buildFitToViewportScript() {
  return `<script>
(function(){
  var surface = document.querySelector(".export-surface");
  if (!surface) return;

  var naturalW = surface.offsetWidth;
  var naturalH = surface.offsetHeight;

  var sizer = document.createElement("div");
  sizer.style.position = "relative";
  sizer.style.overflow = "hidden";
  sizer.style.flex = "none";
  surface.parentNode.insertBefore(sizer, surface);
  sizer.appendChild(surface);
  surface.style.transformOrigin = "top left";

  function applyFit() {
    var padding = 48;
    var maxW = Math.max(window.innerWidth - padding, 50);
    var maxH = Math.max(window.innerHeight - padding, 50);
    var scale = Math.min(maxW / naturalW, maxH / naturalH, 1);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    surface.style.transform = "scale(" + scale + ")";
    sizer.style.width = (naturalW * scale) + "px";
    sizer.style.height = (naturalH * scale) + "px";
  }

  applyFit();
  window.addEventListener("resize", applyFit);
})();
<\/script>`;
}

function buildHovercardScript(mapsJson, linkedInIconSrc, relationshipsJson) {
  return `<script>
(function(){
  var root = document.querySelector(".export-canvas");
  var hovercard = document.getElementById("hovercard");
  if (!root || !hovercard) return;

  var relationships = ${relationshipsJson};

  function getStakeholderNameById(id) {
    var card = root.querySelector('.stakeholder[data-id="' + id + '"]');
    return card ? (cardText(card, ".name") || "Unnamed") : "Unnamed";
  }

  function getReportsToNames(el) {
    var id = el.dataset.id;
    return relationships.filter(function (r) { return r.reportId === id; }).map(function (r) { return getStakeholderNameById(r.managerId); });
  }

  function getDirectReportNames(el) {
    var id = el.dataset.id;
    return relationships.filter(function (r) { return r.managerId === id; }).map(function (r) { return getStakeholderNameById(r.reportId); });
  }

  var hcAvatar = document.getElementById("hcAvatar");
  var hcName = document.getElementById("hcName");
  var hcTitle = document.getElementById("hcTitle");
  var hcRoleDot = document.getElementById("hcRoleDot");
  var hcRole = document.getElementById("hcRole");
  var hcOwnerDot = document.getElementById("hcOwnerDot");
  var hcOwner = document.getElementById("hcOwner");
  var hcInfluenceDot = document.getElementById("hcInfluenceDot");
  var hcInfluence = document.getElementById("hcInfluence");
  var hcContactDot = document.getElementById("hcContactDot");
  var hcContact = document.getElementById("hcContact");
  var hcViewDot = document.getElementById("hcViewDot");
  var hcView = document.getElementById("hcView");
  var hcAdvice = document.getElementById("hcAdvice");
  var hcReportsTo = document.getElementById("hcReportsTo");
  var hcDirectReports = document.getElementById("hcDirectReports");

  var maps = ${mapsJson};
  var linkedInIconSrc = ${JSON.stringify(linkedInIconSrc)};

  function colorClass(type, val) {
    if (type === "role" && val === "T") return "white";
    if (type === "role") return "green";
    if (type === "owner" && val === "") return "white";
    if (type === "owner") return "green";
    if (type === "influence") return val === "H" ? "green" : val === "M" ? "amber" : "red";
    if (type === "view") return val === "+" ? "green" : val === "0" ? "amber" : "red";
    if (type === "contact") return val === "H" ? "green" : val === "M" ? "amber" : "red";
    return "amber";
  }

  function advice(v) {
    if (v === "+") return "Suggested: leverage support and advocacy.";
    if (v === "0") return "Suggested: keep engaged and share progress.";
    if (v === "-") return "Suggested: address objections early.";
    return "";
  }

  function getStatus(el, type) {
    var b = el.querySelector('.status-box[data-type="' + type + '"]');
    return b ? b.textContent : "";
  }

  function setField(dot, text, type, val) {
    dot.className = "dot " + colorClass(type, val);
    var label = val && maps[type] && maps[type][val] ? maps[type][val] : val;
    text.textContent = val ? (label + " (" + val + ")") : "\\u2014";
  }

  function cardText(el, selector) {
    var node = el.querySelector(selector);
    if (!node) return "";
    return (node.value !== undefined ? node.value : node.textContent) || "";
  }

  function updateHovercard(el) {
    var name = cardText(el, ".name") || "Unnamed";
    var title = cardText(el, ".titleInput") || "Role / Title";
    hcName.textContent = name;
    hcTitle.textContent = title;

    hcAvatar.innerHTML = "";
    var img = el.querySelector(".photo img");
    if (img) {
      var i = document.createElement("img");
      i.src = img.src;
      hcAvatar.appendChild(i);
    } else {
      hcAvatar.textContent = name[0] || "\\u2014";
    }

    setField(hcRoleDot, hcRole, "role", getStatus(el, "role"));
    setField(hcOwnerDot, hcOwner, "owner", getStatus(el, "owner"));
    setField(hcInfluenceDot, hcInfluence, "influence", getStatus(el, "influence"));
    setField(hcContactDot, hcContact, "contact", getStatus(el, "contact"));
    setField(hcViewDot, hcView, "view", getStatus(el, "view"));
    hcAdvice.textContent = advice(getStatus(el, "view"));

    hovercard.querySelectorAll(".hc-linkedin").forEach(function (n) { n.remove(); });
    var linkedin = el.dataset.linkedin;
    if (linkedin) {
      var a = document.createElement("a");
      a.className = "hc-linkedin";
      a.href = linkedin;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.innerHTML = '<img src="' + linkedInIconSrc + '" width="20">';
      var top = hovercard.querySelector(".hc-top");
      if (top) top.appendChild(a);
    }

    var reportsTo = getReportsToNames(el);
    var directReports = getDirectReportNames(el);
    hcReportsTo.textContent = reportsTo.length ? reportsTo.join(", ") : "\\u2014";
    hcDirectReports.textContent = directReports.length ? directReports.join(", ") : "\\u2014";
  }

  function positionHovercard(el) {
    var cr = root.getBoundingClientRect();
    var sr = el.getBoundingClientRect();
    // cr/sr are in screen pixels, which include any fit-to-viewport scale
    // applied to an ancestor; left/top are relative to root's own unscaled
    // coordinate space, so the screen-space delta must be un-scaled first.
    var scale = (root.offsetWidth ? cr.width / root.offsetWidth : 1) || 1;

    // Flip to the card's left side once it's past screen mid-width, so the
    // popup doesn't run off the right edge for cards on the right half.
    var placeOnLeft = (sr.left + sr.width / 2) > window.innerWidth / 2;
    var hcWidthLocal = hovercard.offsetWidth || 340;
    var left = placeOnLeft
      ? (sr.left - cr.left) / scale - hcWidthLocal - 12
      : (sr.right - cr.left) / scale + 12;

    hovercard.style.left = Math.max(0, left) + "px";
    hovercard.style.top = ((sr.top - cr.top) / scale) + "px";
  }

  root.querySelectorAll(".stakeholder").forEach(function (card) {
    card.style.cursor = "pointer";
    card.addEventListener("click", function (e) {
      e.stopPropagation();
      if (e.target.closest("a")) return;
      updateHovercard(card);
      positionHovercard(card);
      hovercard.classList.add("show");
    });
  });

  document.addEventListener("click", function (e) {
    if (e.target.closest(".stakeholder") || e.target.closest("#hovercard")) return;
    hovercard.classList.remove("show");
  });
})();
<\/script>`;
}

async function saveHtmlFile(html, fileName) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: "HTML file", accept: { "text/html": [".html"] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      if (err?.name === "AbortError") return; // cancelled
      console.warn("Save picker failed, falling back:", err);
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function exportToFullHTML() {
  try {
    const stakeholders = [...canvas.querySelectorAll(".stakeholder")];
    if (!stakeholders.length) {
      alert("No stakeholders on canvas.");
      return;
    }

    const bounds = getNormalExportBounds(stakeholders);
    const surface = createFullExportSurface(stakeholders, bounds);
    await waitForSnapshotImages(surface);
    await embedImagesAsDataUrls(surface);

    const css = await getExportCss();
    const LINKEDIN_ICON_URL = "https://cdn-icons-png.flaticon.com/512/174/174857.png";
    const linkedInIconSrc = (await tryGetImageDataUrl(LINKEDIN_ICON_URL)) || LINKEDIN_ICON_URL;
    const relationshipsForExport = relationships.map((r) => ({ managerId: r.managerId, reportId: r.reportId }));
    const hovercardScript = buildHovercardScript(JSON.stringify(maps), linkedInIconSrc, JSON.stringify(relationshipsForExport));
    const fitToViewportScript = buildFitToViewportScript();
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Stakeholder Map</title>
<style>
html, body { margin: 0; height: 100%; font-family: Arial, sans-serif; background: #f4f6f8; }
.export-wrap { display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 24px; box-sizing: border-box; }
.export-surface { flex: none; }
${css}
</style>
</head>
<body>
<div class="export-wrap">${surface.outerHTML}</div>
${fitToViewportScript}
${hovercardScript}
</body>
</html>`;

    await saveHtmlFile(html, "stakeholder-map.html");
  } catch (err) {
    console.error("Full HTML export failed:", err);
    alert("Full HTML export failed:\n\n" + (err?.message || err));
  }
}

function isValidImageUrl(url) {
  try {
    const u = new URL(url);
    // allow typical image extensions OR data URLs
    if (u.protocol === "data:") return true;
    return /^https?:$/.test(u.protocol);
  } catch {
    return false;
  }
}

function getShapeTypes(pptx) {
  return pptx.ShapeType || (window.PptxGenJS && window.PptxGenJS.ShapeType) || {};
}

async function exportToPPTXBeta() {
  console.log("Beta PowerPoint export clicked");

  await ensurePptxGen();

  if (!window.PptxGenJS) {
    alert("PptxGenJS not loaded.");
    return;
  }

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  const ST = getShapeTypes(pptx);
  if (!ST.roundRect) {
    console.warn("ShapeType missing. Available:", ST);
    alert("PptxGenJS ShapeType not available in this build. Try updating the unpkg version.");
    return;
}
  const slide = pptx.addSlide();

  const stakeholders = [...canvas.querySelectorAll(".stakeholder")];
  if (!stakeholders.length) {
    alert("No stakeholders on canvas.");
    return;
  }

  const bounds = getStakeholderBounds(stakeholders);

  const SLIDE_W = 13.333;
  const SLIDE_H = 7.5;

  const scale = Math.min(SLIDE_W / bounds.w, SLIDE_H / bounds.h) * 0.95;
  const offsetX = (SLIDE_W - bounds.w * scale) / 2;
  const offsetY = (SLIDE_H - bounds.h * scale) / 2;

  drawRelationshipLines(slide, bounds, scale, offsetX, offsetY, ST);

  for (const el of stakeholders) {
    await drawStakeholderCard(slide, el, bounds, scale, offsetX, offsetY, ST);
  }

  await pptx.writeFile({ fileName: "stakeholder-map-beta.pptx" });
}

function getStakeholderById(id) {
  return canvas.querySelector(`.stakeholder[data-id="${id}"]`);
}

function getAnchorCanvasPoint(el, anchor) {
  const x = parseInt(el.style.left || "0", 10);
  const y = parseInt(el.style.top || "0", 10);
  const w = el.offsetWidth || 340;
  const h = el.offsetHeight || 160;

  if (anchor === "top") return { x: x + w / 2, y };
  if (anchor === "right") return { x: x + w, y: y + h / 2 };
  if (anchor === "left") return { x, y: y + h / 2 };
  return { x: x + w / 2, y: y + h };
}

function drawRelationshipLines(slide, bounds, scale, offsetX, offsetY, ST) {
  if (!ST.line) return;

  relationships.forEach((rel) => {
    const manager = getStakeholderById(rel.managerId);
    const report = getStakeholderById(rel.reportId);
    if (!manager || !report) return;

    const start = getAnchorCanvasPoint(manager, rel.managerAnchor || "bottom");
    const end = getAnchorCanvasPoint(report, rel.reportAnchor || "top");
    const sx = toSlideX(start.x, bounds, scale, offsetX);
    const sy = toSlideY(start.y, bounds, scale, offsetY);
    const ex = toSlideX(end.x, bounds, scale, offsetX);
    const ey = toSlideY(end.y, bounds, scale, offsetY);
    const lineW = ex - sx;
    const lineH = ey - sy;
    const isVertical = Math.abs(lineW) < 0.001;
    const isHorizontal = Math.abs(lineH) < 0.001;

    slide.addShape(ST.line, {
      x: Math.min(sx, ex),
      y: Math.min(sy, ey),
      w: isVertical ? 0.001 : Math.abs(lineW),
      h: isHorizontal ? 0.001 : Math.abs(lineH),
      flipH: lineW < 0,
      flipV: lineH < 0,
      line: {
        color: "111111",
        width: 1.25,
        endArrowType: "triangle"
      }
    });
  });
}

function getSlideObjects(slide) {
  return slide?._slideObjects || slide?._slideObjs || slide?.slideObjects || null;
}

function createGroupingCollector(slide) {
  const objects = [];

  const collectAfter = (methodName, args) => {
    const list = getSlideObjects(slide);
    const beforeCount = Array.isArray(list) ? list.length : 0;
    const result = slide[methodName](...args);
    const afterList = getSlideObjects(slide);

    if (Array.isArray(afterList) && afterList.length > beforeCount) {
      objects.push(...afterList.slice(beforeCount));
    } else if (result && result !== slide) {
      objects.push(result);
    }

    return result;
  };

  return {
    objects,
    addShape: (...args) => collectAfter("addShape", args),
    addText: (...args) => collectAfter("addText", args),
    addImage: (...args) => collectAfter("addImage", args)
  };
}

function tryGroupCardObjects(slide, objects, name) {
  if (!objects || objects.length < 2) return false;

  try {
    if (typeof slide.addGroup === "function") {
      slide.addGroup(objects, { name });
      return true;
    }
    if (typeof slide.groupObjects === "function") {
      slide.groupObjects(objects, { name });
      return true;
    }
    if (typeof slide.group === "function") {
      slide.group(objects, { name });
      return true;
    }
  } catch (error) {
    console.warn("PptxGenJS grouping failed; leaving card elements ungrouped.", error);
  }

  return false;
}

async function drawStakeholderCard(slide, el, bounds, scale, offsetX, offsetY, ST) {
  const cardGroup = createGroupingCollector(slide);
  const cardSlide = cardGroup;
  const x = parseInt(el.style.left || "0", 10);
  const y = parseInt(el.style.top || "0", 10);

  // CSS says 340px fixed; height is whatever it renders to.
  const w = el.offsetWidth || 340;
  const h = el.offsetHeight || 160;

  const sx = toSlideX(x, bounds, scale, offsetX);
  const sy = toSlideY(y, bounds, scale, offsetY);
  const sw = toSlideW(w, scale);
  const sh = toSlideH(h, scale);

  // ---- Style constants derived from your CSS ----
  const RADIUS_PX = 10;
  const BORDER_PX = 2;
  const DIVIDER_PX = 1;
  const STATUS_H_PX = 44;

  // Convert px-ish borders to PPT points-ish widths (roughly)
  const cardLineW = Math.max(1, BORDER_PX * 0.75);
  const dividerLineW = Math.max(0.75, DIVIDER_PX * 0.75);

  const pad = 10 * scale;

  const statusH = STATUS_H_PX * scale;
//  const statusY = sy + sh - statusH - (15 * scale); // added - (15* scale)

  // Card background (rounded)
  cardSlide.addShape(ST.roundRect, {
    x: sx,
    y: sy,
    w: sw,
    h: sh,
    fill: { color: "FFFFFF" },
    line: { color: "111111", width: cardLineW }
    // Shadow: PptxGen has limited/varies by version; leave off for consistency.
  });

  // Header area (top content) sizing tuned to your UI feel
  const photoSize = 42 * scale;

  // Photo circle
  cardSlide.addShape(ST.ellipse, {
    x: sx + pad,
    y: sy + pad,
    w: photoSize,
    h: photoSize,
    fill: { color: "F3F4F6" },
    line: { color: "111111", width: dividerLineW }
  });

  const name = el.querySelector(".name")?.value || "Unnamed";
  const title = el.querySelector(".titleInput")?.value || "Role / Title";

  // Name/title to the right of photo
  cardSlide.addText(name, {
    x: sx + pad + photoSize + (10 * scale),
    y: sy + pad + (2 * scale),
    w: sw - (pad * 2) - photoSize - (1 * scale), // change from 10
    h: 18 * scale,
    fontFace: "Calibri",
    fontSize: Math.max(10, 14 * scale),
    bold: true,
    color: "111111"
  });
  
  cardSlide.addText(title, {
    x: sx + pad + photoSize + (10 * scale),
    y: sy + pad + (40 * scale), // changed from 20
    w: sw - (pad * 2) - photoSize - (10 * scale),
    h: 18 * scale,
    fontFace: "Calibri",
    fontSize: Math.max(7, 11 * scale),
    color: "111111"
  });

  // Photo image if possible, otherwise initials
  const imgSrc = el.querySelector(".photo img")?.src || "";
  const dataUrl = await tryGetImageDataUrl(imgSrc);
  if (dataUrl) {
    const circularDataUrl = await createCircularImageDataUrl(dataUrl);
    if (circularDataUrl) {
      cardSlide.addImage({ data: circularDataUrl, x: sx + pad, y: sy + pad, w: photoSize, h: photoSize });
    } else {
      cardSlide.addText(computeInitials(name), {
        x: sx - pad,
        y: sy + pad,
        w: photoSize * 2,
        h: photoSize,
        align: "center",
        fontFace: "Calibri",
        fontSize: Math.max(6, 14 * scale),
        bold: true,
        color: "111111"
      });
    }
  } else {
    cardSlide.addText(computeInitials(name), {
      x: sx - pad ,//+ pad,  take off the pad and made it - pad
      y: sy + pad , // taken off pad - + pad + (photoSize * 0.18),
      w: photoSize*2 , // added multiplier
      h: photoSize,
      align: "center",
      fontFace: "Calibri",
      fontSize: Math.max(6, 14 * scale), // changed from 10
      bold: true,
      color: "111111"
    });
  }

// ----- STATUS BAR (single, inset, narrower) -----
const BAR_INSET = 8 * scale;

// place bar slightly up inside the frame
const statusY = sy + sh - statusH - (15 * scale); //changed from 6
const statusX = sx + BAR_INSET - (1* scale);
const statusW = sw - (BAR_INSET * 2);

// Values (define BEFORE tileW)
const role = getStatus(el, "role");
const influence = getStatus(el, "influence");
const view = getStatus(el, "view");
const contact = getStatus(el, "contact");
const owner = getStatus(el, "owner");

const tiles = [
  { type: "role", val: role },
  { type: "influence", val: influence },
  { type: "view", val: view },
  { type: "contact", val: contact },
  { type: "owner", val: owner }
];

const tileW = statusW / tiles.length;

// Rounded status bar background (with border)
cardSlide.addShape(ST.roundRect, {
  x: statusX,
  y: statusY,
  w: statusW,
  h: statusH,
  fill: { color: "FFFFFF" },
  line: { color: "111111", width: dividerLineW }
});

// Fill tiles + dividers + text
tiles.forEach((t, i) => {
  const tx = statusX + tileW * i;
  const fill = hexFromStatus(t.type, t.val);

  cardSlide.addShape(ST.rect, {
    x: tx,
    y: statusY,
    w: tileW,
    h: statusH,
    fill: { color: fill },
    line: { color: "FFFFFF", width: 0 }
  });

  if (i < tiles.length - 1) {
    cardSlide.addShape(ST.line, {
      x: tx + tileW,
      y: statusY,
      w: 0.001,
      h: statusH,
      line: { color: "111111", width: dividerLineW }
    });
  }

  const txt = (t.val || "").toString();
  if (txt) {
    cardSlide.addText(txt, {
      x: tx,
      y: statusY + (statusH * 0.18),
      w: tileW,
      h: statusH,
      align: "center",
      fontFace: "Calibri",
      fontSize: Math.max(6, 14 * scale),
      bold: true,
      color: textColorForFill(fill)
    });
  }
});

// Border on top (keeps outline crisp over fills)
cardSlide.addShape(ST.roundRect, {
  x: statusX,
  y: statusY,
  w: statusW,
  h: statusH,
  fill: { color: "FFFFFF", transparency: 100 },
  line: { color: "111111", width: dividerLineW }
});
/*
  // Make sure the rounded bar outline stays visible over fills:
  // Draw the outline once more on top (thin)
  slide.addShape(ST.roundRect, {
    x: sx,
    y: statusY,
    w: sw,
    h: statusH,
    fill: { color: "FFFFFF", transparency: 100 },
    line: { color: "111111", width: dividerLineW }
  });
*/
  const grouped = tryGroupCardObjects(slide, cardGroup.objects, `stakeholder-${el.dataset.id || "card"}`);
  if (!grouped && cardGroup.objects.length) {
    console.info("PptxGenJS grouping API unavailable; exported card as editable separate elements.");
  }
}

  
//Additional items for photos
function setStakeholderPhotoFromUrl(el, url) {
  if (!el) return;
  const clean = String(url || "").trim();
  if (!clean) return;

  // store for export
  el.dataset.photo = clean;

  // render it on the card
  const p = el.querySelector(".photo");
  if (!p) return;

  // remove initials + existing img
  p.querySelector(".initials")?.remove();
  p.querySelector("img")?.remove();

  const img = document.createElement("img");
  img.src = clean;

  // if the URL is bad / blocked, fall back to initials
  img.onerror = () => {
    img.remove();
    el.dataset.photo = ""; // optional: clear if it fails
    const span = document.createElement("span");
    span.className = "initials";
    const name = el.querySelector(".name")?.value || "";
    span.textContent = (name[0] || "—").toUpperCase();
    p.appendChild(span);
    scheduleAutosave();
  };

  p.appendChild(img);
  scheduleAutosave();
}

function getStakeholderBounds(elements) {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  elements.forEach(el => {
    const x = parseInt(el.style.left || "0", 10);
    const y = parseInt(el.style.top || "0", 10);
    const w = el.offsetWidth;
    const h = el.offsetHeight;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function openPhotoAdjust(el) {
  const srcImg = el.querySelector(".photo img");
  if (!srcImg) return;

  const PREVIEW = 220;
  let scale = 1, dx = 0, dy = 0;
  let dragging = false, lastX = 0, lastY = 0;
  let baseScale = 1;

  const modal = document.createElement("div");
  modal.id = "photoAdjustModal";
  modal.innerHTML = `
    <div class="photo-adjust-inner">
      <h3 class="photo-adjust-title">Adjust Photo</h3>
      <div class="photo-adjust-clip" style="width:${PREVIEW}px;height:${PREVIEW}px;">
        <img class="photo-adjust-img" src="${srcImg.src}" crossorigin="anonymous" draggable="false" />
      </div>
      <div class="photo-adjust-zoom-row">
        <span>🔍</span>
        <input type="range" class="photo-adjust-slider" min="0.5" max="4" step="0.01" value="1" />
        <span class="photo-adjust-zoom-label">100%</span>
      </div>
      <div class="photo-adjust-actions">
        <button class="photo-adjust-cancel">Cancel</button>
        <button class="photo-adjust-save">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const clip    = modal.querySelector(".photo-adjust-clip");
  const adjImg  = modal.querySelector(".photo-adjust-img");
  const slider  = modal.querySelector(".photo-adjust-slider");
  const label   = modal.querySelector(".photo-adjust-zoom-label");

  function render() {
    const rw = adjImg.naturalWidth  * baseScale * scale;
    const rh = adjImg.naturalHeight * baseScale * scale;
    adjImg.style.width  = rw + "px";
    adjImg.style.height = rh + "px";
    adjImg.style.left   = (PREVIEW - rw) / 2 + dx + "px";
    adjImg.style.top    = (PREVIEW - rh) / 2 + dy + "px";
  }

  function init() {
    baseScale = Math.max(PREVIEW / adjImg.naturalWidth, PREVIEW / adjImg.naturalHeight);
    render();
  }

  if (adjImg.complete && adjImg.naturalWidth) init();
  else adjImg.onload = init;

  clip.addEventListener("mousedown", (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    clip.style.cursor = "grabbing";
    e.preventDefault();
  });

  function onMove(e) {
    if (!dragging) return;
    dx += e.clientX - lastX; dy += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    render();
  }
  function onUp() { dragging = false; clip.style.cursor = "grab"; }
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup",   onUp);

  clip.addEventListener("wheel", (e) => {
    e.preventDefault();
    scale = Math.max(0.5, Math.min(4, scale - e.deltaY * 0.001));
    slider.value = scale;
    label.textContent = Math.round(scale * 100) + "%";
    render();
  }, { passive: false });

  slider.addEventListener("input", () => {
    scale = parseFloat(slider.value);
    label.textContent = Math.round(scale * 100) + "%";
    render();
  });

  function cleanup() {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup",   onUp);
    modal.remove();
  }

  modal.querySelector(".photo-adjust-cancel").onclick = cleanup;

  modal.querySelector(".photo-adjust-save").onclick = () => {
    const OUT = 400;
    const ratio = OUT / PREVIEW;
    const canvasBaseScale = Math.max(OUT / adjImg.naturalWidth, OUT / adjImg.naturalHeight);
    const rw = adjImg.naturalWidth  * canvasBaseScale * scale;
    const rh = adjImg.naturalHeight * canvasBaseScale * scale;
    const rx = (OUT - rw) / 2 + dx * ratio;
    const ry = (OUT - rh) / 2 + dy * ratio;

    const cv  = document.createElement("canvas");
    cv.width  = OUT; cv.height = OUT;
    const ctx = cv.getContext("2d");
    ctx.beginPath();
    ctx.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(adjImg, rx, ry, rw, rh);

    const dataUrl = cv.toDataURL("image/jpeg", 0.92);

    const photoDiv = el.querySelector(".photo");
    let cardImg = photoDiv.querySelector("img");
    if (!cardImg) {
      photoDiv.querySelector(".initials")?.remove();
      cardImg = document.createElement("img");
      photoDiv.appendChild(cardImg);
    }
    cardImg.src = dataUrl;
    el.dataset.photo = dataUrl;
    scheduleAutosave();
    cleanup();
  };
}

function clearStakeholderPhoto(el) {
  if (!el) return;
  el.dataset.photo = "";

  const p = el.querySelector(".photo");
  if (!p) return;

  p.querySelector("img")?.remove();

  if (!p.querySelector(".initials")) {
    const span = document.createElement("span");
    span.className = "initials";
    const name = el.querySelector(".name")?.value || "";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    span.textContent = ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "—";
    p.appendChild(span);
  }
  scheduleAutosave();
}

// ---- Auto layout for imported cards (avoids overlap) ----
const CARD_W = 340;   // must match your CSS card width
const CARD_H = 160;   // approx; tweak if your card is taller/shorter
const CARD_GAP = 20;  // spacing between cards

function rectsOverlap(a, b) {
  return !(
    a.x + a.w <= b.x ||
    a.x >= b.x + b.w ||
    a.y + a.h <= b.y ||
    a.y >= b.y + b.h
  );
}

function getExistingStakeholderRects() {
  return [...canvas.querySelectorAll(".stakeholder")].map((el) => ({
    x: parseInt(el.style.left || "0", 10),
    y: parseInt(el.style.top || "0", 10),
    w: el.offsetWidth || CARD_W,
    h: el.offsetHeight || CARD_H
  }));
}

/**
 * Finds a non-overlapping position starting near (x,y).
 * Scans downwards first, then moves to next column.
 */
function findFreePosition(startX, startY) {
  const existing = getExistingStakeholderRects();

  let x = snap(startX);
  let y = snap(startY);

  // Use the visible viewport height as a soft wrap point
  const wrapY = (canvas.clientHeight || 700) - (CARD_H + CARD_GAP);
  const stepY = snap(CARD_H + CARD_GAP);
  const stepX = snap(CARD_W + CARD_GAP);

  // Safety limit so we never infinite-loop
  for (let attempts = 0; attempts < 5000; attempts++) {
    const candidate = { x, y, w: CARD_W + CARD_GAP, h: CARD_H + CARD_GAP };

    const hit = existing.some((r) => rectsOverlap(candidate, r));
    if (!hit) return { x, y };

    // move down; if too far, move right and reset y
    y = snap(y + stepY);

    if (y > wrapY && wrapY > 0) {
      y = snap(60);
      x = snap(x + stepX);
    }
  }

  // fallback: just return the start (should never happen)
  return { x: snap(startX), y: snap(startY) };
}

// ---------- SHARE LINK ----------
function encodeShareLink() {
  const state = collectMapState();
  // Strip photos — base64 data URLs are huge and URLs would break
  state.stakeholders = state.stakeholders.map((s) => ({ ...s, photoUrl: "" }));
  try {
    const json = JSON.stringify(state);
    // btoa needs a binary string — encode via URI component to handle unicode
    const encoded = btoa(unescape(encodeURIComponent(json)));
    const url = `${location.origin}${location.pathname}#map=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.getElementById("shareLink");
      const orig = btn.textContent;
      btn.textContent = "✅ Copied!";
      setTimeout(() => (btn.textContent = orig), 2000);
    }).catch(() => {
      prompt("Copy this link:", url);
    });
  } catch (e) {
    alert("Failed to generate share link: " + e.message);
  }
}

function loadFromShareLink() {
  const hash = location.hash;
  if (!hash.startsWith("#map=")) return false;
  const encoded = hash.slice(5);
  if (!encoded) return false;
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    const state = JSON.parse(json);
    if (!state || !Array.isArray(state.stakeholders)) return false;

    // Clear hash so a refresh doesn't keep re-loading the link
    history.replaceState(null, "", location.pathname);

    isRestoringAutosave = true;
    try {
      canvas.querySelectorAll(".stakeholder").forEach((e) => e.remove());
      svg.querySelectorAll(".relationship-line, .relationship-endpoint").forEach((n) => n.remove());
      relationships.length = 0;

      if (state.owners && typeof state.owners === "object") {
        ownersToModel(state.owners);
      }

      const idMap = {};
      state.stakeholders.forEach((item) => {
        const el = createStakeholderFromData({
          name: item.name, title: item.title, role: item.role,
          influence: item.influence, view: item.view, contact: item.contact,
          owner: item.owner, linkedin: item.linkedin,
          x: item.x, y: item.y, photoUrl: "", cardId: item.csvId
        });
        if (!el) return;
        if (item.id) {
          const oldId = el.dataset.id;
          el.dataset.id = String(item.id);
          idMap[oldId] = el.dataset.id;
        }
        if (Number.isFinite(Number(item.zIndex))) el.style.zIndex = String(item.zIndex);
      });

      nextId = Math.max(
        Number(state.nextId) || 1,
        ...[...canvas.querySelectorAll(".stakeholder")].map((el) => Number(el.dataset.id) + 1).filter(Number.isFinite)
      );
      zIndex = Math.max(Number(state.zIndex) || 1, nextId);
      showLinkedInUrl = !!state.showLinkedInUrl;
      updateLinkedInVisibility();

      (state.relationships || []).forEach((rel) => {
        const managerId = idMap[rel.managerId] || rel.managerId;
        const reportId = idMap[rel.reportId] || rel.reportId;
        if (!managerId || !reportId) return;
        addRelationship(managerId, reportId, rel.managerAnchor || "bottom", rel.reportAnchor || "top", { toggleExisting: false });
      });

      redraw();
    } finally {
      isRestoringAutosave = false;
    }
    return true;
  } catch (e) {
    console.warn("Failed to load share link:", e);
    return false;
  }
}

document.getElementById("shareLink").onclick = encodeShareLink;

// On load: share link takes priority over autosave
if (!loadFromShareLink()) {
  restoreMapFromAutosave();
}
window.addEventListener("beforeunload", saveMapStateNow);
