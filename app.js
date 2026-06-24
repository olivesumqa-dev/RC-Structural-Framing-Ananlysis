const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const resultsCanvas = document.createElement("canvas");
const rctx = resultsCanvas.getContext("2d");
const RESTRICTED_FRAME = true;
const span1Input = document.getElementById("span1");
const span2Input = document.getElementById("span2");
const frameHeightInput = document.getElementById("frameHeight");
const beamSupportCanvas = document.getElementById("beamSupportCanvas");
const beamMidspanCanvas = document.getElementById("beamMidspanCanvas");
const columnSectionCanvas = document.getElementById("columnSectionCanvas");
const deflectionCanvas = document.getElementById("deflectionCanvas");
const shearDiagramCanvas = document.getElementById("shearDiagramCanvas");
const momentDiagramCanvas = document.getElementById("momentDiagramCanvas");
const analysisState = document.getElementById("analysisState");
const toggleMembersBtn = document.getElementById("toggleMembersBtn");
const concreteFcInput = document.getElementById("concreteFc");
const steelFyInput = document.getElementById("steelFy");
const clearCoverInput = document.getElementById("clearCover");
const beamBarDiaInput = document.getElementById("beamBarDia");
const columnBarDiaInput = document.getElementById("columnBarDia");
const tieBarDiaInput = document.getElementById("tieBarDia");
const analysisWarning = document.getElementById("analysisWarning");
const calculationDetailsBody = document.getElementById("calculationDetailsBody");

const model = {
  v: [0,4,8],
  h: [0,3],
  nodes: [],
  members: [],
  supports: {},
  loads: [],
  selectedNodes: [],
  selectedMemberIds: [],
  selectedNode: null,
  mode: "node",
  nextNode: 1,
  nextMember: 1
};

const history = [];
const baseScale = 70;
let zoom = 1;
let pan = {x: 0, y: 0};
const minZoom = 0.25;
const maxZoom = 4;
const margin = {left: 125, bottom: 105};
let isPanning = false;
let didPan = false;
let lastPan = null;
let currentFileHandle = null;
let viewLocked = false;
let deleteMode = false;
let membersVisible = true;
const filePickerSupported = "showSaveFilePicker" in window;
const tutorialDrawer = document.getElementById("tutorialDrawer");
const tutorialToggle = document.getElementById("tutorialToggle");
const tutorialClose = document.getElementById("tutorialClose");
const tutorialDrawerTab = document.getElementById("tutorialDrawerTab");
const memberPropsDrawerTab = document.getElementById("memberPropsDrawerTab");
const memberPropsTable = document.getElementById("memberPropsTable");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const lockToggleBtn = document.getElementById("lockToggleBtn");
const toolbarDeleteBtn = document.getElementById("toolbarDeleteBtn");
const toolbarSaveBtn = document.getElementById("toolbarSaveBtn");
const toolbarSaveAsBtn = document.getElementById("toolbarSaveAsBtn");
const toolbarImportBtn = document.getElementById("toolbarImportBtn");
const toolbarExportBtn = document.getElementById("toolbarExportBtn");
const toolbarOpenBtn = document.getElementById("toolbarOpenBtn");
const toolbarPrintBtn = document.getElementById("toolbarPrintBtn");
const toolbarPrintPdfBtn = document.getElementById("toolbarPrintPdfBtn");
const toolbarNewBtn = document.getElementById("toolbarNewBtn");
const toolbarCalcBtn = document.getElementById("toolbarCalcBtn");
const loadList = document.getElementById("loadList");
function setTutorialDrawer(open, section = "tutorial") {
  if (!tutorialDrawer) return;
  tutorialDrawer.classList.toggle("open", open);
  tutorialDrawer.setAttribute("aria-hidden", open ? "false" : "true");
  tutorialToggle?.setAttribute("aria-expanded", open ? "true" : "false");
  tutorialDrawer.dataset.section = section;
  memberPropsDrawerTab?.classList.toggle("is-active", open && section === "member");
  tutorialDrawerTab?.classList.toggle("is-active", open && section === "tutorial");
  if (open && section === "member") memberPropsTable?.classList.add("is-open");
  if (open && section === "tutorial") memberPropsTable?.classList.remove("is-open");
}
tutorialToggle?.addEventListener("click", () => setTutorialDrawer(!tutorialDrawer?.classList.contains("open")));
tutorialClose?.addEventListener("click", () => setTutorialDrawer(false));
tutorialDrawerTab?.addEventListener("click", () => {
  const sameTabOpen = tutorialDrawer?.classList.contains("open") && tutorialDrawer?.dataset.section === "tutorial";
  setTutorialDrawer(!sameTabOpen, "tutorial");
});
memberPropsDrawerTab?.addEventListener("click", () => {
  const sameTabOpen = tutorialDrawer?.classList.contains("open") && tutorialDrawer?.dataset.section === "member";
  setTutorialDrawer(!sameTabOpen, "member");
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setTutorialDrawer(false);
});

function themeColor(name, fallback) { return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback; }
function updateDayNightButtons() {
  const isNight = document.body.dataset.theme === "green_teal";
  if (!themeToggleBtn) return;
  themeToggleBtn.classList.toggle("is-night", isNight);
  themeToggleBtn.title = isNight ? "Day theme" : "Night theme";
  themeToggleBtn.setAttribute("aria-label", themeToggleBtn.title);
}
function updateLockToggle() {
  if (!lockToggleBtn) return;
  lockToggleBtn.classList.toggle("is-active", viewLocked);
  lockToggleBtn.title = viewLocked ? "Unlock Zoom/Pan" : "Lock Zoom/Pan";
  lockToggleBtn.setAttribute("aria-label", lockToggleBtn.title);
}
function setViewLocked(locked) {
  viewLocked = !!locked;
  if (viewLocked) isPanning = false;
  updateLockToggle();
  status(viewLocked ? "Zoom/Pan locked." : "Zoom/Pan unlocked.");
}
function setDeleteMode(active) {
  deleteMode = !!active;
  document.body.classList.toggle("delete-mode", deleteMode);
  toolbarDeleteBtn?.classList.toggle("is-active", deleteMode);
  if (deleteMode) {
    model.mode = "delete";
    model.selectedNodes = [];
    model.selectedMemberIds = [];
    model.selectedNode = null;
  }
  status(deleteMode ? "Delete tool active. Click a node or member to erase it." : "Delete tool off.");
  draw();
}
function setTheme(name, remember = true) {
  document.body.dataset.theme = name || "olive_saffron";
  document.querySelectorAll("[data-theme-choice]").forEach(btn => btn.classList.toggle("active", btn.dataset.themeChoice === document.body.dataset.theme));
  updateDayNightButtons();
  if (remember) localStorage.setItem("strucforge_theme", document.body.dataset.theme);
  draw();
}
function projectHeaderData() {
  const field = id => document.getElementById(id)?.value || "";
  return {
    title: field("projectTitle"),
    owner: field("projectOwner"),
    location: field("projectLocation"),
    designedBy: field("designedBy")
  };
}
function designInputData() {
  return {
    fc: Number(concreteFcInput?.value) || 28,
    fy: Number(steelFyInput?.value) || 415,
    cover: Number(clearCoverInput?.value) || 40,
    beamBarDia: Number(beamBarDiaInput?.value) || 20,
    columnBarDia: Number(columnBarDiaInput?.value) || 20,
    tieBarDia: Number(tieBarDiaInput?.value) || 10
  };
}

function memberDesignData(member) {
  const base = designInputData();
  return {
    ...base,
    beamBarDia: Number(member?.beamBarDia) || base.beamBarDia,
    columnBarDia: Number(member?.columnBarDia) || base.columnBarDia,
    tieBarDia: Number(member?.tieBarDia) || base.tieBarDia
  };
}

function modelPackage() { return {app:"StrucForge 2-Beam 3-Column Calculator",version:1,savedAt:new Date().toISOString(),theme:document.body.dataset.theme||"olive_saffron",view:{zoom,pan:clone(pan),fontScale,loadsVisible,membersVisible},project:projectHeaderData(),design:designInputData(),model:clone(model)}; }
function normalizeModelPayload(data) { return data && data.model ? data : {model:data || {}, view:null, theme:null}; }

function status(msg) {
  statusLabel.textContent = msg;
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function pushHistory() {
  history.push(JSON.stringify({model: clone(model), zoom, pan: clone(pan)}));
  if (history.length > 60) history.shift();
}

function undo() {
  const previous = history.pop();
  if (!previous) {
    status("Nothing to undo.");
    return;
  }
  const data = JSON.parse(previous);
  Object.assign(model, data.model);
  zoom = data.zoom;
  pan = data.pan;
  draw();
  status("Undo complete.");
}

function eventToCanvas(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width / r.width),
    y: (e.clientY - r.top) * (canvas.height / r.height)
  };
}

function drawingHeight() {
  return canvas.height;
}

function modelTransform() {
  const b = resultBounds();
  const modelW = Math.max(1, b.maxX - b.minX);
  const modelH = Math.max(1, b.maxY - b.minY);
  const band = {x: 0, y: 0, w: canvas.width, h: canvas.height};
  const padLeft = Math.min(150, Math.max(92, canvas.width * 0.09));
  const padRight = 44;
  const padTop = 145;
  const padBottom = diagramsVisible ? 118 : 82;
  const availableW = Math.max(1, band.w - padLeft - padRight);
  const availableH = Math.max(1, band.h - padTop - padBottom);
  const base = Math.min(availableW / modelW, availableH / modelH);
  const scale = Math.max(0.01, base * zoom);
  const ox = band.x + padLeft + (availableW - modelW * scale) / 2 + pan.x;
  const oy = band.y + padTop + (availableH - modelH * scale) / 2 + pan.y;
  return {bounds: b, scale, ox, oy};
}

function modelToCanvasPoint(n) {
  const t = modelTransform();
  return {
    x: t.ox + (n.x - t.bounds.minX) * t.scale,
    y: t.oy + (t.bounds.maxY - n.y) * t.scale
  };
}

function toCanvas(x, y) {
  return modelToCanvasPoint({x, y});
}

function fromCanvas(px, py) {
  const t = modelTransform();
  return {
    x: (px - t.ox) / t.scale + t.bounds.minX,
    y: t.bounds.maxY - (py - t.oy) / t.scale
  };
}

function parsePositions(text) {
  let arr = text.split(",").map(v => Number(v.trim())).filter(v => !isNaN(v) && v >= 0);
  if (!arr.includes(0)) arr.unshift(0);
  return [...new Set(arr)].sort((a,b) => a-b);
}

function sameId(a, b) {
  return a === b || String(a) === String(b);
}

function idSetHas(set, id) {
  for (const value of set) {
    if (sameId(value, id)) return true;
  }
  return false;
}

function getNode(id) {
  return model.nodes.find(n => sameId(n.id, id));
}

function getMember(id) {
  return model.members.find(m => sameId(m.id, id));
}

function getGridPoint(px, py) {
  let best = null;
  for (const x of model.v) {
    for (const y of model.h) {
      const p = toCanvas(x, y);
      const d = Math.hypot(px - p.x, py - p.y);
      if (d < scaled(20) && (!best || d < best.d)) best = {x, y, d};
    }
  }
  return best;
}

function addGridMemberCandidate(candidates, member, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const minX = Math.min(...model.v, 0);
  const maxX = Math.max(...model.v, 0);
  const minY = Math.min(...model.h, 0);
  const maxY = Math.max(...model.h, 0);
  if (x < minX - 1e-6 || x > maxX + 1e-6 || y < minY - 1e-6 || y > maxY + 1e-6) return;
  const duplicate = candidates.some(p => Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6 && sameId(p.member.id, member.id));
  if (!duplicate) candidates.push({x, y, member});
}

function getGridMemberIntersection(px, py) {
  const candidates = [];
  for (const member of model.members) {
    const a = getNode(member.i);
    const b = getNode(member.j);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;

    if (Math.abs(dx) > 1e-9) {
      for (const x of model.v) {
        const t = (x - a.x) / dx;
        if (t > 1e-5 && t < 1 - 1e-5) addGridMemberCandidate(candidates, member, x, a.y + dy * t);
      }
    }

    if (Math.abs(dy) > 1e-9) {
      for (const y of model.h) {
        const t = (y - a.y) / dy;
        if (t > 1e-5 && t < 1 - 1e-5) addGridMemberCandidate(candidates, member, a.x + dx * t, y);
      }
    }
  }

  let best = null;
  for (const candidate of candidates) {
    const p = toCanvas(candidate.x, candidate.y);
    const d = Math.hypot(px - p.x, py - p.y);
    if (d < scaled(22) && (!best || d < best.d)) best = {...candidate, d};
  }
  return best;
}

function getNodeAt(px, py) {
  let best = null;
  for (const n of model.nodes) {
    const p = toCanvas(n.x, n.y);
    const d = Math.hypot(px - p.x, py - p.y);
    if (d < scaled(14) && (!best || d < best.d)) best = {n, d};
  }
  return best ? best.n : null;
}

function distanceToSegment(px, py, A, B) {
  const len2 = (B.x-A.x)**2 + (B.y-A.y)**2;
  if (len2 < 1e-9) return Math.hypot(px-A.x, py-A.y);
  const t = Math.max(0, Math.min(1, ((px-A.x)*(B.x-A.x) + (py-A.y)*(B.y-A.y)) / len2));
  const q = {x: A.x + t*(B.x-A.x), y: A.y + t*(B.y-A.y)};
  return Math.hypot(px-q.x, py-q.y);
}

function getMemberAt(px, py) {
  let best = null;
  for (const m of model.members) {
    normalizeMemberProperties(m);
    const a = getNode(m.i);
    const b = getNode(m.j);
    if (!a || !b) continue;
    const A = toCanvas(a.x, a.y);
    const B = toCanvas(b.x, b.y);
    const d = distanceToSegment(px, py, A, B);
    if (d < scaled(28) && (!best || d < best.d)) best = {m, d};
  }
  return best ? best.m : null;
}

function renumberNodesSystematically() {
  const selectedCoord = model.selectedNode ? {x: model.selectedNode.x, y: model.selectedNode.y} : null;
  const oldToNew = {};

  model.nodes.sort((a,b) => {
    if (Math.abs(a.y - b.y) > 1e-6) return a.y - b.y;
    return a.x - b.x;
  });

  const oldIds = model.nodes.map(n => n.id);
  oldIds.forEach((oldId, index) => oldToNew[oldId] = index + 1);
  model.nodes.forEach((n, index) => n.id = index + 1);

  for (const m of model.members) {
    m.i = oldToNew[m.i] || m.i;
    m.j = oldToNew[m.j] || m.j;
  }

  const newSupports = {};
  for (const oldId in model.supports) {
    if (oldToNew[oldId]) newSupports[oldToNew[oldId]] = model.supports[oldId];
  }
  model.supports = newSupports;

  for (const L of model.loads) {
    if (L.node && oldToNew[L.node]) L.node = oldToNew[L.node];
  }

  model.selectedNodes = model.selectedNodes.map(id => oldToNew[id] || id);
  model.selectedMemberIds = model.selectedMemberIds.filter(id => getMember(id));
  model.nextNode = model.nodes.length + 1;

  if (selectedCoord) {
    model.selectedNode = model.nodes.find(n => Math.abs(n.x-selectedCoord.x)<1e-6 && Math.abs(n.y-selectedCoord.y)<1e-6) || null;
  }
}

function addNode(x, y) {
  const existing = model.nodes.find(n => Math.abs(n.x-x)<1e-6 && Math.abs(n.y-y)<1e-6);
  if (existing) return existing;
  if (RESTRICTED_FRAME) {
    status("This calculator is restricted to six fixed frame nodes.");
    return null;
  }
  model.nodes.push({id: model.nextNode++, x, y});
  renumberNodesSystematically();
  return model.nodes.find(n => Math.abs(n.x-x)<1e-6 && Math.abs(n.y-y)<1e-6);
}

function getMemberType(a, b) {
  if (Math.abs(a.x - b.x) < 1e-6) return "Column";
  if (Math.abs(a.y - b.y) < 1e-6) return "Beam";
  return "Brace";
}

function memberTypeProperties(type) {
  const isColumn = type === "Column";
  const beamW = document.getElementById("beamWidth");
  const beamH = document.getElementById("beamHeight");
  const colW = document.getElementById("columnWidth");
  const colH = document.getElementById("columnHeight");
  const width = Number(isColumn ? colW?.value : beamW?.value) || (isColumn ? 400 : 300);
  const height = Number(isColumn ? colH?.value : beamH?.value) || (isColumn ? 400 : 500);
  const area = width * height;
  const inertia = width * Math.pow(height, 3) / 12;
  return {
    width,
    height,
    area,
    inertia,
    E: Number(matE.value) || 200000,
    dim: `${width}x${height} mm`
  };
}

function selectMember(id, additive) {
  if (!additive) model.selectedMemberIds = [];
  if (!model.selectedMemberIds.includes(id)) model.selectedMemberIds.push(id);
  model.selectedNode = null;
  model.selectedNodes = [];
}

function selectedMembers() {
  return model.selectedMemberIds.map(id => getMember(id)).filter(Boolean);
}

function addMember(i, j) {
  if (RESTRICTED_FRAME) {
    status("Additional beams and columns are disabled in this calculator.");
    return null;
  }
  if (i === j) return null;
  const a = getNode(i);
  const b = getNode(j);
  if (!a || !b) return null;

  const duplicate = model.members.find(m => (m.i === i && m.j === j) || (m.i === j && m.j === i));
  if (duplicate) {
    selectMember(duplicate.id, false);
    return duplicate;
  }

  const type = getMemberType(a, b);
  const props = memberTypeProperties(type);
  const m = {
    id: model.nextMember++,
    i,
    j,
    type,
    dim: props.dim,
    width: props.width,
    height: props.height,
    length: Math.hypot(b.x-a.x, b.y-a.y),
    E: props.E,
    A: props.area,
    I: props.inertia
  };

  model.members.push(m);
  selectMember(m.id, false);
  return m;
}

function memberParameterAtNode(member, node) {
  const a = getNode(member.i);
  const b = getNode(member.j);
  if (!a || !b || !node) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return null;
  const t = ((node.x - a.x) * dx + (node.y - a.y) * dy) / len2;
  const px = a.x + dx * t;
  const py = a.y + dy * t;
  const dist = Math.hypot(node.x - px, node.y - py);
  if (dist > 1e-6 || t <= 1e-5 || t >= 1 - 1e-5) return null;
  return t;
}

