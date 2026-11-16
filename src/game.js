// Core game: world state, the fixed-step update, collisions, scoring,
// the jam meter, the autoplay policy (attract mode + verification sweeps)
// and the probe API the screenshots and sweeps drive.

function loadBestScore() {
  try {
    return parseInt(window.localStorage.getItem('neon-gridlock-best') || '0', 10) || 0;
  } catch (e) {
    return 0;
  }
}

function saveBestScore(score) {
  try {
    window.localStorage.setItem('neon-gridlock-best', String(score));
  } catch (e) { /* storage unavailable */ }
}

function freshMods() {
  return {
    quick: false, sensors: false, buslane: false, tires: false,
    tow: false, siren: false, asphalt: false, bridges: {}
  };
}

function createWorld(seed) {
  const streams = makeGameStreams(seed);
  const city = buildCity(streams.world);
  const lights = [];
  for (let i = 0; i < 6; i++) {
    const l = makeIntersectionLights(i, true);
    lightSet(l, 'N', 'green');
    lightSet(l, 'S', 'green');
    lightSet(l, 'E', 'red');
    lightSet(l, 'W', 'red');
    l.autoTimer = i * 0.8;
    lights.push(l);
  }
  const world = {
    seed: seed,
    rng: streams.traffic,
    streams: streams,
    city: city,
    lights: lights,
    roundabouts: {},
    mods: freshMods(),
    cars: [],
    peds: [],
    particles: makeParticles(),
    director: makeDirector(),
    weather: { rain: 0, fog: 0, darkness: 0.1 },
    phase: 'menu',
    attract: true,
    score: 0,
    combo: 1,
    comboPulse: 0,
    lives: NG_CONFIG.startLives,
    throughput: 0,
    crashes: 0,
    nearMisses: 0,
    emergenciesSaved: 0,
    lifeLosses: { crash: 0, emergency: 0, jam: 0, ped: 0 },
    jam: 0,
    selected: 0,
    speed: 1,
    time: 0,
    mouse: { x: -100, y: -100 },
    ui: { buttons: [] },
    banner: null,
    events: [],
    queues: {},
    hint: null,
    hintTimer: 0,
    autoplay: false,
    autoplayTimer: 0,
    lastFlip: [0, 0, 0, 0, 0, 0],
    pendingFlip: [null, null, null, null, null, null],
    lastHonk: 0,
    sprites: makeSprites(),
    staticLayer: null,
    staticDirty: true,
    bestScore: loadBestScore(),
    endStats: null,
    upgradesTaken: [],
    shotReady: false,
    sceneName: ''
  };
  initWeather(world.particles, streams.effects, NG_CONFIG.canvasWidth, NG_CONFIG.canvasHeight);
  return world;
}

function resetRun(world, seed) {
  const fresh = createWorld(seed);
  // Keep rendering artefacts and the best score.
  fresh.sprites = world.sprites;
  fresh.bestScore = world.bestScore;
  fresh.staticLayer = null;
  fresh.staticDirty = true;
  for (const key in fresh) world[key] = fresh[key];
  world.attract = false;
  world.phase = 'playing';
  startWave(world, 0);
}

function startRun(world) {
  NG_Audio.unlock();
  NG_Audio.click();
  resetRun(world, world.seed);
}

function restartRun(world) {
  NG_Audio.unlock();
  const seed = (Math.random() * 2000000000) >>> 0;
  resetRun(world, seed);
}

// ---- consequences -------------------------------------------------------

function loseLife(world, reason, x, y) {
  if (world.attract) return;
  world.lives -= 1;
  if (reason.indexOf('CRASH') === 0) world.lifeLosses.crash++;
  else if (reason.indexOf('EMERGENCY') === 0) world.lifeLosses.emergency++;
  else if (reason.indexOf('GRIDLOCK') === 0) world.lifeLosses.jam++;
  else world.lifeLosses.ped++;
  world.combo = 1;
  addPopup(world.particles, x, y, reason, '#ff4d6d', true);
  addShake(world.particles, 9);
  NG_Audio.lifeLost();
  if (world.lives <= 0) {
    endRun(world, false);
  }
}

