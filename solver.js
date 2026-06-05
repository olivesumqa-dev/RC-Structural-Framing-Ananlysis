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
  const concreteUnitWeight = 24;
  return areaMm2 * concreteUnitWeight / 1000000;
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
    .map(load => Math.abs(Number(load.w) || 0));
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

function computeFrameSystemResults(model, memberResults) {
  const nodes = model.nodes || [];
  const members = model.members || [];
  const nodalForces = {};
  nodes.forEach(node => addNodalResult(nodalForces, node.id, 0, 0, 0));
  if (!nodes.length || !members.length) return {supportReactions: [], nodalForces: Object.values(nodalForces), stable: false};

  const nodeIndex = new Map(nodes.map((node, index) => [node.id, index]));
  const nodeIndexFor = nodeId => {
    if (nodeIndex.has(nodeId)) return nodeIndex.get(nodeId);
    const numericId = Number(nodeId);
    if (!Number.isNaN(numericId) && nodeIndex.has(numericId)) return nodeIndex.get(numericId);
    const stringId = String(nodeId);
    if (nodeIndex.has(stringId)) return nodeIndex.get(stringId);
    return undefined;
  };

  const dofCount = nodes.length * 3;
  const K = Array.from({length: dofCount}, () => Array(dofCount).fill(0));
  const F = Array(dofCount).fill(0);

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
    if (!a || !b) continue;
    const ia = nodeIndexFor(a.id);
    const ib = nodeIndexFor(b.id);
    if (ia === undefined || ib === undefined) continue;

    const Lm = memberLength(model, member);
    const L = Lm * 1000;
    const c = (b.x - a.x) / Lm;
    const s = (b.y - a.y) / Lm;
    const E = Number(member.E) || 200000;
    const A = Math.max(1, Number(member.A) || 1);
    const I = Math.max(1, Number(member.I) || 1);
    const EA = E * A;
    const EI = E * I;
    const kLocal = [
      [EA / L, 0, 0, -EA / L, 0, 0],
      [0, 12 * EI / L**3, 6 * EI / L**2, 0, -12 * EI / L**3, 6 * EI / L**2],
      [0, 6 * EI / L**2, 4 * EI / L, 0, -6 * EI / L**2, 2 * EI / L],
      [-EA / L, 0, 0, EA / L, 0, 0],
      [0, -12 * EI / L**3, -6 * EI / L**2, 0, 12 * EI / L**3, -6 * EI / L**2],
      [0, 6 * EI / L**2, 2 * EI / L, 0, -6 * EI / L**2, 4 * EI / L]
    ];
    const kGlobal = transformFrameMatrix(kLocal, c, s);
    const dofs = [ia * 3, ia * 3 + 1, ia * 3 + 2, ib * 3, ib * 3 + 1, ib * 3 + 2];
    for (let r = 0; r < 6; r++) {
      for (let col = 0; col < 6; col++) K[dofs[r]][dofs[col]] += kGlobal[r][col];
    }

    const memberLoads = (model.loads || []).filter(load => sameModelId(load.member, member.id));
    let totalUdl = memberSelfWeightValue(member);
    for (const load of memberLoads) {
      if (load.kind === "member_udl") totalUdl += Math.abs(Number(load.w) || 0);
    }
    if (totalUdl > 0) {
      const qxKnM = -totalUdl * s;
      const qyKnM = -totalUdl * c;
      const equivLocal = [
        qxKnM * Lm / 2 * 1000,
        qyKnM * Lm / 2 * 1000,
        qyKnM * Lm * Lm / 12 * 1000000,
        qxKnM * Lm / 2 * 1000,
        qyKnM * Lm / 2 * 1000,
        -qyKnM * Lm * Lm / 12 * 1000000
      ];
      const equivGlobal = transformFrameVector(equivLocal, c, s);
      dofs.forEach((dof, index) => F[dof] += equivGlobal[index]);
      addNodalResult(nodalForces, member.i, equivGlobal[0] / 1000, equivGlobal[1] / 1000, equivGlobal[2] / 1000000);
      addNodalResult(nodalForces, member.j, equivGlobal[3] / 1000, equivGlobal[4] / 1000, equivGlobal[5] / 1000000);
    }

    for (const load of memberLoads) {
      if (load.kind !== "member_point") continue;
      const P = Math.abs(Number(load.p) || 0);
      if (!P) continue;
      const x = Math.max(0, Math.min(Lm, Number(load.x) || Lm / 2));
      const left = Lm > 1e-9 ? (Lm - x) / Lm : 0.5;
      const right = 1 - left;
      addGlobalLoad(member.i, 0, -P * left, 0);
      addGlobalLoad(member.j, 0, -P * right, 0);
    }
  }

  for (const load of model.loads || []) {
    if (load.kind === "node") addGlobalLoad(load.node, load.fx, load.fy, load.mz);
  }

  const restrained = new Set();
  for (const nodeId in model.supports || {}) {
    const index = nodeIndexFor(nodeId);
    if (index === undefined) continue;
    for (const dof of supportRestrainedDofs(model.supports[nodeId])) {
      restrained.add(index * 3 + (dof === "x" ? 0 : dof === "y" ? 1 : 2));
    }
  }

  const free = Array.from({length: dofCount}, (_, i) => i).filter(i => !restrained.has(i));
  const U = Array(dofCount).fill(0);
  let stable = true;
  if (free.length) {
    const Kff = free.map(r => free.map(c => K[r][c]));
    const Ff = free.map(i => F[i]);
    const uf = solveLinearSystem(Kff, Ff);
    if (!uf) stable = false;
    else free.forEach((dof, index) => U[dof] = uf[index]);
  }

  const KU = K.map(row => row.reduce((sum, value, index) => sum + value * U[index], 0));
  const rawReactions = KU.map((value, index) => value - F[index]);
  const supported = nodes
    .filter(node => model.supports && model.supports[node.id])
    .sort((a, b) => (a.x - b.x) || (a.y - b.y));

  const supportReactions = supported.map((node, index) => {
    const nodeDof = nodeIndexFor(node.id) * 3;
    const restrainedDofs = supportRestrainedDofs(model.supports[node.id]);
    const rx = restrainedDofs.includes("x") ? rawReactions[nodeDof] / 1000 : 0;
    const ry = restrainedDofs.includes("y") ? rawReactions[nodeDof + 1] / 1000 : 0;
    const mz = restrainedDofs.includes("rz") ? rawReactions[nodeDof + 2] / 1000000 : 0;
    return {
      id: `R${index + 1}`,
      node: node.id,
      support: model.supports[node.id],
      rx,
      ry,
      mz,
      value: ry
    };
  });

  return {supportReactions, nodalForces: Object.values(nodalForces), stable};
}

function runBasicFrameAnalysis(model) {
  const loadCases = {};
  for (const load of model.loads) {
    if (!loadCases[load.case]) loadCases[load.case] = [];
    loadCases[load.case].push(load);
  }
  const memberResults = {};
  for (const member of model.members || []) {
    memberResults[member.id] = computedMemberDiagramValues(model, member);
  }
  const frameResults = computeFrameSystemResults(model, memberResults);
  return {
    status: frameResults.stable ? "2D frame stiffness check complete" : "Frame appears unstable or under-restrained",
    nodes: model.nodes.length,
    members: model.members.length,
    supports: Object.keys(model.supports).length,
    loads: model.loads.length,
    loadCases,
    memberResults,
    supportReactions: frameResults.supportReactions,
    nodalForces: frameResults.nodalForces,
    stable: frameResults.stable
  };
}