function splitMemberAtNode(member, node) {
  if (!member || !node) return false;
  const t = memberParameterAtNode(member, node);
  if (t === null) return false;

  const oldEnds = memberStartEnd(member);
  const oldLength = oldEnds ? Math.hypot(oldEnds.end.x - oldEnds.start.x, oldEnds.end.y - oldEnds.start.y) : 0;
  const splitDist = oldEnds ? Math.hypot(node.x - oldEnds.start.x, node.y - oldEnds.start.y) : 0;
  const oldLoads = model.loads.filter(load => sameId(load.member, member.id));
  model.loads = model.loads.filter(load => !sameId(load.member, member.id));
  model.members = model.members.filter(m => !sameId(m.id, member.id));
  model.selectedMemberIds = model.selectedMemberIds.filter(id => !sameId(id, member.id));

  const m1 = addMember(member.i, node.id);
  const m2 = addMember(node.id, member.j);
  for (const load of oldLoads) {
    if (load.kind === "member_udl") {
      if (m1) model.loads.push({...load, member: m1.id});
      if (m2) model.loads.push({...load, member: m2.id});
    } else if (load.kind === "member_point" && oldLength > 1e-6) {
      const x = Math.max(0, Math.min(oldLength, Number(load.x) || 0));
      if (x <= splitDist && m1) model.loads.push({...load, member: m1.id, x});
      if (x > splitDist && m2) model.loads.push({...load, member: m2.id, x: x - splitDist});
    }
  }
  lastAnalysisResult = null;
  return true;
}

function memberStartEnd(m) {
  const a = getNode(m.i);
  const b = getNode(m.j);
  if (!a || !b) return null;

  if (Math.abs(a.y-b.y) < 1e-6) return a.x <= b.x ? {start:a, end:b} : {start:b, end:a};
  if (Math.abs(a.x-b.x) < 1e-6) return a.y <= b.y ? {start:a, end:b} : {start:b, end:a};
  return a.x <= b.x ? {start:a, end:b} : {start:b, end:a};
}

function addPointLoadToSelected() {
  const members = selectedMembers();
  if (!members.length) {
    status("Select one or more members first. In Member Mode, click member line; Ctrl/Shift + click adds more.");
    return;
  }

  pushHistory();
  for (const m of members) {
    const x = Math.max(0, Math.min(Number(ploadX.value), m.length || 0));
    model.loads.push({
      kind: "member_point",
      case: loadCase.value,
      member: m.id,
      p: Number(pload.value),
      x
    });
  }
  lastAnalysisResult = null;
  status(`Green point load assigned to ${members.length} selected member(s).`);
  draw();
}

let diagramsVisible = false;
let lastAnalysisResult = null;
let lastStrengthEnvelope = null;
let fontScale = 1;
let loadsVisible = true;
const concreteUnitWeight = 24;
let mainLabelBoxes = [];
let resultLabelBoxes = [];

function resizeCanvasToDisplaySize(target) {
  if (!target) return false;
  const rect = target.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  if (target.width !== width || target.height !== height) {
    target.width = width;
    target.height = height;
    return true;
  }
  return false;
}

function prepareCanvasSizes() {
  const changed = resizeCanvasToDisplaySize(canvas);
  return changed;
}

function annotationColor() {
  return themeColor("--dimension", "#000");
}

function loadAnnotationColor() {
  return themeColor("--load", "#dc2626");
}

function viewScale() {
  return Math.max(0.45, Math.min(2.5, zoom));
}

function scaled(value) {
  return value * viewScale();
}

function setScaledFont(size, family = "Arial") {
  ctx.font = `${(scaled(size) * fontScale).toFixed(1)}px ${family}`;
}

function labelBox(x, y, text, pad = 3) {
  const metrics = ctx.measureText(text);
  const height = scaled(14) * fontScale;
  return {x: x - metrics.width / 2 - pad, y: y - height / 2 - pad, w: metrics.width + pad * 2, h: height + pad * 2};
}

function reserveLabelBox(x, y, text, pad = 3) {
  const box = labelBox(x, y, text, scaled(pad));
  mainLabelBoxes.push(box);
  return box;
}

function boxesOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function findClearLabelPoint(x, y, text, candidates) {
  for (const c of candidates) {
    const p = {x: x + c.x, y: y + c.y};
    const box = labelBox(p.x, p.y, text);
    if (!mainLabelBoxes.some(existing => boxesOverlap(existing, box))) {
      mainLabelBoxes.push(box);
      return p;
    }
  }
  const fallback = {x: x + candidates[0].x, y: y + candidates[0].y};
  mainLabelBoxes.push(labelBox(fallback.x, fallback.y, text));
  return fallback;
}

function drawSafeText(text, x, y, candidates, align = "center", color = annotationColor()) {
  const p = findClearLabelPoint(x, y, text, candidates);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, p.x, p.y);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  return p;
}

function drawRotatedLines(lines, x, y, angle, color = annotationColor(), lineHeight = 13) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lh = scaled(lineHeight) * fontScale;
  const start = -((lines.length - 1) * lh) / 2;
  lines.forEach((line, index) => ctx.fillText(line, 0, start + index * lh));
  ctx.restore();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function memberSelfWeight(member) {
  if (!member || (member.type !== "Column" && member.type !== "Beam")) return 0;
  const areaMm2 = Number(member.A) || Number(secA.value) || 0;
  return areaMm2 * concreteUnitWeight / 1000000;
}

function columnSelfWeight(member) {
  return member && member.type === "Column" ? memberSelfWeight(member) : 0;
}

function memberUdlByCase(member, loadCaseName, component = "w") {
  if (!member) return 0;
  return model.loads
    .filter(load =>
      load.kind === "member_udl" &&
      sameId(load.member, member.id) &&
      String(load.case || "").toUpperCase() === loadCaseName
    )
    .reduce((sum, load) => sum + Math.abs(Number(load[component]) || 0), 0);
}

function memberAutoDeadLoad(member) {
  if (!member) return 0;
  const sw = memberSelfWeight(member);
  const userDL = memberUdlByCase(member, "DL");
  return sw + userDL;
}

function propertyText(value, unit) {
  const n = Number(value) || 0;
  const shown = Math.abs(n) >= 1000000 ? n.toExponential(2).replace("+", "") : String(Math.round(n));
  return `${shown} ${unit}`.trim();
}

function memberDisplayName(member) {
  if (!member) return "";
  if (member.name && String(member.name).trim()) return String(member.name).trim();
  const prefix = member.type === "Beam" ? "B" : member.type === "Column" ? "C" : "BR";
  const sameType = model.members
    .filter(m => m.type === member.type)
    .sort((a, b) => a.id - b.id);
  const index = sameType.findIndex(m => sameId(m.id, member.id));
  return `${prefix}-${index + 1 || member.id}`;
}

function setMemberDisplayName(memberId, value) {
  const member = getMember(memberId);
  if (!member) return;
  const clean = String(value || "").trim();
  member.name = clean || memberDisplayName({...member, name: ""});
  draw();
  status(`Member name updated to ${member.name}.`);
}

function setMemberDimension(memberId, field, value) {
  const member = getMember(memberId);
  if (!member || (field !== "width" && field !== "height")) return;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    status("Enter a positive value for b or h.");
    updateMemberPropertiesTable();
    return;
  }
  member[field] = numeric;
  normalizeMemberProperties(member);
  lastAnalysisResult = null;
  lastStrengthEnvelope = null;
  draw();
  updateMemberPropertiesTable();
  status(`${memberDisplayName(member)} ${field === "width" ? "b" : "h"} updated to ${numeric} mm.`);
}

function setMemberRebar(memberId, field, value) {
  const member = getMember(memberId);
  if (!member || !["beamBarDia", "columnBarDia", "tieBarDia"].includes(field)) return;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    status("Enter a positive rebar or tie diameter.");
    updateMemberPropertiesTable();
    return;
  }
  member[field] = numeric;
  if (!lastStrengthEnvelope && lastAnalysisResult) lastStrengthEnvelope = buildStrengthEnvelope(model);
  renderEngineeringResults(lastAnalysisResult);
  updateMemberPropertiesTable();
  status(`${memberDisplayName(member)} ${field === "tieBarDia" ? "tie/stirrup" : "main rebar"} diameter updated to D${numeric}.`);
}

function resetDesignWorkspace(message = "New design ready. Generate grid to begin.") {
  if (RESTRICTED_FRAME) {
    buildRestrictedFrame(message);
    return;
  }
  model.nodes = [];
  model.members = [];
  model.supports = {};
  model.loads = [];
  model.selectedNodes = [];
  model.selectedMemberIds = [];
  model.selectedNode = null;
  model.nextNode = 1;
  model.nextMember = 1;
  model.mode = "node";
  diagramsVisible = false;
  lastAnalysisResult = null;
  showDiagramBtn.textContent = "Show/Hide S&M Diagram";
  zoom = 1;
  pan = {x: 0, y: 0};
  status(message);
  draw();
}

function normalizeMemberProperties(member) {
  if (!member) return member;
  if (member.type === "Beam" || member.type === "Column") {
    const defaults = memberTypeProperties(member.type);
    const width = Number(member.width) || defaults.width;
    const height = Number(member.height) || defaults.height;
    member.width = width;
    member.height = height;
    member.dim = `${width}x${height} mm`;
    member.A = width * height;
    member.I = width * Math.pow(height, 3) / 12;
    member.E = Number(member.E) || defaults.E;
  }
  return member;
}

function restrictedGeometry() {
  const clamp = (value, min, max, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  return {
    l1: clamp(span1Input?.value, 1, 15, 4),
    l2: clamp(span2Input?.value, 1, 15, 4),
    height: clamp(frameHeightInput?.value, 1, 10, 3)
  };
}

function buildRestrictedFrame(message = "Restricted frame generated.") {
  const {l1, l2, height} = restrictedGeometry();
  if (span1Input) span1Input.value = l1;
  if (span2Input) span2Input.value = l2;
  if (frameHeightInput) frameHeightInput.value = height;
  model.v = [0, l1, l1 + l2];
  model.h = [0, height];
  if (typeof vPositions !== "undefined" && vPositions) vPositions.value = model.v.join(",");
  if (typeof hPositions !== "undefined" && hPositions) hPositions.value = model.h.join(",");

  model.nodes = [
    {id: 1, x: 0, y: 0}, {id: 2, x: l1, y: 0}, {id: 3, x: l1 + l2, y: 0},
    {id: 4, x: 0, y: height}, {id: 5, x: l1, y: height}, {id: 6, x: l1 + l2, y: height}
  ];
  const member = (id, i, j, type, name) => {
    const a = model.nodes.find(node => node.id === i);
    const b = model.nodes.find(node => node.id === j);
    const props = memberTypeProperties(type);
    return normalizeMemberProperties({id, i, j, type, name, length: Math.hypot(b.x-a.x, b.y-a.y), ...props, A: props.area, I: props.inertia});
  };
  model.members = [
    member(1, 1, 4, "Column", "C-1"),
    member(2, 2, 5, "Column", "C-2"),
    member(3, 3, 6, "Column", "C-3"),
    member(4, 4, 5, "Beam", "B-1"),
    member(5, 5, 6, "Beam", "B-2")
  ];
  model.supports = {1: "Fixed", 2: "Fixed", 3: "Fixed"};
  model.loads = [];
  model.selectedNodes = [];
  model.selectedMemberIds = [];
  model.selectedNode = null;
  model.mode = "select";
  model.nextNode = 7;
  model.nextMember = 6;
  zoom = 1;
  pan = {x: 0, y: 0};
  diagramsVisible = false;
  lastAnalysisResult = null;
  if (analysisState) analysisState.textContent = "Press Calculate to update results.";
  renderEngineeringResults(null);
  status(message);
  draw();
}

function restrictedDefaultPackage() {
  return {
    app: "StrucForge 2-Beam 3-Column Calculator",
    version: 1,
    theme: "green_teal",
    view: {zoom: 1.0951515644, pan: {x: -198.138, y: 81.714}, fontScale: 1.5, loadsVisible: true, membersVisible:true},
    project: {title: "Dela Cruz Residence", owner: "Mr. Juan dela Cruz", location: "Pagadian City", designedBy: "Engr. Sue N. Su"},
    design: {fc: 28, fy: 415, cover: 40, beamBarDia: 16, columnBarDia: 16, tieBarDia: 10},
    model: {
      v: [0, 7, 12.5], h: [0, 3],
      nodes: [
        {id:1,x:0,y:0},{id:2,x:7,y:0},{id:3,x:12.5,y:0},
        {id:4,x:0,y:3},{id:5,x:7,y:3},{id:6,x:12.5,y:3}
      ],
      members: [
        {id:1,i:1,j:4,type:"Column",name:"C-1",width:300,height:300,length:3,E:24870.062324,A:90000,I:675000000},
        {id:2,i:2,j:5,type:"Column",name:"C-2",width:300,height:300,length:3,E:24870.062324,A:90000,I:675000000},
        {id:3,i:3,j:6,type:"Column",name:"C-3",width:300,height:300,length:3,E:24870.062324,A:90000,I:675000000},
        {id:4,i:4,j:5,type:"Beam",name:"B-1",width:200,height:400,length:7,E:24870.062324,A:80000,I:1066666666.6666666},
        {id:5,i:5,j:6,type:"Beam",name:"B-2",width:200,height:400,length:5.5,E:24870.062324,A:80000,I:1066666666.6666666}
      ],
      supports: {1:"Fixed",2:"Fixed",3:"Fixed"},
      loads: [
        {kind:"member_point",case:"P",member:4,p:12,x:3},
        {kind:"member_point",case:"P",member:4,p:12,x:5},
        {kind:"member_point",case:"P",member:5,p:12,x:3.5},
        {kind:"member_udl",case:"DL",member:5,w:25,wx:0},
        {kind:"member_udl",case:"DL",member:4,w:25,wx:0},
        {kind:"member_udl",case:"WL",member:1,w:0,wx:35}
      ],
      selectedNodes: [], selectedMemberIds: [], selectedNode: null, mode: "select", nextNode: 7, nextMember: 6
    }
  };
}

function nodeDisplayName(node) {
  return node ? `N-${node.id}` : "";
}

function aggregateNodalLoad(nodeId) {
  return model.loads
    .filter(load => load.kind === "node" && sameId(load.node, nodeId))
    .reduce((sum, load) => {
      sum.fx += Number(load.fx) || 0;
      sum.fy += Number(load.fy) || 0;
      sum.mz += Number(load.mz) || 0;
      return sum;
    }, {fx: 0, fy: 0, mz: 0});
}

function draw() {
  mainLabelBoxes = [];
  resizeCanvasToDisplaySize(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = themeColor("--surface", "#fff");
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  setScaledFont(12);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  drawGrid();
  if (membersVisible) drawMembers();
  drawNodes();
  if (loadsVisible) drawLoads();
  if (loadsVisible) drawSupportReactions();
  drawColumnSectionDimensionLabels();
  drawMainDiagramTitle();
  if (diagramsVisible) drawResultsInMainCanvas();
  updateMemberPropertiesTable();
  renderLoadList();
  updateButtonStates();

  modeLabel.textContent = `Mode: ${model.mode} | Zoom: ${Math.round(zoom*100)}%`;
  const sm = selectedMembers();
  selectedLabel.textContent =
    sm.length ? `Selected members: ${sm.map(m => m.id).join(", ")}` :
    model.selectedNode ? `Selected node: ${model.selectedNode.id}` :
    model.selectedNodes.length ? `Selected nodes: ${model.selectedNodes.join(", ")}` :
    "Selected: none";
}

function updateButtonStates() {
  const modeButtons = [
    [modeNode, "node"],
    [modeMember, "member"],
    [modeSelect, "select"],
    [modeSupport, "support"]
  ];
  modeButtons.forEach(([button, mode]) => button?.classList.toggle("is-active", model.mode === mode));
  showDiagramBtn?.classList.toggle("is-active", diagramsVisible);
  toggleLoadsBtn?.classList.toggle("is-active", !loadsVisible);
}

function drawMainDiagramTitle() {
  const base = baseModelBounds();
  const titlePoint = toCanvas((base.minX + base.maxX) / 2, base.minY - mainTitleDrop(base));
  const text = "Structural Framing Diagram";
  ctx.fillStyle = annotationColor();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  setScaledFont(20);
  reserveLabelBox(titlePoint.x, titlePoint.y, text, 6);
  ctx.fillText(text, titlePoint.x, titlePoint.y);
  if (diagramsVisible) {
    const smTitle = "Shear & Moment Diagram";
    setScaledFont(12);
    reserveLabelBox(titlePoint.x, titlePoint.y + scaled(24), smTitle, 5);
    ctx.fillText(smTitle, titlePoint.x, titlePoint.y + scaled(24));
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  setScaledFont(12);
}

function drawGrid() {
  ctx.strokeStyle = themeColor("--grid", "#d1d5db");
  ctx.fillStyle = annotationColor();
  ctx.lineWidth = scaled(1);
  setScaledFont(12);

  for (let i=0; i<model.v.length; i++) {
    const x = model.v[i];
    const a = toCanvas(x, model.h[0]);
    const b = toCanvas(x, model.h[model.h.length-1]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }

  for (let i=0; i<model.h.length; i++) {
    const y = model.h[i];
    const a = toCanvas(model.v[0], y);
    const b = toCanvas(model.v[model.v.length-1], y);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    const levelLabel = i === 0 ? "Base" : `Level-${i}, EL-${y}m`;
    ctx.fillStyle = annotationColor();
    setScaledFont(9);
    const p = findClearLabelPoint(a.x, a.y, levelLabel, [
      {x: -scaled(38), y: -scaled(7)},
      {x: -scaled(58), y: -scaled(7)},
      {x: -scaled(38), y: scaled(12)},
      {x: -scaled(58), y: scaled(12)}
    ]);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(levelLabel, p.x, p.y);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    setScaledFont(12);
  }

  drawGridBubbles();
  drawAutoDimensions();
}

function drawArrowHead(x, y, angle, size) {
  const headSize = scaled(size * 5);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - headSize*Math.cos(angle-Math.PI/7), y - headSize*Math.sin(angle-Math.PI/7));
  ctx.moveTo(x, y);
  ctx.lineTo(x - headSize*Math.cos(angle+Math.PI/7), y - headSize*Math.sin(angle+Math.PI/7));
  ctx.stroke();
}

function drawRotatedText(text, x, y, angle, color = annotationColor()) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, 0);
  ctx.restore();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function drawDimensionSegment(x1, y1, x2, y2, label, textOffset) {
  const color = annotationColor();
  const angle = Math.atan2(y2-y1, x2-x1);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = scaled(1);
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  drawArrowHead(x1, y1, angle + Math.PI, 1.75);
  drawArrowHead(x2, y2, angle, 1.75);
  ctx.restore();
  const mx = (x1+x2)/2;
  const my = (y1+y2)/2;
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);
  const p = findClearLabelPoint(mx, my, label, [
    {x: nx*textOffset, y: ny*textOffset},
    {x: nx*textOffset*1.8, y: ny*textOffset*1.8},
    {x: -nx*textOffset, y: -ny*textOffset},
    {x: nx*textOffset + Math.cos(angle)*scaled(18), y: ny*textOffset + Math.sin(angle)*scaled(18)},
    {x: nx*textOffset - Math.cos(angle)*scaled(18), y: ny*textOffset - Math.sin(angle)*scaled(18)}
  ]);
  drawRotatedText(label, p.x, p.y, angle, color);
}

function gridLetter(index) {
  let n = index + 1;
  let label = "";
  while (n > 0) {
    n--;
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26);
  }
  return label;
}

