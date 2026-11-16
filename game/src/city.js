// City layout: the road lattice, the routing graph, building generation
// and crosswalks. Intersections activate in a fixed order as waves grow,
// so the player's responsibility (and the road network) grows with them.

var NG_DIRECTIONS = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 }
};

var NG_OPPOSITE = { N: 'S', E: 'W', S: 'N', W: 'E' };

function buildCity(rng) {
  const hud = NG_CONFIG.hudHeight;
  // Intersections in activation order. The order matters: every prefix
  // of it must be a connected subgraph with at least two edge portals,
  // or no route (and no traffic) exists in the early waves. We start in
  // a corner (two direct portals) and grow along the grid.
  const intersections = [
    { id: 0, x: 300, y: 262 },
    { id: 1, x: 640, y: 262 },
    { id: 2, x: 300, y: 498 },
    { id: 3, x: 980, y: 262 },
    { id: 4, x: 640, y: 498 },
    { id: 5, x: 980, y: 498 }
  ];
  // Portals: where cars enter and leave at the map edges. Each portal's
  // neighbour is the nearest intersection on its road.
  const portals = [
    { id: 6,  x: 300,  y: hud,  dir: 'S', neighbour: 0 },
    { id: 7,  x: 640,  y: hud,  dir: 'S', neighbour: 1 },
    { id: 8,  x: 980,  y: hud,  dir: 'S', neighbour: 3 },
    { id: 9,  x: 300,  y: 720,  dir: 'N', neighbour: 2 },
    { id: 10, x: 640,  y: 720,  dir: 'N', neighbour: 4 },
    { id: 11, x: 980,  y: 720,  dir: 'N', neighbour: 5 },
    { id: 12, x: 0,    y: 262,  dir: 'E', neighbour: 0 },
    { id: 13, x: 0,    y: 498,  dir: 'E', neighbour: 2 },
    { id: 14, x: 1280, y: 262,  dir: 'W', neighbour: 3 },
    { id: 15, x: 1280, y: 498,  dir: 'W', neighbour: 5 }
  ];
  // Undirected adjacency: [a, b] pairs of node ids.
  const edges = [
    [6, 0], [0, 2], [2, 9],
    [7, 1], [1, 4], [4, 10],
    [8, 3], [3, 5], [5, 11],
    [12, 0], [0, 1], [1, 3], [3, 14],
    [13, 2], [2, 4], [4, 5], [5, 15]
  ];
  const nodes = [];
  intersections.forEach(function (n) { nodes[n.id] = { id: n.id, x: n.x, y: n.y, kind: 'cross' }; });
  portals.forEach(function (p) { nodes[p.id] = { id: p.id, x: p.x, y: p.y, kind: 'portal', dir: p.dir, neighbour: p.neighbour }; });

  const adjacency = {};
  edges.forEach(function (e) {
    (adjacency[e[0]] = adjacency[e[0]] || []).push(e[1]);
    (adjacency[e[1]] = adjacency[e[1]] || []).push(e[0]);
  });

  const city = {
    intersections: intersections,
    portals: portals,
    nodes: nodes,
    adjacency: adjacency,
    blocks: buildBlocks(rng),
    roundabouts: {}
  };
  return city;
}