function endRun(world, victory) {
  world.endStats = {
    score: world.score,
    throughput: world.throughput,
    crashes: world.crashes,
    nearMisses: world.nearMisses,
    emergencies: world.emergenciesSaved
  };
  if (world.score > world.bestScore) {
    world.bestScore = world.score;
    saveBestScore(world.score);
  }
  world.phase = victory ? 'victory' : 'gameover';
  NG_Audio.siren(false);
  if (!victory) NG_Audio.gameOver();
}

function awardExit(world, car) {
  let points = car.arch.score;
  if (car.type === 'bus' && world.mods.buslane) points *= 2;
  if (car.emergency) {
    points = Math.round(points * (world.mods.siren ? 1.5 : 1));
    world.emergenciesSaved++;
    addPopup(world.particles, car.x, car.y, 'EMERGENCY +' + Math.round(points * world.combo), '#7dff6a', true);
    NG_Audio.combo(3);
  }
  const gained = Math.round(points * world.combo);
  world.score += gained;
  world.throughput++;
  world.combo = Math.min(NG_CONFIG.comboMax, world.combo + NG_CONFIG.comboPerExit);
  world.comboPulse = 0.5;
  if (!car.emergency && world.rng.chance(0.25)) {
    addPopup(world.particles, car.x, car.y, '+' + gained, '#c9c9e0', false);
  }
}

// ---- collisions ---------------------------------------------------------

// Oriented bounding-box overlap (separating axis test) between two cars.
// A circular distance check falsely fires for cars on adjacent or
// converging paths that pass within 19px without touching; rectangles
// only overlap on a genuine crossing contact.
function carRectsOverlap(a, b) {
  const aHL = a.arch.len * 0.45, aHW = a.arch.wid * 0.45;
  const bHL = b.arch.len * 0.45, bHW = b.arch.wid * 0.45;
  const ax = Math.cos(a.angle), ay = Math.sin(a.angle);
  const bx = Math.cos(b.angle), by = Math.sin(b.angle);
  const dx = b.x - a.x, dy = b.y - a.y;
  const axes = [[ax, ay], [-ay, ax], [bx, by], [-by, bx]];
  for (let i = 0; i < 4; i++) {
    const ux = axes[i][0], uy = axes[i][1];
    const ra = aHL * Math.abs(ax * ux + ay * uy) + aHW * Math.abs(-ay * ux + ax * uy);
    const rb = bHL * Math.abs(bx * ux + by * uy) + bHW * Math.abs(-by * ux + bx * uy);
    if (Math.abs(dx * ux + dy * uy) > ra + rb) return false;
  }
  return true;
}

function detectCollisions(world) {
  const cars = world.cars;
  // Car vs car inside intersection boxes.
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    if (a.state !== 'driving') continue;
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      if (b.state !== 'driving') continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 40 * 40) continue;
      // Both inside the same non-roundabout intersection box?
      let sharedNode = -1;
      for (let n = 0; n < 6; n++) {
        if (world.roundabouts[n]) continue;
        const node = world.city.intersections[n];
        const adx = a.x - node.x, ady = a.y - node.y;
        const bdx = b.x - node.x, bdy = b.y - node.y;
        if (adx * adx + ady * ady < 36 * 36 && bdx * bdx + bdy * bdy < 36 * 36) { sharedNode = n; break; }
      }
      if (sharedNode < 0) continue;
      const dist = Math.sqrt(d2);
      let angleDiff = Math.abs(a.angle - b.angle) % (Math.PI * 2);
      if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
      if (angleDiff > 0.5 && carRectsOverlap(a, b)) {
        crashCars(world, a, b);
        return; // re-scan next tick; the pair is wrecked now
      }
      if (dist >= 19 && dist < 30 && angleDiff > 0.6 && a.speed > 28 && b.speed > 28 &&
          a.nearMissTimer <= 0 && b.nearMissTimer <= 0) {
        a.nearMissTimer = 3;
        b.nearMissTimer = 3;
        world.nearMisses++;
        if (!world.attract) {
          const bonus = 30;
          world.score += Math.round(bonus * world.combo);
          addPopup(world.particles, (a.x + b.x) / 2, (a.y + b.y) / 2 - 14, 'NEAR MISS +' + Math.round(bonus * world.combo), '#ffd166', true);
          NG_Audio.nearMiss();
        }
      }
    }
  }
  // Car vs pedestrian: only a fast car that could not stop.
  for (let i = 0; i < cars.length; i++) {
    const car = cars[i];
    if (car.state !== 'driving' || car.speed < 20) continue;
    for (let j = 0; j < world.peds.length; j++) {
      const ped = world.peds[j];
      if (!ped.crossing) continue;
      const dx = ped.x - car.x;
      const dy = ped.y - car.y;
      if (dx * dx + dy * dy < 11 * 11) {
        world.peds.splice(j, 1);
        crashBurst(world.particles, ped.x, ped.y);
        loseLife(world, 'PEDESTRIAN HIT!', ped.x, ped.y - 10);
        return;
      }
    }
  }
}

