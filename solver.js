function sameModelId(a, b) {
  return a === b || String(a) === String(b);
}

function memberNode(model, id) {
  return (model.nodes || []).find(n => sameModelId(n.id, id));
}

function memberLength(model, member) {
  const a = memberNode(model, member.i);
  const b = memberNode(model, member.j);
  if (!a || !b) return Math.max(0.001, Number(member.length) || 0.001);
  return Math.max(0.001, Math.hypot(b.x - a.x, b.y - a.y));
}

function memberSelfWeightValue(member) {
  if (!member || (member.type !== "Column" && member.type !== "Beam")) return 0;
  const areaMm2 = Number(member.A) || 0;
  const enteredUnitWeight = Number(member.unitWeight);
  const concreteUnitWeight = Number.isFinite(enteredUnitWeight) ? Math.max(0, enteredUnitWeight) : 24;
  const loadPathShare = Number.isFinite(Number(member.selfWeightFactor))
    ? Math.max(0, Number(member.selfWeightFactor))
    : 1;
  return areaMm2 * concreteUnitWeight * loadPathShare / 1000000;
}

function computedMemberDiagramValues(model, member) {
  const L = memberLength(model, member);
  const selfWeight = memberSelfWeightValue(member);
  const memberLoads = (model.loads || []).filter(load => sameModelId(load.member, member.id));
  const userDeadLoad = memberLoads
    .filter(load => load.kind === "member_udl" && String(load.case || "").toUpperCase() === "DL")
    .reduce((sum, load) => sum + Math.abs(Number(load.w) || 0), 0);
  const udls = memberLoads
    .filter(load => load.kind === "member_udl")
    .map(load => {
      const a = memberNode(model, member.i);
      const b = memberNode(model, member.j);
      const Lm = memberLength(model, member);
      const c = a && b ? (b.x - a.x) / Lm : 1;
      const s = a && b ? (b.y - a.y) / Lm : 0;
      const wx = Number(load.wx) || 0;
      const wy = Number(load.w) || 0;
      const qyLocal = -s * wx - c * wy;
      return Math.abs(qyLocal);
    });
  const beamDeadLoad = member.type === "Beam" ? userDeadLoad + selfWeight : userDeadLoad;
  if ((member.type === "Beam" || member.type === "Column") && selfWeight > 0) udls.push(selfWeight);
  const points = memberLoads
    .filter(load => load.kind === "member_point")
    .map(load => ({
      p: Math.abs(Number(load.p) || 0),
      x: Math.max(0, Math.min(L, Number(load.x) || L / 2))
    }));

  let r1 = 0;
  let r2 = 0;
  for (const w of udls) {
    r1 += w * L / 2;
    r2 += w * L / 2;
  }
  for (const point of points) {
    r1 += point.p * (L - point.x) / L;
    r2 += point.p * point.x / L;
  }

  const shearAt = x => {
    let v = r1;
    for (const w of udls) v -= w * x;
    for (const point of points) {
      if (x >= point.x) v -= point.p;
    }
    return v;
  };

  const momentAt = x => {
    let m = r1 * x;
    for (const w of udls) m -= w * x * x / 2;
    for (const point of points) {
      if (x >= point.x) m -= point.p * (x - point.x);
    }
    return m;
  };

  const pointPositions = points.map(point => point.x);
  const uniquePositions = [...new Set([0, L, L / 2, ...pointPositions].map(x => Number(x.toFixed(6))))].sort((a, b) => a - b);
  const shearSamples = [];
  for (const x of uniquePositions) {
    const before = Math.max(0, x - L * 0.0001);
    const after = Math.min(L, x + L * 0.0001);
    if (x > 0 && pointPositions.some(px => Math.abs(px - x) < 1e-5)) {
      shearSamples.push({t: x / L, value: shearAt(before)});
      shearSamples.push({t: x / L, value: shearAt(after)});
    } else {
      shearSamples.push({t: x / L, value: shearAt(x)});
    }
  }

  const momentPositions = new Set([0, L, ...pointPositions]);
  for (let i = 1; i < 20; i++) momentPositions.add(Number((L * i / 20).toFixed(6)));
  const momentSamples = [...momentPositions]
    .sort((a, b) => a - b)
    .map(x => ({t: x / L, value: momentAt(x)}));

  const maxMomentSample = momentSamples.reduce((best, sample) =>
    Math.abs(sample.value) > Math.abs(best.value) ? sample : best, {t: 0, value: 0});
  const maxShear = Math.max(...shearSamples.map(sample => Math.abs(sample.value)), 0.001);
  const maxMoment = Math.max(...momentSamples.map(sample => Math.abs(sample.value)), 0.001);

  const shearLabels = [
    {t: 0, value: r1},
    ...points.map(point => ({t: point.x / L, value: shearAt(Math.min(L, point.x + L * 0.0001))})),
    {t: 1, value: -r2}
  ];
  const momentLabels = [
    {t: 0, value: 0},
    maxMomentSample,
    {t: 1, value: 0}
  ];

  return {
    memberId: member.id,
    length: L,
    reactions: {start: r1, end: r2},
    selfWeight,
    axialSelfWeight: selfWeight * L,
    beamDeadLoad,
    maxShear,
    maxMoment,
    shearSamples,
    momentSamples,
    shearLabels,
    momentLabels
  };
}