function drawGridBubbles() {
  if (model.v.length < 1 || model.h.length < 1) return;
  const top = toCanvas(0, model.h[model.h.length-1]).y - scaled(98 + 18);
  const color = annotationColor();
  const isNight = document.body.dataset.theme === "green_teal";
  setScaledFont(12);
  for (let i=0; i<model.v.length; i++) {
    const x = toCanvas(model.v[i], 0).x;
    ctx.beginPath();
    ctx.arc(x, top, scaled(15), 0, Math.PI*2);
    ctx.fillStyle = isNight ? "#000" : "#fff";
    ctx.fill();
    ctx.strokeStyle = isNight ? "#fff" : color;
    ctx.lineWidth = scaled(1);
    ctx.stroke();
    ctx.fillStyle = isNight ? "#fff" : color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(gridLetter(i), x, top + scaled(1));
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function drawAutoDimensions() {
  if (model.v.length < 2 || model.h.length < 2) return;
  const topY = toCanvas(0, model.h[model.h.length-1]).y - scaled(98);
  const leftX = toCanvas(model.v[0], 0).x - scaled(118);
  const tick = scaled(8);
  const gap = scaled(4);
  const color = annotationColor();

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = scaled(1);
  for (let i=0; i<model.v.length-1; i++) {
    const x1 = toCanvas(model.v[i], 0).x;
    const x2 = toCanvas(model.v[i+1], 0).x;
    const frameY = toCanvas(0, model.h[model.h.length-1]).y;
    ctx.beginPath();
    ctx.moveTo(x1, topY-tick); ctx.lineTo(x1, topY+tick);
    ctx.moveTo(x2, topY-tick); ctx.lineTo(x2, topY+tick);
    ctx.moveTo(x1, topY); ctx.lineTo(x1, frameY - gap);
    ctx.moveTo(x2, topY); ctx.lineTo(x2, frameY - gap);
    ctx.stroke();
    drawDimensionSegment(x1, topY, x2, topY, `${(model.v[i+1]-model.v[i]).toFixed(2)} m`, scaled(-9));
  }

  for (let i=0; i<model.h.length-1; i++) {
    const y1 = toCanvas(0, model.h[i]).y;
    const y2 = toCanvas(0, model.h[i+1]).y;
    const frameX = toCanvas(model.v[0], 0).x;
    ctx.beginPath();
    ctx.moveTo(leftX-tick, y1); ctx.lineTo(leftX+tick, y1);
    ctx.moveTo(leftX-tick, y2); ctx.lineTo(leftX+tick, y2);
    ctx.moveTo(leftX, y1); ctx.lineTo(frameX - gap, y1);
    ctx.moveTo(leftX, y2); ctx.lineTo(frameX - gap, y2);
    ctx.stroke();
    drawDimensionSegment(leftX, y1, leftX, y2, `${(model.h[i+1]-model.h[i]).toFixed(2)} m`, scaled(-10));
  }
}

function drawColumnSectionDimensionLabels() {
  const columns = model.members.filter(member => member.type === "Column");
  if (!columns.length) return;
  const color = annotationColor();
  const tick = scaled(5);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(0.8, scaled(1));
  setScaledFont(9);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  columns.forEach((member, index) => {
    normalizeMemberProperties(member);
    const a = getNode(member.i);
    const b = getNode(member.j);
    if (!a || !b) return;
    const bottomNode = a.y <= b.y ? a : b;
    const topNode = a.y > b.y ? a : b;
    const base = toCanvas(bottomNode.x, bottomNode.y);
    const top = toCanvas(topNode.x, topNode.y);
    const widthLabel = `b=${Math.round(Number(member.width) || 0)}mm`;
    const heightLabel = `h=${Math.round(Number(member.height) || 0)}mm`;
    const sectionW = scaled(34);
    const sectionH = scaled(24);
    const sectionY = base.y + scaled(118 + (index % 2) * 10);
    const sectionX = base.x - sectionW / 2;
    const horizontalY = sectionY + sectionH + scaled(20);
    const horizontalHalf = Math.max(sectionW / 2, scaled(24));
    const verticalHalf = Math.max(sectionH / 2, scaled(18));
    const side = index === 0 ? -1 : 1;
    const sideX = sectionX + (side < 0 ? -scaled(22) : sectionW + scaled(22));
    const sideY = sectionY + sectionH / 2;

    ctx.fillStyle = themeColor("--surface", "#fff");
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.9, scaled(1));
    ctx.beginPath();
    ctx.rect(sectionX, sectionY, sectionW, sectionH);
    ctx.fill();
    ctx.stroke();

    const innerPad = scaled(5);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.65, scaled(0.75));
    ctx.strokeRect(sectionX + innerPad, sectionY + innerPad, Math.max(1, sectionW - innerPad * 2), Math.max(1, sectionH - innerPad * 2));

    ctx.fillStyle = color;
    const barRadius = Math.max(1.7, scaled(2.4));
    [
      [sectionX + innerPad, sectionY + innerPad],
      [sectionX + sectionW - innerPad, sectionY + innerPad],
      [sectionX + innerPad, sectionY + sectionH - innerPad],
      [sectionX + sectionW - innerPad, sectionY + sectionH - innerPad]
    ].forEach(([bx, by]) => {
      ctx.beginPath();
      ctx.arc(bx, by, barRadius, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.beginPath();
    ctx.moveTo(base.x - horizontalHalf, horizontalY);
    ctx.lineTo(base.x + horizontalHalf, horizontalY);
    ctx.moveTo(base.x - horizontalHalf, horizontalY - tick);
    ctx.lineTo(base.x - horizontalHalf, horizontalY + tick);
    ctx.moveTo(base.x + horizontalHalf, horizontalY - tick);
    ctx.lineTo(base.x + horizontalHalf, horizontalY + tick);
    ctx.stroke();
    reserveLabelBox(base.x, horizontalY + scaled(13), widthLabel, 4);
    ctx.fillText(widthLabel, base.x, horizontalY + scaled(13));

    ctx.beginPath();
    ctx.moveTo(sideX, sideY - verticalHalf);
    ctx.lineTo(sideX, sideY + verticalHalf);
    ctx.moveTo(sideX - tick, sideY - verticalHalf);
    ctx.lineTo(sideX + tick, sideY - verticalHalf);
    ctx.moveTo(sideX - tick, sideY + verticalHalf);
    ctx.lineTo(sideX + tick, sideY + verticalHalf);
    ctx.stroke();
    drawRotatedText(heightLabel, sideX + side * scaled(13), sideY, -Math.PI / 2, color);
  });

  ctx.restore();
}

function drawMembers() {
  const transform = modelTransform();
  const modelMinX = Math.min(...model.v);
  const modelMaxX = Math.max(...model.v);
  for (const m of model.members) {
    const a = getNode(m.i);
    const b = getNode(m.j);
    if (!a || !b) continue;

    const A = toCanvas(a.x, a.y);
    const B = toCanvas(b.x, b.y);
    const selected = model.selectedMemberIds.includes(m.id);

    normalizeMemberProperties(m);
    ctx.strokeStyle = selected ? themeColor("--selected", "#ef4444") : (m.type === "Column" ? themeColor("--column", "#111827") : themeColor("--beam", "#2563eb"));
    ctx.lineWidth = selected ? Math.max(2.4, scaled(2.5)) : Math.max(1.1, scaled(1.35));
    ctx.setLineDash([]);

    if (m.type === "Column") {
      const widthPx = Math.max(2, Number(m.width) / 1000 * transform.scale);
      const left = A.x - widthPx / 2;
      const top = Math.min(A.y, B.y);
      const bottom = Math.max(A.y, B.y);
      ctx.strokeRect(left, top, widthPx, bottom - top);
    } else if (m.type === "Beam") {
      const depthPx = Math.max(2, Number(m.height) / 1000 * transform.scale);
      const columnAtStart = model.members.find(member => member.type === "Column" && (sameId(member.i, m.i) || sameId(member.j, m.i)));
      const columnAtEnd = model.members.find(member => member.type === "Column" && (sameId(member.i, m.j) || sameId(member.j, m.j)));
      const startExtension = Math.abs(a.x - modelMinX) < 1e-6 ? (Number(columnAtStart?.width) || 0) / 2000 * transform.scale : 0;
      const endExtension = Math.abs(b.x - modelMaxX) < 1e-6 ? (Number(columnAtEnd?.width) || 0) / 2000 * transform.scale : 0;
      const left = Math.min(A.x, B.x) - startExtension;
      const right = Math.max(A.x, B.x) + endExtension;
      const top = Math.min(A.y, B.y);
      const bottom = top + depthPx;
      ctx.beginPath();
      ctx.moveTo(left, top); ctx.lineTo(right, top);
      ctx.moveTo(left, bottom); ctx.lineTo(right, bottom);
      if (startExtension > 0) { ctx.moveTo(left, top); ctx.lineTo(left, bottom); }
      if (endExtension > 0) { ctx.moveTo(right, top); ctx.lineTo(right, bottom); }
      ctx.stroke();
    }

    drawMemberLabel(m, A, B);
  }
}

function drawMemberLabel(m, A, B) {
  const midX = (A.x+B.x)/2;
  const midY = (A.y+B.y)/2;
  const dx = B.x-A.x;
  const dy = B.y-A.y;
  const len = Math.hypot(dx,dy) || 1;
  const nx = -dy/len;
  const ny = dx/len;
  const label = memberDisplayName(m);

  ctx.fillStyle = annotationColor();
  setScaledFont(10);
  if (m.type === "Beam") {
    const p = findClearLabelPoint(midX, midY, label, [
      {x: 0, y: scaled(14)},
      {x: 0, y: scaled(21)},
      {x: scaled(23), y: scaled(17)},
      {x: -scaled(23), y: scaled(17)}
    ]);
    drawRotatedText(label, p.x, p.y, 0, annotationColor());
  } else if (m.type === "Column") {
    const p = findClearLabelPoint(midX, midY, label, [
      {x: -scaled(6), y: 0},
      {x: -scaled(9), y: 0},
      {x: -scaled(6), y: scaled(12)},
      {x: -scaled(6), y: -scaled(12)}
    ]);
    drawRotatedText(label, p.x, p.y, -Math.PI/2, annotationColor());
  } else {
    let angle = Math.atan2(dy, dx);
    if (angle > Math.PI / 2) angle -= Math.PI;
    if (angle < -Math.PI / 2) angle += Math.PI;
    drawRotatedText(label, midX + nx*scaled(14), midY + ny*scaled(14), angle, annotationColor());
  }
}

function concreteElasticModulus(fc = designInputData().fc) {
  return 4700 * Math.sqrt(Math.max(17, Number(fc) || 28));
}

function barArea(diameter) {
  return Math.PI * Math.pow(Number(diameter) || 0, 2) / 4;
}

function roundedSpacing(value) {
  return Math.max(75, Math.floor(Math.max(75, value) / 25) * 25);
}

function loadCategory(loadCase) {
  const name = String(loadCase || "").toUpperCase();
  if (name === "DL" || name === "SDL") return "D";
  if (name === "LL" || name === "P") return "L";
  if (name === "WL") return "W";
  if (name === "EQ" || name === "EQL") return "E";
  return null;
}

function scaledCombinationModel(sourceModel, factors) {
  const copy = clone(sourceModel);
  copy.loads = (copy.loads || []).map(load => {
    const category = loadCategory(load.case);
    const factor = category ? Number(factors[category] || 0) : 0;
    const scaled = {...load};
    ["w","wx","p","fx","fy","mz"].forEach(field => {
      if (scaled[field] != null) scaled[field] = (Number(scaled[field]) || 0) * factor;
    });
    return scaled;
  }).filter(load => ["w","wx","p","fx","fy","mz"].some(field => Math.abs(Number(load[field]) || 0) > 1e-12));
  return copy;
}

function buildStrengthEnvelope(sourceModel) {
  const combinations = [
    {name:"U1 1.4D", factors:{D:1.4,L:0,W:0,E:0}},
    {name:"U2 1.2D + 1.6L", factors:{D:1.2,L:1.6,W:0,E:0}},
    {name:"U3 1.2D + 1.0L + 1.0W", factors:{D:1.2,L:1.0,W:1.0,E:0}},
    {name:"U4 0.9D + 1.0W", factors:{D:0.9,L:0,W:1.0,E:0}},
    {name:"U5 1.2D + 1.0L + 1.0E", factors:{D:1.2,L:1.0,W:0,E:1.0}},
    {name:"U6 0.9D + 1.0E", factors:{D:0.9,L:0,W:0,E:1.0}}
  ];
  const analyses = combinations.map(combo => ({
    ...combo,
    result: runBasicFrameAnalysis(scaledCombinationModel(sourceModel, combo.factors), {selfWeightFactor:combo.factors.D, resultType:"FACTORED", combination:combo.name})
  }));
  const members = {};
  (sourceModel.members || []).forEach(member => {
    const demand = {positiveMoment:0,negativeMoment:0,shear:0,axial:0,endMoment:0,governingPositive:"",governingNegative:"",governingShear:"",governingAxial:""};
    analyses.forEach(analysis => {
      if (!analysis.result.valid) return;
      const diagram = analysis.result.memberResults?.[member.id];
      const end = analysis.result.memberEndForces?.[member.id];
      const positive = Math.max(0, Number(diagram?.maxPositiveMoment) || 0);
      const negative = Math.abs(Math.min(0, Number(diagram?.maxNegativeMoment) || 0));
      const shear = Math.max(Math.abs(Number(diagram?.maxShear) || 0), Math.abs(Number(end?.start?.shear)||0), Math.abs(Number(end?.end?.shear)||0));
      const axial = Math.max(Math.abs(Number(end?.start?.axial)||0), Math.abs(Number(end?.end?.axial)||0));
      const endMoment = Math.max(Math.abs(Number(end?.start?.moment)||0), Math.abs(Number(end?.end?.moment)||0));
      if (positive > demand.positiveMoment) { demand.positiveMoment = positive; demand.governingPositive = analysis.name; }
      if (negative > demand.negativeMoment) { demand.negativeMoment = negative; demand.governingNegative = analysis.name; }
      if (shear > demand.shear) { demand.shear = shear; demand.governingShear = analysis.name; }
      if (axial > demand.axial) { demand.axial = axial; demand.governingAxial = analysis.name; }
      demand.endMoment = Math.max(demand.endMoment, endMoment);
    });
    members[member.id] = demand;
  });
  return {members, analyses, valid:analyses.every(item => item.result.valid), basis:"Factored D/L/W/E strength envelope using combinations U1 through U6"};
}

function preliminaryReinforcement(member, result) {
  if (!result || !lastStrengthEnvelope) return {pu:"-", mu:"-", asReq:"-", bars:"Calculate", supportBars:"Calculate", midspanBars:"Calculate", transverse:"Calculate", status:"CALCULATE", recommendation:"Press Calculate to generate the member design.", utilization:"-", governing:"-"};
  const design = memberDesignData(member);
  const fc = design.fc;
  const fy = design.fy;
  const b = Number(member.width) || 300;
  const h = Number(member.height) || 500;
  const demand = lastStrengthEnvelope.members?.[member.id] || {};
  const muPositive = Number(demand.positiveMoment) || 0;
  const muNegative = Number(demand.negativeMoment) || 0;
  const mu = Math.max(muPositive, muNegative, Number(demand.endMoment) || 0);
  const vu = Number(demand.shear) || 0;
  const pu = member.type === "Column" ? Number(demand.axial) || 0 : 0;
  const tieDia = design.tieBarDia;

  if (member.type === "Beam") {
    const mainDia = design.beamBarDia;
    const d = Math.max(h * 0.65, h - design.cover - tieDia - mainDia / 2);
    const asMin = Math.max(0.25 * Math.sqrt(fc) / fy * b * d, 1.4 / fy * b * d);
    const requiredAs = moment => {
      const rn = moment * 1e6 / Math.max(1, 0.9 * b * d * d);
      const discriminant = 1 - 2 * rn / Math.max(0.001, 0.85 * fc);
      if (discriminant <= 0) return {as:Infinity,doublyRequired:true};
      const rho = 0.85 * fc / fy * (1 - Math.sqrt(discriminant));
      return {as:Math.max(asMin, rho * b * d),doublyRequired:false};
    };
    const topDesign = requiredAs(muNegative);
    const bottomDesign = requiredAs(muPositive);
    const topCount = Number.isFinite(topDesign.as) ? Math.max(2, Math.ceil(topDesign.as / barArea(mainDia))) : 0;
    const bottomCount = Number.isFinite(bottomDesign.as) ? Math.max(2, Math.ceil(bottomDesign.as / barArea(mainDia))) : 0;
    const topProvided = topCount * barArea(mainDia);
    const bottomProvided = bottomCount * barArea(mainDia);
    const phiMn = asProvided => {
      if (!asProvided) return 0;
      const beta1 = Math.max(0.65, 0.85 - Math.max(0, fc - 28) * 0.05 / 7);
      const a = asProvided * fy / (0.85 * fc * b);
      const c = a / beta1;
      const et = c > 0 ? 0.003 * (d - c) / c : 0.005;
      const phi = et >= 0.005 ? 0.9 : et <= 0.002 ? 0.65 : 0.65 + (et - 0.002) * 0.25 / 0.003;
      return phi * asProvided * fy * (d - a / 2) / 1e6;
    };
    const topCapacity = phiMn(topProvided);
    const bottomCapacity = phiMn(bottomProvided);
    const vc = 0.17 * Math.sqrt(fc) * b * d / 1000;
    const av = 2 * barArea(tieDia);
    const shearDemand = Math.max(0, vu / 0.75 - vc);
    const strengthSpacing = shearDemand > 0 ? av * fy * d / (shearDemand * 1000) : 600;
    const minSpacing = av * fy / Math.max(0.062 * Math.sqrt(fc) * b, 0.35 * b);
    const spacing = roundedSpacing(Math.min(strengthSpacing, minSpacing, d / 2, 600));
    const vs = av * fy * d / spacing / 1000;
    const phiVn = 0.75 * (vc + vs);
    const topClear = topCount > 1 ? (b - 2 * (design.cover + tieDia) - topCount * mainDia) / (topCount - 1) : 999;
    const bottomClear = bottomCount > 1 ? (b - 2 * (design.cover + tieDia) - bottomCount * mainDia) / (bottomCount - 1) : 999;
    const congested = Math.min(topClear,bottomClear) < Math.max(25,mainDia);
    const utilization = Math.max(muNegative / Math.max(0.001,topCapacity), muPositive / Math.max(0.001,bottomCapacity), vu / Math.max(0.001,phiVn));
    const warnings = [];
    if (topDesign.doublyRequired || bottomDesign.doublyRequired) warnings.push("DOUBLY REINFORCED DESIGN REQUIRED");
    if (congested) warnings.push("BAR CONGESTION");
    if (utilization > 1) warnings.push("PROVIDED STRENGTH INSUFFICIENT");
    const recommendation = memberRepairRecommendation(member, {
      kind: "Beam",
      utilization,
      warnings,
      width: b,
      height: h,
      barDia: mainDia,
      topCount,
      bottomCount,
      muPositive,
      muNegative,
      vu
    });
    return {
      pu: "0",
      mu: valueText(mu, ""),
      asReq: `${Number.isFinite(topDesign.as) ? Math.ceil(topDesign.as) : "NG"} top / ${Number.isFinite(bottomDesign.as) ? Math.ceil(bottomDesign.as) : "NG"} bottom`,
      bars: `${Math.max(topCount,bottomCount)}-D${mainDia}`,
      supportBars: topCount ? `${topCount}-D${mainDia} top (As=${Math.round(topProvided)})` : "SECTION INADEQUATE",
      midspanBars: bottomCount ? `${bottomCount}-D${mainDia} bottom (As=${Math.round(bottomProvided)})` : "SECTION INADEQUATE",
      transverse: `2-Leg D${tieDia} @ ${spacing} mm`,
      status: warnings.length ? "REVISE" : "PASS",
      recommendation,
      utilization: Number.isFinite(utilization) ? utilization.toFixed(2) : ">1.00",
      governing: `${demand.governingNegative || "-"} / ${demand.governingPositive || "-"}`
    };
  }

  const mainDia = design.columnBarDia;
  const ag = b * h;
  const phi = 0.65;
  const axialSteel = Math.max(0, (pu * 1000 / (phi * 0.8) - 0.85 * fc * ag) / Math.max(1, fy - 0.85 * fc));
  const effectiveDepth = Math.max(h * 0.7, h - design.cover - tieDia - mainDia / 2);
  const momentSteel = mu * 1e6 / Math.max(1, 0.9 * fy * 0.8 * effectiveDepth);
  const asReq = Math.max(0.01 * ag, axialSteel, momentSteel);
  const count = Math.max(4, Math.ceil(asReq / barArea(mainDia)));
  const asProvided = count * barArea(mainDia);
  const tieSpacing = roundedSpacing(Math.min(16 * mainDia, 48 * tieDia, Math.min(b, h)));
  const phiPnMax = phi * 0.8 * (0.85 * fc * (ag - asProvided) + fy * asProvided) / 1000;
  const approxPhiMn = 0.65 * asProvided * fy * 0.8 * effectiveDepth / 1e6;
  const screeningUtilization = pu / Math.max(0.001,phiPnMax) + mu / Math.max(0.001,approxPhiMn);
  const ratio = asProvided / ag;
  const warnings = [];
  if (ratio < 0.01) warnings.push("Ast BELOW 1% Ag");
  if (ratio > 0.04) warnings.push("HIGH REBAR CONGESTION");
  if (ratio > 0.08) warnings.push("Ast ABOVE 8% Ag");
  if (screeningUtilization > 1) warnings.push("P-M SCREENING FAIL");
  const recommendation = memberRepairRecommendation(member, {
    kind: "Column",
    utilization: screeningUtilization,
    warnings,
    width: b,
    height: h,
    barDia: mainDia,
    count,
    pu,
    mu
  });
  return {
    pu: valueText(pu, ""),
    mu: valueText(mu, ""),
    asReq: Math.ceil(asReq).toString(),
    bars: `${count}-D${mainDia} (As=${Math.round(asProvided)} mm2)`,
    supportBars: "N/A",
    midspanBars: "N/A",
    transverse: `D${tieDia} ties @ ${tieSpacing} mm`,
    status: warnings.length ? "REVISE" : "PASS",
    recommendation,
    utilization: screeningUtilization.toFixed(2),
    governing: demand.governingAxial || "-"
  };
}

function nextStandardBarDia(currentDia, steps = 1) {
  const bars = [10, 12, 16, 20, 25, 28, 32, 36];
  const currentIndex = bars.findIndex(dia => dia > Number(currentDia));
  const start = currentIndex >= 0 ? currentIndex : bars.length - 1;
  return bars[Math.min(bars.length - 1, start + Math.max(0, steps - 1))];
}

function roundUpTo(value, step) {
  return Math.ceil(Number(value) / step) * step;
}

function memberRepairRecommendation(member, data) {
  const name = memberDisplayName(member);
  const warnings = data.warnings || [];
  const failed = warnings.length || Number(data.utilization) > 1;
  if (!failed) {
    if (data.kind === "Column") {
      return `No change required. Keep ${data.width}x${data.height} mm with ${data.count}-D${data.barDia}; utilization ${Number(data.utilization).toFixed(2)}.`;
    }
    return `No change required. Keep the ${data.width}x${data.height} mm section and D${data.barDia} reinforcement shown; utilization ${Number(data.utilization).toFixed(2)}.`;
  }

  const utilization = Number.isFinite(Number(data.utilization)) ? Math.max(1, Number(data.utilization)) : 1.35;
  const nextBar = nextStandardBarDia(data.barDia, utilization > 1.25 ? 2 : 1);

  if (data.kind === "Beam") {
    const deeper = roundUpTo(Math.max(data.height + 50, data.height * Math.sqrt(utilization) * 1.12), 50);
    const wider = roundUpTo(Math.max(data.width + 50, data.width * Math.min(1.45, 1 + (utilization - 1) * 0.45)), 50);
    const issues = [];
    if (warnings.some(item => /STRENGTH/i.test(item))) issues.push("flexural or shear demand exceeds the current provided capacity");
    if (warnings.some(item => /CONGESTION/i.test(item))) issues.push("the current bar arrangement is congested");
    if (warnings.some(item => /DOUBLY/i.test(item))) issues.push("the current section requires a doubly reinforced solution");
    const actions = [issues.length ? `Issue: ${issues.join(" and ")}` : "Issue: member utilization exceeds 1.00"];
    if (warnings.some(item => /CONGESTION|DOUBLY/i.test(item))) {
      actions.push(`increase ${name} width from ${data.width} mm to about ${wider} mm`);
    }
    actions.push(`increase ${name} depth from ${data.height} mm to about ${deeper} mm`);
    actions.push(`try D${nextBar} beam bars with a revised bar layout`);
    if (data.vu > 0) actions.push("use tighter stirrup spacing near supports");
    actions.push("reduce span or factored load if the section cannot grow");
    return actions.join("; ") + ".";
  }

  const side = Math.max(data.width, data.height);
  const newSide = roundUpTo(Math.max(side + 50, side * Math.sqrt(utilization) * 1.12), 50);
  const barCount = Math.max(Number(data.count) + 2, Math.ceil(Number(data.count) * Math.min(1.65, utilization * 1.08)));
  return [
    `Issue: combined axial and bending demand exceeds the current column capacity at utilization ${utilization.toFixed(2)}`,
    `increase ${name} column size from ${data.width}x${data.height} mm to about ${newSide}x${newSide} mm`,
    `try ${barCount}-D${nextBar} longitudinal bars`,
    "reduce unsupported height or lateral load if the section cannot grow"
  ].join("; ") + ".";
}

function designStatusClass(status) {
  const text = String(status || "");
  if (text.startsWith("REVISE")) return "design-fail";
  if (text === "PASS") return "design-ok";
  return "design-unverified";
}

function updateMemberPropertiesTable() {
  const body = document.getElementById("memberPropsBody");
  if (!body) return;
  if (!model.members.length && !model.nodes.length) {
    body.innerHTML = '<tr><td colspan="30">No data</td></tr>';
    return;
  }

  const result = lastAnalysisResult || (diagramsVisible ? runBasicFrameAnalysis(model) : null);
  const memberRows = model.members.map(m => normalizeMemberProperties(m)).map(m => {
    const r = result?.memberResults?.[m.id] || computedMemberDiagramValues(model, m);
    const sw = memberSelfWeight(m);
    const dlTotal = memberAutoDeadLoad(m);
    const rebar = preliminaryReinforcement(m, result);
    return `
    <tr>
      <td><input class="member-name-input" data-member-name="${m.id}" value="${escapeHtml(memberDisplayName(m))}" /></td>
      <td>${m.type}</td>
      <td><input class="member-dim-input" data-member-dim="${m.id}" data-field="width" value="${escapeHtml(m.width)}" /></td>
      <td><input class="member-dim-input" data-member-dim="${m.id}" data-field="height" value="${escapeHtml(m.height)}" /></td>
      <td><input class="member-bar-input" data-member-rebar="${m.id}" data-field="${m.type === "Column" ? "columnBarDia" : "beamBarDia"}" value="${escapeHtml(m.type === "Column" ? (m.columnBarDia || designInputData().columnBarDia) : (m.beamBarDia || designInputData().beamBarDia))}" /></td>
      <td><input class="member-bar-input" data-member-rebar="${m.id}" data-field="tieBarDia" value="${escapeHtml(m.tieBarDia || designInputData().tieBarDia)}" /></td>
      <td>${propertyText(m.A, "")}</td>
      <td>${propertyText(m.I, "")}</td>
      <td>${propertyText(m.E, "")}</td>
      <td>${valueText(sw, "")}</td>
      <td>${valueText(dlTotal, "")}</td>
      <td>${valueText(r.maxShear || 0, "")}</td>
      <td>${valueText(r.maxMoment || 0, "")}</td>
      <td>${rebar.pu}</td>
      <td>${rebar.mu}</td>
      <td>${rebar.asReq}</td>
      <td>${rebar.supportBars}</td>
      <td>${rebar.midspanBars}</td>
      <td>${m.type === "Column" ? rebar.bars : "N/A"}</td>
      <td>${rebar.transverse}</td>
      <td>${rebar.governing}</td>
      <td class="${designStatusClass(rebar.status)}">${rebar.status}</td>
      <td class="design-recommendation ${String(rebar.status).startsWith("REVISE") ? "needs-action" : "ok-action"}">${escapeHtml(rebar.recommendation || "")}</td>
      <td>${rebar.utilization}</td>
      <td></td><td></td><td></td><td></td><td></td><td></td>
    </tr>
  `;
  });

  const nodeRows = (result?.nodalForces || model.nodes.map(node => ({node: node.id, fx: 0, fy: 0, mz: 0})))
    .sort((a, b) => Number(a.node) - Number(b.node))
    .map(load => `
      <tr>
        <td>${nodeDisplayName(getNode(load.node) || {id: load.node})}</td>
        <td>Node Sum P/M</td>
        ${"<td></td>".repeat(25)}
        <td>${valueText(load.fx || 0, "")}</td>
        <td>${valueText(load.fy || 0, "")}</td>
        <td>${momentText(load.mz || 0)}</td>
      </tr>
    `);

  const reactionRows = (result?.supportReactions || [])
    .filter(reaction => Math.abs(reaction.rx || 0) > 0.001 || Math.abs(reaction.ry || 0) > 0.001 || Math.abs(reaction.mz || 0) > 0.001 || model.supports?.[reaction.node])
    .map(reaction => `
      <tr>
        <td>${reaction.id}</td>
        <td>${reaction.support || "Support"}</td>
        ${"<td></td>".repeat(22)}
        <td>${valueText(reaction.rx || 0, "")}</td>
        <td>${valueText(reaction.ry || 0, "")}</td>
        <td>${momentText(reaction.mz || 0)}</td>
        <td></td><td></td><td></td>
      </tr>
    `);

  body.innerHTML = [...memberRows, ...nodeRows, ...reactionRows].join("") || '<tr><td colspan="30">No data</td></tr>';
}

function momentText(value) {
  const mz = Number(value) || 0;
  if (Math.abs(mz) < 0.05) return "0";
  return valueText(mz, "") + " " + (mz >= 0 ? "CCW" : "CW");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function drawNodes() {
  const isNight = document.body.dataset.theme === "green_teal";
  for (const n of model.nodes) {
    const p = toCanvas(n.x, n.y);
    const nodeLabel = String(n.id);
    const nodeRadius = scaled(nodeLabel.length > 2 ? 9 : 8);
    ctx.beginPath();
    ctx.arc(p.x, p.y, nodeRadius, 0, Math.PI*2);
    const isSelected = model.selectedNode?.id === n.id || model.selectedNodes.includes(n.id);
    ctx.fillStyle = isSelected ? "#f59e0b" : (isNight ? "#000" : "#fff");
    ctx.fill();
    ctx.strokeStyle = isNight ? "#fff" : annotationColor();
    ctx.lineWidth = Math.max(0.9, scaled(1.35));
    ctx.stroke();

    ctx.fillStyle = isNight && !isSelected ? "#fff" : annotationColor();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    setScaledFont(nodeLabel.length > 2 ? 7.5 : 8.5);
    ctx.fillText(nodeLabel, p.x, p.y + scaled(0.5));
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    if (model.supports[n.id]) drawSupport(p.x, p.y, model.supports[n.id]);
  }
}

function drawSupport(x, y, type) {
  ctx.strokeStyle = themeColor("--support", "#16a34a");
  ctx.fillStyle = themeColor("--support", "#16a34a");
  ctx.lineWidth = scaled(2);

  if (type === "Fixed") {
    ctx.beginPath(); ctx.moveTo(x-scaled(16), y+scaled(22)); ctx.lineTo(x+scaled(16), y+scaled(22)); ctx.stroke();
    for (let i=-14; i<=14; i+=7) {
      ctx.beginPath(); ctx.moveTo(x+scaled(i), y+scaled(22)); ctx.lineTo(x+scaled(i-7), y+scaled(32)); ctx.stroke();
    }
  } else {
    ctx.beginPath(); ctx.moveTo(x, y+scaled(12)); ctx.lineTo(x-scaled(14), y+scaled(32)); ctx.lineTo(x+scaled(14), y+scaled(32)); ctx.closePath(); ctx.stroke();
    if (type.includes("Roller")) {
      ctx.beginPath(); ctx.arc(x-scaled(7), y+scaled(37), scaled(3), 0, Math.PI*2); ctx.arc(x+scaled(7), y+scaled(37), scaled(3), 0, Math.PI*2); ctx.stroke();
    }
  }

  ctx.fillStyle = annotationColor();
  setScaledFont(9);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const labelY = type === "Fixed" ? y + scaled(35) : y + scaled(43);
  ctx.fillText(type, x, labelY);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function currentAnalysisResult() {
  if (lastAnalysisResult) return lastAnalysisResult;
  return diagramsVisible ? runBasicFrameAnalysis(model) : null;
}

function drawSupportReactions() {
  const result = currentAnalysisResult();
  if (!result?.supportReactions?.length) return;
  const color = themeColor("--support", "#16a34a");
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  setScaledFont(9);

  for (const reaction of result.supportReactions) {
    const node = getNode(reaction.node);
    if (!node) continue;
    const p = toCanvas(node.x, node.y);
    const rx = Number(reaction.rx) || 0;
    const ry = Number(reaction.ry ?? reaction.value) || 0;
    const mz = Number(reaction.mz) || 0;
    const xRestrained = reaction.support === "Fixed" || reaction.support === "Pinned" || reaction.support === "Roller X";

    if (Math.abs(ry) > 0.001) {
      const startY = ry >= 0 ? p.y + scaled(86) : p.y + scaled(42);
      const endY = ry >= 0 ? p.y + scaled(46) : p.y + scaled(88);
      arrow(p.x, startY, p.x, endY, color, 7, 2.4);
      const text = `${reaction.id}y = ${valueText(ry, "kN")}`;
      const label = findClearLabelPoint(p.x, p.y + scaled(106), text, [
        {x: 0, y: 0},
        {x: scaled(42), y: 0},
        {x: -scaled(42), y: 0},
        {x: 0, y: scaled(18)}
      ]);
      reserveLabelBox(label.x, label.y, text, 4);
      ctx.fillText(text, label.x, label.y);
    }

    if (Math.abs(rx) > 0.001 || xRestrained) {
      const dir = rx >= 0 ? 1 : -1;
      if (Math.abs(rx) > 0.001) {
        const startX = p.x - dir * scaled(50);
        const endX = p.x - dir * scaled(16);
        arrow(startX, p.y, endX, p.y, color, 7, 2.4);
      }
      const text = `${reaction.id}x = ${valueText(rx, "kN")}`;
      const label = findClearLabelPoint(p.x - dir * scaled(60), p.y - scaled(20), text, [
        {x: 0, y: 0},
        {x: 0, y: scaled(18)},
        {x: dir * scaled(34), y: 0},
        {x: -dir * scaled(34), y: 0}
      ]);
      reserveLabelBox(label.x, label.y, text, 4);
      ctx.fillText(text, label.x, label.y);
    }

    if (Math.abs(mz) > 0.001) {
      const cx = p.x;
      const cy = p.y;
      drawMomentArrow(cx, cy, mz, color, 1.3);
      const text = `${reaction.id}z = ${momentText(mz)}`;
      const label = findClearLabelPoint(cx, cy - scaled(34), text, [
        {x: 0, y: 0},
        {x: scaled(40), y: 0},
        {x: -scaled(40), y: 0},
        {x: 0, y: -scaled(18)},
        {x: 0, y: scaled(18)}
      ]);
      reserveLabelBox(label.x, label.y, text, 4);
      ctx.fillText(text, label.x, label.y);
    }
  }

  ctx.restore();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function arrow(x1, y1, x2, y2, color, head=8, width=2) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  const headSize = scaled(head * 1.25);
  ctx.lineWidth = Math.max(0.6, scaled(width * 0.5));
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  ctx.lineTo(x2,y2);
  ctx.stroke();

  const ang = Math.atan2(y2-y1, x2-x1);
  ctx.beginPath();
  ctx.moveTo(x2,y2);
  ctx.lineTo(x2-headSize*Math.cos(ang-Math.PI/6), y2-headSize*Math.sin(ang-Math.PI/6));
  ctx.moveTo(x2,y2);
  ctx.lineTo(x2-headSize*Math.cos(ang+Math.PI/6), y2-headSize*Math.sin(ang+Math.PI/6));
  ctx.stroke();
}

function openArrowHead(x, y, angle, color, head=8, width=2) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  const headSize = scaled(head * 1.25);
  ctx.lineWidth = Math.max(0.6, scaled(width * 0.5));
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - headSize * Math.cos(angle - Math.PI / 6), y - headSize * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(x, y);
  ctx.lineTo(x - headSize * Math.cos(angle + Math.PI / 6), y - headSize * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
}

function drawMomentArrow(cx, cy, value, color, widthScale = 1) {
  const positive = value >= 0;
  const radius = scaled(12);
  const start = positive ? -Math.PI * 0.1 : Math.PI * 1.1;
  const end = positive ? Math.PI * 0.4 : Math.PI * 0.6;
  const steps = 10;
  let previous = null;
  let last = null;

  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, scaled(1 * widthScale));
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = start + (end - start) * t;
    const point = {
      x: cx + Math.cos(angle) * radius,
      y: cy - Math.sin(angle) * radius
    };
    if (i === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
    previous = last;
    last = point;
  }
  ctx.stroke();

  if (previous && last) {
    openArrowHead(last.x, last.y, Math.atan2(last.y - previous.y, last.x - previous.x), color, 6, 1.4 * widthScale);
  }
}

function typicalColumnArrowLength() {
  const spans = [];
  for (let i = 0; i < model.h.length - 1; i++) {
    const a = toCanvas(model.v[0] || 0, model.h[i]);
    const b = toCanvas(model.v[0] || 0, model.h[i + 1]);
    const span = Math.abs(a.y - b.y);
    if (span > 1) spans.push(span);
  }
  const columnSpan = spans.length ? Math.min(...spans) : scaled(90);
  return Math.max(scaled(14), columnSpan * 0.25);
}

function drawLoads() {
  const memberUdlMap = {};
  const memberPointStack = {};
  const nodeLoadMap = {};
  for (const L of model.loads) {
    if (L.kind === "node") {
      const key = L.node;
      if (!nodeLoadMap[key]) nodeLoadMap[key] = {kind:"node", case:"P", node:key, fx:0, fy:0, mz:0};
      nodeLoadMap[key].fx += Number(L.fx) || 0;
      nodeLoadMap[key].fy += Number(L.fy) || 0;
      nodeLoadMap[key].mz += Number(L.mz) || 0;
    }
    if (L.kind === "member_udl") {
      const key = L.member;
      if (!memberUdlMap[key]) memberUdlMap[key] = {kind:"member_udl", member:key, cases:{}};
      const loadCase = L.case || "UDL";
      if (!memberUdlMap[key].cases[loadCase]) memberUdlMap[key].cases[loadCase] = {w:0, wx:0};
      memberUdlMap[key].cases[loadCase].w += Number(L.w) || 0;
      memberUdlMap[key].cases[loadCase].wx += Number(L.wx) || 0;
    }
    if (L.kind === "member_point") {
      memberPointStack[L.member] = (memberPointStack[L.member] || 0) + 1;
      drawPointLoad(L, memberPointStack[L.member]);
    }
  }
  Object.values(memberUdlMap).forEach(load => {
    load.label = Object.entries(load.cases)
      .map(([caseName, values]) => {
        const parts = [];
        const wy = Number(values.w) || 0;
        const wx = Number(values.wx) || 0;
        if (wy) parts.push(`${caseName}y=${valueText(Math.abs(wy), "kN/m")}`);
        if (wx) parts.push(`${caseName}x=${valueText(wx, "kN/m")}`);
        return parts.join(" + ");
      })
      .filter(Boolean)
      .join(" + ");
    drawUdl(load, 1);
  });
  Object.values(nodeLoadMap).forEach(load => drawNodeLoad(load));
}

function drawNodeLoad(L) {
  const n = getNode(L.node);
  if (!n) return;
  const p = toCanvas(n.x, n.y);
  const loadColor = themeColor("--point", "#00C74C");
  const verticalColor = loadColor;
  const len = typicalColumnArrowLength();
  const fxVal = Number(L.fx) || 0;
  const fyVal = Number(L.fy) || 0;
  const mzVal = Number(L.mz) || 0;

  if (fxVal) {
    const dir = fxVal >= 0 ? 1 : -1;
    const endX = p.x - dir * scaled(14);
    const startX = endX - dir * len;
    const y = p.y - scaled(2);
    arrow(startX, y, endX, y, loadColor, 8, 2.52);
    setScaledFont(9);
    ctx.fillStyle = loadColor;
    const text = `${L.case}: Px=${valueText(fxVal, "kN")}`;
    const tx = (startX + endX) / 2;
    const ty = y - scaled(13);
    drawSafeText(text, tx, ty, [
      {x: 0, y: 0},
      {x: 0, y: -scaled(14)},
      {x: dir * scaled(20), y: -scaled(14)},
      {x: -dir * scaled(20), y: -scaled(14)}
    ], "center", loadColor);
  }
  if (fyVal) {
    const topX = p.x;
    const dir = fyVal >= 0 ? -1 : 1;
    const endY = p.y - dir * scaled(14);
    const startY = endY - dir * len;
    const farY = Math.min(startY, endY);
    arrow(topX, startY, topX, endY, verticalColor, 8, 2.52);
    setScaledFont(9);
    ctx.fillStyle = verticalColor;
    const text = `${L.case}: Py=${valueText(fyVal, "kN")}`;
    const lp = findClearLabelPoint(topX, farY - scaled(16), text, [
      {x: 0, y: 0},
      {x: scaled(30), y: 0},
      {x: -scaled(30), y: 0},
      {x: scaled(16), y: -scaled(18)},
      {x: -scaled(16), y: -scaled(18)}
    ]);
    drawSafeText(text, lp.x, lp.y, [
      {x: 0, y: 0},
      {x: scaled(24), y: 0},
      {x: -scaled(24), y: 0},
      {x: 0, y: -scaled(16)}
    ], "center", verticalColor);
  }
  if (mzVal) {
    setScaledFont(9);
    ctx.fillStyle = loadAnnotationColor();
    const momentCx = p.x;
    const momentCy = p.y;
    drawMomentArrow(momentCx, momentCy, mzVal, loadColor, 1.3);
    const direction = mzVal >= 0 ? "CCW" : "CW";
    const text = `${L.case}: Mz=${valueText(mzVal, "kN-m")} ${direction}`;
    drawSafeText(text, momentCx, momentCy - scaled(42), [
      {x: 0, y: 0},
      {x: scaled(28), y: 0},
      {x: -scaled(28), y: 0},
      {x: 0, y: -scaled(16)},
      {x: 0, y: scaled(16)}
    ], "center", loadAnnotationColor());
  }
  ctx.textAlign = "left";
}

function drawColumnSelfWeights() {
  const color = loadAnnotationColor();
  for (const m of model.members) {
    if (m.type !== "Column") continue;
    const ends = memberStartEnd(m);
    if (!ends) continue;
    const sw = columnSelfWeight(m);
    if (sw <= 0) continue;
    const A = toCanvas(ends.start.x, ends.start.y);
    const B = toCanvas(ends.end.x, ends.end.y);
    const side = 1;
    const x = Math.max(A.x, B.x) + scaled(26);
    const yTop = Math.min(A.y, B.y);
    const yBot = Math.max(A.y, B.y);
    const arrowLen = Math.min(typicalColumnArrowLength(), Math.abs(yBot - yTop) * 0.25);
    const midY = (yTop + yBot) / 2;
    arrow(x, midY - arrowLen / 2, x, midY + arrowLen / 2, color, 7, 1.5);
    setScaledFont(9);
    drawRotatedText(`SW=${valueText(sw, "kN/m")}`, x + side*scaled(18), midY, -Math.PI/2, loadAnnotationColor());
  }
}

function drawUdl(L, stackIndex) {
  const m = getMember(L.member);
  if (!m) return;
  const ends = memberStartEnd(m);
  if (!ends) return;
  const A = toCanvas(ends.start.x, ends.start.y);
  const B = toCanvas(ends.end.x, ends.end.y);
  const dx = B.x-A.x;
  const dy = B.y-A.y;
  const len = Math.hypot(dx,dy) || 1;
  const tx = dx/len;
  const ty = dy/len;
  const color = loadAnnotationColor();
  const depth = scaled(18);
  const isHorizontalMember = Math.abs(dy) < scaled(1.5);

  if (isHorizontalMember) {
    const startPad = scaled(2);
    const beamTopY = Math.min(A.y, B.y) - scaled(2.4);
    const lowerY = beamTopY - scaled(0.6) - (stackIndex - 1) * (depth + scaled(1));
    const upperY = lowerY - depth;
    const leftX = Math.min(A.x, B.x) + startPad;
    const rightX = Math.max(A.x, B.x) - startPad;

    ctx.strokeStyle = color;
    ctx.fillStyle = "rgba(255,150,31,.08)";
    ctx.lineWidth = scaled(1);
    ctx.beginPath();
    ctx.rect(leftX, upperY, Math.max(1, rightX - leftX), depth);
    ctx.fill();
    ctx.stroke();

    for (let x = leftX + (rightX - leftX) * 0.14; x < rightX; x += Math.max(scaled(28), (rightX - leftX) * 0.16)) {
      arrow(x, upperY + scaled(2), x, lowerY - scaled(0.2), color, 6, 1.5);
    }

    setScaledFont(9);
    drawRotatedText(L.label || `${L.case}: w=${L.w} kN/m`, (leftX + rightX) / 2, upperY - scaled(10), 0, loadAnnotationColor());
    return;
  }

  let nx = -ty;
  let ny = tx;
  if (m.type === "Column") { nx = -1; ny = 0; }
  if (m.type === "Beam" && ny > 0) { nx *= -1; ny *= -1; }
  const memberGap = 0;
  const stackStep = scaled(20);
  const offset = memberGap + (stackIndex-1)*stackStep;
  const startPad = scaled(8);
  const x1 = A.x + tx*startPad + nx*offset;
  const y1 = A.y + ty*startPad + ny*offset;
  const x2 = B.x - tx*startPad + nx*offset;
  const y2 = B.y - ty*startPad + ny*offset;
  const x3 = x2 + nx*depth;
  const y3 = y2 + ny*depth;
  const x4 = x1 + nx*depth;
  const y4 = y1 + ny*depth;
  ctx.strokeStyle = color;
  ctx.fillStyle = "rgba(255,150,31,.08)";
  ctx.lineWidth = scaled(1);
  ctx.beginPath();
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath();
  ctx.fill(); ctx.stroke();
  for (let t=0.14; t<0.92; t+=0.16) {
    const bx = A.x + t*dx + nx*(offset+depth);
    const by = A.y + t*dy + ny*(offset+depth);
    const tipInset = scaled(4);
    arrow(bx, by, bx - nx*(depth-tipInset), by - ny*(depth-tipInset), color, 6, 1.5);
  }
  setScaledFont(9);
  drawRotatedText(L.label || `${L.case}: w=${L.w} kN/m`, (x3+x4)/2 + nx*scaled(10), (y3+y4)/2 + ny*scaled(10), Math.atan2(ty, tx), loadAnnotationColor());
}

function drawPointLoad(L, stackIndex) {
  const m = getMember(L.member);
  if (!m) return;
  const ends = memberStartEnd(m);
  if (!ends) return;

  const A = toCanvas(ends.start.x, ends.start.y);
  const B = toCanvas(ends.end.x, ends.end.y);
  const trueLength = Math.hypot(ends.end.x-ends.start.x, ends.end.y-ends.start.y) || 1;
  const ratio = Math.max(0, Math.min(1, L.x / trueLength));
  const x = A.x + ratio*(B.x-A.x);
  const y = A.y + ratio*(B.y-A.y);

  const color = themeColor("--point", "#16a34a");
  const loadLen = typicalColumnArrowLength();
  const offset = scaled(12 + (stackIndex-1)*14);

  if (m.type === "Column") {
    arrow(x + offset + loadLen, y, x + offset, y, color, 7, 1.5);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x + offset + loadLen, y, scaled(3), 0, Math.PI*2); ctx.fill();
    setScaledFont(9);
    drawRotatedText(`${L.case}: P=${L.p} kN @ ${L.x} m`, x + offset + loadLen + scaled(12), y, -Math.PI/2, loadAnnotationColor());
  } else {
    arrow(x, y - offset - loadLen, x, y - offset, color, 7, 1.5);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y - offset - loadLen, scaled(3), 0, Math.PI*2); ctx.fill();
    setScaledFont(9);
    const label = `${L.case}: P=${L.p} kN @ ${L.x} m`;
    const isHorizontalMember = Math.abs(B.y - A.y) < scaled(1.5);
    if (isHorizontalMember) {
      const beamTopY = Math.min(A.y, B.y) - scaled(2.4);
      const udlUpperY = beamTopY - scaled(0.6) - scaled(18);
      drawSafeText(label, x, udlUpperY - scaled(26), [
        {x: 0, y: 0},
        {x: 0, y: -scaled(14)},
        {x: scaled(24), y: 0},
        {x: -scaled(24), y: 0},
        {x: 0, y: scaled(14)}
      ], "center", color);
    } else {
      drawRotatedText(label, x+scaled(42), y - offset - loadLen / 2, 0, loadAnnotationColor());
    }
  }
}

function updateLoadInputs() {
  const isNodeLoad = loadType.value === "node";
  nodeLoadInputs.style.display = isNodeLoad ? "block" : "none";
  memberUdlInputs.style.display = loadType.value === "member_udl" ? "block" : "none";
  memberPointInputs.style.display = loadType.value === "member_point" ? "block" : "none";
  if (typeof assignNodeLoad !== "undefined" && assignNodeLoad) assignNodeLoad.style.display = isNodeLoad ? "block" : "none";
  if (isNodeLoad) loadCase.value = "P";
}

function loadTargetText(load) {
  if (load.kind === "node") return nodeDisplayName(getNode(load.node) || {id: load.node});
  const member = getMember(load.member);
  return member ? memberDisplayName(member) : `M-${load.member}`;
}

function loadSummaryText(load, index) {
  const target = loadTargetText(load);
  const loadCaseName = load.case || (load.kind === "node" ? "P" : "LOAD");
  if (load.kind === "node") {
    return `${index + 1}. ${loadCaseName} @ ${target}: Px=${valueText(load.fx || 0, "kN")}, Py=${valueText(load.fy || 0, "kN")}, Mz=${momentText(load.mz || 0)}`;
  }
  if (load.kind === "member_udl") {
    const parts = [];
    if (Math.abs(Number(load.w) || 0) > 1e-9) parts.push(`Wy=${valueText(load.w || 0, "kN/m")}`);
    if (Math.abs(Number(load.wx) || 0) > 1e-9) parts.push(`Wx=${valueText(load.wx || 0, "kN/m")}`);
    return `${index + 1}. ${loadCaseName} UDL @ ${target}: ${parts.join(", ") || "0 kN/m"}`;
  }
  if (load.kind === "member_point") {
    return `${index + 1}. ${loadCaseName} point @ ${target}: ${valueText(load.p || 0, "kN")} at ${valueText(load.x || 0, "m")}`;
  }
  return `${index + 1}. ${loadCaseName} @ ${target}`;
}

function renderLoadList() {
  if (!loadList) return;
  if (!model.loads.length) {
    loadList.innerHTML = "No loads assigned.";
    return;
  }
  loadList.innerHTML = model.loads.map((load, index) => `
    <div class="load-list-row">
      <span>${escapeHtml(loadSummaryText(load, index))}</span>
      <button type="button" class="delete-load-btn" data-delete-load="${index}" aria-label="Delete load ${index + 1}">Delete</button>
    </div>
  `).join("");
}

function deleteLoadAtIndex(index) {
  const loadIndex = Number(index);
  if (!Number.isInteger(loadIndex) || loadIndex < 0 || loadIndex >= model.loads.length) {
    status("Load was not found.");
    return;
  }
  const label = loadSummaryText(model.loads[loadIndex], loadIndex);
  pushHistory();
  model.loads.splice(loadIndex, 1);
  lastAnalysisResult = null;
  diagramsVisible = false;
  showDiagramBtn.textContent = "Show/Hide S&M Diagram";
  status(`Deleted load: ${label}`);
  draw();
}

function assignNodePointLoad() {
  if (!model.selectedNode) {
    status("Select a node first, then click Assign to Node.");
    return;
  }

  const fxVal = Number(fx.value) || 0;
  const fyVal = Number(fy.value) || 0;
  const mzVal = Number(mz.value) || 0;
  if (!fxVal && !fyVal && !mzVal) {
    status("Px, Py, and Mz are all zero. No node load was added.");
    return;
  }

  pushHistory();
  model.loads.push({kind:"node", case:"P", node:model.selectedNode.id, fx:fxVal, fy:fyVal, mz:mzVal});
  lastAnalysisResult = null;
  status(`P load assigned to ${nodeDisplayName(model.selectedNode)}.`);
  draw();
}

function saveRecordNames(names) {
  localStorage.setItem("strucforge_record_names", JSON.stringify(names));
}

function getRecordNames() {
  try {
    return JSON.parse(localStorage.getItem("strucforge_record_names")) || [];
  } catch {
    return [];
  }
}

function refreshRecords() {
  const names = getRecordNames();
  savedRecords.innerHTML = "";
  for (const name of names) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    savedRecords.appendChild(option);
  }
}

function saveRecord() {
  const name = recordName.value.trim() || savedRecords.value || "Frame 1";
  recordName.value = name;
  localStorage.setItem("strucforge_record_" + name, JSON.stringify(modelPackage()));
  const names = getRecordNames();
  if (!names.includes(name)) names.push(name);
  saveRecordNames(names);
  refreshRecords();
  savedRecords.value = name;
  status(`Saved "${name}" to browser records.`);
}

function loadProjectPackage(data, sourceName, options = {}) {
  const payload = normalizeModelPayload(data);
  if (!payload.model || typeof payload.model !== "object") {
    throw new Error("Invalid frame model JSON.");
  }
  if (RESTRICTED_FRAME) {
    const candidate = payload.model;
    const validShape = Array.isArray(candidate.v) && candidate.v.length === 3
      && Array.isArray(candidate.h) && candidate.h.length === 2
      && Array.isArray(candidate.nodes) && candidate.nodes.length === 6
      && Array.isArray(candidate.members) && candidate.members.length === 5;
    if (!validShape) throw new Error("This calculator accepts only a two-beam, three-column frame file.");
  }

  if (options.pushHistory !== false) pushHistory();
  Object.assign(model, payload.model);
  if (payload.view) {
    zoom = Number(payload.view.zoom) || 1;
    pan = payload.view.pan || {x: 0, y: 0};
    fontScale = Number(payload.view.fontScale) || fontScale;
    loadsVisible = payload.view.loadsVisible !== false;
    membersVisible = payload.view.membersVisible !== false;
    if (typeof toggleLoadsBtn !== "undefined" && toggleLoadsBtn) toggleLoadsBtn.textContent = "Show/Hide Loading";
    if (fontScaleSelect) fontScaleSelect.value = String(fontScale);
  }
  vPositions.value = (model.v || []).join(",");
  hPositions.value = (model.h || []).join(",");
  if (RESTRICTED_FRAME) {
    const v = model.v || [0, 4, 8];
    const h = model.h || [0, 3];
    if (span1Input) span1Input.value = Number(v[1] - v[0]).toFixed(2).replace(/\.00$/, "");
    if (span2Input) span2Input.value = Number(v[2] - v[1]).toFixed(2).replace(/\.00$/, "");
    if (frameHeightInput) frameHeightInput.value = Number(h[1] - h[0]).toFixed(2).replace(/\.00$/, "");
    const beam = model.members.find(member => member.type === "Beam");
    const column = model.members.find(member => member.type === "Column");
    if (beam) { beamWidth.value = beam.width; beamHeight.value = beam.height; }
    if (column) { columnWidth.value = column.width; columnHeight.value = column.height; }
    model.supports = {1:"Fixed", 2:"Fixed", 3:"Fixed"};
  }
  if (payload.design) {
    const designFields = {concreteFc:payload.design.fc, steelFy:payload.design.fy, clearCover:payload.design.cover, beamBarDia:payload.design.beamBarDia, columnBarDia:payload.design.columnBarDia, tieBarDia:payload.design.tieBarDia};
    Object.entries(designFields).forEach(([id, value]) => { const input = document.getElementById(id); if (input && value != null) input.value = value; });
  }
  const concreteE = concreteElasticModulus();
  model.members.forEach(member => { member.E = concreteE; normalizeMemberProperties(member); });
  if (payload.project) {
    const setField = (id, value) => {
      const input = document.getElementById(id);
      if (input) input.value = value || "";
    };
    setField("projectTitle", payload.project.title);
    setField("projectOwner", payload.project.owner);
    setField("projectLocation", payload.project.location);
    setField("designedBy", payload.project.designedBy);
  }
  if (payload.theme) setTheme(payload.theme, true);
  prepareCanvasSizes();
  draw();
  status(`Loaded ${sourceName || "JSON file"}.`);
}

async function loadDefaultProject() {
  if (RESTRICTED_FRAME) {
    try {
      const response = await fetch("JSON/2bms-3cols-3.json", {cache: "no-store"});
      if (!response.ok) throw new Error("Default restricted frame JSON not found.");
      const data = await response.json();
      currentFileHandle = null;
      loadProjectPackage(data, "JSON/2bms-3cols-3.json", {pushHistory: false});
      recordName.value = "2bms-3cols-3";
    } catch (err) {
      loadProjectPackage(restrictedDefaultPackage(), "built-in 2bms-3cols-3 fallback", {pushHistory: false});
      recordName.value = "2bms-3cols-3";
      status("Loaded built-in fallback. JSON/2bms-3cols-3.json was not available.");
    }
    return;
  }
  try {
    let data = null;
    const embedded = document.getElementById("defaultProjectData");
    if (embedded && embedded.textContent.trim()) {
      data = JSON.parse(embedded.textContent);
    } else {
      const response = await fetch("Sample%20Project.json", {cache: "no-store"});
      if (!response.ok) throw new Error("Default model not found.");
      data = await response.json();
    }
    currentFileHandle = null;
    loadProjectPackage(data, "Default Sample Project", {pushHistory: false});
    recordName.value = "Default Sample Project";
  } catch (err) {
    status("Ready. Default sample project was not loaded.");
  }
}

function loadRecord() {
  const name = savedRecords.value;
  if (!name) {
    status("No saved record selected.");
    return;
  }

  const raw = localStorage.getItem("strucforge_record_" + name);
  if (!raw) {
    status("Selected record was not found.");
    return;
  }

  try {
    loadProjectPackage(JSON.parse(raw), `"${name}"`);
    recordName.value = name;
  } catch {
    status("Could not load saved record.");
  }
}


function deleteObjectAtPoint(px, py) {
  const node = getNodeAt(px, py);
  const member = node ? null : getMemberAt(px, py);
  if (!node && !member) {
    status("Delete tool: no node or member found at click point.");
    return;
  }

  pushHistory();
  if (node) {
    const nodeId = node.id;
    const connectedMemberIds = new Set(model.members.filter(m => sameId(m.i, nodeId) || sameId(m.j, nodeId)).map(m => m.id));
    model.nodes = model.nodes.filter(n => !sameId(n.id, nodeId));
    model.members = model.members.filter(m => !connectedMemberIds.has(m.id));
    delete model.supports[nodeId];
    model.loads = model.loads.filter(L => !sameId(L.node, nodeId) && !connectedMemberIds.has(L.member));
    status(`Deleted Node ${nodeId} and connected member(s).`);
  } else {
    model.members = model.members.filter(m => !sameId(m.id, member.id));
    model.loads = model.loads.filter(L => !sameId(L.member, member.id));
    status(`Deleted Member ${member.id}.`);
  }

  model.selectedNodes = [];
  model.selectedMemberIds = [];
  model.selectedNode = null;
  renumberNodesSystematically();
  lastAnalysisResult = null;
  diagramsVisible = false;
  showDiagramBtn.textContent = "Show/Hide S&M Diagram";
  draw();
}

function deleteSelectedItems() {
  const nodeIds = new Set(model.selectedNodes || []);
  if (model.selectedNode) nodeIds.add(model.selectedNode.id);
  const memberIds = new Set(model.selectedMemberIds || []);

  if (!nodeIds.size && !memberIds.size) {
    status("Select node(s) or member(s) first.");
    return;
  }

  pushHistory();
  if (nodeIds.size) {
    for (const member of model.members) {
      if (idSetHas(nodeIds, member.i) || idSetHas(nodeIds, member.j)) memberIds.add(member.id);
    }
    model.nodes = model.nodes.filter(node => !idSetHas(nodeIds, node.id));
    for (const nodeId of nodeIds) delete model.supports[nodeId];
  }

  model.members = model.members.filter(member => !idSetHas(memberIds, member.id));
  model.loads = model.loads.filter(load => {
    if (load.node && idSetHas(nodeIds, load.node)) return false;
    if (load.member && idSetHas(memberIds, load.member)) return false;
    return true;
  });
  model.selectedNodes = [];
  model.selectedMemberIds = [];
  model.selectedNode = null;
  renumberNodesSystematically();
  lastAnalysisResult = null;
  diagramsVisible = false;
  showDiagramBtn.textContent = "Show/Hide S&M Diagram";
  status("Selected item(s) deleted.");
  draw();
}

function deleteRecord() {
  const name = savedRecords.value;
  if (!name) {
    status("No record selected.");
    return;
  }

  localStorage.removeItem("strucforge_record_" + name);
  saveRecordNames(getRecordNames().filter(n => n !== name));
  refreshRecords();
  status(`Deleted "${name}".`);
}

function printHeaderHtml() {
  const p = projectHeaderData();
  const title = p.title || "Structural Frame Diagram";
  const printedAt = new Date();
  const disclaimerLine1 = "Disclaimer: Calculations must be checked and approved";
  const disclaimerLine2 = "by a licensed Structural or Civil Engineer.";
  const disclaimerLine3 = "Preliminary design aid only; not a substitute for professional engineering judgment.";
  return `
    <div class="print-header">
      <img class="print-logo" src="assets/LOGO-STRUCF.png?v=3" alt="StrucForge Structural Design Studio" />
      <div class="print-header-main">
        <div class="print-date">${escapeHtml(printedAt.toLocaleDateString())}, ${escapeHtml(printedAt.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}))}</div>
        <h1>${escapeHtml(title)}</h1>
        <div class="print-meta">
          <span><strong>Owner:</strong> ${escapeHtml(p.owner || "-")}</span>
          <span><strong>Location:</strong> ${escapeHtml(p.location || "-")}</span>
          <span><strong>Designed by:</strong> ${escapeHtml(p.designedBy || "-")}</span>
          <span><strong>Date:</strong> ${escapeHtml(printedAt.toLocaleDateString())}</span>
        </div>
      </div>
      <div class="print-disclaimer">${escapeHtml(disclaimerLine1)}<br>${escapeHtml(disclaimerLine2)}<br>${escapeHtml(disclaimerLine3)}</div>
    </div>
  `;
}

function croppedCanvasDataUrl(sourceCanvas, marginPx = 28) {
  const sourceCtx = sourceCanvas.getContext("2d");
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const pixels = sourceCtx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = 0, maxY = 0;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const idx = (y * w + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const a = pixels[idx + 3];
      if (a > 12 && (r < 248 || g < 248 || b < 248)) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (minX > maxX || minY > maxY) return sourceCanvas.toDataURL("image/png");
  minX = Math.max(0, minX - marginPx);
  minY = Math.max(0, minY - marginPx);
  maxX = Math.min(w - 1, maxX + marginPx);
  maxY = Math.min(h - 1, maxY + marginPx);

  const cropW = Math.max(1, maxX - minX + 1);
  const cropH = Math.max(1, maxY - minY + 1);
  const out = document.createElement("canvas");
  out.width = cropW;
  out.height = cropH;
  const outCtx = out.getContext("2d");
  outCtx.fillStyle = "#fff";
  outCtx.fillRect(0, 0, cropW, cropH);
  outCtx.drawImage(sourceCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
  return out.toDataURL("image/png");
}

function capturePrintDiagramImage({withLoads, withResults}) {
  const previousLoadsVisible = loadsVisible;
  const previousDiagramsVisible = diagramsVisible;
  const previousText = showDiagramBtn?.textContent;

  loadsVisible = !!withLoads;
  diagramsVisible = !!withResults;
  if (showDiagramBtn) showDiagramBtn.textContent = "Show/Hide S&M Diagram";
  draw();

  const imageUrl = croppedCanvasDataUrl(canvas);

  loadsVisible = previousLoadsVisible;
  diagramsVisible = previousDiagramsVisible;
  if (showDiagramBtn && previousText) showDiagramBtn.textContent = previousText;
  draw();

  return imageUrl;
}

function preparePrintPages(target = "printer") {
  const printRoot = document.getElementById("printPages");
  if (!printRoot) return;
  if (!lastAnalysisResult) lastAnalysisResult = runBasicFrameAnalysis(model);

  const frameDiagramUrl = capturePrintDiagramImage({withLoads: true, withResults: false});
  const smDiagramUrl = capturePrintDiagramImage({withLoads: false, withResults: true});
  updateMemberPropertiesTable();
  const tableHtml = memberPropsTable.querySelector("table")?.outerHTML || "<table><tbody><tr><td>No data</td></tr></tbody></table>";

  printRoot.innerHTML = `
    <section class="print-page print-diagram-page">
      ${printHeaderHtml()}
      <div class="print-page-title">Page 1 - Frame Diagram with Loadings</div>
      <img class="print-diagram-img" src="${frameDiagramUrl}" alt="Frame diagram with loadings" />
    </section>
    <section class="print-page print-diagram-page">
      ${printHeaderHtml()}
      <div class="print-page-title">Page 2 - Shear &amp; Moment Diagram</div>
      <img class="print-diagram-img" src="${smDiagramUrl}" alt="Shear and moment diagram" />
    </section>
    <section class="print-page print-table-page">
      ${printHeaderHtml()}
      <div class="print-page-title">Page 3 - Member Properties / Results</div>
      <div class="print-table-wrap">${tableHtml}</div>
    </section>
  `;
  printRoot.dataset.target = target;
  document.body.classList.add("print-ready");
}

function printReport(target) {
  preparePrintPages(target);
  status(target === "pdf" ? "Print dialog opened. Choose Save as PDF." : "Print dialog opened. Choose a local printer.");
  setTimeout(() => window.print(), 60);
}

window.addEventListener("afterprint", () => {
  const printRoot = document.getElementById("printPages");
  if (printRoot) printRoot.innerHTML = "";
  document.body.classList.remove("print-ready");
});

memberPropsTable.addEventListener("change", e => {
  const nameInput = e.target.closest("[data-member-name]");
  if (nameInput) {
    setMemberDisplayName(nameInput.dataset.memberName, nameInput.value);
    return;
  }
  const dimInput = e.target.closest("[data-member-dim]");
  if (dimInput) {
    setMemberDimension(dimInput.dataset.memberDim, dimInput.dataset.field, dimInput.value);
    return;
  }
  const rebarInput = e.target.closest("[data-member-rebar]");
  if (rebarInput) setMemberRebar(rebarInput.dataset.memberRebar, rebarInput.dataset.field, rebarInput.value);
});

let memberTableInputTimer = null;
memberPropsTable.addEventListener("input", e => {
  const editable = e.target.closest("[data-member-dim], [data-member-rebar]");
  if (!editable) return;
  clearTimeout(memberTableInputTimer);
  memberTableInputTimer = setTimeout(() => {
    if (!document.contains(editable)) return;
    const dimInput = editable.closest("[data-member-dim]");
    if (dimInput) {
      setMemberDimension(dimInput.dataset.memberDim, dimInput.dataset.field, dimInput.value);
      return;
    }
    const rebarInput = editable.closest("[data-member-rebar]");
    if (rebarInput) setMemberRebar(rebarInput.dataset.memberRebar, rebarInput.dataset.field, rebarInput.value);
  }, 450);
});

memberPropsTable.addEventListener("keydown", e => {
  const input = e.target.closest("[data-member-name], [data-member-dim], [data-member-rebar]");
  if (!input) return;
  if (e.key === "Enter") {
    e.preventDefault();
    input.blur();
  }
});

const memberPropsTitle = memberPropsTable?.querySelector(".member-props-title");
if (memberPropsTitle) {
  memberPropsTitle.setAttribute("role", "button");
  memberPropsTitle.setAttribute("tabindex", "0");
  memberPropsTitle.setAttribute("title", "Click to show/hide member properties and recommendations");
  const toggleMemberProps = () => {
    memberPropsTable.classList.toggle("is-open");
    status(memberPropsTable.classList.contains("is-open")
      ? "Member Properties / Results table opened."
      : "Member Properties / Results table hidden.");
  };
  memberPropsTitle.addEventListener("click", toggleMemberProps);
  memberPropsTitle.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleMemberProps();
    }
  });
}