function buildBlocks(rng) {
  const hw = NG_CONFIG.roadWidth / 2;
  const xs = [0, 300 - hw, 300 + hw, 640 - hw, 640 + hw, 980 - hw, 980 + hw, 1280];
  const ys = [NG_CONFIG.hudHeight, 262 - hw, 262 + hw, 498 - hw, 498 + hw, 720];
  const blocks = [];
  const neon = [NG_PALETTE.neonPink, NG_PALETTE.neonCyan, NG_PALETTE.neonAmber, NG_PALETTE.neonLime, NG_PALETTE.neonViolet];
  for (let bx = 0; bx < 4; bx++) {
    for (let by = 0; by < 3; by++) {
      const x0 = xs[bx * 2] + 4;
      const x1 = xs[bx * 2 + 1] - 4;
      const y0 = ys[by * 2] + 4;
      const y1 = ys[by * 2 + 1] - 4;
      const w = x1 - x0;
      const h = y1 - y0;
      const kind = rng.weighted([['buildings', 62], ['park', 20], ['plaza', 18]]);
      const block = { x: x0, y: y0, w: w, h: h, kind: kind, buildings: [], trees: [], sign: null };
      if (kind === 'buildings') {
        const cols = w > 200 ? 2 : 1;
        const rows = h > 150 ? 2 : 1;
        for (let cx = 0; cx < cols; cx++) {
          for (let cy = 0; cy < rows; cy++) {
            const bw = w / cols - 14;
            const bh = h / rows - 14;
            const bx0 = x0 + 7 + cx * (w / cols);
            const by0 = y0 + 7 + cy * (h / rows);
            const roof = rng.pick([NG_PALETTE.roofA, NG_PALETTE.roofB, NG_PALETTE.roofC]);
            const windows = [];
            const stepX = 16;
            const stepY = 15;
            for (let wx = bx0 + 8; wx < bx0 + bw - 6; wx += stepX) {
              for (let wy = by0 + 8; wy < by0 + bh - 6; wy += stepY) {
                windows.push({ x: wx, y: wy, lit: rng.chance(0.55) });
              }
            }
            block.buildings.push({
              x: bx0, y: by0, w: bw, h: bh, roof: roof, windows: windows,
              sign: rng.chance(0.4) ? rng.pick(neon) : null,
              signSide: rng.pick(['top', 'left'])
            });
          }
        }
      } else if (kind === 'park') {
        const n = Math.floor(rng.range(5, 9));
        for (let i = 0; i < n; i++) {
          block.trees.push({
            x: rng.range(x0 + 14, x1 - 14),
            y: rng.range(y0 + 14, y1 - 14),
            r: rng.range(7, 12),
            hue: rng.pick(['#1d5a3f', '#25704c', '#17452f'])
          });
        }
      } else {
        block.sign = { color: rng.pick(neon), x: x0 + w / 2, y: y0 + h / 2, r: Math.min(w, h) * 0.26 };
      }
      blocks.push(block);
    }
  }
  return blocks;
}

// Nodes usable with `activeCount` intersections switched on.
function activeNodeSet(city, activeCount) {
  const set = {};
  for (let i = 0; i < activeCount; i++) set[i] = true;
  city.portals.forEach(function (p) {
    if (p.neighbour < activeCount) set[p.id] = true;
  });
  return set;
}

function usablePortals(city, activeCount) {
  return city.portals.filter(function (p) { return p.neighbour < activeCount; });
}

// Breadth-first shortest route through the active graph.
function findRoute(city, activeCount, fromId, toId) {
  const active = activeNodeSet(city, activeCount);
  const prev = {};
  const queue = [fromId];
  prev[fromId] = -1;
  while (queue.length) {
    const cur = queue.shift();
    if (cur === toId) break;
    const nbrs = city.adjacency[cur] || [];
    for (let i = 0; i < nbrs.length; i++) {
      const n = nbrs[i];
      if (!active[n] || prev[n] !== undefined) continue;
      prev[n] = cur;
      queue.push(n);
    }
  }
  if (prev[toId] === undefined) return null;
  const route = [];
  let cur = toId;
  while (cur !== -1) { route.unshift(cur); cur = prev[cur]; }
  return route;
}

// Right-hand offset of a direction (screen coordinates, y down).
function rightOf(dir) {
  return { x: -dir.y, y: dir.x };
}

function compassOf(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'E' : 'W';
  return dy > 0 ? 'S' : 'N';
}