function supportRestrainedDofs(type) {
  if (!type) return [];
  if (type === "Fixed") return ["x", "y", "rz"];
  if (type === "Pinned") return ["x", "y"];
  if (type === "Roller Y") return ["y"];
  if (type === "Roller X") return ["x"];
  return ["x", "y"];
}

function solveLinearSystem(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-9) return null;
    if (pivot !== col) [M[pivot], M[col]] = [M[col], M[pivot]];
    const div = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }
  return M.map(row => row[n]);
}

function transformFrameMatrix(k, c, s) {
  const T = [
    [c, s, 0, 0, 0, 0],
    [-s, c, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 0],
    [0, 0, 0, c, s, 0],
    [0, 0, 0, -s, c, 0],
    [0, 0, 0, 0, 0, 1]
  ];
  const temp = Array.from({length: 6}, () => Array(6).fill(0));
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      for (let p = 0; p < 6; p++) temp[i][j] += k[i][p] * T[p][j];
    }
  }
  const out = Array.from({length: 6}, () => Array(6).fill(0));
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      for (let p = 0; p < 6; p++) out[i][j] += T[p][i] * temp[p][j];
    }
  }
  return out;
}

function transformFrameVector(local, c, s) {
  const T = [
    [c, s, 0, 0, 0, 0],
    [-s, c, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 0],
    [0, 0, 0, c, s, 0],
    [0, 0, 0, -s, c, 0],
    [0, 0, 0, 0, 0, 1]
  ];
  const out = Array(6).fill(0);
  for (let i = 0; i < 6; i++) {
    for (let p = 0; p < 6; p++) out[i] += T[p][i] * local[p];
  }
  return out;
}

function addNodalResult(nodalForces, nodeId, fx = 0, fy = 0, mz = 0) {
  if (!nodalForces[nodeId]) nodalForces[nodeId] = { node: nodeId, fx: 0, fy: 0, mz: 0 };
  nodalForces[nodeId].fx += Number(fx) || 0;
  nodalForces[nodeId].fy += Number(fy) || 0;
  nodalForces[nodeId].mz += Number(mz) || 0;
}