canvas.addEventListener("wheel", e => {
  e.preventDefault();
  if (viewLocked) {
    status("Zoom/Pan is locked.");
    return;
  }
  const pt = eventToCanvas(e);
  const before = fromCanvas(pt.x, pt.y);
  zoom = Math.max(minZoom, Math.min(maxZoom, zoom * (e.deltaY < 0 ? 1.12 : 0.89)));
  const after = toCanvas(before.x, before.y);
  pan.x += pt.x - after.x;
  pan.y += pt.y - after.y;
  draw();
}, {passive:false});

canvas.addEventListener("mousedown", e => {
  if (viewLocked) return;
  if (e.button === 1 || e.button === 2 || (e.shiftKey && model.mode !== "member")) {
    isPanning = true;
    didPan = false;
    lastPan = {x: e.clientX, y: e.clientY};
  }
});

canvas.addEventListener("mousemove", e => {
  if (viewLocked) return;
  if (!isPanning) return;
  const dx = e.clientX - lastPan.x;
  const dy = e.clientY - lastPan.y;
  if (Math.abs(dx) + Math.abs(dy) > 1) didPan = true;
  pan.x += dx;
  pan.y += dy;
  lastPan = {x: e.clientX, y: e.clientY};
  draw();
});

canvas.addEventListener("mouseup", () => isPanning = false);
canvas.addEventListener("mouseleave", () => isPanning = false);
canvas.addEventListener("contextmenu", e => e.preventDefault());