function crashCars(world, a, b) {
  const clearSec = world.mods.tow ? 2 : NG_CONFIG.wreckClearSec;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  wreckCar(a, clearSec);
  wreckCar(b, clearSec);
  world.crashes++;
  crashBurst(world.particles, mx, my);
  addShake(world.particles, 11);
  NG_Audio.crash();
  if (!world.attract) {
    loseLife(world, 'CRASH!', mx, my - 16);
  }
}

// ---- queues, jam, hints ---------------------------------------------------

function computeQueues(world) {
  const queues = {};
  for (let n = 0; n < 6; n++) queues[n] = { N: 0, E: 0, S: 0, W: 0 };
  world.cars.forEach(function (car) {
    if (car.state !== 'driving' || car.speed > 2) return;
    const st = nextStopOf(car);
    if (!st) return;
    if (st.s - car.s < 110) queues[st.node][st.approach]++;
  });
  world.queues = queues;
  return queues;
}

function updateJam(world, dt) {
  let worst = 0;
  let worstNode = -1;
  for (let n = 0; n < 6; n++) {
    const q = world.queues[n];
    for (const ap in q) {
      if (q[ap] > worst) { worst = q[ap]; worstNode = n; }
    }
  }
  if (worst >= NG_CONFIG.jamCapacity) {
    world.jam += NG_CONFIG.jamFillPerSec * (worst - NG_CONFIG.jamCapacity + 1) * dt;
  } else {
    world.jam = Math.max(0, world.jam - NG_CONFIG.jamDrainPerSec * dt);
  }
  if (world.jam >= 1) {
    world.jam = 0.35;
    // Traffic control tows the worst queue away.
    let removed = 0;
    for (let i = world.cars.length - 1; i >= 0 && removed < 3; i--) {
      const car = world.cars[i];
      if (car.state !== 'driving' || car.speed > 2) continue;
      const st = nextStopOf(car);
      if (st && st.node === worstNode) {
        smokePuff(world.particles, car.x, car.y);
        world.cars.splice(i, 1);
        removed++;
      }
    }
    const node = world.city.intersections[Math.max(0, worstNode)];
    loseLife(world, 'GRIDLOCK JAM!', node.x, node.y - 52);
  }
}

function updateHint(world, dt) {
  world.hintTimer -= dt;
  if (world.hintTimer > 0) return;
  world.hintTimer = 0.5;
  world.hint = null;
  if (!world.mods.sensors) return;
  let best = 2;
  for (let n = 0; n < world.director.activeCount; n++) {
    const lights = world.lights[n];
    if (lights.auto || lights.roundabout) continue;
    for (const ap in world.queues[n]) {
      if (lightStateAt(lights, ap) === 'red' && world.queues[n][ap] > best) {
        best = world.queues[n][ap];
        world.hint = { node: n, approach: ap };
      }
    }
  }
}

// ---- autoplay policy ------------------------------------------------------

