// Vehicles: driving along precomputed paths, obeying lights, following
// the car ahead, stopping for pedestrians, and (rarely) running reds.
// Emergency vehicles carry a patience timer the player must protect.

let NG_VEHICLE_ID = 1;

function makeVehicle(type, path, rng, mods) {
  const arch = NG_VEHICLES[type];
  const v = {
    id: NG_VEHICLE_ID++,
    type: type,
    arch: arch,
    color: rng.pick(arch.colors),
    path: path,
    s: 0,
    speed: 0,
    cruise: arch.speed * rng.range(0.92, 1.08),
    x: 0, y: 0, angle: 0,
    state: 'driving',
    wreckTimer: 0,
    reckless: (type === 'car' || type === 'taxi') && rng.chance(0.09),
    redDecisions: {},
    emergency: !!arch.emergency,
    patience: 0,
    patienceMax: 1,
    stoppedTime: 0,
    honkTimer: rng.range(2, 6),
    turnSignal: 0,
    signalTimer: 0,
    brake: false,
    nearMissTimer: 0,
    runningRed: false,
    runFlash: 0,
    exited: false
  };
  if (v.emergency) {
    v.patienceMax = 30 * (mods.siren ? 1.6 : 1);
    v.patience = v.patienceMax;
  }
  const p = pathPointAt(path, 0);
  v.x = p.x; v.y = p.y; v.angle = p.angle;
  return v;
}

// Next stop line ahead of the car (within lookahead), if any.
function nextStopOf(car) {
  const stops = car.path.stops;
  for (let i = 0; i < stops.length; i++) {
    if (stops[i].s > car.s - 2) return stops[i];
  }
  return null;
}

function nextYieldOf(car) {
  const yields = car.path.yields;
  for (let i = 0; i < yields.length; i++) {
    if (yields[i].s > car.s - 2) return yields[i];
  }
  return null;
}

// Turn direction at the next node: -1 left, 0 straight, 1 right.
function turnAtNextNode(car, city) {
  const route = car.path.route;
  // Find which route node we are approaching: the next stop/yield node.
  const st = nextStopOf(car);
  const yl = nextYieldOf(car);
  let nodeId = -1;
  let nodeS = Infinity;
  if (st && st.s < nodeS) { nodeId = st.node; nodeS = st.s; }
  if (yl && yl.s < nodeS) { nodeId = yl.node; nodeS = yl.s; }
  if (nodeId < 0) return 0;
  const idx = route.indexOf(nodeId);
  if (idx <= 0 || idx >= route.length - 1) return 0;
  const a = city.nodes[route[idx - 1]];
  const b = city.nodes[nodeId];
  const c = city.nodes[route[idx + 1]];
  const d1x = b.x - a.x, d1y = b.y - a.y;
  const d2x = c.x - b.x, d2y = c.y - b.y;
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1) return 0;
  return cross > 0 ? 1 : -1; // y-down: positive cross = right turn
}