canvas.addEventListener("click", e => {
  if (didPan) {
    didPan = false;
    return;
  }

  const pt = eventToCanvas(e);
  const px = pt.x;
  const py = pt.y;
  const additive = e.ctrlKey || e.shiftKey;

  if (deleteMode) {
    deleteObjectAtPoint(px, py);
    return;
  }

  if (loadType.value === "node" && model.mode === "node") {
    const loadNode = getNodeAt(px, py);
    if (loadNode) {
      model.selectedNode = loadNode;
      model.selectedNodes = [];
      model.selectedMemberIds = [];
      status(`${nodeDisplayName(loadNode)} selected for Node P Load. Click Assign to Node.`);
      draw();
      return;
    }
  }

  // Dedicated selection mode: this is the most reliable way to select existing members
  // because it ignores grid intersections and node creation.
  if (model.mode === "select") {
    const clickedMember = getMemberAt(px, py);
    if (clickedMember) {
      selectMember(clickedMember.id, additive);
      status(additive
        ? `Added Member ${clickedMember.id} to selection.`
        : `Selected Member ${clickedMember.id}.`);
    } else {
      status("No member found at click point. Click directly on or near the member line.");
    }
    draw();
    return;
  }

  if (model.mode === "node") {
    const gp = getGridMemberIntersection(px, py) || getGridPoint(px, py);
    if (!gp) return;
    pushHistory();
    const n = addNode(gp.x, gp.y);
    if (gp.member) splitMemberAtNode(gp.member, n);
    model.selectedNode = n;
    model.selectedMemberIds = [];
    status(gp.member ? `Created Node ${n.id} at grid/member intersection.` : `Created/selected Node ${n.id}.`);
    draw();
    return;
  }

  if (model.mode === "support") {
    const n = getNodeAt(px, py);
    if (!n) return;
    pushHistory();
    model.supports[n.id] = supportType.value;
    model.selectedNode = n;
    model.selectedMemberIds = [];
    status(`Assigned ${supportType.value} support to Node ${n.id}.`);
    draw();
    return;
  }

  if (model.mode === "member") {
    const nearNode = getNodeAt(px, py);
    const clickedMember = getMemberAt(px, py);
    const gridPoint = getGridMemberIntersection(px, py) || getGridPoint(px, py);

    // In Create Member Mode, clicking an existing member away from a node selects it.
    // This prevents accidental new-node creation when the user is trying to select a member.
    if (clickedMember && !nearNode && !gridPoint) {
      selectMember(clickedMember.id, additive);
      status(additive
        ? `Added Member ${clickedMember.id} to selection.`
        : `Selected Member ${clickedMember.id}.`);
      draw();
      return;
    }

    // Ctrl/Shift click prioritizes adding existing members to selection.
    if (clickedMember && additive) {
      selectMember(clickedMember.id, true);
      status(`Added Member ${clickedMember.id} to selection.`);
      draw();
      return;
    }

    // Otherwise create a member by clicking two nodes/intersections.
    let n = nearNode;
    if (!n && gridPoint) {
      pushHistory();
      n = addNode(gridPoint.x, gridPoint.y);
      if (gridPoint.member) splitMemberAtNode(gridPoint.member, n);
    }

    if (n) {
      model.selectedNode = n;
      model.selectedMemberIds = [];
      if (!model.selectedNodes.includes(n.id)) model.selectedNodes.push(n.id);

      if (model.selectedNodes.length === 2) {
        pushHistory();
        const m = addMember(model.selectedNodes[0], model.selectedNodes[1]);
        model.selectedNodes = [];
        if (m) status(`Created/selected Member ${m.id}: ${m.type}, ${m.dim}.`);
      } else {
        status(`First node selected: Node ${n.id}. Click second node/intersection.`);
      }
      draw();
      return;
    }

    if (clickedMember) {
      selectMember(clickedMember.id, additive);
      status(additive
        ? `Added Member ${clickedMember.id} to selection.`
        : `Selected Member ${clickedMember.id}.`);
      draw();
      return;
    }
  }
});