function autoplayStep(world) {
  const d = world.director;
  for (let n = 0; n < d.activeCount; n++) {
    const lights = world.lights[n];
    if (lights.auto || lights.roundabout) continue;
    const q = world.queues[n] || { N: 0, E: 0, S: 0, W: 0 };
    const nsQueue = q.N + q.S;
    const ewQueue = q.E + q.W;
    // Emergency priority: green the axis an emergency vehicle waits on.
    let forceAxis = null;
    for (let i = 0; i < world.cars.length; i++) {
      const car = world.cars[i];
      if (!car.emergency || car.state !== 'driving' || car.speed > 2) continue;
      const st = nextStopOf(car);
      if (st && st.node === n && st.s - car.s < 110) {
        forceAxis = (st.approach === 'N' || st.approach === 'S') ? 'ns' : 'ew';
        break;
      }
    }
    const wantNs = forceAxis ? forceAxis === 'ns' : nsQueue >= ewQueue;
    const wantAxis = wantNs ? 'ns' : 'ew';
    const nsGreen = lightStateAt(lights, 'N') === 'green' || lightStateAt(lights, 'S') === 'green';
    const ewGreen = lightStateAt(lights, 'E') === 'green' || lightStateAt(lights, 'W') === 'green';
    const currentAxis = nsGreen ? 'ns' : (ewGreen ? 'ew' : null);

    // Finish a pending flip once the old axis is fully red AND the box
    // is empty: a long vehicle that entered on amber needs more than
    // the amber second to clear, and greening the cross axis early
    // invites a collision with it.
    const pending = world.pendingFlip[n];
    if (pending) {
      const oldRed = pending === 'ns'
        ? lightStateAt(lights, 'E') === 'red' && lightStateAt(lights, 'W') === 'red'
        : lightStateAt(lights, 'N') === 'red' && lightStateAt(lights, 'S') === 'red';
      let boxEmpty = true;
      if (oldRed) {
        const node = world.city.intersections[n];
        for (let i = 0; i < world.cars.length; i++) {
          const car = world.cars[i];
          if (car.state !== 'driving') continue;
          const dx = car.x - node.x;
          const dy = car.y - node.y;
          if (dx * dx + dy * dy < 50 * 50) { boxEmpty = false; break; }
        }
      }
      if (oldRed && boxEmpty) {
        const ok1 = lightToggle(lights, pending === 'ns' ? 'N' : 'E', world.mods);
        const ok2 = lightToggle(lights, pending === 'ns' ? 'S' : 'W', world.mods);
        if (ok1 && ok2) {
          world.pendingFlip[n] = null;
          world.lastFlip[n] = world.time;
        }
      }
      continue;
    }
    if (currentAxis === wantAxis) continue;
    // Hysteresis must never starve an axis: a green older than 7s with
    // any queue on the other side always flips.
    const stale = world.time - world.lastFlip[n] > 7 && (nsQueue + ewQueue) > 0 &&
      ((wantAxis === 'ns' && nsQueue > 0) || (wantAxis === 'ew' && ewQueue > 0));
    if (Math.abs(nsQueue - ewQueue) < 3 && !forceAxis && !stale) continue;
    if (world.time - world.lastFlip[n] < 2.5) continue;
    // Do not start a flip while the box is occupied.
    const node = world.city.intersections[n];
    let occupied = false;
    for (let i = 0; i < world.cars.length; i++) {
      const car = world.cars[i];
      if (car.state !== 'driving') continue;
      const dx = car.x - node.x;
      const dy = car.y - node.y;
      if (dx * dx + dy * dy < 40 * 40) { occupied = true; break; }
    }
    if (occupied) continue;
    // Phase 1: send the green axis to amber; phase 2 completes the flip.
    // Only arm the pending flip if both toggles actually fired.
    let ok = true;
    if (currentAxis === 'ns') {
      ok = lightToggle(lights, 'N', world.mods) && lightToggle(lights, 'S', world.mods);
    } else if (currentAxis === 'ew') {
      ok = lightToggle(lights, 'E', world.mods) && lightToggle(lights, 'W', world.mods);
    }
    if (ok) world.pendingFlip[n] = wantAxis;
  }
}