function loadCaseFactor(loadCase, options = {}) {
  if (!options.caseFactors) return 1;
  const raw = String(loadCase || "DL").toUpperCase();
  const key = raw === "EQL" ? "EQ" : raw;
  const value = options.caseFactors[key];
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function addEquivalentLocal(target, source) {
  source.forEach((value, index) => target[index] += value);
}

function memberLoadData(model, member, c, s, lengthM, options = {}) {
  const equivalentLocal = Array(6).fill(0);
  const distributed = [];
  const points = [];
  const addDistributedGlobal = (globalX, globalY) => {
    const qx = c * globalX + s * globalY;
    const qy = -s * globalX + c * globalY;
    if (Math.abs(qx) < 1e-12 && Math.abs(qy) < 1e-12) return;
    distributed.push({qx, qy});
    addEquivalentLocal(equivalentLocal, [
      qx * lengthM / 2 * 1000,
      qy * lengthM / 2 * 1000,
      qy * lengthM * lengthM / 12 * 1000000,
      qx * lengthM / 2 * 1000,
      qy * lengthM / 2 * 1000,
      -qy * lengthM * lengthM / 12 * 1000000
    ]);
  };
  const addPointGlobal = (globalX, globalY, distance) => {
    const x = Math.max(0, Math.min(lengthM, Number(distance) || lengthM / 2));
    const ratio = lengthM > 1e-12 ? x / lengthM : 0.5;
    const px = c * globalX + s * globalY;
    const py = -s * globalX + c * globalY;
    if (Math.abs(px) < 1e-12 && Math.abs(py) < 1e-12) return;
    points.push({px, py, x});
    const n1 = 1 - 3 * ratio * ratio + 2 * ratio * ratio * ratio;
    const n2 = lengthM * (ratio - 2 * ratio * ratio + ratio * ratio * ratio);
    const n3 = 3 * ratio * ratio - 2 * ratio * ratio * ratio;
    const n4 = lengthM * (-ratio * ratio + ratio * ratio * ratio);
    addEquivalentLocal(equivalentLocal, [
      px * (1 - ratio) * 1000,
      py * n1 * 1000,
      py * n2 * 1000000,
      px * ratio * 1000,
      py * n3 * 1000,
      py * n4 * 1000000
    ]);
  };

  const selfWeightFactor = Number.isFinite(Number(options.selfWeightFactor))
    ? Number(options.selfWeightFactor)
    : loadCaseFactor("DL", options);
  addDistributedGlobal(0, -memberSelfWeightValue(member) * selfWeightFactor);

  for (const load of model.loads || []) {
    if (!sameModelId(load.member, member.id)) continue;
    const factor = loadCaseFactor(load.case, options);
    if (!factor) continue;
    if (load.kind === "member_udl") {
      addDistributedGlobal((Number(load.wx) || 0) * factor, -(Number(load.w) || 0) * factor);
    } else if (load.kind === "member_point") {
      const globalX = (Number(load.fx) || 0) * factor;
      const globalY = load.fy !== undefined
        ? (Number(load.fy) || 0) * factor
        : -Math.abs(Number(load.p) || 0) * factor;
      addPointGlobal(globalX, globalY, load.x);
    } else if (load.kind === "member_point_vector") {
      addPointGlobal((Number(load.fx) || 0) * factor, (Number(load.fy) || 0) * factor, load.x);
    }
  }
  return {equivalentLocal, distributed, points};
}

function uniqueDiagramLabels(samples) {
  if (!samples.length) return [];
  const extreme = samples.reduce((best, sample) => Math.abs(sample.value) > Math.abs(best.value) ? sample : best, samples[0]);
  const chosen = [samples[0], extreme, samples[samples.length - 1]];
  const seen = new Set();
  return chosen.filter(sample => {
    const key = `${Number(sample.t).toFixed(6)}|${Number(sample.value).toFixed(6)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function recoveredMemberDiagram(model, member, system, localEndForces) {
  const length = system.lengthM;
  const qx = system.loadData.distributed.reduce((sum, item) => sum + item.qx, 0);
  const qy = system.loadData.distributed.reduce((sum, item) => sum + item.qy, 0);
  const points = system.loadData.points.slice().sort((a, b) => a.x - b.x);
  const startAxial = localEndForces[0] / 1000;
  const startShear = localEndForces[1] / 1000;
  const startEndMoment = localEndForces[2] / 1000000;
  const responseAt = (x, afterPoint = true) => {
    let axial = -startAxial - qx * x;
    let shear = startShear + qy * x;
    let moment = -startEndMoment + startShear * x + qy * x * x / 2;
    for (const point of points) {
      if (point.x < x || (afterPoint && Math.abs(point.x - x) < 1e-9)) {
        axial -= point.px;
        shear += point.py;
        moment += point.py * (x - point.x);
      }
    }
    return {axial, shear, moment};
  };

  const positions = new Set([0, length]);
  for (let index = 1; index < 80; index += 1) positions.add(length * index / 80);
  points.forEach(point => positions.add(point.x));
  const shearSamples = [];
  const momentSamples = [];
  const axialSamples = [];
  Array.from(positions).sort((a, b) => a - b).forEach(x => {
    const before = responseAt(x, false);
    const after = responseAt(x, true);
    const t = length > 0 ? x / length : 0;
    shearSamples.push({t, value: before.shear});
    if (Math.abs(after.shear - before.shear) > 1e-9) shearSamples.push({t, value: after.shear});
    momentSamples.push({t, value: after.moment});
    axialSamples.push({t, value: after.axial});
  });
  const maxShear = Math.max(0, ...shearSamples.map(sample => Math.abs(sample.value)));
  const maxMoment = Math.max(0, ...momentSamples.map(sample => Math.abs(sample.value)));
  const maxPositiveMoment = Math.max(0, ...momentSamples.map(sample => sample.value));
  const maxNegativeMoment = Math.min(0, ...momentSamples.map(sample => sample.value));
  const maxAxial = Math.max(0, ...axialSamples.map(sample => Math.abs(sample.value)));
  const rawDeadLoad = (model.loads || [])
    .filter(load => sameModelId(load.member, member.id) && load.kind === "member_udl" && String(load.case || "").toUpperCase() === "DL")
    .reduce((sum, load) => sum + Math.abs(Number(load.w) || 0), 0);
  return {
    memberId: member.id,
    length,
    reactions: {start: shearSamples[0]?.value || 0, end: -(shearSamples[shearSamples.length - 1]?.value || 0)},
    selfWeight: memberSelfWeightValue(member),
    axialSelfWeight: memberSelfWeightValue(member) * length,
    beamDeadLoad: rawDeadLoad + memberSelfWeightValue(member),
    maxAxial,
    maxShear,
    maxMoment,
    maxPositiveMoment,
    maxNegativeMoment,
    startMoment: momentSamples[0]?.value || 0,
    endMoment: momentSamples[momentSamples.length - 1]?.value || 0,
    axialSamples,
    shearSamples,
    momentSamples,
    shearLabels: uniqueDiagramLabels(shearSamples),
    momentLabels: uniqueDiagramLabels(momentSamples),
    endForces: {
      start: {n: localEndForces[0] / 1000, v: localEndForces[1] / 1000, m: localEndForces[2] / 1000000},
      end: {n: localEndForces[3] / 1000, v: localEndForces[4] / 1000, m: localEndForces[5] / 1000000}
    }
  };
}

function computeFrameSystemResults(model, options = {}) {
  const nodes = model.nodes || [];
  const members = model.members || [];
  const nodalForces = {};
  const issues = [];
  nodes.forEach(node => addNodalResult(nodalForces, node.id, 0, 0, 0));
  if (!nodes.length || !members.length) {
    return {supportReactions: [], nodalForces: Object.values(nodalForces), nodeDisplacements: [], memberResults: {}, stable: false, issues: ["Frame has no analyzable members."]};
  }

  const nodeIndex = new Map(nodes.map((node, index) => [String(node.id), index]));
  const nodeIndexFor = nodeId => nodeIndex.get(String(nodeId));
  const dofCount = nodes.length * 3;
  const K = Array.from({length: dofCount}, () => Array(dofCount).fill(0));
  const F = Array(dofCount).fill(0);
  const systems = new Map();

  const addGlobalLoad = (nodeId, fx = 0, fy = 0, mz = 0, record = true) => {
    const index = nodeIndexFor(nodeId);
    if (index === undefined) return;
    F[index * 3] += (Number(fx) || 0) * 1000;
    F[index * 3 + 1] += (Number(fy) || 0) * 1000;
    F[index * 3 + 2] += (Number(mz) || 0) * 1000000;
    if (record) addNodalResult(nodalForces, nodeId, fx, fy, mz);
  };

  for (const member of members) {
    const a = memberNode(model, member.i);
    const b = memberNode(model, member.j);
    if (!a || !b) {
      issues.push(`Member ${member.id} references a missing node.`);
      continue;
    }
    const rawLength = Math.hypot(b.x - a.x, b.y - a.y);
    if (rawLength < 1e-8) {
      issues.push(`Member ${member.id} has zero length.`);
      continue;
    }
    const ia = nodeIndexFor(a.id);
    const ib = nodeIndexFor(b.id);
    const lengthM = rawLength;
    const lengthMm = lengthM * 1000;
    const c = (b.x - a.x) / lengthM;
    const s = (b.y - a.y) / lengthM;
    const elasticModulus = Number(member.E) || 0;
    const area = Number(member.A) || 0;
    const grossInertia = Number(member.I) || 0;
    const modifier = Number(member.stiffnessModifier);
    const effectiveInertia = grossInertia * (Number.isFinite(modifier) && modifier > 0 ? modifier : 1);
    if (elasticModulus <= 0 || area <= 0 || effectiveInertia <= 0) {
      issues.push(`Member ${member.id} has invalid E, A, or I.`);
      continue;
    }
    const EA = elasticModulus * area;
    const EI = elasticModulus * effectiveInertia;
    const localStiffness = [
      [EA / lengthMm, 0, 0, -EA / lengthMm, 0, 0],
      [0, 12 * EI / lengthMm ** 3, 6 * EI / lengthMm ** 2, 0, -12 * EI / lengthMm ** 3, 6 * EI / lengthMm ** 2],
      [0, 6 * EI / lengthMm ** 2, 4 * EI / lengthMm, 0, -6 * EI / lengthMm ** 2, 2 * EI / lengthMm],
      [-EA / lengthMm, 0, 0, EA / lengthMm, 0, 0],
      [0, -12 * EI / lengthMm ** 3, -6 * EI / lengthMm ** 2, 0, 12 * EI / lengthMm ** 3, -6 * EI / lengthMm ** 2],
      [0, 6 * EI / lengthMm ** 2, 2 * EI / lengthMm, 0, -6 * EI / lengthMm ** 2, 4 * EI / lengthMm]
    ];
    const globalStiffness = transformFrameMatrix(localStiffness, c, s);
    const dofs = [ia * 3, ia * 3 + 1, ia * 3 + 2, ib * 3, ib * 3 + 1, ib * 3 + 2];
    for (let row = 0; row < 6; row += 1) {
      for (let column = 0; column < 6; column += 1) K[dofs[row]][dofs[column]] += globalStiffness[row][column];
    }
    const loadData = memberLoadData(model, member, c, s, lengthM, options);
    const equivalentGlobal = transformFrameVector(loadData.equivalentLocal, c, s);
    dofs.forEach((dof, index) => F[dof] += equivalentGlobal[index]);
    addNodalResult(nodalForces, member.i, equivalentGlobal[0] / 1000, equivalentGlobal[1] / 1000, equivalentGlobal[2] / 1000000);
    addNodalResult(nodalForces, member.j, equivalentGlobal[3] / 1000, equivalentGlobal[4] / 1000, equivalentGlobal[5] / 1000000);
    systems.set(String(member.id), {member, localStiffness, dofs, c, s, lengthM, loadData});
  }

  for (const load of model.loads || []) {
    if (load.kind !== "node") continue;
    const factor = loadCaseFactor(load.case, options);
    addGlobalLoad(load.node, (Number(load.fx) || 0) * factor, (Number(load.fy) || 0) * factor, (Number(load.mz) || 0) * factor);
  }

  const restrained = new Set();
  for (const [nodeId, support] of Object.entries(model.supports || {})) {
    const index = nodeIndexFor(nodeId);
    if (index === undefined) continue;
    for (const dof of supportRestrainedDofs(support)) {
      restrained.add(index * 3 + (dof === "x" ? 0 : dof === "y" ? 1 : 2));
    }
  }
  if (!restrained.size) issues.push("Frame has no restrained degrees of freedom.");

  const free = Array.from({length: dofCount}, (_, index) => index).filter(index => !restrained.has(index));
  const displacements = Array(dofCount).fill(0);
  let stable = issues.length === 0;
  if (free.length && restrained.size) {
    const reducedStiffness = free.map(row => free.map(column => K[row][column]));
    const reducedLoads = free.map(index => F[index]);
    const solved = solveLinearSystem(reducedStiffness, reducedLoads);
    if (!solved) {
      stable = false;
      issues.push("Stiffness matrix is singular or numerically ill-conditioned.");
    } else {
      free.forEach((dof, index) => displacements[dof] = solved[index]);
    }
  }

  const memberResults = {};
  if (stable) {
    systems.forEach((system, id) => {
      const globalDisplacement = system.dofs.map(dof => displacements[dof]);
      const localDisplacement = [
        system.c * globalDisplacement[0] + system.s * globalDisplacement[1],
        -system.s * globalDisplacement[0] + system.c * globalDisplacement[1],
        globalDisplacement[2],
        system.c * globalDisplacement[3] + system.s * globalDisplacement[4],
        -system.s * globalDisplacement[3] + system.c * globalDisplacement[4],
        globalDisplacement[5]
      ];
      const localEndForces = system.localStiffness.map((row, rowIndex) =>
        row.reduce((sum, value, columnIndex) => sum + value * localDisplacement[columnIndex], 0) - system.loadData.equivalentLocal[rowIndex]
      );
      memberResults[id] = recoveredMemberDiagram(model, system.member, system, localEndForces);
    });
  }

  const stiffnessTimesDisplacement = K.map(row => row.reduce((sum, value, index) => sum + value * displacements[index], 0));
  const rawReactions = stiffnessTimesDisplacement.map((value, index) => value - F[index]);
  const supported = nodes
    .filter(node => model.supports && model.supports[node.id])
    .sort((a, b) => (a.x - b.x) || (a.y - b.y));
  const supportReactions = supported.map((node, index) => {
    const nodeDof = nodeIndexFor(node.id) * 3;
    const restrainedDofs = supportRestrainedDofs(model.supports[node.id]);
    const rx = restrainedDofs.includes("x") ? rawReactions[nodeDof] / 1000 : 0;
    const ry = restrainedDofs.includes("y") ? rawReactions[nodeDof + 1] / 1000 : 0;
    const mz = restrainedDofs.includes("rz") ? rawReactions[nodeDof + 2] / 1000000 : 0;
    return {id: `R${index + 1}`, node: node.id, support: model.supports[node.id], rx, ry, mz, value: ry};
  });
  const nodeDisplacements = nodes.map(node => {
    const index = nodeIndexFor(node.id) * 3;
    return {
      node: node.id,
      dxMm: displacements[index],
      dyMm: displacements[index + 1],
      rzRad: displacements[index + 2],
      dxM: displacements[index] / 1000,
      dyM: displacements[index + 1] / 1000
    };
  });
  return {supportReactions, nodalForces: Object.values(nodalForces), nodeDisplacements, memberResults, stable, issues};
}

function runBasicFrameAnalysis(model, options = {}) {
  const loadCases = {};
  for (const load of model.loads || []) {
    if (!loadCases[load.case]) loadCases[load.case] = [];
    loadCases[load.case].push(load);
  }
  const frameResults = computeFrameSystemResults(model, options);
  const memberResults = frameResults.stable
    ? frameResults.memberResults
    : Object.fromEntries((model.members || []).map(member => [member.id, computedMemberDiagramValues(model, member)]));
  return {
    status: frameResults.stable ? "2D frame stiffness check complete" : "Frame appears unstable or under-restrained",
    nodes: (model.nodes || []).length,
    members: (model.members || []).length,
    supports: Object.keys(model.supports || {}).length,
    loads: (model.loads || []).length,
    loadCases,
    memberResults,
    supportReactions: frameResults.supportReactions,
    nodalForces: frameResults.nodalForces,
    nodeDisplacements: frameResults.nodeDisplacements,
    stable: frameResults.stable,
    issues: frameResults.issues
  };
}

function eccentricFootingPressure({
  width,
  length,
  thickness = 0,
  concreteDensity = 0,
  vertical = 0,
  momentX = 0,
  momentY = 0,
  shortTerm = false
} = {}) {
  const b = Math.max(0.001, Number(width) || 0);
  const l = Math.max(0.001, Number(length) || 0);
  const footingWeight = b * l * Math.max(0, Number(thickness) || 0) * Math.max(0, Number(concreteDensity) || 0);
  const serviceLoad = Math.max(0, Number(vertical) || 0) + footingWeight;
  const mx = Math.abs(Number(momentX) || 0);
  const my = Math.abs(Number(momentY) || 0);
  if (serviceLoad <= 1e-9) {
    const unloaded = mx <= 1e-9 && my <= 1e-9;
    return {
      serviceLoad,
      footingWeight,
      average: 0,
      maximum: unloaded ? 0 : Infinity,
      minimum: 0,
      eccentricityLength: unloaded ? 0 : Infinity,
      eccentricityWidth: unloaded ? 0 : Infinity,
      eccentricityRatio: unloaded ? 0 : Infinity,
      eccentricityLimit: shortTerm ? 1 / 3 : 1 / 6,
      eccentricityUtilization: unloaded ? 0 : Infinity,
      eccentricityPass: unloaded,
      fullContact: unloaded,
      contactMode: unloaded ? "FULL" : "UPLIFT LIMIT",
      effectiveWidth: unloaded ? b : 0,
      effectiveLength: unloaded ? l : 0,
      contactAreaRatio: unloaded ? 1 : 0
    };
  }

  const average = serviceLoad / (b * l);
  const eccentricityLength = mx / serviceLoad;
  const eccentricityWidth = my / serviceLoad;
  const eccentricityRatio = eccentricityLength / l + eccentricityWidth / b;
  const eccentricityLimit = shortTerm ? 1 / 3 : 1 / 6;
  const eccentricityUtilization = eccentricityRatio / eccentricityLimit;
  const fullContact = eccentricityRatio <= 1 / 6 + 1e-9;
  const eccentricityPass = eccentricityRatio <= eccentricityLimit + 1e-9;
  const linearMaximum = average * (1 + 6 * eccentricityRatio);
  const linearMinimum = average * (1 - 6 * eccentricityRatio);
  const effectiveWidth = Math.max(0, b - 2 * eccentricityWidth);
  const effectiveLength = Math.max(0, l - 2 * eccentricityLength);
  const effectiveArea = effectiveWidth * effectiveLength;

  // Supplied Foundation Engineering, Sec. 3.5: B/6 for full contact and
  // transient partial contact limited to B/3. The 4/3 effective-area term
  // reproduces one-way triangular pressure and screens preliminary biaxial contact.
  const partialMaximum = effectiveArea > 1e-9 ? 4 * serviceLoad / (3 * effectiveArea) : Infinity;
  const maximum = fullContact ? linearMaximum : Math.max(linearMaximum, partialMaximum);
  return {
    serviceLoad,
    footingWeight,
    average,
    maximum,
    minimum: fullContact ? Math.max(0, linearMinimum) : 0,
    eccentricityLength,
    eccentricityWidth,
    eccentricityRatio,
    eccentricityLimit,
    eccentricityUtilization,
    eccentricityPass,
    fullContact,
    contactMode: fullContact ? "FULL" : shortTerm && eccentricityPass ? "PARTIAL" : "UPLIFT LIMIT",
    effectiveWidth,
    effectiveLength,
    contactAreaRatio: effectiveArea / (b * l)
  };
}

function generatedFrameBeamRange(gridCount, columnIndices, isGround) {
  const count = Math.max(0, Math.floor(Number(gridCount) || 0));
  if (count < 2) return null;
  if (!isGround) return {startIndex: 0, endIndex: count - 1};
  const supported = Array.from(new Set((columnIndices || [])
    .map(value => Math.floor(Number(value)))
    .filter(value => value >= 0 && value < count)))
    .sort((a, b) => a - b);
  if (supported.length < 2) return null;
  const startIndex = Math.max(1, supported[0]);
  const endIndex = Math.min(count - 2, supported[supported.length - 1]);
  return startIndex < endIndex ? {startIndex, endIndex} : null;
}

function selectMonotonicColumnStack(candidateMatrix, maximumStoryReduction = 100) {
  if (!Array.isArray(candidateMatrix) || !candidateMatrix.length || candidateMatrix.some(story => !Array.isArray(story) || !story.length)) return null;
  const shapeFamily = candidate => {
    const width = Number(candidate.width) || 0;
    const height = Number(candidate.height) || 0;
    if (Math.abs(width - height) < 1e-9) return "square";
    return width > height ? "wide" : "deep";
  };
  const solve = enforceGradualReduction => {
    let states = candidateMatrix[0].map(candidate => ({
      cost: Number(candidate.cost) || 0,
      path: [candidate]
    }));
    for (let storyIndex = 1; storyIndex < candidateMatrix.length; storyIndex += 1) {
      const nextStates = [];
      candidateMatrix[storyIndex].forEach(upper => {
        let best = null;
        states.forEach(state => {
          const lower = state.path[state.path.length - 1];
          const widthReduction = Number(lower.width) - Number(upper.width);
          const heightReduction = Number(lower.height) - Number(upper.height);
          if (shapeFamily(lower) !== shapeFamily(upper) || widthReduction < 0 || heightReduction < 0) return;
          if (enforceGradualReduction && (widthReduction > maximumStoryReduction || heightReduction > maximumStoryReduction)) return;
          const cost = state.cost + (Number(upper.cost) || 0);
          if (!best || cost < best.cost - 1e-9) best = {cost, path: [...state.path, upper]};
        });
        if (best) nextStates.push(best);
      });
      states = nextStates;
      if (!states.length) return null;
    }
    return states.reduce((best, state) => !best || state.cost < best.cost - 1e-9 ? state : best, null)?.path || null;
  };
  return solve(true) || solve(false);
}