generateGrid.onclick = () => {
  pushHistory();
  if (RESTRICTED_FRAME) {
    buildRestrictedFrame("Two-span frame updated. Reassign loads, then calculate.");
    return;
  }
  model.v = parsePositions(vPositions.value);
  model.h = parsePositions(hPositions.value);
  diagramsVisible = false;
  lastAnalysisResult = null;
  showDiagramBtn.textContent = "Show/Hide S&M Diagram";
  renumberNodesSystematically();
  status("Grid generated.");
  draw();
};

modeNode.onclick = () => { if (deleteMode) setDeleteMode(false); model.mode = "node"; model.selectedNodes = []; status("Node Mode."); draw(); };
modeMember.onclick = () => { if (deleteMode) setDeleteMode(false);
  model.mode = "member";
  model.selectedNodes = [];
  status("Create Member Mode. Click first node/intersection, then second.");
  draw();
};

modeSelect.onclick = () => { if (deleteMode) setDeleteMode(false);
  model.mode = "select";
  model.selectedNodes = [];
  model.selectedNode = null;
  status("Select Member Mode. Click a member line. Ctrl/Shift + click adds more.");
  draw();
};
modeSupport.onclick = () => { if (deleteMode) setDeleteMode(false); model.mode = "support"; model.selectedNodes = []; status("Support Mode."); draw(); };
clearSelection.onclick = () => { model.selectedNodes = []; model.selectedMemberIds = []; model.selectedNode = null; status("Selection cleared."); draw(); };
if (toolbarDeleteBtn) toolbarDeleteBtn.onclick = () => setDeleteMode(!deleteMode);
if (typeof deleteSelectedBtn !== "undefined" && deleteSelectedBtn) deleteSelectedBtn.onclick = deleteSelectedItems;

