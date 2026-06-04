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
const GRID = 20;
const relationships = [];

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
  if (type === "owner" && val === "-") return "white";
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
  };

  input.onchange = () => {
    el.dataset.linkedin = input.value.trim();
    renderLinkedInField(el);
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
  input.placeholder = "LinkedIn URL";
  input.value = url;
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

// ---------- BUTTONS ----------
addBtn.onclick = () => createStakeholder(40, 40);

if (toggleLinkedInBtn) {
  updateLinkedInToggleButton();
  toggleLinkedInBtn.onclick = () => {
    showLinkedInUrl = !showLinkedInUrl;
    localStorage.setItem("showLinkedInUrl", String(showLinkedInUrl));
    updateLinkedInVisibility();
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

function deleteRelationshipById(id) {
  const index = relationships.findIndex((rel) => rel.id === id);
  if (index === -1) return;

  deleteRelationshipAt(index);
  hideRelMenu();
  updateLines();
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

  if (!insideStake && !insideHover && !insideRel && !insideStakeMenu) {
    hideHovercard();
    hideRelMenu();
    hideStakeMenu();
  }
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
      ${statusBox(OWNER_VALUES, "owner", true)}
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

  el.addEventListener("mousedown", (e) => {
    if (e.target.closest("input") || e.target.closest("a") || e.target.closest(".status-box") || e.target.closest(".connection-anchor")) return;
    drag = true;
    ox = e.clientX - el.offsetLeft;
    oy = e.clientY - el.offsetTop;
    el.style.zIndex = zIndex++;
  });

  document.addEventListener("mousemove", (e) => {
    if (!drag) return;
    el.style.left = snap(e.clientX - ox) + "px";
    el.style.top = snap(e.clientY - oy) + "px";
    updateLines();
  });

  document.addEventListener("mouseup", () => (drag = false));
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
  };

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

      idx = (idx + 1) % vals.length;
      const v = vals[idx];

      b.textContent = v;

      // Special white cases
      if (
        (b.dataset.type === "role" && v === "T") ||
        (b.dataset.type === "owner" && v === "-")
      ) {
        b.className = "status-box white";
        return;
      }

      b.className =
        "status-box " +
        (b.dataset.alwaysGreen === "true"
          ? "green"
          : colorClass(b.dataset.type, v));
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

    updateHovercard(el);
    positionHovercard(el);
    showHovercard();
  });
}

// ---------- RELATIONSHIPS ----------
function addRelationship(m, r, managerAnchor = "bottom", reportAnchor = "top") {
  const existingIndex = relationships.findIndex((x) =>
    x.managerId === m &&
    x.reportId === r &&
    (x.managerAnchor || "bottom") === managerAnchor &&
    (x.reportAnchor || "top") === reportAnchor
  );

  if (existingIndex !== -1) {
    deleteRelationshipAt(existingIndex);
    updateLines();
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

  // Optional: you can populate reports-to/direct-reports later if you want
  hcReportsTo.textContent = "—";
  hcDirectReports.textContent = "—";
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

  el.remove();
  redraw();

  hideHovercard();
  hideRelMenu();
  hideStakeMenu();
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
    box.dataset.values = JSON.stringify(OWNER_VALUES);

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

  // wire events
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

      // If code changed, move it
      if (oldCode && oldCode !== newCode) delete current[oldCode];

      current[newCode] = newLabel;

      ownersToModel(current);

      // IMPORTANT: if code changed, update any existing stakeholders using the old code
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
      if (!confirm(`Delete owner ${code}?`)) return;

      const current = getOwnersModel();
      delete current[code];
      ownersToModel(current);
    });
  });
}

if (ownersAddBtn) {
  ownersAddBtn.onclick = () => {
    const code = normalizeOwnerCode(prompt("Owner code (e.g. RW):", "RW") || "");
    if (!code) return;
    const label = String(prompt("Owner label (e.g. Rob Walker):", code) || "").trim() || code;

    const current = getOwnersModel();
    current[code] = label;
    ownersToModel(current);
  };
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
}

// ---------- CLEAR ----------
function clearAll() {
  canvas.querySelectorAll(".stakeholder").forEach((e) => e.remove());
  svg.querySelectorAll(".relationship-line, .relationship-endpoint").forEach((node) => node.remove());
  relationships.length = 0;
  relationshipMode = false;
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
        Format: <code>Name,Title,Role,Influence,View,Contact,Owner,LinkedIn,X,Y,PhotoURL</code><br>
        Example: <code>Jane Smith,CIO,D,H,+,M,RW,https://linkedin.com/in/janesmith,60,60,https://example.com/jane.jpg</code><br>
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
  if ((type === "role" && v === "T") || (type === "owner" && v === "-")) {
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

  const nameInput = el.querySelector(".name");
  const titleInput = el.querySelector(".titleInput");

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
  }

  // statuses
  if (data.role) setStatus(el, "role", data.role);
  if (data.influence) setStatus(el, "influence", data.influence);
  if (data.view) setStatus(el, "view", data.view);
  if (data.contact) setStatus(el, "contact", data.contact);
  if (data.owner) setStatus(el, "owner", data.owner);

  updateLines();
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
      !/^Name\s*,\s*Title\s*,/i.test(l)       // ignore header row
    );

  // basic CSV split (supports simple quotes)
  const splitCSV = (line) => {
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
  };

  return lines.map((line, idx) => {
    const cols = splitCSV(line);

    // Name,Title,Role,Influence,View,Contact,Owner,LinkedIn,X,Y,PhotoURL
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
      photoUrl = ""
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
      data: { name, title, role, influence, view, contact, owner, linkedin, x, y, photoUrl },
      errors
    };
  });
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

  if (!parsed.length) {
    csvPreviewOut.innerHTML = `<div class="bad">Nothing to import.</div>`;
    return;
  }

  const okCount = parsed.filter(p => p.errors.length === 0).length;
  const badCount = parsed.length - okCount;

  const rows = parsed.slice(0, 50).map(p => {
    if (p.errors.length) {
      return `<div><span class="bad">Line ${p.lineNo} ✗</span> — ${p.errors.join("; ")}<br><code>${escapeHtml(p.raw)}</code></div>`;
    }
    const d = p.data;
    return `<div><span class="ok">Line ${p.lineNo} ✓</span> — ${escapeHtml(d.name)} (${escapeHtml(d.title)})</div>`;
  }).join("");

  csvPreviewOut.innerHTML =
    `<div><b>${okCount}</b> valid, <b>${badCount}</b> invalid (showing up to 50 lines)</div><br>` + rows;
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
    photoUrl: d.photoUrl
  });
});

  redraw();
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
  rows.push(["Name","Title","Role","Influence","View","Contact","Owner","LinkedIn","X","Y","PhotoURL"].join(","));

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
      csvEscape(photoUrl)
    ].join(",");

    rows.push(row);
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

  try {
    const res = await fetch(src, { mode: "cors" });
    const blob = await res.blob();
    return await new Promise((r) => {
      const fr = new FileReader();
      fr.onloadend = () => r(fr.result);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
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
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();

    return new Promise((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => {
        img.remove();
        resolve();
      };
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
  };

  p.appendChild(img);
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