// ---- events ---------------------------------------------------------------

function processEvents(world) {
  const events = world.events;
  world.events = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type === 'carExited') {
      const idx = world.cars.indexOf(e.car);
      if (idx >= 0) world.cars.splice(idx, 1);
      if (!world.attract) awardExit(world, e.car);
      else world.throughput++;
    } else if (e.type === 'emergencyExpired') {
      const idx = world.cars.indexOf(e.car);
      if (idx >= 0) {
        world.cars.splice(idx, 1);
        if (!world.attract) {
          loseLife(world, 'EMERGENCY DELAYED!', e.car.x, e.car.y - 18);
        }
      }
    } else if (e.type === 'honk') {
      if (world.time - world.lastHonk > 0.5) {
        world.lastHonk = world.time;
        NG_Audio.horn();
      }
    } else if (e.type === 'pedCrossed') {
      if (!world.attract) {
        world.score += 5;
      }
    }
  }
  // Wrecked cars whose tow timer expired leave the road.
  for (let i = world.cars.length - 1; i >= 0; i--) {
    const car = world.cars[i];
    if (car.state === 'wrecked') {
      if (world.rng.chance(0.06)) smokePuff(world.particles, car.x, car.y - 4);
      if (car.wreckTimer <= 0) world.cars.splice(i, 1);
    }
  }
  // Finished pedestrians leave.
  for (let i = world.peds.length - 1; i >= 0; i--) {
    if (world.peds[i].done) world.peds.splice(i, 1);
  }
}

// ---- main update ------------------------------------------------------------

function updateWorld(world, dt) {
  world.time += dt;
  if (world.banner && world.banner.timer > 0) world.banner.timer -= dt;
  if (world.comboPulse > 0) world.comboPulse -= dt;

  const simRunning = world.phase === 'playing' || world.phase === 'upgrade' || world.phase === 'menu';
  if (!simRunning) {
    updateParticles(world.particles, dt, world.weather, NG_CONFIG.canvasWidth, NG_CONFIG.canvasHeight);
    return;
  }

  if (world.phase === 'menu') {
    // Attract mode: steady traffic, autoplay lights, no consequences.
    const d = world.director;
    d.spawnTimer -= dt;
    if (d.spawnTimer <= 0) {
      d.spawnTimer = 0.95 * world.rng.range(0.7, 1.3);
      if (world.cars.length < 40) spawnCar(world, null);
    }
    d.pedTimer -= dt;
    if (d.pedTimer <= 0) {
      d.pedTimer = 3.0;
      if (world.peds.length < 14) spawnPedestrian(world);
    }
  } else {
    updateDirector(world, dt);
  }

  for (let i = 0; i < 6; i++) updateLights(world.lights[i], dt, world.mods);

  for (let i = 0; i < world.cars.length; i++) {
    updateVehicle(world.cars[i], dt, world);
  }
  for (let i = 0; i < world.peds.length; i++) {
    updatePedestrian(world.peds[i], dt, world);
  }

  if (world.phase === 'playing' || world.phase === 'menu') {
    detectCollisions(world);
  }
  processEvents(world);
  computeQueues(world);
  if (world.phase === 'playing' && !world.attract) {
    updateJam(world, dt);
    updateHint(world, dt);
    // Combo slowly decays back toward x1.
    world.combo = Math.max(1, world.combo - NG_CONFIG.comboDecayPerSec * dt);
  }

  if (world.autoplay || world.phase === 'menu') {
    world.autoplayTimer -= dt;
    if (world.autoplayTimer <= 0) {
      world.autoplayTimer = 0.6;
      autoplayStep(world);
    }
  }

  // Siren while any emergency vehicle is on the road.
  let anyEmergency = false;
  for (let i = 0; i < world.cars.length; i++) {
    if (world.cars[i].emergency && world.cars[i].state === 'driving') { anyEmergency = true; break; }
  }
  NG_Audio.siren(anyEmergency && world.phase === 'playing');

  updateParticles(world.particles, dt, world.weather, NG_CONFIG.canvasWidth, NG_CONFIG.canvasHeight);
}