undoBtn.onclick = undo;
newDesign.onclick = () => {
  pushHistory();
  resetDesignWorkspace(RESTRICTED_FRAME ? "New two-span frame ready." : "New design ready. Generate grid to begin.");
};
clearAll.onclick = () => {
  pushHistory();
  resetDesignWorkspace("Model cleared.");
};

if (typeof zoomIn !== "undefined" && zoomIn) zoomIn.onclick = () => { zoom = Math.min(maxZoom, zoom * 1.2); draw(); };
if (typeof zoomOut !== "undefined" && zoomOut) zoomOut.onclick = () => { zoom = Math.max(minZoom, zoom / 1.2); draw(); };
resetView.onclick = () => { zoom = 1; pan = {x:0, y:0}; draw(); };

saveBtn.onclick = saveRecord;
saveAsBtn.onclick = () => saveProjectFile(true);
deleteRecordBtn.onclick = deleteRecord;
if (toolbarSaveBtn) toolbarSaveBtn.onclick = saveRecord;
if (toolbarSaveAsBtn) toolbarSaveAsBtn.onclick = () => saveProjectFile(true);
if (toolbarImportBtn) toolbarImportBtn.onclick = () => importJsonFile.click();
if (toolbarExportBtn) toolbarExportBtn.onclick = () => saveProjectFile(true);
if (toolbarOpenBtn) toolbarOpenBtn.onclick = () => importJsonFile.click();
if (toolbarPrintBtn) toolbarPrintBtn.onclick = () => printReport("printer");
if (toolbarPrintPdfBtn) toolbarPrintPdfBtn.onclick = () => printReport("pdf");
if (toolbarNewBtn) toolbarNewBtn.onclick = () => newDesign.click();
if (toolbarCalcBtn) toolbarCalcBtn.onclick = () => calculateBtn.click();
if (lockToggleBtn) lockToggleBtn.onclick = () => setViewLocked(!viewLocked);
if (themeToggleBtn) themeToggleBtn.onclick = () => setTheme(document.body.dataset.theme === "green_teal" ? "olive_saffron" : "green_teal", true);
document.querySelectorAll("[data-theme-choice]").forEach(btn => {
  btn.onclick = () => setTheme(btn.dataset.themeChoice, true);
});
fontScaleSelect.onchange = () => {
  fontScale = Number(fontScaleSelect.value) || 1;
  localStorage.setItem("strucforge_font_scale", String(fontScale));
  draw();
};
importJsonBtn.onclick = () => importJsonFile.click();
importJsonFile.onchange = async () => { const file = importJsonFile.files && importJsonFile.files[0]; if (!file) return; try { const data = JSON.parse(await file.text()); currentFileHandle = null; loadProjectPackage(data, file.name); recordName.value = file.name.replace(/\.json$/i, ""); } catch (err) { status("Could not load JSON file. Check that it is a valid frame model."); } finally { importJsonFile.value = ""; } };

assignSelectedProps.onclick = () => {
  const members = RESTRICTED_FRAME ? model.members : selectedMembers();
  if (!members.length) return;

  pushHistory();
  for (const m of members) {
    if (RESTRICTED_FRAME) {
      m.width = Number(m.type === "Column" ? columnWidth.value : beamWidth.value);
      m.height = Number(m.type === "Column" ? columnHeight.value : beamHeight.value);
    }
    normalizeMemberProperties(m);
    m.E = concreteElasticModulus();
  }

  lastAnalysisResult = null;
  renderEngineeringResults(null);
  status(RESTRICTED_FRAME ? "Beam and column sections applied to all members." : `Properties assigned to ${members.length} selected member(s).`);
  draw();
};

loadType.onchange = updateLoadInputs;

assignNodeLoad.onclick = () => {
  loadType.value = "node";
  updateLoadInputs();
  assignNodePointLoad();
};

assignLoad.onclick = () => {
  const lt = loadType.value;
  const lc = loadCase.value;

  if (lt === "node") {
    assignNodePointLoad();
    return;
  }

  if (lt === "member_point") {
    addPointLoadToSelected();
    return;
  }

  const members = selectedMembers();
  if (!members.length) {
    status("Select one or more members first.");
    return;
  }

  pushHistory();
  for (const m of members) {
    model.loads.push({kind:"member_udl", case:lc, member:m.id, w:Number(wudl.value) || 0, wx:Number(document.getElementById("wudlX")?.value) || 0});
  }

  lastAnalysisResult = null;
  status(`UDL assigned to ${members.length} selected member(s).`);
  draw();
};

assignPointLoad.onclick = () => {
  loadType.value = "member_point";
  updateLoadInputs();
  addPointLoadToSelected();
};

loadList?.addEventListener("click", event => {
  const button = event.target.closest("[data-delete-load]");
  if (!button) return;
  deleteLoadAtIndex(button.dataset.deleteLoad);
});

function prepareResultCanvas(target) {
  if (!target) return null;
  const rect = target.getBoundingClientRect();
  const cssWidth = Math.max(320, Math.round(rect.width || target.width));
  const cssHeight = Math.max(180, Math.round(rect.height || target.height));
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  target.width = Math.round(cssWidth * ratio);
  target.height = Math.round(cssHeight * ratio);
  const context = target.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);
  context.fillStyle = "#fff";
  context.fillRect(0, 0, cssWidth, cssHeight);
  context.font = "12px Arial";
  context.fillStyle = "#111";
  context.strokeStyle = "#111";
  return {context, width: cssWidth, height: cssHeight};
}

function drawSectionDetail(target, type) {
  const prepared = prepareResultCanvas(target);
  if (!prepared) return;
  const {context: c, width, height} = prepared;
  const isBeam = type === "Beam";
  const b = Number(isBeam ? beamWidth.value : columnWidth.value) || (isBeam ? 300 : 400);
  const h = Number(isBeam ? beamHeight.value : columnHeight.value) || (isBeam ? 500 : 400);
  const maxW = width * 0.44;
  const maxH = height * 0.62;
  const scale = Math.min(maxW / b, maxH / h);
  const rw = b * scale;
  const rh = h * scale;
  const x = (width - rw) / 2;
  const y = (height - rh) / 2 + 4;
  c.fillStyle = "#e5e7eb";
  c.strokeStyle = "#111";
  c.lineWidth = 2;
  c.fillRect(x, y, rw, rh);
  c.strokeRect(x, y, rw, rh);
  c.lineWidth = 1;
  const cover = Math.min(28, rw * 0.13, rh * 0.13);
  c.strokeStyle = "#777";
  c.strokeRect(x + cover, y + cover, Math.max(1, rw - cover * 2), Math.max(1, rh - cover * 2));
  c.fillStyle = "#111";
  const bars = isBeam ? [[.22,.2],[.78,.2],[.22,.8],[.5,.8],[.78,.8]] : [[.18,.18],[.82,.18],[.18,.82],[.82,.82]];
  bars.forEach(([px, py]) => { c.beginPath(); c.arc(x + rw * px, y + rh * py, 4, 0, Math.PI * 2); c.fill(); });
  c.textAlign = "center";
  c.fillText(`b = ${b} mm`, width / 2, y + rh + 25);
  c.save();
  c.translate(x - 24, y + rh / 2);
  c.rotate(-Math.PI / 2);
  c.fillText(`h = ${h} mm`, 0, 0);
  c.restore();
  const area = b * h;
  const inertia = b * Math.pow(h, 3) / 12;
  c.fillStyle = "#555";
  c.fillText(`A = ${area.toLocaleString()} mm2   I = ${inertia.toExponential(3)} mm4`, width / 2, height - 12);
}

function drawBeamBarGroup(c, count, left, right, startY, rowStep, filled = true) {
  let remaining = Math.max(2, count);
  let row = 0;
  while (remaining > 0 && row < 4) {
    const inRow = Math.min(6, remaining);
    for (let i = 0; i < inRow; i++) {
      const x = inRow === 1 ? (left + right) / 2 : left + (right - left) * i / (inRow - 1);
      const y = startY + row * rowStep;
      c.beginPath(); c.arc(x, y, 4.5, 0, Math.PI * 2);
      if (filled) c.fill(); else c.stroke();
    }
    remaining -= inRow;
    row++;
  }
}

function drawBeamSectionDetail(target, location, result) {
  const prepared = prepareResultCanvas(target);
  if (!prepared) return;
  const {context: c, width, height} = prepared;
  const b = Number(beamWidth.value) || 300;
  const h = Number(beamHeight.value) || 500;
  const design = designInputData();
  const beamDesigns = model.members.filter(member => member.type === "Beam").map(member => preliminaryReinforcement(member, result));
  const mainCount = Math.max(2, ...beamDesigns.map(item => parseInt(location === "support" ? item.supportBars : item.midspanBars, 10) || 2));
  const maxW = width * 0.38;
  const maxH = height * 0.60;
  const scale = Math.min(maxW / b, maxH / h);
  const rw = b * scale;
  const rh = h * scale;
  const x = (width - rw) / 2;
  const y = 42;
  const cover = Math.max(14, Math.min(25, design.cover * scale));
  c.fillStyle = "#e2e2e2";
  c.strokeStyle = "#222";
  c.lineWidth = 2;
  c.fillRect(x, y, rw, rh);
  c.strokeRect(x, y, rw, rh);
  c.lineWidth = 1.2;
  c.strokeStyle = "#777";
  c.strokeRect(x + cover, y + cover, rw - cover * 2, rh - cover * 2);

  const barLeft = x + cover + 7;
  const barRight = x + rw - cover - 7;
  const topY = y + cover + 9;
  const bottomY = y + rh - cover - 9;
  c.fillStyle = "#111";
  c.strokeStyle = "#555";
  if (location === "support") {
    drawBeamBarGroup(c, mainCount, barLeft, barRight, topY, 14, true);
    drawBeamBarGroup(c, 2, barLeft, barRight, bottomY, -14, false);
  } else {
    drawBeamBarGroup(c, 2, barLeft, barRight, topY, 14, false);
    drawBeamBarGroup(c, mainCount, barLeft, barRight, bottomY, -14, true);
  }

  c.fillStyle = "#111";
  c.font = "bold 13px Arial";
  c.textAlign = "center";
  c.fillText(location === "support" ? "SUPPORT - TOP BARS" : "MID-SPAN - BOTTOM BARS", width / 2, 22);
  c.font = "12px Arial";
  c.fillText(`b = ${b} mm`, width / 2, y - 8);
  c.save(); c.translate(x + rw + 30, y + rh / 2); c.rotate(-Math.PI / 2); c.fillText(`h = ${h} mm`, 0, 0); c.restore();
  const mainLabel = `${mainCount}-D${design.beamBarDia} main bars`;
  const compressionLabel = `2-D${design.beamBarDia} compression bars`;
  c.textAlign = "left";
  c.fillText(location === "support" ? mainLabel : compressionLabel, 16, y + 30);
  c.fillText(location === "support" ? compressionLabel : mainLabel, 16, y + rh - 18);
  const transverse = beamDesigns[0]?.transverse || `2-Leg D${design.tieBarDia} stirrups`;
  c.textAlign = "center";
  c.fillStyle = "#555";
  c.fillText(transverse, width / 2, height - 18);
}

function diagramFrameTransform(width, height) {
  const bounds = baseModelBounds();
  const pad = {left: 72, right: 42, top: 34, bottom: 48};
  const sx = (width - pad.left - pad.right) / Math.max(1, bounds.maxX - bounds.minX);
  const sy = (height - pad.top - pad.bottom) / Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min(sx, sy);
  return point => ({x: pad.left + (point.x - bounds.minX) * scale, y: height - pad.bottom - (point.y - bounds.minY) * scale});
}

function drawDeflectionResult(result) {
  const prepared = prepareResultCanvas(deflectionCanvas);
  if (!prepared) return;
  const {context: c, width, height} = prepared;
  const map = diagramFrameTransform(width, height);
  const displacements = new Map((result?.nodeDisplacements || []).map(item => [String(item.node), item]));
  const maxMm = Math.max(...[...displacements.values()].map(d => Math.hypot(d.ux || 0, d.uy || 0)), 0);
  const bounds = baseModelBounds();
  const modelSizeMm = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 1000;
  const magnification = maxMm > 1e-9 ? Math.min(250, Math.max(1, modelSizeMm * 0.08 / maxMm)) : 1;
  const drawShape = (deformed, color, dashed, widthPx) => {
    c.strokeStyle = color; c.lineWidth = widthPx; c.setLineDash(dashed ? [7, 5] : []);
    model.members.forEach(member => {
      const a = getNode(member.i), b = getNode(member.j);
      const da = displacements.get(String(a.id)) || {ux:0,uy:0};
      const db = displacements.get(String(b.id)) || {ux:0,uy:0};
      const pa = map({x:a.x + (deformed ? da.ux * magnification / 1000 : 0), y:a.y + (deformed ? da.uy * magnification / 1000 : 0)});
      const pb = map({x:b.x + (deformed ? db.ux * magnification / 1000 : 0), y:b.y + (deformed ? db.uy * magnification / 1000 : 0)});
      c.beginPath(); c.moveTo(pa.x, pa.y); c.lineTo(pb.x, pb.y); c.stroke();
    });
  };
  drawShape(false, "#9ca3af", true, 1.2);
  drawShape(true, "#018A61", false, 2.5);
  c.setLineDash([]); c.fillStyle = "#111"; c.textAlign = "left";
  c.fillText(`Maximum nodal displacement = ${maxMm.toFixed(3)} mm`, 18, 20);
  c.textAlign = "right"; c.fillText(`Display magnification: ${magnification.toFixed(0)}x`, width - 18, 20);
}