// Build a dense driving path (points ~3px apart) for a route.
// Legs run on the right-hand lane; turns round corners; roundabout
// nodes route around the circle. Also computes stop lines and yields.
function buildPath(city, route, roundabouts) {
  const lane = NG_CONFIG.laneOffset;
  const pts = [];
  const stops = [];
  const yields = [];

  function pushPoint(x, y) {
    const n = pts.length;
    if (n > 0) {
      const dx = x - pts[n - 1].x;
      const dy = y - pts[n - 1].y;
      if (dx * dx + dy * dy < 4) return;
    }
    pts.push({ x: x, y: y });
  }

  function pushLine(x0, y0, x1, y1) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / 3));
    for (let i = 1; i <= steps; i++) {
      pushPoint(x0 + (x1 - x0) * (i / steps), y0 + (y1 - y0) * (i / steps));
    }
  }

  function pushQuad(p0, c, p2) {
    const approx = Math.hypot(p2.x - p0.x, p2.y - p0.y) + Math.hypot(c.x - p0.x, c.y - p0.y);
    const steps = Math.max(4, Math.ceil(approx / 3));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      pushPoint(u * u * p0.x + 2 * u * t * c.x + t * t * p2.x,
        u * u * p0.y + 2 * u * t * c.y + t * t * p2.y);
    }
  }

  const nodes = city.nodes;
  // Legs between consecutive route nodes, lane-offset.
  const legs = [];
  for (let i = 0; i < route.length - 1; i++) {
    const a = nodes[route[i]];
    const b = nodes[route[i + 1]];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const dir = { x: dx / len, y: dy / len };
    const r = rightOf(dir);
    let ax = a.x + r.x * lane;
    let ay = a.y + r.y * lane;
    let bx = b.x + r.x * lane;
    let by = b.y + r.y * lane;
    if (a.kind === 'portal') {
      const out = NG_DIRECTIONS[NG_OPPOSITE[a.dir]];
      ax += out.x * 36;
      ay += out.y * 36;
    }
    if (b.kind === 'portal') {
      const out = NG_DIRECTIONS[NG_OPPOSITE[b.dir]];
      bx += out.x * 36;
      by += out.y * 36;
    }
    legs.push({ a: { x: ax, y: ay }, b: { x: bx, y: by }, dir: dir, right: r, from: route[i], to: route[i + 1] });
  }

  pushPoint(legs[0].a.x, legs[0].a.y);
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const node = nodes[leg.to];
    const isLast = i === legs.length - 1;
    if (node.kind === 'portal' || isLast) {
      pushLine(pts[pts.length - 1].x, pts[pts.length - 1].y, leg.b.x, leg.b.y);
      continue;
    }
    const next = legs[i + 1];
    if (roundabouts && roundabouts[node.id]) {
      // Roundabout: approach the yield point, merge onto the circle,
      // arc counter-clockwise, then leave onto the next leg.
      const R = 22;
      const entryDir = { x: -leg.dir.x, y: -leg.dir.y }; // from node toward entry arm
      const exitDir = next.dir; // from node toward exit arm
      const entryAng = Math.atan2(entryDir.y, entryDir.x);
      let exitAng = Math.atan2(exitDir.y, exitDir.x);
      // Counter-clockwise circulation = decreasing angle (y down).
      while (exitAng > entryAng - 0.01) exitAng -= Math.PI * 2;
      const approachEnd = {
        x: node.x + entryDir.x * (R + 16) + leg.right.x * lane,
        y: node.y + entryDir.y * (R + 16) + leg.right.y * lane
      };
      pushLine(pts[pts.length - 1].x, pts[pts.length - 1].y, approachEnd.x, approachEnd.y);
      yields.push({ node: node.id, x: approachEnd.x, y: approachEnd.y });
      const entryPt = { x: node.x + Math.cos(entryAng) * R, y: node.y + Math.sin(entryAng) * R };
      pushLine(approachEnd.x, approachEnd.y, entryPt.x, entryPt.y);
      const arcLen = Math.abs(entryAng - exitAng) * R;
      const steps = Math.max(6, Math.ceil(arcLen / 3));
      for (let s = 1; s <= steps; s++) {
        const a = entryAng + (exitAng - entryAng) * (s / steps);
        pushPoint(node.x + Math.cos(a) * R, node.y + Math.sin(a) * R);
      }
      // Leave the circle onto the next leg.
      const exitPt = { x: node.x + Math.cos(exitAng) * R, y: node.y + Math.sin(exitAng) * R };
      const rejoin = { x: node.x + exitDir.x * 46 + next.right.x * lane, y: node.y + exitDir.y * 46 + next.right.y * lane };
      pushLine(exitPt.x, exitPt.y, rejoin.x, rejoin.y);
      // Replace the next leg's start with the rejoin point.
      next.a = rejoin;
      continue;
    }
    // Normal intersection: straight through or a rounded corner.
    const sameDir = Math.abs(leg.dir.x - next.dir.x) < 0.01 && Math.abs(leg.dir.y - next.dir.y) < 0.01;
    if (sameDir) {
      pushLine(pts[pts.length - 1].x, pts[pts.length - 1].y, leg.b.x, leg.b.y);
    } else {
      // Corner point = intersection of the two offset lines.
      const c = {
        x: node.x + (leg.right.x + next.right.x) * lane,
        y: node.y + (leg.right.y + next.right.y) * lane
      };
      const p0 = { x: c.x - leg.dir.x * 18, y: c.y - leg.dir.y * 18 };
      const p2 = { x: c.x + next.dir.x * 18, y: c.y + next.dir.y * 18 };
      pushLine(pts[pts.length - 1].x, pts[pts.length - 1].y, p0.x, p0.y);
      pushQuad(p0, c, p2);
      next.a = p2;
    }
    // Stop line for this node: record the approach and the node id;
    // the arc position is resolved after the full path is built.
    stops.push({ node: node.id, approach: NG_OPPOSITE[compassOf(leg.dir.x, leg.dir.y)] });
  }

  // Cumulative distances.
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const length = cum[cum.length - 1];

  // Resolve stop-line distances: nearest path point to the node centre,
  // pulled back past the crosswalk so queues never block pedestrians.
  const stopOffset = NG_CONFIG.roadWidth / 2 + 20;
  stops.forEach(function (st) {
    const node = nodes[st.node];
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = (pts[i].x - node.x) * (pts[i].x - node.x) + (pts[i].y - node.y) * (pts[i].y - node.y);
      if (d < bestD) { bestD = d; best = i; }
    }
    st.s = Math.max(0, cum[best] - stopOffset);
    st.x = pts[best].x;
    st.y = pts[best].y;
  });
  yields.forEach(function (yl) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = (pts[i].x - yl.x) * (pts[i].x - yl.x) + (pts[i].y - yl.y) * (pts[i].y - yl.y);
      if (d < bestD) { bestD = d; best = i; }
    }
    yl.s = cum[best];
  });

  return { pts: pts, cum: cum, length: length, stops: stops, yields: yields, route: route };
}