// ---- attract setup -----------------------------------------------------------

function setupAttract(world) {
  world.director.activeCount = 3;
  for (let i = 0; i < 3; i++) {
    const lights = world.lights[i];
    lights.auto = false;
    lightSet(lights, 'N', 'green');
    lightSet(lights, 'S', 'green');
    lightSet(lights, 'E', 'red');
    lightSet(lights, 'W', 'red');
  }
  world.weather.darkness = 0.3;
  // Fast-forward the sim so the menu opens on a living city.
  for (let t = 0; t < 60 * 22; t++) {
    updateWorld(world, NG_CONFIG.fixedDt);
  }
  world.banner = null;
}

// ---- scenes for composed screenshots ------------------------------------------

function fastForward(world, seconds, useAutoplay) {
  const wasAuto = world.autoplay;
  world.autoplay = !!useAutoplay;
  const steps = Math.floor(seconds / NG_CONFIG.fixedDt);
  for (let t = 0; t < steps; t++) {
    updateWorld(world, NG_CONFIG.fixedDt);
    if (world.phase === 'gameover' || world.phase === 'victory') break;
  }
  world.autoplay = wasAuto;
}

function setScene(world, name) {
  world.sceneName = name;
  world.shotReady = false;
  if (name === 'start') {
    const fresh = createWorld(world.seed);
    fresh.sprites = world.sprites;
    fresh.bestScore = world.bestScore;
    for (const key in fresh) world[key] = fresh[key];
    world.phase = 'menu';
    world.attract = true;
    setupAttract(world);
  } else if (name === 'play') {
    resetRun(world, world.seed);
    startWave(world, 2);
    world.director.waveTime = 20;
    fastForward(world, 24, true);
    world.autoplay = false;
  } else if (name === 'rush') {
    resetRun(world, world.seed);
    startWave(world, 4);
    world.director.waveTime = 20;
    world.weather.rain = 1;
    world.weather.darkness = 0.66;
    fastForward(world, 24, true);
    spawnEmergency(world);
    fastForward(world, 4, true);
    world.autoplay = false;
    world.banner = { text: 'NEON RUSH HOUR', sub: 'Rain, glare and a city that will not wait.', timer: 30 };
  } else if (name === 'upgrade') {
    resetRun(world, world.seed);
    fastForward(world, NG_CONFIG.waveLengthSec + 1, true);
    if (world.phase !== 'upgrade') {
      world.phase = 'upgrade';
      world.director.offer = pickUpgradeOffer(world);
    }
    world.autoplay = false;
  } else if (name === 'gameover') {
    resetRun(world, world.seed);
    fastForward(world, 20, true);
    world.autoplay = false;
    world.lives = 1;
    loseLife(world, 'CRASH!', 640, 300);
    if (world.phase !== 'gameover') endRun(world, false);
  }
  world.shotReady = true;
}

// ---- verification sweep ---------------------------------------------------------

function runSweep(seeds, opts) {
  opts = opts || {};
  const maxTicks = opts.maxTicks || 30000;
  const results = [];
  for (let s = 0; s < seeds.length; s++) {
    const world = createWorld(seeds[s]);
    world.sprites = makeSprites();
    world.attract = false;
    world.autoplay = true;
    world.phase = 'playing';
    startWave(world, 0);
    let ticks = 0;
    while (ticks < maxTicks && world.phase !== 'gameover' && world.phase !== 'victory') {
      if (world.phase === 'upgrade') {
        const offer = world.director.offer || [];
        if (offer.length) applyUpgrade(world, offer[0].id);
        world.phase = 'playing';
        startWave(world, world.director.waveIndex + 1);
      }
      updateWorld(world, NG_CONFIG.fixedDt);
      ticks++;
    }
    results.push({
      seed: seeds[s],
      result: world.phase,
      score: world.score,
      waves: world.director.waveIndex + 1,
      throughput: world.throughput,
      crashes: world.crashes,
      lifeLosses: world.lifeLosses,
      ticks: ticks
    });
  }
  return results;
}