function drawBeamResultChart(target, result, kind) {
  const prepared = prepareResultCanvas(target);
  if (!prepared) return;
  const {context: c, width, height} = prepared;
  const beams = model.members.filter(member => member.type === "Beam");
  const values = beams.map(beam => result?.memberResults?.[beam.id] || computedMemberDiagramValues(model, beam));
  const samplesKey = kind === "shear" ? "shearSamples" : "momentSamples";
  const maxValue = Math.max(...values.flatMap(item => item[samplesKey].map(sample => Math.abs(sample.value))), 0.001);
  const left = 70, right = width - 40;
  const totalLength = beams.reduce((sum, beam) => sum + memberLength(model, beam), 0) || 1;
  const amplitude = Math.min(72, (height - 60) / (beams.length * 2.1));
  let cursor = left;
  beams.forEach((beam, index) => {
    const data = values[index];
    const chartWidth = (right - left) * memberLength(model, beam) / totalLength;
    const baseline = 60 + index * ((height - 80) / Math.max(1, beams.length));
    c.strokeStyle = "#333"; c.lineWidth = 1; c.beginPath(); c.moveTo(cursor, baseline); c.lineTo(cursor + chartWidth, baseline); c.stroke();
    const points = data[samplesKey].map(sample => ({x: cursor + chartWidth * sample.t, y: baseline - sample.value / maxValue * amplitude, value: sample.value}));
    c.strokeStyle = kind === "shear" ? "#018A61" : "#FF961F";
    c.lineWidth = 2; c.setLineDash(kind === "moment" ? [8, 5] : []);
    c.beginPath(); c.moveTo(cursor, baseline); points.forEach(point => c.lineTo(point.x, point.y)); c.lineTo(cursor + chartWidth, baseline); c.stroke(); c.setLineDash([]);
    c.fillStyle = "#111"; c.textAlign = "left"; c.fillText(memberDisplayName(beam), cursor, baseline - amplitude - 12);
    const labels = kind === "shear" ? data.shearLabels : data.momentLabels;
    c.fillStyle = kind === "shear" ? "#018A61" : "#b85c00"; c.textAlign = "center";
    labels.filter(label => Math.abs(label.value) > 0.01).forEach(label => {
      const x = cursor + chartWidth * label.t;
      const y = baseline - label.value / maxValue * amplitude;
      c.fillText(valueText(label.value, ""), x, y + (label.value >= 0 ? -7 : 14));
    });
    cursor += chartWidth;
  });
}

function renderEngineeringResults(result = lastAnalysisResult) {
  drawBeamSectionDetail(beamSupportCanvas, "support", result);
  drawBeamSectionDetail(beamMidspanCanvas, "midspan", result);
  drawSectionDetail(columnSectionCanvas, "Column");
  drawDeflectionResult(result);
  drawBeamResultChart(shearDiagramCanvas, result, "shear");
  drawBeamResultChart(momentDiagramCanvas, result, "moment");
}

function renderCalculationTransparency(result, envelope) {
  if (!calculationDetailsBody || !result) return;
  const eq = result.equilibrium || {};
  const rows = model.members.map(member => {
    const service = result.memberResults?.[member.id] || {};
    const demand = envelope?.members?.[member.id] || {};
    const design = preliminaryReinforcement(member, result);
    return `<tr><td>${escapeHtml(memberDisplayName(member))}</td><td>${escapeHtml(member.type)}</td><td>${valueText(service.maxShear||0,"")} kN</td><td>${valueText(service.maxPositiveMoment||0,"")} / ${valueText(service.maxNegativeMoment||0,"")} kN-m</td><td>${valueText(demand.axial||0,"")} kN</td><td>${valueText(Math.max(demand.positiveMoment||0,demand.negativeMoment||0,demand.endMoment||0),"")} kN-m</td><td>${escapeHtml(design.governing)}</td><td>${escapeHtml(design.status)}</td><td>${escapeHtml(design.recommendation || "")}</td></tr>`;
  }).join("");
  calculationDetailsBody.innerHTML = `
    <p><strong>Analysis:</strong> 2D matrix stiffness method; 3 DOF/node (Ux, Uy, Rz); transformed frame-element stiffness; consistent nodal load vectors for UDL and concentrated member loads; end forces recovered from <code>q = k'u' - f<sub>eq</sub></code>.</p>
    <p><strong>Service display:</strong> ${escapeHtml(result.combination || "Unfactored service case")}. <strong>Factored screening:</strong> ${escapeHtml(envelope?.basis || "Not calculated")}.</p>
    <p><strong>Equilibrium:</strong> residual Fx = ${valueText(eq.residual?.fx||0,"")} kN; Fy = ${valueText(eq.residual?.fy||0,"")} kN; M = ${valueText(eq.residual?.mz||0,"")} kN-m; status = <strong>${eq.ok ? "BALANCED" : "ANALYSIS ERROR"}</strong>.</p>
    <p><strong>RC design checks:</strong> beam flexure uses a rectangular compression block, strain-dependent phi, and Mn = As fy(d-a/2); shear uses Vc plus two-leg stirrup Vs; columns use the displayed combined axial-and-bending utilization. PASS is utilization at or below 1.00 with reinforcement limits satisfied; REVISE provides the required section and bar changes.</p>
    <table><thead><tr><th>Member</th><th>Type</th><th>Service V</th><th>Service M+ / M-</th><th>Factored Pu</th><th>Factored Mu</th><th>Governing</th><th>Status</th><th>Recommended Action</th></tr></thead><tbody>${rows}</tbody></table>`;
}

calculateBtn.onclick = () => {
  const ec = concreteElasticModulus();
  model.members.forEach(member => { member.E = ec; normalizeMemberProperties(member); });
  const r = runBasicFrameAnalysis(model, {resultType:"SERVICE", combination:"Service D + L + W/E (simultaneous display case)"});
  lastAnalysisResult = r;
  lastStrengthEnvelope = buildStrengthEnvelope(model);
  diagramsVisible = true;
  showDiagramBtn.textContent = "Show/Hide S&M Diagram";
  draw();
  renderEngineeringResults(r);
  if (analysisState) analysisState.textContent = r.valid
    ? `SERVICE diagrams shown. FACTORED design envelope evaluated separately. ${lastStrengthEnvelope.basis}.`
    : "ANALYSIS ERROR - equilibrium or stability check failed.";
  const designRows = model.members.map(member => preliminaryReinforcement(member, r));
  const failed = designRows.filter(item => String(item.status).startsWith("REVISE"));
  if (analysisWarning) {
    analysisWarning.hidden = false;
    analysisWarning.dataset.state = !r.valid || failed.length ? "revise" : "pass";
    analysisWarning.textContent = !r.valid
      ? `ANALYSIS ERROR: equilibrium residuals are Fx ${valueText(r.equilibrium?.residual?.fx || 0,"kN")}, Fy ${valueText(r.equilibrium?.residual?.fy || 0,"kN")}, and M ${valueText(r.equilibrium?.residual?.mz || 0,"kN-m")}. Correct the supports, connectivity, or loads and calculate again.`
      : failed.length
        ? `${failed.length} member(s) require revision. Open Member Properties and apply the exact section and reinforcement changes shown in the REVISE rows.`
        : `PASS: all ${designRows.length} members satisfy the current strength and detailing checks for the entered loads.`;
  }
  renderCalculationTransparency(r, lastStrengthEnvelope);
  status(r.valid ? `Service analysis balanced. ${r.nodes} nodes, ${r.members} members, ${r.loads} loads.` : "ANALYSIS ERROR - results suppressed from verification.");
};
if (typeof printPdfBtn !== "undefined" && printPdfBtn) printPdfBtn.onclick = () => printReport("pdf");
if (typeof printLocalBtn !== "undefined" && printLocalBtn) printLocalBtn.onclick = () => printReport("printer");

function resultBounds() {
  const base = baseModelBounds();
  return {
    minX: base.minX,
    maxX: base.maxX,
    minY: base.minY - mainTitleDrop(base) - Math.max(0.15, (base.maxY - base.minY) * 0.03),
    maxY: base.maxY
  };
}

function mainTitleDrop(base = baseModelBounds()) {
  const height = Math.max(1, base.maxY - base.minY);
  return Math.max(2.65, height * 0.58);
}

function baseModelBounds() {
  const xs = [
    ...(model.v || []),
    ...model.nodes.map(n => n.x)
  ];
  const ys = [
    ...(model.h || []),
    ...model.nodes.map(n => n.y)
  ];
  return {
    minX: Math.min(...xs, 0),
    maxX: Math.max(...xs, 1),
    minY: Math.min(...ys, 0),
    maxY: Math.max(...ys, 1)
  };
}

function resultPoint(n) {
  return toCanvas(n.x, n.y);
}

function resultMemberEnds(m) {
  const a = getNode(m.i);
  const b = getNode(m.j);
  if (!a || !b) return null;
  return { A: resultPoint(a), B: resultPoint(b), a, b };
}

function memberDiagramValues(m) {
  const fromAnalysis = lastAnalysisResult?.memberResults?.[m.id];
  if (fromAnalysis) return fromAnalysis;
  return computedMemberDiagramValues(model, m);
}

function valueText(value, unit) {
  if (Math.abs(value) < 0.05) return "0";
  if (Math.abs(value) >= 100) return Math.round(value).toString();
  return value.toFixed(1).replace(/\.0$/, "") + (unit ? " " + unit : "");
}

function resultFont(size, family = "Arial") {
  return `${Math.max(6, scaled(size) * fontScale).toFixed(1)}px ${family}`;
}

function resultMeasureBox(text, x, y) {
  const metrics = rctx.measureText(text);
  const height = Math.max(10, scaled(12) * fontScale);
  const pad = scaled(3);
  return {x: x - metrics.width / 2 - pad, y: y - height / 2 - pad, w: metrics.width + pad * 2, h: height + pad * 2};
}

function findResultLabelPoint(text, x, y, nx, ny) {
  const gap = Math.max(10, scaled(12) * fontScale);
  const candidates = [
    {x: x + nx * gap, y: y + ny * gap},
    {x: x - nx * gap, y: y - ny * gap},
    {x: x + ny * gap, y: y - nx * gap},
    {x: x - ny * gap, y: y + nx * gap},
    {x: x + nx * gap * 1.8, y: y + ny * gap * 1.8},
    {x: x - nx * gap * 1.8, y: y - ny * gap * 1.8},
    {x: x + ny * gap * 1.8, y: y - nx * gap * 1.8},
    {x: x - ny * gap * 1.8, y: y + nx * gap * 1.8},
    {x: x + gap * 2.4, y},
    {x: x - gap * 2.4, y}
  ];
  for (const p of candidates) {
    const box = resultMeasureBox(text, p.x, p.y);
    if (!resultLabelBoxes.some(existing => boxesOverlap(existing, box))) {
      resultLabelBoxes.push(box);
      return p;
    }
  }
  resultLabelBoxes.push(resultMeasureBox(text, candidates[0].x, candidates[0].y));
  return candidates[0];
}

function drawResultLabel(text, x, y, color = "#000") {
  rctx.fillStyle = color;
  rctx.fillText(text, x, y);
}

function resultDiagramScale(result, kind) {
  const values = Object.values(result?.memberResults || {});
  const max = Math.max(...values.map(v => kind === "shear" ? v.maxShear : v.maxMoment), 0.001);
  return max;
}

function drawResultDiagramOnMember(m, kind, globalMax) {
  const ends = resultMemberEnds(m);
  if (!ends) return;
  const {A, B} = ends;
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len = Math.hypot(dx, dy) || 1;
  const tx = dx / len;
  const ty = dy / len;
  let nx = -ty;
  let ny = tx;
  if (m.type === "Column") {
    nx = A.x < canvas.width / 2 ? -1 : 1;
    ny = 0;
  } else if (ny < 0) {
    nx *= -1;
    ny *= -1;
  }

  const values = memberDiagramValues(m);
  const diagramMax = Math.max(globalMax, 0.001);
  const maxAmp = Math.min(scaled(34), Math.max(scaled(14), len * 0.11));
  const baseOffset = scaled(kind === "shear" ? 4 : 9);
  const p0 = { x: A.x + nx*baseOffset, y: A.y + ny*baseOffset };
  const p1 = { x: B.x + nx*baseOffset, y: B.y + ny*baseOffset };

  const diagramPoint = (t, value) => ({
    x: p0.x + (p1.x - p0.x) * t + nx * (value / diagramMax) * maxAmp,
    y: p0.y + (p1.y - p0.y) * t + ny * (value / diagramMax) * maxAmp
  });

  const samples = kind === "shear" ? values.shearSamples : values.momentSamples;
  const labels = kind === "shear" ? values.shearLabels : values.momentLabels;
  if (!samples || !samples.length) return;
  if (diagramMax <= 0.001) return;
  const pts = samples.map(sample => diagramPoint(sample.t, sample.value));

  rctx.beginPath();
  rctx.moveTo(p0.x, p0.y);
  for (const p of pts) rctx.lineTo(p.x, p.y);
  rctx.lineTo(p1.x, p1.y);
  const color = kind === "shear" ? "#018A61" : "#FF961F";
  rctx.strokeStyle = color;
  rctx.lineWidth = Math.max(0.8, scaled(kind === "shear" ? 1.2 : 1.4));
  rctx.setLineDash(kind === "shear" ? [] : [scaled(8), scaled(5)]);
  rctx.stroke();
  rctx.setLineDash([]);

  rctx.fillStyle = color;
  rctx.font = resultFont(8, "Arial");
  rctx.textAlign = "center";
  for (const label of labels || []) {
    if (Math.abs(label.value) < 0.05) continue;
    const p = diagramPoint(label.t, label.value);
    const text = `${kind === "shear" ? "V" : "M"} ${valueText(label.value, "")}`;
    const placed = findResultLabelPoint(text, p.x, p.y, nx, ny);
    drawResultLabel(text, placed.x, placed.y, color);
  }
}

function drawResultsInMainCanvas() {
  const result = lastAnalysisResult || runBasicFrameAnalysis(model);
  drawStructuralResults(result, canvas.width, canvas.height);
  ctx.save();
  ctx.drawImage(resultsCanvas, 0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function drawStructuralResults(result, targetWidth = null, targetHeight = null) {
  if (!rctx) return;
  if (targetWidth && targetHeight) {
    resultsCanvas.width = Math.max(1, Math.round(targetWidth));
    resultsCanvas.height = Math.max(1, Math.round(targetHeight));
  } else {
    resizeCanvasToDisplaySize(resultsCanvas);
  }
  rctx.clearRect(0, 0, resultsCanvas.width, resultsCanvas.height);
  resultLabelBoxes = [];
  const base = baseModelBounds();
  const titleP = toCanvas((base.minX + base.maxX) / 2, base.minY - mainTitleDrop(base));
  resultLabelBoxes.push(resultMeasureBox("Structural Framing Diagram", titleP.x, titleP.y));

  const shearScale = resultDiagramScale(result, "shear");
  const momentScale = resultDiagramScale(result, "moment");

  model.members.forEach(m => drawResultDiagramOnMember(m, "shear", shearScale));
  model.members.forEach(m => drawResultDiagramOnMember(m, "moment", momentScale));

  rctx.setLineDash([]);
}

showDiagramBtn.onclick = () => {
  diagramsVisible = !diagramsVisible;
  showDiagramBtn.textContent = "Show/Hide S&M Diagram";
  draw();
};

if (toggleMembersBtn) toggleMembersBtn.onclick = () => {
  membersVisible = !membersVisible;
  toggleMembersBtn.classList.toggle("is-active", !membersVisible);
  draw();
  status(membersVisible ? "Columns and beams shown." : "Columns and beams hidden.");
};

toggleLoadsBtn.onclick = () => {
  loadsVisible = !loadsVisible;
  toggleLoadsBtn.textContent = "Show/Hide Loading";
  draw();
  status(loadsVisible ? "Loadings shown." : "Loadings hidden.");
};

function downloadProjectJson(filename) { const blob = new Blob([JSON.stringify(modelPackage(), null, 2)], {type:"application/json"}); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename || `${(recordName.value || "frame-model").trim() || "frame-model"}.json`; a.click(); URL.revokeObjectURL(a.href); }
async function saveProjectFile(forcePicker) { const filename = `${(recordName.value || "frame-model").trim() || "frame-model"}.json`; try { if (filePickerSupported) { if (forcePicker || !currentFileHandle) { currentFileHandle = await window.showSaveFilePicker({suggestedName: filename, types: [{description:"StrucForge JSON", accept:{"application/json":[".json"]}}]}); } const writable = await currentFileHandle.createWritable(); await writable.write(JSON.stringify(modelPackage(), null, 2)); await writable.close(); status(forcePicker ? "Saved as JSON file." : "Saved JSON file."); return; } downloadProjectJson(filename); status("JSON downloaded. Browser security may ask where to save it."); } catch (err) { if (err && err.name === "AbortError") { status("Save cancelled."); return; } downloadProjectJson(filename); status("JSON downloaded using browser fallback."); } }
exportJson.onclick = () => saveProjectFile(true);

window.addEventListener("load", () => {
  updateLoadInputs();
  refreshRecords();
  document.body.dataset.theme = localStorage.getItem("strucforge_theme") || "olive_saffron";
  fontScale = Number(localStorage.getItem("strucforge_font_scale")) || 1;
  loadsVisible = true;
  if (typeof toggleLoadsBtn !== "undefined" && toggleLoadsBtn) toggleLoadsBtn.textContent = "Show/Hide Loading";
  fontScaleSelect.value = String(fontScale);
  document.querySelectorAll("[data-theme-choice]").forEach(btn => btn.classList.toggle("active", btn.dataset.themeChoice === document.body.dataset.theme));
  updateDayNightButtons();
  updateLockToggle();
  prepareCanvasSizes();
  draw();
  loadDefaultProject();
});

window.addEventListener("resize", () => {
  if (prepareCanvasSizes()) {
    draw();
  }
});