function pathPointAt(path, s) {
  const cum = path.cum;
  const pts = path.pts;
  if (s <= 0) return { x: pts[0].x, y: pts[0].y, angle: Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) };
  if (s >= path.length) {
    const n = pts.length;
    return { x: pts[n - 1].x, y: pts[n - 1].y, angle: Math.atan2(pts[n - 1].y - pts[n - 2].y, pts[n - 1].x - pts[n - 2].x) };
  }
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s) lo = mid; else hi = mid;
  }
  const t = (s - cum[lo]) / Math.max(0.001, cum[hi] - cum[lo]);
  const x = pts[lo].x + (pts[hi].x - pts[lo].x) * t;
  const y = pts[lo].y + (pts[hi].y - pts[lo].y) * t;
  return { x: x, y: y, angle: Math.atan2(pts[hi].y - pts[lo].y, pts[hi].x - pts[lo].x) };
}

// Index of the dense path point at or just before distance s.
function pathIndexAt(path, s) {
  const cum = path.cum;
  if (s <= 0) return 0;
  if (s >= path.length) return cum.length - 1;
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s) lo = mid; else hi = mid;
  }
  return lo;
}

// Crosswalk rectangles for one intersection (one per arm).
function crosswalksOf(node) {
  const hw = NG_CONFIG.roadWidth / 2;
  const off = hw + 9;
  const w = NG_CONFIG.roadWidth - 8;
  const d = 11;
  return [
    { arm: 'N', x: node.x - w / 2, y: node.y - off - d / 2, w: w, h: d, horizontal: true },
    { arm: 'S', x: node.x - w / 2, y: node.y + off - d / 2, w: w, h: d, horizontal: true },
    { arm: 'W', x: node.x - off - d / 2, y: node.y - w / 2, w: d, h: w, horizontal: false },
    { arm: 'E', x: node.x + off - d / 2, y: node.y - w / 2, w: d, h: w, horizontal: false }
  ];
}