function updateVehicle(car, dt, world) {
  if (car.state === 'wrecked') {
    car.wreckTimer -= dt;
    car.speed = 0;
    return;
  }
  const mods = world.mods;
  const rain = world.weather.rain > 0;
  let cruise = car.cruise;
  if (mods.asphalt) cruise *= 1.10;
  if (car.type === 'bus' && mods.buslane) cruise *= 1.25;
  if (rain) cruise *= 0.94;
  if (car.emergency) cruise *= 1.05;

  const accel = 150;
  const decel = rain && !mods.tires ? 175 : 270;

  // --- constraint 1: traffic light at the next stop line
  let limitSpeed = cruise;
  let mustStopAt = Infinity;
  const st = nextStopOf(car);
  if (st) {
    const dist = st.s - car.s;
    const lights = world.lights[st.node];
    if (lights && !lights.roundabout && dist < 150 && dist > 2) {
      const state = lightStateAt(lights, st.approach);
      const key = st.node + ':' + st.approach;
      if (car.redDecisions[key] === undefined) {
        car.redDecisions[key] = car.reckless && world.rng.chance(0.35);
      }
      const willRun = car.redDecisions[key];
      if (state === 'red' && !willRun) {
        mustStopAt = st.s - NG_CONFIG.stopGap;
      } else if (state === 'red' && willRun) {
        car.runningRed = true;
        car.runFlash = 0.8;
      } else if (state === 'amber') {
        // Stop if comfortably possible, else clear the box.
        const brakeDist = (car.speed * car.speed) / (2 * decel) + 6;
        if (dist > brakeDist + 4 && !willRun) mustStopAt = st.s - NG_CONFIG.stopGap;
      }
    }
  }

  // --- constraint 2: roundabout yield
  const yl = nextYieldOf(car);
  if (yl) {
    const dist = yl.s - car.s;
    if (dist < 70 && dist > 2) {
      const node = world.city.nodes[yl.node];
      let blocked = false;
      for (let i = 0; i < world.cars.length; i++) {
        const other = world.cars[i];
        if (other === car || other.state !== 'driving') continue;
        const dx = other.x - node.x;
        const dy = other.y - node.y;
        if (dx * dx + dy * dy < 34 * 34) { blocked = true; break; }
      }
      if (blocked) mustStopAt = Math.min(mustStopAt, yl.s - NG_CONFIG.stopGap);
    }
  }

  // --- constraint 3: the car ahead (same lane, same direction)
  let leader = null;
  let leaderGap = Infinity;
  const hx = Math.cos(car.angle);
  const hy = Math.sin(car.angle);
  for (let i = 0; i < world.cars.length; i++) {
    const other = world.cars[i];
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * hx + dy * hy;
    if (ahead <= 0) continue;
    const lateral = Math.abs(dx * hy - dy * hx);
    if (lateral > 13) continue;
    const gap = ahead - other.arch.len / 2 - car.arch.len / 2;
    if (gap < leaderGap) { leaderGap = gap; leader = other; }
  }
  if (leader && leaderGap < 46) {
    if (leaderGap <= 11) {
      limitSpeed = 0;
    } else {
      limitSpeed = Math.min(limitSpeed, leader.speed * Math.min(1, leaderGap / 30) + 12);
    }
  }

  // --- constraint 4: pedestrians in a crosswalk ahead
  for (let i = 0; i < world.peds.length; i++) {
    const ped = world.peds[i];
    if (!ped.crossing) continue;
    const dx = ped.x - car.x;
    const dy = ped.y - car.y;
    const ahead = dx * hx + dy * hy;
    if (ahead < 0 || ahead > 52) continue;
    const lateral = Math.abs(dx * hy - dy * hx);
    if (lateral > 14) continue;
    if (ahead <= 26) { limitSpeed = 0; }
    else { limitSpeed = Math.min(limitSpeed, 18); }
    break;
  }

  // --- apply stop-line constraint
  if (mustStopAt < Infinity) {
    const dist = mustStopAt - car.s;
    if (dist <= 0.5) {
      limitSpeed = 0;
    } else {
      const allowed = Math.sqrt(2 * decel * Math.max(0, dist));
      limitSpeed = Math.min(limitSpeed, allowed);
    }
  }

  // --- integrate speed
  if (limitSpeed > car.speed) {
    car.speed = Math.min(limitSpeed, car.speed + accel * dt);
  } else {
    car.speed = Math.max(limitSpeed, car.speed - decel * dt);
  }
  car.brake = limitSpeed < car.speed + 1 && car.speed > 8;
  if (car.speed < 0.5) car.speed = 0;

  car.s += car.speed * dt;
  const p = pathPointAt(car.path, car.s);
  car.x = p.x; car.y = p.y; car.angle = p.angle;

  if (car.runFlash > 0) car.runFlash -= dt;
  if (car.nearMissTimer > 0) car.nearMissTimer -= dt;

  // Stopped-time tracking (queues, honking).
  if (car.speed < 2) {
    car.stoppedTime += dt;
    car.honkTimer -= dt;
    if (car.honkTimer <= 0) {
      car.honkTimer = 4 + world.rng.range(0, 5);
      if (world.rng.chance(0.5)) world.events.push({ type: 'honk', x: car.x, y: car.y });
    }
  } else {
    car.stoppedTime = 0;
  }

  // Turn signal near the next node.
  const turn = turnAtNextNode(car, world.city);
  const nearNode = (st && st.s - car.s < 80) || (yl && yl.s - car.s < 80);
  car.turnSignal = nearNode ? turn : 0;
  car.signalTimer += dt;

  // Emergency patience drains only while actually playing.
  if (car.emergency && world.phase === 'playing') {
    if (car.speed < 22) car.patience -= dt;
    if (car.patience <= 0) {
      world.events.push({ type: 'emergencyExpired', car: car });
    }
  }

  // Exited the map?
  if (car.s >= car.path.length - 1) {
    car.exited = true;
    world.events.push({ type: 'carExited', car: car });
  }
}

function wreckCar(car, clearSec) {
  car.state = 'wrecked';
  car.speed = 0;
  car.wreckTimer = clearSec;
  car.turnSignal = 0;
}
