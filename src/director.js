// The director: wave pacing, vehicle and pedestrian spawning, weather
// progression, intersection activation and the between-wave upgrades.

function makeDirector() {
  return {
    waveIndex: 0,
    waveTime: 0,
    spawnTimer: 1.2,
    emergencyTimer: 14,
    pedTimer: 2.5,
    activeCount: 0,
    offer: null,
    nodeVisits: [0, 0, 0, 0, 0, 0]
  };
}

function currentWaveDef(director) {
  return NG_WAVES[Math.min(director.waveIndex, NG_WAVES.length - 1)];
}

function startWave(world, index) {
  const d = world.director;
  d.waveIndex = index;
  d.waveTime = 0;
  const def = currentWaveDef(d);
  const prevActive = d.activeCount;
  d.activeCount = Math.min(6, index + 1);
  // Newly activated intersections switch from AUTO to manual control.
  for (let i = prevActive; i < d.activeCount; i++) {
    const lights = world.lights[i];
    lights.auto = false;
    lightSet(lights, 'N', 'green');
    lightSet(lights, 'S', 'green');
    lightSet(lights, 'E', 'red');
    lightSet(lights, 'W', 'red');
  }
  d.spawnTimer = 0.8;
  d.emergencyTimer = def.emergencyEvery * 0.6;
  world.banner = {
    text: 'WAVE ' + (index + 1) + ' — ' + def.name.toUpperCase(),
    sub: index === 0 ? 'You control the glowing intersection. Click a light to switch it.'
      : 'A new intersection is yours. ' + def.weather + ' ahead.',
    timer: 3.2
  };
  NG_Audio.wave();
  NG_Audio.setRain(def.rain);
}

function spawnCar(world, forceType) {
  const d = world.director;
  const city = world.city;
  const portals = usablePortals(city, d.activeCount);
  if (portals.length < 2) return;
  const rng = world.rng;
  const entry = rng.pick(portals);
  let exit = rng.pick(portals);
  let guard = 0;
  while (exit.id === entry.id && guard++ < 8) exit = rng.pick(portals);
  if (exit.id === entry.id) return;
  const route = findRoute(city, d.activeCount, entry.id, exit.id);
  if (!route) return;
  const path = buildPath(city, route, world.roundabouts);
  // Do not spawn on top of another car.
  const spawnPt = pathPointAt(path, 0);
  for (let i = 0; i < world.cars.length; i++) {
    const c = world.cars[i];
    const dx = c.x - spawnPt.x;
    const dy = c.y - spawnPt.y;
    if (dx * dx + dy * dy < 48 * 48) return;
  }
  let type = forceType;
  if (!type) {
    const pairs = [];
    for (const key in NG_VEHICLES) {
      const arch = NG_VEHICLES[key];
      if (!arch.emergency && arch.weight > 0) pairs.push([key, arch.weight]);
    }
    type = rng.weighted(pairs);
  }
  const car = makeVehicle(type, path, rng, world.mods);
  route.forEach(function (n) {
    if (n < 6) d.nodeVisits[n]++;
  });
  world.cars.push(car);
  return car;
}

function spawnEmergency(world) {
  const active = world.cars.filter(function (c) { return c.emergency && c.state === 'driving'; });
  if (active.length >= 2) return;
  const type = world.rng.chance(0.5) ? 'ambulance' : 'firetruck';
  const car = spawnCar(world, type);
  if (car) {
    world.banner = { text: 'EMERGENCY VEHICLE INBOUND', sub: 'Clear a path — do not keep it waiting.', timer: 2.4, alert: true };
    NG_Audio.warning();
  }
}

function spawnPedestrian(world) {
  const d = world.director;
  const choices = [];
  for (let i = 0; i < d.activeCount; i++) {
    if (!world.mods.bridges[i]) choices.push(i);
  }
  if (!choices.length) return;
  const node = world.city.intersections[world.rng.pick(choices)];
  world.peds.push(makePedestrian(node, world.rng, world.mods.bridges));
}

