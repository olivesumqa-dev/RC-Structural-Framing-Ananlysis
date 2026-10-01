(function (global) {
  "use strict";

  const STORAGE_KEY = "strucforge.column-shape-library.v1";
  const SMALL_BUILDING_MIN_COLUMN_DIMENSION = 200;
  const STANDARD_MIN_COLUMN_DIMENSION = 250;
  const INSIDE_OR_BOTTOM_CORNER_MIN_DIMENSION = 150;
  const DEFAULT_CLEAR_COVER = 40;
  const DEFAULT_MAIN_BAR_DIAMETER = 16;
  const DEFAULT_TIE_DIAMETER = 10;

  function pointOf(node) {
    return {x: Number(node.x), y: Number(node.y)};
  }

  function orientation(a, b, c) {
    const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
    if (Math.abs(value) < 1e-8) return 0;
    return value > 0 ? 1 : 2;
  }

  function onSegment(a, b, c) {
    return b.x <= Math.max(a.x, c.x) + 1e-8 &&
      b.x >= Math.min(a.x, c.x) - 1e-8 &&
      b.y <= Math.max(a.y, c.y) + 1e-8 &&
      b.y >= Math.min(a.y, c.y) - 1e-8;
  }

  function segmentsIntersect(a, b, c, d) {
    const o1 = orientation(a, b, c);
    const o2 = orientation(a, b, d);
    const o3 = orientation(c, d, a);
    const o4 = orientation(c, d, b);
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSegment(a, c, b)) return true;
    if (o2 === 0 && onSegment(a, d, b)) return true;
    if (o3 === 0 && onSegment(c, a, d)) return true;
    if (o4 === 0 && onSegment(c, b, d)) return true;
    return false;
  }

  function columnShapeBoundary(nodes, lines) {
    if (!Array.isArray(nodes) || nodes.length < 3) {
      return {valid: false, reason: "A closed section needs at least three nodes."};
    }
    if (!Array.isArray(lines) || lines.length < 3) {
      return {valid: false, reason: "Draw a closed boundary before saving."};
    }

    // A single diagonal is often drawn to show a corner column's imaginary
    // insertion line. It is a construction guide, not part of the perimeter.
    // When removing one extra line produces a valid closed loop, retain the
    // guide for display but exclude it from section properties and saving checks.
    if (lines.length === nodes.length + 1) {
      for (const guide of lines) {
        const boundary = columnShapeBoundary(nodes, lines.filter(function (line) { return line !== guide; }));
        if (boundary.valid) {
          return {...boundary, constructionLineIds: [String(guide.id)]};
        }
      }
    }

    const nodeMap = new Map();
    for (const node of nodes) {
      const id = String(node.id);
      const point = pointOf(node);
      if (!id || !Number.isFinite(point.x) || !Number.isFinite(point.y) || nodeMap.has(id)) {
        return {valid: false, reason: "The section contains an invalid node."};
      }
      nodeMap.set(id, point);
    }

    const adjacency = new Map(Array.from(nodeMap.keys(), function (id) { return [id, []]; }));
    const edgeKeys = new Set();
    for (const line of lines) {
      const a = String(line.a);
      const b = String(line.b);
      if (a === b || !nodeMap.has(a) || !nodeMap.has(b)) {
        return {valid: false, reason: "A boundary line has an invalid endpoint."};
      }
      const key = [a, b].sort().join("|");
      if (edgeKeys.has(key)) {
        return {valid: false, reason: "The section contains a duplicate boundary line."};
      }
      edgeKeys.add(key);
      adjacency.get(a).push(b);
      adjacency.get(b).push(a);
    }

    for (const neighbors of adjacency.values()) {
      if (neighbors.length !== 2) {
        return {valid: false, reason: "Every boundary node must connect to exactly two lines."};
      }
    }

    const start = String(nodes[0].id);
    const orderedIds = [start];
    const visited = new Set([start]);
    let previous = null;
    let current = start;
    for (let guard = 0; guard <= nodes.length; guard += 1) {
      const neighbors = adjacency.get(current);
      const next = neighbors[0] === previous ? neighbors[1] : neighbors[0];
      if (next === start) break;
      if (!next || visited.has(next)) {
        return {valid: false, reason: "The boundary does not form one continuous closed loop."};
      }
      orderedIds.push(next);
      visited.add(next);
      previous = current;
      current = next;
    }
    if (visited.size !== nodes.length || lines.length !== nodes.length) {
      return {valid: false, reason: "The section must contain one closed boundary without loose geometry."};
    }

    const polygon = orderedIds.map(function (id) { return nodeMap.get(id); });
    for (let i = 0; i < polygon.length; i += 1) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      for (let j = i + 1; j < polygon.length; j += 1) {
        const adjacent = j === i || j === i + 1 || (i === 0 && j === polygon.length - 1);
        if (adjacent) continue;
        const c = polygon[j];
        const d = polygon[(j + 1) % polygon.length];
        if (segmentsIntersect(a, b, c, d)) {
          return {valid: false, reason: "Boundary lines cannot cross each other."};
        }
      }
    }
    return {valid: true, polygon: polygon, orderedIds: orderedIds};
  }

  function columnShapeProperties(nodes, lines) {
    const boundary = columnShapeBoundary(nodes, lines);
    if (!boundary.valid) return boundary;
    const polygon = boundary.polygon;
    let twiceArea = 0;
    let centroidNumeratorX = 0;
    let centroidNumeratorY = 0;
    let ixOrigin = 0;
    let iyOrigin = 0;
    for (let i = 0; i < polygon.length; i += 1) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      const cross = a.x * b.y - b.x * a.y;
      twiceArea += cross;
      centroidNumeratorX += (a.x + b.x) * cross;
      centroidNumeratorY += (a.y + b.y) * cross;
      ixOrigin += (a.y * a.y + a.y * b.y + b.y * b.y) * cross;
      iyOrigin += (a.x * a.x + a.x * b.x + b.x * b.x) * cross;
    }
    if (Math.abs(twiceArea) < 1e-6) {
      return {valid: false, reason: "The closed boundary has zero area."};
    }
    const signedArea = twiceArea / 2;
    const centroidX = centroidNumeratorX / (3 * twiceArea);
    const centroidY = centroidNumeratorY / (3 * twiceArea);
    const ix = Math.abs(ixOrigin / 12 - signedArea * centroidY * centroidY);
    const iy = Math.abs(iyOrigin / 12 - signedArea * centroidX * centroidX);
    return {
      valid: true,
      polygon: polygon,
      orderedIds: boundary.orderedIds,
      area: Math.abs(signedArea),
      centroidX: centroidX,
      centroidY: centroidY,
      ix: ix,
      iy: iy
    };
  }

  const geometryApi = {
    columnShapeBoundary: columnShapeBoundary,
    columnShapeProperties: columnShapeProperties,
    segmentsIntersect: segmentsIntersect
  };
  global.StrucForgeColumnGeometry = geometryApi;
  if (typeof module !== "undefined" && module.exports) module.exports = geometryApi;
  if (typeof document === "undefined") return;

  const state = {
    library: [],
    activeId: null,
    mode: "select",
    gridVisible: true,
    gridSpacing: 50,
    nodes: [],
    lines: [],
    dimensions: [],
    selected: null,
    pendingNodeId: null,
    pendingDimensionMoveId: null,
    history: [],
    scale: 0.7,
    shapeKind: "RECTANGULAR",
    sectionWidth: 400,
    sectionHeight: 400,
    sectionDiameter: 400
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function makeId(prefix) {
    if (global.crypto && typeof global.crypto.randomUUID === "function") {
      return prefix + "-" + global.crypto.randomUUID();
    }
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  }

  function defaultDraft() {
    const nodes = [
      {id: "n1", x: -200, y: -200},
      {id: "n2", x: 200, y: -200},
      {id: "n3", x: 200, y: 200},
      {id: "n4", x: -200, y: 200}
    ];
    return {
      nodes: nodes,
      lines: [
        {id: "l1", a: "n1", b: "n2"},
        {id: "l2", a: "n2", b: "n3"},
        {id: "l3", a: "n3", b: "n4"},
        {id: "l4", a: "n4", b: "n1"}
      ],
      dimensions: [
        {id: "d1", a: "n1", b: "n2"},
        {id: "d2", a: "n2", b: "n3"}
      ]
    };
  }

  function normalMinimumDimension() {
    return typeof global.StrucForgeIsSmallBuilding === "function" && global.StrucForgeIsSmallBuilding()
      ? SMALL_BUILDING_MIN_COLUMN_DIMENSION
      : STANDARD_MIN_COLUMN_DIMENSION;
  }

  function updateMinimumDimensionInputs() {
    const minimum = normalMinimumDimension();
    ["columnShapeWidth", "columnShapeHeight", "columnShapeDiameter"].forEach(function (id) {
      const input = byId(id);
      if (input) input.min = String(minimum);
    });
  }

  function positiveInput(id, fallback) {
    return Math.max(normalMinimumDimension(), Number(byId(id) && byId(id).value) || fallback);
  }

  function polygonBounds(polygon) {
    const xs = polygon.map(function (point) { return Number(point.x); });
    const ys = polygon.map(function (point) { return Number(point.y); });
    const minX = Math.min.apply(null, xs);
    const maxX = Math.max.apply(null, xs);
    const minY = Math.min.apply(null, ys);
    const maxY = Math.max.apply(null, ys);
    return {minX: minX, maxX: maxX, minY: minY, maxY: maxY, width: maxX - minX, height: maxY - minY};
  }

  function pointInPolygon(point, polygon) {
    let inside = false;
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
      const a = polygon[index];
      const b = polygon[previous];
      const intersects = ((a.y > point.y) !== (b.y > point.y)) &&
        point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || 1e-12) + a.x;
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function polygonInsertionPoint(polygon, fallback) {
    let twiceArea = 0;
    polygon.forEach(function (point, index) {
      const next = polygon[(index + 1) % polygon.length];
      twiceArea += point.x * next.y - next.x * point.y;
    });
    const orientationSign = Math.sign(twiceArea) || 1;
    for (let index = 0; index < polygon.length; index += 1) {
      const previous = polygon[(index - 1 + polygon.length) % polygon.length];
      const current = polygon[index];
      const next = polygon[(index + 1) % polygon.length];
      const cross = (current.x - previous.x) * (next.y - current.y) - (current.y - previous.y) * (next.x - current.x);
      if (Math.sign(cross) && Math.sign(cross) !== orientationSign) {
        const outsideCorner = polygon.reduce(function (farthest, point) {
          const distance = Math.hypot(point.x - current.x, point.y - current.y);
          return !farthest || distance > farthest.distance ? {x: point.x, y: point.y, distance: distance} : farthest;
        }, null);
        return {
          x: (current.x + outsideCorner.x) / 2,
          y: (current.y + outsideCorner.y) / 2,
          type: "MIDLINE_CORNER_INTERSECTION",
          insideCorner: {x: current.x, y: current.y},
          outsideCorner: {x: outsideCorner.x, y: outsideCorner.y}
        };
      }
    }
    return {x: fallback.centroidX, y: fallback.centroidY, type: "CENTROID"};
  }

  function reentrantCornerIndices(polygon) {
    let twiceArea = 0;
    polygon.forEach(function (point, index) {
      const next = polygon[(index + 1) % polygon.length];
      twiceArea += point.x * next.y - next.x * point.y;
    });
    const orientationSign = Math.sign(twiceArea) || 1;
    return new Set(polygon.map(function (current, index) {
      const previous = polygon[(index - 1 + polygon.length) % polygon.length];
      const next = polygon[(index + 1) % polygon.length];
      const cross = (current.x - previous.x) * (next.y - current.y) - (current.y - previous.y) * (next.x - current.x);
      return Math.sign(cross) && Math.sign(cross) !== orientationSign ? index : -1;
    }).filter(function (index) { return index >= 0; }));
  }

  function sectionDimensionValidation(properties, kind) {
    if (!properties.valid) return properties;
    const bounds = polygonBounds(properties.polygon);
    const normalMinimum = normalMinimumDimension();
    if (bounds.width < normalMinimum || bounds.height < normalMinimum) {
      return {valid: false, reason: "Column width and depth must each be at least " + normalMinimum + " mm."};
    }
    if (kind !== "CIRCULAR") {
      const reentrantCorners = reentrantCornerIndices(properties.polygon);
      for (let index = 0; index < properties.polygon.length; index += 1) {
        const a = properties.polygon[index];
        const b = properties.polygon[(index + 1) % properties.polygon.length];
        const nextIndex = (index + 1) % properties.polygon.length;
        const isBottomEdge = Math.abs(a.y - bounds.minY) < 1e-8 && Math.abs(b.y - bounds.minY) < 1e-8;
        const isInsideCornerLeg = reentrantCorners.has(index) || reentrantCorners.has(nextIndex);
        const minimum = isBottomEdge || isInsideCornerLeg ? INSIDE_OR_BOTTOM_CORNER_MIN_DIMENSION : normalMinimum;
        if (Math.hypot(b.x - a.x, b.y - a.y) < minimum) {
          return {
            valid: false,
            reason: (isBottomEdge || isInsideCornerLeg
              ? "Bottom and re-entrant inside-corner dimensions must be at least " + INSIDE_OR_BOTTOM_CORNER_MIN_DIMENSION + " mm."
              : "Other column boundary dimensions must be at least " + normalMinimum + " mm.")
          };
        }
      }
    }
    return {valid: true, bounds: bounds};
  }

  function rebarPointNearVertex(polygon, vertex) {
    const clearance = DEFAULT_CLEAR_COVER + DEFAULT_MAIN_BAR_DIAMETER / 2;
    let best = null;
    for (let step = 0; step < 32; step += 1) {
      const angle = Math.PI * 2 * step / 32;
      const candidate = {x: vertex.x + Math.cos(angle) * clearance, y: vertex.y + Math.sin(angle) * clearance};
      if (!pointInPolygon(candidate, polygon)) continue;
      const edgeDistance = polygon.reduce(function (minimum, point, index) {
        return Math.min(minimum, distanceToSegment(candidate, point, polygon[(index + 1) % polygon.length]));
      }, Infinity);
      if (edgeDistance >= clearance * 0.55 && (!best || edgeDistance > best.edgeDistance)) best = {...candidate, edgeDistance: edgeDistance};
    }
    return best && {x: best.x, y: best.y};
  }

  function defaultRebarLayout(properties, kind) {
    const bounds = polygonBounds(properties.polygon);
    const common = {cover: DEFAULT_CLEAR_COVER, barDiameter: DEFAULT_MAIN_BAR_DIAMETER, tieDiameter: DEFAULT_TIE_DIAMETER};
    if (kind === "CIRCULAR") {
      const radius = Math.max(0, Math.min(bounds.width, bounds.height) / 2 - common.cover - common.barDiameter / 2);
      const count = Math.max(6, Math.ceil((2 * Math.PI * radius) / 300));
      return {
        ...common,
        tie: "CIRCULAR",
        bars: Array.from({length: count}, function (_, index) {
          const angle = Math.PI * 2 * index / count;
          return {x: properties.centroidX + radius * Math.cos(angle), y: properties.centroidY + radius * Math.sin(angle)};
        })
      };
    }
    const bars = properties.polygon.map(function (vertex) { return rebarPointNearVertex(properties.polygon, vertex); }).filter(Boolean);
    return {...common, tie: kind === "RECTANGULAR" ? "RECTANGULAR" : "CUSTOM", bars: bars};
  }

  function updateSectionInputs() {
    updateMinimumDimensionInputs();
    if (byId("columnShapeWidth")) byId("columnShapeWidth").value = String(state.sectionWidth);
    if (byId("columnShapeHeight")) byId("columnShapeHeight").value = String(state.sectionHeight);
    if (byId("columnShapeDiameter")) byId("columnShapeDiameter").value = String(state.sectionDiameter);
  }

  function rectangularDraft(width, height) {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const nodes = [
      {id: "n1", x: -halfWidth, y: -halfHeight},
      {id: "n2", x: halfWidth, y: -halfHeight},
      {id: "n3", x: halfWidth, y: halfHeight},
      {id: "n4", x: -halfWidth, y: halfHeight}
    ];
    return {
      nodes: nodes,
      lines: [
        {id: "l1", a: "n1", b: "n2"}, {id: "l2", a: "n2", b: "n3"},
        {id: "l3", a: "n3", b: "n4"}, {id: "l4", a: "n4", b: "n1"}
      ],
      dimensions: [{id: "d1", a: "n1", b: "n2"}, {id: "d2", a: "n2", b: "n3"}]
    };
  }

  function circularDraft(diameter) {
    const radius = diameter / 2;
    const segments = 24;
    const nodes = Array.from({length: segments}, function (_, index) {
      const angle = Math.PI * 2 * index / segments;
      return {id: "n" + (index + 1), x: radius * Math.cos(angle), y: radius * Math.sin(angle)};
    });
    return {
      nodes: nodes,
      lines: nodes.map(function (node, index) { return {id: "l" + (index + 1), a: node.id, b: nodes[(index + 1) % segments].id}; }),
      dimensions: [{id: "d1", a: "n1", b: "n13"}]
    };
  }

  function setParametricShape(kind) {
    pushHistory();
    state.shapeKind = kind;
    state.sectionWidth = positiveInput("columnShapeWidth", state.sectionWidth);
    state.sectionHeight = positiveInput("columnShapeHeight", state.sectionHeight);
    state.sectionDiameter = positiveInput("columnShapeDiameter", state.sectionDiameter);
    const draft = kind === "CIRCULAR"
      ? circularDraft(state.sectionDiameter)
      : rectangularDraft(state.sectionWidth, state.sectionHeight);
    state.activeId = null;
    state.nodes = draft.nodes;
    state.lines = draft.lines;
    state.dimensions = draft.dimensions;
    state.selected = null;
    state.pendingNodeId = null;
    updateSectionInputs();
    setMode("select");
    setStatus(kind === "CIRCULAR"
      ? "Circular column \u00d8" + state.sectionDiameter + " mm ready."
      : "Rectangular column " + state.sectionWidth + " x " + state.sectionHeight + " mm ready.");
    updateButtons();
    drawEditor();
    updateReadout();
  }

  function sectionFromCurrentDrawing() {
    const properties = columnShapeProperties(state.nodes, state.lines);
    if (!properties.valid) return {section: null, properties: properties, validation: properties};
    const dimensionValidation = sectionDimensionValidation(properties, state.shapeKind);
    const bounds = polygonBounds(properties.polygon);
    const width = state.shapeKind === "CIRCULAR" ? state.sectionDiameter : bounds.width;
    const height = state.shapeKind === "CIRCULAR" ? state.sectionDiameter : bounds.height;
    const insertionPoint = polygonInsertionPoint(properties.polygon, properties);
    const reinforcement = defaultRebarLayout(properties, state.shapeKind);
    return {
      properties: properties,
      validation: dimensionValidation,
      section: {
      id: state.activeId || makeId("column-section"),
      name: String(byId("columnShapeName") && byId("columnShapeName").value || "Column Section").trim() || "Column Section",
      kind: state.shapeKind,
      width: width,
      height: height,
      diameter: state.shapeKind === "CIRCULAR" ? state.sectionDiameter : null,
      insertionPoint: insertionPoint,
      geometry: state.shapeKind === "CUSTOM" ? {
        points: properties.polygon.map(function (point) {
          return {x: point.x - insertionPoint.x, y: point.y - insertionPoint.y};
        })
      } : null,
      reinforcement: reinforcement,
      designWarning: dimensionValidation.valid ? null : dimensionValidation.reason,
      properties: {area: properties.area, ix: properties.ix, iy: properties.iy}
      }
    };
  }

  function activeSection() {
    const drawing = sectionFromCurrentDrawing();
    return drawing.validation.valid ? drawing.section : null;
  }

  function validStoredShape(shape) {
    return shape && typeof shape === "object" && String(shape.id || "") &&
      Array.isArray(shape.nodes) && Array.isArray(shape.lines) && Array.isArray(shape.dimensions);
  }

  function loadLibrary() {
    try {
      const parsed = JSON.parse(global.localStorage.getItem(STORAGE_KEY) || "[]");
      state.library = Array.isArray(parsed) ? parsed.filter(validStoredShape) : [];
    } catch (error) {
      state.library = [];
    }
  }

  function persistLibrary() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.library));
    } catch (error) {
      setStatus("The shape is available now, but browser storage is unavailable.");
    }
    global.dispatchEvent(new CustomEvent("strucforge:column-shape-library-change", {
      detail: {shapes: clone(state.library)}
    }));
  }

  function exportLibrary() {
    return clone(state.library);
  }

  function mergeLibrary(shapes) {
    if (!Array.isArray(shapes)) return;
    const merged = new Map(state.library.map(function (shape) { return [shape.id, shape]; }));
    shapes.filter(validStoredShape).forEach(function (shape) {
      const properties = columnShapeProperties(shape.nodes, shape.lines);
      if (!properties.valid) return;
      merged.set(String(shape.id), Object.assign({}, clone(shape), {
        id: String(shape.id),
        properties: {
          area: properties.area,
          centroidX: properties.centroidX,
          centroidY: properties.centroidY,
          ix: properties.ix,
          iy: properties.iy
        }
      }));
    });
    state.library = Array.from(merged.values());
    persistLibrary();
    renderLibrary();
  }

  function setStatus(message) {
    const target = byId("columnToolStatus");
    if (target) target.textContent = message;
  }

  function nextShapeName() {
    return "Column Shape " + String(state.library.length + 1).padStart(2, "0");
  }

  function draftSnapshot() {
    return {
      activeId: state.activeId,
      shapeKind: state.shapeKind,
      sectionWidth: state.sectionWidth,
      sectionHeight: state.sectionHeight,
      sectionDiameter: state.sectionDiameter,
      gridSpacing: state.gridSpacing,
      name: String(byId("columnShapeName") && byId("columnShapeName").value || ""),
      nodes: clone(state.nodes),
      lines: clone(state.lines),
      dimensions: clone(state.dimensions),
      selected: clone(state.selected),
      pendingNodeId: state.pendingNodeId,
      pendingDimensionMoveId: state.pendingDimensionMoveId
    };
  }

  function pushHistory() {
    state.history.push(draftSnapshot());
    while (state.history.length > 40) state.history.shift();
    updateButtons();
  }

  function restoreDraft(snapshot) {
    state.activeId = snapshot.activeId || null;
    state.shapeKind = ["RECTANGULAR", "CIRCULAR", "CUSTOM"].includes(snapshot.shapeKind) ? snapshot.shapeKind : "RECTANGULAR";
    state.sectionWidth = Math.max(normalMinimumDimension(), Number(snapshot.sectionWidth) || 400);
    state.sectionHeight = Math.max(normalMinimumDimension(), Number(snapshot.sectionHeight) || state.sectionWidth);
    state.sectionDiameter = Math.max(normalMinimumDimension(), Number(snapshot.sectionDiameter) || state.sectionWidth);
    state.gridSpacing = Math.max(10, Math.min(500, Number(snapshot.gridSpacing) || state.gridSpacing || 50));
    state.nodes = clone(snapshot.nodes || []);
    state.lines = clone(snapshot.lines || []);
    state.dimensions = clone(snapshot.dimensions || []);
    state.selected = clone(snapshot.selected);
    state.pendingNodeId = snapshot.pendingNodeId || null;
    state.pendingDimensionMoveId = snapshot.pendingDimensionMoveId || null;
    if (byId("columnShapeName")) byId("columnShapeName").value = snapshot.name || nextShapeName();
    if (byId("columnGridSpacing")) byId("columnGridSpacing").value = String(state.gridSpacing);
    updateSectionInputs();
    drawEditor();
    updateReadout();
    updateButtons();
    renderLibrary();
  }

  function clearDrawing() {
    const previous = draftSnapshot();
    state.activeId = null;
    state.shapeKind = "RECTANGULAR";
    state.sectionWidth = 400;
    state.sectionHeight = 400;
    state.sectionDiameter = 400;
    state.nodes = [];
    state.lines = [];
    state.dimensions = [];
    state.selected = null;
    state.pendingNodeId = null;
    state.pendingDimensionMoveId = null;
    state.history = [previous];
    if (byId("columnShapeName")) byId("columnShapeName").value = nextShapeName();
    updateSectionInputs();
    setMode("node");
    setStatus("Screen cleared. Place the first node to start a new column drawing.");
    updateButtons();
    renderLibrary();
    drawEditor();
    updateReadout();
  }

  function rotateDrawing() {
    if (!state.nodes.length) {
      setStatus("There is no column drawing to rotate.");
      return;
    }
    pushHistory();
    const properties = columnShapeProperties(state.nodes, state.lines);
    const centerX = properties.valid
      ? properties.centroidX
      : state.nodes.reduce(function (sum, node) { return sum + Number(node.x); }, 0) / state.nodes.length;
    const centerY = properties.valid
      ? properties.centroidY
      : state.nodes.reduce(function (sum, node) { return sum + Number(node.y); }, 0) / state.nodes.length;
    state.nodes = state.nodes.map(function (node) {
      const dx = Number(node.x) - centerX;
      const dy = Number(node.y) - centerY;
      return {
        ...node,
        x: Math.round((centerX + dy) * 1e6) / 1e6,
        y: Math.round((centerY - dx) * 1e6) / 1e6
      };
    });
    if (state.shapeKind === "RECTANGULAR") {
      const width = state.sectionWidth;
      state.sectionWidth = state.sectionHeight;
      state.sectionHeight = width;
      updateSectionInputs();
    }
    state.selected = null;
    state.pendingNodeId = null;
    state.pendingDimensionMoveId = null;
    drawEditor();
    updateReadout();
    updateButtons();
    setStatus("Column drawing rotated 90 degrees clockwise.");
  }

  function startNewShape() {
    const draft = defaultDraft();
    state.activeId = null;
    state.shapeKind = "RECTANGULAR";
    state.sectionWidth = 400;
    state.sectionHeight = 400;
    state.sectionDiameter = 400;
    state.nodes = draft.nodes;
    state.lines = draft.lines;
    state.dimensions = draft.dimensions;
    state.selected = null;
    state.pendingNodeId = null;
    state.history = [];
    const name = byId("columnShapeName");
    if (name) name.value = nextShapeName();
    const spacing = byId("columnGridSpacing");
    if (spacing) spacing.value = "50";
    state.gridSpacing = 50;
    updateSectionInputs();
    setMode("select");
    setStatus("New 400 x 400 mm section ready.");
    updateButtons();
    renderLibrary();
    drawEditor();
    updateReadout();
  }

  function loadShape(shape) {
    state.activeId = shape.id;
    state.nodes = clone(shape.nodes);
    state.lines = clone(shape.lines);
    state.dimensions = clone(shape.dimensions);
    state.gridSpacing = Math.max(10, Number(shape.gridSpacing) || 50);
    state.selected = null;
    state.pendingNodeId = null;
    state.history = [];
    state.shapeKind = ["RECTANGULAR", "CIRCULAR", "CUSTOM"].includes(shape.kind) ? shape.kind : "RECTANGULAR";
    state.sectionWidth = Math.max(normalMinimumDimension(), Number(shape.width) || 400);
    state.sectionHeight = Math.max(normalMinimumDimension(), Number(shape.height) || state.sectionWidth);
    state.sectionDiameter = Math.max(normalMinimumDimension(), Number(shape.diameter) || state.sectionWidth);
    if (byId("columnShapeName")) byId("columnShapeName").value = shape.name || "Column Shape";
    if (byId("columnGridSpacing")) byId("columnGridSpacing").value = String(state.gridSpacing);
    updateSectionInputs();
    setMode("select");
    setStatus("Loaded " + (shape.name || "column shape") + ".");
    updateButtons();
    renderLibrary();
    drawEditor();
    updateReadout();
  }

  function saveShape() {
    const properties = columnShapeProperties(state.nodes, state.lines);
    if (!properties.valid) {
      setStatus(properties.reason);
      return;
    }
    const dimensionValidation = sectionDimensionValidation(properties, state.shapeKind);
    const name = String(byId("columnShapeName") && byId("columnShapeName").value || "").trim();
    if (!name) {
      setStatus("Enter a shape name before saving.");
      byId("columnShapeName") && byId("columnShapeName").focus();
      return;
    }
    const now = new Date().toISOString();
    const id = state.activeId || makeId("column-shape");
    const bounds = polygonBounds(properties.polygon);
    const insertionPoint = polygonInsertionPoint(properties.polygon, properties);
    // Saving the library drawing must remain independent from the stricter
    // Structural Plan/application gate. A closed section is always saveable;
    // its design-warning flag controls whether it may be applied to the plan.
    const section = {
      width: state.shapeKind === "CIRCULAR" ? state.sectionDiameter : bounds.width,
      height: state.shapeKind === "CIRCULAR" ? state.sectionDiameter : bounds.height,
      insertionPoint: insertionPoint,
      geometry: state.shapeKind === "CUSTOM" ? {
        points: properties.polygon.map(function (point) {
          return {x: point.x - insertionPoint.x, y: point.y - insertionPoint.y};
        })
      } : null,
      reinforcement: defaultRebarLayout(properties, state.shapeKind)
    };
    const record = {
      id: id,
      name: name,
      kind: state.shapeKind,
      width: section.width,
      height: section.height,
      diameter: state.shapeKind === "CIRCULAR" ? state.sectionDiameter : null,
      insertionPoint: section.insertionPoint,
      geometry: section.geometry,
      reinforcement: section.reinforcement,
      designWarning: dimensionValidation.valid ? null : dimensionValidation.reason,
      gridSpacing: state.gridSpacing,
      nodes: clone(state.nodes),
      lines: clone(state.lines),
      dimensions: clone(state.dimensions),
      properties: {
        area: properties.area,
        centroidX: properties.centroidX,
        centroidY: properties.centroidY,
        ix: properties.ix,
        iy: properties.iy
      },
      updatedAt: now
    };
    const index = state.library.findIndex(function (item) { return item.id === id; });
    if (index >= 0) state.library[index] = record;
    else state.library.push(record);
    state.activeId = id;
    persistLibrary();
    renderLibrary();
    updateButtons();
    setStatus(dimensionValidation.valid
      ? "Saved " + name + " to the column shape library."
      : "Saved " + name + " as a draft. " + dimensionValidation.reason + " Resolve it before applying the section to the Structural Plan.");
  }

  function deleteSavedShape() {
    if (!state.activeId) return;
    const shape = state.library.find(function (item) { return item.id === state.activeId; });
    state.library = state.library.filter(function (item) { return item.id !== state.activeId; });
    persistLibrary();
    startNewShape();
    setStatus((shape && shape.name || "Column shape") + " deleted.");
  }

  function updateCount() {
    const count = byId("columnToolCount");
    if (!count) return;
    count.textContent = String(state.library.length);
    count.setAttribute("aria-label", state.library.length + " saved column shape" + (state.library.length === 1 ? "" : "s"));
  }

  function drawShapeThumbnail(canvas, shape) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const night = document.body.dataset.theme === "green_teal";
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = night ? "#090f11" : "#ffffff";
    ctx.fillRect(0, 0, width, height);
    if (!shape.nodes.length) return;
    const xs = shape.nodes.map(function (node) { return Number(node.x); });
    const ys = shape.nodes.map(function (node) { return Number(node.y); });
    const minX = Math.min.apply(null, xs);
    const maxX = Math.max.apply(null, xs);
    const minY = Math.min.apply(null, ys);
    const maxY = Math.max.apply(null, ys);
    const scale = Math.min((width - 22) / Math.max(1, maxX - minX), (height - 22) / Math.max(1, maxY - minY));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const screen = function (node) {
      return {x: width / 2 + (node.x - centerX) * scale, y: height / 2 - (node.y - centerY) * scale};
    };
    const nodeMap = new Map(shape.nodes.map(function (node) { return [String(node.id), node]; }));
    const boundary = columnShapeBoundary(shape.nodes, shape.lines);
    if (boundary.valid) {
      ctx.beginPath();
      boundary.orderedIds.forEach(function (id, index) {
        const point = screen(nodeMap.get(String(id)));
        if (!index) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      ctx.fillStyle = night ? "rgba(255,129,18,0.22)" : "rgba(135,129,129,0.18)";
      ctx.fill();
    }
    ctx.strokeStyle = night ? "#e6eeec" : "#2f3334";
    ctx.lineWidth = 2;
    shape.lines.forEach(function (line) {
      const a = nodeMap.get(String(line.a));
      const b = nodeMap.get(String(line.b));
      if (!a || !b) return;
      const sa = screen(a);
      const sb = screen(b);
      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y);
      ctx.lineTo(sb.x, sb.y);
      ctx.stroke();
    });
  }

  function renderLibrary() {
    const grid = byId("columnShapeLibraryGrid");
    const empty = byId("columnLibraryEmpty");
    if (!grid) return;
    grid.replaceChildren();
    state.library.forEach(function (shape) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "column-shape-card" + (shape.id === state.activeId ? " is-active" : "");
      card.title = "Open " + shape.name;
      card.setAttribute("aria-label", "Open " + shape.name);
      const canvas = document.createElement("canvas");
      canvas.width = 180;
      canvas.height = 110;
      const caption = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = shape.name;
      const size = document.createElement("small");
      size.textContent = formatArea(shape.properties && shape.properties.area) + " area";
      caption.append(title, size);
      card.append(canvas, caption);
      card.addEventListener("click", function () { loadShape(shape); });
      grid.appendChild(card);
      drawShapeThumbnail(canvas, shape);
    });
    if (empty) empty.hidden = state.library.length > 0;
    updateCount();
  }

  function setMode(mode) {
    state.mode = mode;
    state.pendingNodeId = null;
    state.pendingDimensionMoveId = null;
    const buttons = {
      select: "columnSelectTool",
      node: "columnNodeTool",
      line: "columnLineTool",
      dimension: "columnDimensionTool"
    };
    Object.entries(buttons).forEach(function (entry) {
      byId(entry[1]) && byId(entry[1]).classList.toggle("is-active", entry[0] === mode);
    });
    setStatus(mode.charAt(0).toUpperCase() + mode.slice(1) + " tool active.");
    drawEditor();
  }

  function updateButtons() {
    if (byId("columnUndoTool")) byId("columnUndoTool").disabled = !state.history.length;
    if (byId("columnRotateTool")) byId("columnRotateTool").disabled = !state.nodes.length;
    if (byId("columnClearTool")) byId("columnClearTool").disabled = !state.nodes.length && !state.lines.length && !state.dimensions.length;
    if (byId("columnShapeDelete")) byId("columnShapeDelete").disabled = !state.activeId;
    if (byId("columnDeleteTool")) byId("columnDeleteTool").disabled = !state.selected;
    if (byId("columnRectangleTool")) byId("columnRectangleTool").classList.toggle("is-active", state.shapeKind === "RECTANGULAR");
    if (byId("columnCircleTool")) byId("columnCircleTool").classList.toggle("is-active", state.shapeKind === "CIRCULAR");
    const gridButton = byId("columnGridTool");
    if (gridButton) {
      gridButton.classList.toggle("is-active", state.gridVisible);
      gridButton.setAttribute("aria-pressed", String(state.gridVisible));
    }
  }

  function canvasMetrics() {
    const canvas = byId("columnShapeCanvas");
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.round(rect.width || 820));
    const height = Math.max(320, Math.round(rect.height || 520));
    const dpr = Math.min(2, global.devicePixelRatio || 1);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    state.scale = width < 500 ? 0.52 : 0.7;
    return {canvas: canvas, width: width, height: height, dpr: dpr};
  }

  function worldToScreen(point, metrics) {
    return {
      x: metrics.width / 2 + Number(point.x) * state.scale,
      y: metrics.height / 2 - Number(point.y) * state.scale
    };
  }

  function screenToWorld(event) {
    const metrics = canvasMetrics();
    const rect = metrics.canvas.getBoundingClientRect();
    const raw = {
      x: (event.clientX - rect.left - metrics.width / 2) / state.scale,
      y: (metrics.height / 2 - (event.clientY - rect.top)) / state.scale
    };
    const spacing = Math.max(10, state.gridSpacing);
    return {
      x: Math.round(raw.x / spacing) * spacing,
      y: Math.round(raw.y / spacing) * spacing
    };
  }

  function nodeMap() {
    return new Map(state.nodes.map(function (node) { return [String(node.id), node]; }));
  }

  function defaultDimensionOffset(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length < 1e-8) return 0;
    const normal = {x: -dy / length, y: dx / length};
    const mid = {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2};
    const boundary = columnShapeBoundary(state.nodes, state.lines);
    const probe = Math.max(10, state.gridSpacing / 3);
    if (boundary.valid) {
      const plusInside = pointInPolygon({x: mid.x + normal.x * probe, y: mid.y + normal.y * probe}, boundary.polygon);
      const minusInside = pointInPolygon({x: mid.x - normal.x * probe, y: mid.y - normal.y * probe}, boundary.polygon);
      if (plusInside !== minusInside) return plusInside ? -60 : 60;
    }
    const properties = columnShapeProperties(state.nodes, state.lines);
    const outward = (mid.x - (properties.centroidX || 0)) * normal.x + (mid.y - (properties.centroidY || 0)) * normal.y;
    return outward >= 0 ? 60 : -60;
  }

  function dimensionGeometry(dimension, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length < 1e-8) return null;
    const normal = {x: -dy / length, y: dx / length};
    const offset = Number.isFinite(Number(dimension.offset)) ? Number(dimension.offset) : defaultDimensionOffset(a, b);
    return {
      normal: normal,
      offset: offset,
      a: {x: a.x + normal.x * offset, y: a.y + normal.y * offset},
      b: {x: b.x + normal.x * offset, y: b.y + normal.y * offset}
    };
  }

  function markCustomDrawing() {
    state.shapeKind = "CUSTOM";
    state.activeId = null;
  }

  function nodeNear(point) {
    const tolerance = 13 / state.scale;
    let best = null;
    let distance = Infinity;
    state.nodes.forEach(function (node) {
      const current = Math.hypot(node.x - point.x, node.y - point.y);
      if (current < distance && current <= tolerance) {
        best = node;
        distance = current;
      }
    });
    return best;
  }

  function distanceToSegment(point, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    if (!lengthSquared) return Math.hypot(point.x - a.x, point.y - a.y);
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
    return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
  }

  function objectNear(point) {
    const node = nodeNear(point);
    if (node) return {type: "node", id: node.id};
    const map = nodeMap();
    const tolerance = 10 / state.scale;
    let selected = null;
    let best = Infinity;
    state.dimensions.forEach(function (dimension) {
      const a = map.get(String(dimension.a));
      const b = map.get(String(dimension.b));
      if (!a || !b) return;
      const geometry = dimensionGeometry(dimension, a, b);
      if (!geometry) return;
      const distance = distanceToSegment(point, geometry.a, geometry.b);
      if (distance < best && distance <= tolerance) {
        selected = {type: "dimension", id: dimension.id};
        best = distance;
      }
    });
    state.lines.forEach(function (line) {
      const a = map.get(String(line.a));
      const b = map.get(String(line.b));
      if (!a || !b) return;
      const distance = distanceToSegment(point, a, b);
      if (distance < best && distance <= tolerance) {
        selected = {type: "line", id: line.id};
        best = distance;
      }
    });
    return selected;
  }

  function addNode(point) {
    const existing = nodeNear(point);
    if (existing) return existing;
    const node = {id: makeId("node"), x: point.x, y: point.y};
    state.nodes.push(node);
    markCustomDrawing();
    return node;
  }

  function handleCanvasClick(event) {
    const point = screenToWorld(event);
    if (state.mode === "select") {
      if (state.pendingDimensionMoveId) {
        const dimension = state.dimensions.find(function (item) { return item.id === state.pendingDimensionMoveId; });
        const map = nodeMap();
        const a = dimension && map.get(String(dimension.a));
        const b = dimension && map.get(String(dimension.b));
        const boundary = columnShapeBoundary(state.nodes, state.lines);
        if (!dimension || !a || !b) {
          state.pendingDimensionMoveId = null;
          setStatus("Dimension is no longer available.");
        } else if (boundary.valid && pointInPolygon(point, boundary.polygon)) {
          setStatus("Place the dimension outside the column boundary.");
        } else {
          const geometry = dimensionGeometry(dimension, a, b);
          const mid = {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2};
          pushHistory();
          dimension.offset = (point.x - mid.x) * geometry.normal.x + (point.y - mid.y) * geometry.normal.y;
          state.pendingDimensionMoveId = null;
          state.selected = {type: "dimension", id: dimension.id};
          setStatus("Dimension moved.");
        }
        updateButtons();
        drawEditor();
        return;
      }
      state.selected = objectNear(point);
      if (state.selected && state.selected.type === "dimension") {
        state.pendingDimensionMoveId = state.selected.id;
        setStatus("Dimension selected. Click outside the column to place it.");
      } else {
        setStatus(state.selected ? "Object selected." : "Selection cleared.");
      }
      updateButtons();
      drawEditor();
      return;
    }
    if (state.mode === "node") {
      if (nodeNear(point)) {
        setStatus("A node already exists at this location.");
        return;
      }
      pushHistory();
      const node = addNode(point);
      state.selected = {type: "node", id: node.id};
      setStatus("Node placed at " + node.x + ", " + node.y + " mm.");
      updateButtons();
      drawEditor();
      updateReadout();
      return;
    }
    if (state.mode === "line") {
      let node = nodeNear(point);
      let createdNode = false;
      if (!node) {
        pushHistory();
        node = addNode(point);
        createdNode = true;
      }
      if (!state.pendingNodeId) {
        state.pendingNodeId = node.id;
        state.selected = {type: "node", id: node.id};
        setStatus("Line start selected.");
      } else if (String(state.pendingNodeId) === String(node.id)) {
        state.pendingNodeId = null;
        setStatus("Line cancelled.");
      } else {
        const duplicate = state.lines.some(function (line) {
          return (String(line.a) === String(state.pendingNodeId) && String(line.b) === String(node.id)) ||
            (String(line.b) === String(state.pendingNodeId) && String(line.a) === String(node.id));
        });
        if (duplicate) {
          state.pendingNodeId = null;
          setStatus("That boundary line already exists.");
        } else {
          if (Math.hypot(node.x - nodeMap().get(String(state.pendingNodeId)).x, node.y - nodeMap().get(String(state.pendingNodeId)).y) < INSIDE_OR_BOTTOM_CORNER_MIN_DIMENSION) {
            if (createdNode) state.nodes = state.nodes.filter(function (item) { return item.id !== node.id; });
            setStatus("Boundary lines must be at least " + INSIDE_OR_BOTTOM_CORNER_MIN_DIMENSION + " mm long; only bottom or re-entrant inside-corner legs may use this reduced minimum.");
            updateButtons();
            drawEditor();
            updateReadout();
            return;
          }
          pushHistory();
          const line = {id: makeId("line"), a: state.pendingNodeId, b: node.id};
          state.lines.push(line);
          markCustomDrawing();
          state.pendingNodeId = node.id;
          state.selected = {type: "line", id: line.id};
          setStatus("Boundary line added. Continue from the active node.");
        }
      }
      updateButtons();
      drawEditor();
      updateReadout();
      return;
    }
    if (state.mode === "dimension") {
      const node = nodeNear(point);
      if (!node) {
        setStatus("Select an existing node for the dimension.");
        return;
      }
      if (!state.pendingNodeId) {
        state.pendingNodeId = node.id;
        state.selected = {type: "node", id: node.id};
        setStatus("Dimension start selected.");
      } else if (String(state.pendingNodeId) === String(node.id)) {
        state.pendingNodeId = null;
        setStatus("Dimension cancelled.");
      } else {
        if (Math.hypot(node.x - nodeMap().get(String(state.pendingNodeId)).x, node.y - nodeMap().get(String(state.pendingNodeId)).y) < INSIDE_OR_BOTTOM_CORNER_MIN_DIMENSION) {
          state.pendingNodeId = null;
          setStatus("Dimensions must be at least " + INSIDE_OR_BOTTOM_CORNER_MIN_DIMENSION + " mm.");
          return;
        }
        const duplicate = state.dimensions.some(function (dimension) {
          return (String(dimension.a) === String(state.pendingNodeId) && String(dimension.b) === String(node.id)) ||
            (String(dimension.b) === String(state.pendingNodeId) && String(dimension.a) === String(node.id));
        });
        if (duplicate) {
          state.pendingNodeId = null;
          setStatus("That dimension already exists.");
        } else {
          pushHistory();
          const dimension = {id: makeId("dimension"), a: state.pendingNodeId, b: node.id};
          state.dimensions.push(dimension);
          state.pendingNodeId = null;
          state.selected = {type: "dimension", id: dimension.id};
          setStatus("Dimension added.");
        }
      }
      updateButtons();
      drawEditor();
    }
  }

  function deleteSelected() {
    if (!state.selected) return;
    pushHistory();
    const selected = state.selected;
    if (selected.type === "node") {
      state.nodes = state.nodes.filter(function (node) { return node.id !== selected.id; });
      state.lines = state.lines.filter(function (line) { return line.a !== selected.id && line.b !== selected.id; });
      state.dimensions = state.dimensions.filter(function (dimension) { return dimension.a !== selected.id && dimension.b !== selected.id; });
    } else if (selected.type === "line") {
      state.lines = state.lines.filter(function (line) { return line.id !== selected.id; });
    } else if (selected.type === "dimension") {
      state.dimensions = state.dimensions.filter(function (dimension) { return dimension.id !== selected.id; });
    }
    if (selected.type === "node" || selected.type === "line") markCustomDrawing();
    state.selected = null;
    state.pendingNodeId = null;
    state.pendingDimensionMoveId = null;
    setStatus("Selected drawing object deleted.");
    updateButtons();
    drawEditor();
    updateReadout();
  }

  function drawGrid(ctx, metrics) {
    if (!state.gridVisible) return;
    const spacing = Math.max(10, state.gridSpacing) * state.scale;
    if (spacing < 7) return;
    ctx.save();
    ctx.strokeStyle = document.body.dataset.theme === "green_teal" ? "#253033" : "#e3dfdc";
    ctx.lineWidth = 1;
    const centerX = metrics.width / 2;
    const centerY = metrics.height / 2;
    for (let x = centerX % spacing; x < metrics.width; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, metrics.height);
      ctx.stroke();
    }
    for (let y = centerY % spacing; y < metrics.height; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(metrics.width, y);
      ctx.stroke();
    }
    ctx.strokeStyle = document.body.dataset.theme === "green_teal" ? "#506064" : "#aaa4a1";
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, metrics.height);
    ctx.moveTo(0, centerY);
    ctx.lineTo(metrics.width, centerY);
    ctx.stroke();
    ctx.restore();
  }

  function drawDimension(ctx, metrics, dimension, map) {
    const a = map.get(String(dimension.a));
    const b = map.get(String(dimension.b));
    if (!a || !b) return;
    const geometry = dimensionGeometry(dimension, a, b);
    if (!geometry) return;
    const sa = worldToScreen(a, metrics);
    const sb = worldToScreen(b, metrics);
    const da = worldToScreen(geometry.a, metrics);
    const db = worldToScreen(geometry.b, metrics);
    const selected = state.selected && state.selected.type === "dimension" && state.selected.id === dimension.id;
    ctx.save();
    ctx.strokeStyle = selected ? "#ff8112" : "#2878b5";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = selected ? 2 : 1.2;
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(da.x, da.y);
    ctx.moveTo(sb.x, sb.y);
    ctx.lineTo(db.x, db.y);
    ctx.moveTo(da.x, da.y);
    ctx.lineTo(db.x, db.y);
    ctx.stroke();
    const angle = Math.atan2(db.y - da.y, db.x - da.x);
    [da, db].forEach(function (point, index) {
      const direction = index === 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(point.x + direction * 8 * Math.cos(angle - 0.45), point.y + direction * 8 * Math.sin(angle - 0.45));
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(point.x + direction * 8 * Math.cos(angle + 0.45), point.y + direction * 8 * Math.sin(angle + 0.45));
      ctx.stroke();
    });
    const value = Math.hypot(b.x - a.x, b.y - a.y);
    const midX = (da.x + db.x) / 2;
    const midY = (da.y + db.y) / 2;
    ctx.font = '300 11px "Aptos Light", Aptos, Arial, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(Math.round(value) + " mm", midX, midY - 3);
    ctx.restore();
  }

  function drawDefaultReinforcement(ctx, metrics, properties) {
    const layout = defaultRebarLayout(properties, state.shapeKind);
    const bounds = polygonBounds(properties.polygon);
    ctx.save();
    ctx.strokeStyle = "#d9480f";
    ctx.fillStyle = "#ffd8a8";
    ctx.lineWidth = 1.2;
    if (layout.tie === "CIRCULAR") {
      const center = worldToScreen({x: properties.centroidX, y: properties.centroidY}, metrics);
      const radius = Math.max(0, Math.min(bounds.width, bounds.height) / 2 - layout.cover) * state.scale;
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (layout.tie === "RECTANGULAR") {
      const topLeft = worldToScreen({x: bounds.minX + layout.cover, y: bounds.maxY - layout.cover}, metrics);
      const bottomRight = worldToScreen({x: bounds.maxX - layout.cover, y: bounds.minY + layout.cover}, metrics);
      ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
    }
    layout.bars.forEach(function (bar) {
      const point = worldToScreen(bar, metrics);
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.max(3, layout.barDiameter * state.scale / 2), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawInsertionMarker(ctx, metrics, properties) {
    if (state.shapeKind !== "CUSTOM") return;
    const insertion = polygonInsertionPoint(properties.polygon, properties);
    if (insertion.type !== "MIDLINE_CORNER_INTERSECTION") return;
    const point = worldToScreen(insertion, metrics);
    const insideCorner = worldToScreen(insertion.insideCorner, metrics);
    const outsideCorner = worldToScreen(insertion.outsideCorner, metrics);
    ctx.save();
    ctx.strokeStyle = "#00a2ff";
    ctx.fillStyle = "#00a2ff";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(insideCorner.x, insideCorner.y);
    ctx.lineTo(outsideCorner.x, outsideCorner.y);
    ctx.moveTo(point.x - 28, point.y);
    ctx.lineTo(point.x + 28, point.y);
    ctx.moveTo(point.x, point.y - 28);
    ctx.lineTo(point.x, point.y + 28);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '300 9px "Aptos Light", Aptos, Arial, sans-serif';
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText("PLAN INSERTION", point.x + 6, point.y - 6);
    ctx.restore();
  }

  function drawEditor() {
    const canvas = byId("columnShapeCanvas");
    if (!canvas || !canvas.isConnected) return;
    const metrics = canvasMetrics();
    const ctx = canvas.getContext("2d");
    ctx.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0);
    const night = document.body.dataset.theme === "green_teal";
    ctx.clearRect(0, 0, metrics.width, metrics.height);
    ctx.fillStyle = night ? "#090f11" : "#ffffff";
    ctx.fillRect(0, 0, metrics.width, metrics.height);
    drawGrid(ctx, metrics);
    const map = nodeMap();
    const boundary = columnShapeBoundary(state.nodes, state.lines);
    if (boundary.valid) {
      ctx.beginPath();
      boundary.orderedIds.forEach(function (id, index) {
        const point = worldToScreen(map.get(String(id)), metrics);
        if (!index) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      ctx.fillStyle = night ? "rgba(255,129,18,0.16)" : "rgba(135,129,129,0.16)";
      ctx.fill();
      const properties = columnShapeProperties(state.nodes, state.lines);
      if (properties.valid) {
        drawDefaultReinforcement(ctx, metrics, properties);
        drawInsertionMarker(ctx, metrics, properties);
      }
    }
    state.lines.forEach(function (line) {
      const a = map.get(String(line.a));
      const b = map.get(String(line.b));
      if (!a || !b) return;
      const sa = worldToScreen(a, metrics);
      const sb = worldToScreen(b, metrics);
      const selected = state.selected && state.selected.type === "line" && state.selected.id === line.id;
      const constructionLine = (boundary.constructionLineIds || []).includes(String(line.id));
      ctx.strokeStyle = selected ? "#ff8112" : (constructionLine ? "#00a2ff" : (night ? "#e6eeec" : "#333839"));
      ctx.lineWidth = selected ? 4 : (constructionLine ? 1.3 : 2.4);
      ctx.setLineDash(constructionLine ? [5, 4] : []);
      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y);
      ctx.lineTo(sb.x, sb.y);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    state.dimensions.forEach(function (dimension) { drawDimension(ctx, metrics, dimension, map); });
    state.nodes.forEach(function (node) {
      const point = worldToScreen(node, metrics);
      const selected = state.selected && state.selected.type === "node" && state.selected.id === node.id;
      const pending = String(state.pendingNodeId || "") === String(node.id);
      ctx.beginPath();
      ctx.arc(point.x, point.y, selected || pending ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = selected || pending ? "#ff8112" : "#ffffff";
      ctx.fill();
      ctx.strokeStyle = selected || pending ? "#c95d00" : (night ? "#e6eeec" : "#25292a");
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }

  function formatArea(value) {
    if (!Number.isFinite(Number(value))) return "-";
    return Math.round(Number(value)).toLocaleString() + " mm2";
  }

  function formatInertia(value) {
    if (!Number.isFinite(Number(value))) return "-";
    return Number(value).toExponential(3) + " mm4";
  }

  function updateReadout() {
    const properties = columnShapeProperties(state.nodes, state.lines);
    const values = properties.valid ? {
      columnShapeArea: formatArea(properties.area),
      columnShapeCx: properties.centroidX.toFixed(1) + " mm",
      columnShapeCy: properties.centroidY.toFixed(1) + " mm",
      columnShapeIx: formatInertia(properties.ix),
      columnShapeIy: formatInertia(properties.iy)
    } : {
      columnShapeArea: "-",
      columnShapeCx: "-",
      columnShapeCy: "-",
      columnShapeIx: "-",
      columnShapeIy: "-"
    };
    Object.entries(values).forEach(function (entry) {
      if (byId(entry[0])) byId(entry[0]).textContent = entry[1];
    });
  }

  function openTool() {
    updateMinimumDimensionInputs();
    renderLibrary();
    if (!state.nodes.length) startNewShape();
    const dialog = byId("columnToolDialog");
    if (dialog && typeof dialog.showModal === "function") dialog.showModal();
    else if (dialog) dialog.setAttribute("open", "");
    global.requestAnimationFrame(function () {
      drawEditor();
      updateReadout();
    });
  }

  function closeTool() {
    const dialog = byId("columnToolDialog");
    if (dialog && typeof dialog.close === "function") dialog.close();
    else if (dialog) dialog.removeAttribute("open");
  }

  function applySelectedColumnToPlan() {
    const drawing = sectionFromCurrentDrawing();
    const section = drawing.section;
    if (!section) {
      setStatus(drawing.properties.reason || "Complete a valid closed column section before applying it to the plan.");
      return;
    }
    if (typeof global.onStrucForgeApplyColumnToPlan !== "function") {
      setStatus("Structural Plan is not ready yet. Try again after the application finishes loading.");
      return;
    }
    global.onStrucForgeApplyColumnToPlan(clone(section));
    closeTool();
  }

  function install() {
    if (!byId("columnToolBtn") || byId("columnToolBtn").dataset.ready) return;
    byId("columnToolBtn").dataset.ready = "true";
    loadLibrary();
    startNewShape();
    renderLibrary();
    byId("columnToolBtn").addEventListener("click", openTool);
    byId("columnToolClose").addEventListener("click", closeTool);
    byId("columnToolDone").addEventListener("click", closeTool);
    byId("columnLibraryNew").addEventListener("click", startNewShape);
    byId("columnShapeNew").addEventListener("click", startNewShape);
    byId("columnShapeSave").addEventListener("click", saveShape);
    byId("columnShapeDelete").addEventListener("click", deleteSavedShape);
    byId("applyColumnToPlanBtn").addEventListener("click", applySelectedColumnToPlan);
    byId("columnSelectTool").addEventListener("click", function () { setMode("select"); });
    byId("columnRectangleTool").addEventListener("click", function () { setParametricShape("RECTANGULAR"); });
    byId("columnCircleTool").addEventListener("click", function () { setParametricShape("CIRCULAR"); });
    byId("columnNodeTool").addEventListener("click", function () { setMode("node"); });
    byId("columnLineTool").addEventListener("click", function () { setMode("line"); });
    byId("columnDimensionTool").addEventListener("click", function () { setMode("dimension"); });
    byId("columnClearTool").addEventListener("click", clearDrawing);
    byId("columnRotateTool").addEventListener("click", rotateDrawing);
    byId("columnGridTool").addEventListener("click", function () {
      state.gridVisible = !state.gridVisible;
      updateButtons();
      drawEditor();
      setStatus("Grid " + (state.gridVisible ? "shown." : "hidden."));
    });
    byId("columnUndoTool").addEventListener("click", function () {
      const previous = state.history.pop();
      if (previous) {
        restoreDraft(previous);
        setStatus("Column drawing change undone.");
      }
    });
    byId("columnDeleteTool").addEventListener("click", deleteSelected);
    byId("columnGridSpacing").addEventListener("change", function (event) {
      state.gridSpacing = Math.max(10, Math.min(500, Number(event.target.value) || 50));
      event.target.value = String(state.gridSpacing);
      drawEditor();
    });
    ["columnShapeWidth", "columnShapeHeight", "columnShapeDiameter"].forEach(function (id) {
      byId(id).addEventListener("change", function () {
        setParametricShape(state.shapeKind);
      });
    });
    byId("columnShapeCanvas").addEventListener("click", handleCanvasClick);
    byId("columnToolDialog").addEventListener("cancel", function (event) {
      event.preventDefault();
      closeTool();
    });
    byId("columnToolDialog").addEventListener("keydown", function (event) {
      const editing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if ((event.key === "Delete" || event.key === "Backspace") && !editing && state.selected) {
        event.preventDefault();
        deleteSelected();
      }
      if (event.key === "Escape" && state.pendingNodeId) {
        event.preventDefault();
        state.pendingNodeId = null;
        drawEditor();
        setStatus("Pending point cancelled.");
      }
      if (event.key === "Escape" && state.pendingDimensionMoveId) {
        event.preventDefault();
        state.pendingDimensionMoveId = null;
        drawEditor();
        setStatus("Dimension move cancelled.");
      }
    });
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(function () {
        if (byId("columnToolDialog").open) drawEditor();
      });
      observer.observe(byId("columnShapeCanvas").parentElement);
    } else {
      global.addEventListener("resize", drawEditor);
    }
  }

  global.StrucForgeColumnTool = {
    open: openTool,
    getLibrary: exportLibrary,
    mergeLibrary: mergeLibrary,
    getSelectedSection: activeSection
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
}(typeof window !== "undefined" ? window : globalThis));