function pickUpgradeOffer(world) {
  const pool = NG_UPGRADES.filter(function (u) {
    if (u.id === 'life') return world.lives < NG_CONFIG.maxLives;
    if (u.id === 'roundabout') {
      for (let i = 0; i < world.director.activeCount; i++) if (!world.roundabouts[i]) return true;
      return false;
    }
    if (u.id === 'bridge') {
      for (let i = 0; i < world.director.activeCount; i++) if (!world.mods.bridges[i]) return true;
      return false;
    }
    return !world.mods[u.id];
  });
  const shuffled = world.rng.shuffle(pool);
  return shuffled.slice(0, Math.min(3, shuffled.length));
}

function busiestNode(world, predicate) {
  let best = -1;
  let bestCount = -1;
  for (let i = 0; i < world.director.activeCount; i++) {
    if (predicate && !predicate(i)) continue;
    if (world.director.nodeVisits[i] > bestCount) { bestCount = world.director.nodeVisits[i]; best = i; }
  }
  return best;
}

function applyUpgrade(world, id) {
  const mods = world.mods;
  if (id === 'life') {
    world.lives = Math.min(NG_CONFIG.maxLives, world.lives + 1);
  } else if (id === 'roundabout') {
    const node = busiestNode(world, function (i) { return !world.roundabouts[i]; });
    if (node >= 0) {
      world.roundabouts[node] = true;
      world.lights[node].roundabout = true;
      world.staticDirty = true;
    }
  } else if (id === 'bridge') {
    const node = busiestNode(world, function (i) { return !mods.bridges[i]; });
    if (node >= 0) {
      mods.bridges[node] = true;
      world.staticDirty = true;
    }
  } else {
    mods[id] = true;
  }
  world.upgradesTaken.push(id);
  NG_Audio.upgrade();
}

function updateDirector(world, dt) {
  const d = world.director;
  const def = currentWaveDef(d);
  // Weather eases toward the wave's targets.
  const w = world.weather;
  const rate = 0.25 * dt;
  w.rain += (def.rain - w.rain) * rate * 4;
  w.fog += (def.fog - w.fog) * rate * 4;
  w.darkness += (def.darkness - w.darkness) * rate * 4;

  if (world.phase !== 'playing') return;
  d.waveTime += dt;

  // Spawning.
  d.spawnTimer -= dt;
  if (d.spawnTimer <= 0) {
    d.spawnTimer = def.spawnEvery * world.rng.range(0.7, 1.3);
    if (world.cars.length < NG_CONFIG.maxCars) spawnCar(world, null);
  }
  d.emergencyTimer -= dt;
  if (d.emergencyTimer <= 0) {
    d.emergencyTimer = def.emergencyEvery * world.rng.range(0.8, 1.2);
    spawnEmergency(world);
  }
  d.pedTimer -= dt;
  if (d.pedTimer <= 0) {
    d.pedTimer = def.pedEvery * world.rng.range(0.7, 1.3);
    if (world.peds.length < NG_CONFIG.maxPedestrians) spawnPedestrian(world);
  }

  // Wave end: intermission with an upgrade, or victory.
  if (d.waveTime >= NG_CONFIG.waveLengthSec) {
    if (d.waveIndex >= NG_CONFIG.totalWaves - 1) {
      world.phase = 'victory';
      world.victoryStats = {
        score: world.score,
        throughput: world.throughput,
        crashes: world.crashes,
        nearMisses: world.nearMisses,
        emergencies: world.emergenciesSaved
      };
      world.endStats = world.victoryStats;
      if (world.score > world.bestScore) {
        world.bestScore = world.score;
        saveBestScore(world.score);
      }
      NG_Audio.victory();
      NG_Audio.siren(false);
    } else {
      world.phase = 'upgrade';
      d.offer = pickUpgradeOffer(world);
    }
  }
}
