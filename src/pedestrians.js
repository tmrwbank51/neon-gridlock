// Pedestrians: they wait at crosswalks for the walk signal, cross when
// it is safe, and jaywalk when kept waiting too long. Cars stop for them,
// so a hit only happens when a jaywalker steps into immediate traffic.

var NG_PED_ID = 1;
var NG_PED_SHIRTS = ['#ff6b9d', '#7bdff2', '#ffd166', '#9bf6a3', '#c792ff', '#f7f7ff', '#ff8c42'];

function makePedestrian(node, rng, bridgeNodes) {
  const walks = crosswalksOf(node);
  const walk = rng.pick(walks);
  const side = rng.chance(0.5) ? 1 : -1;
  let wait, target, leave;
  if (walk.horizontal) {
    const yC = walk.y + walk.h / 2;
    const x0 = walk.x - 8;
    const x1 = walk.x + walk.w + 8;
    const sx = side > 0 ? x1 : x0;
    const tx = side > 0 ? x0 : x1;
    wait = { x: sx, y: yC };
    target = { x: tx, y: yC };
    leave = { x: tx + side * -22, y: yC + (rng.chance(0.5) ? -20 : 20) };
  } else {
    const xC = walk.x + walk.w / 2;
    const y0 = walk.y - 8;
    const y1 = walk.y + walk.h + 8;
    const sy = side > 0 ? y1 : y0;
    const ty = side > 0 ? y0 : y1;
    wait = { x: xC, y: sy };
    target = { x: xC, y: ty };
    leave = { x: xC + (rng.chance(0.5) ? -20 : 20), y: ty + side * -22 };
  }
  // Start a little way from the wait point, on the sidewalk.
  const start = {
    x: wait.x + (rng.range(-26, 26)),
    y: wait.y + (rng.range(-26, 26))
  };
  return {
    id: NG_PED_ID++,
    node: node.id,
    arm: walk.arm,
    x: start.x, y: start.y,
    wait: wait, target: target, leave: leave,
    state: 'toWait',
    crossing: false,
    jaywalking: false,
    patience: rng.range(12, 18),
    waitTime: 0,
    speed: rng.range(30, 40),
    bob: rng.range(0, Math.PI * 2),
    shirt: rng.pick(NG_PED_SHIRTS),
    done: false,
    crossed: false
  };
}

function pedStepToward(ped, tx, ty, dt, speed) {
  const dx = tx - ped.x;
  const dy = ty - ped.y;
  const d = Math.hypot(dx, dy);
  if (d < 2) return true;
  const step = Math.min(d, speed * dt);
  ped.x += (dx / d) * step;
  ped.y += (dy / d) * step;
  ped.bob += dt * 9;
  return d - step < 2;
}

function updatePedestrian(ped, dt, world) {
  if (ped.done) return;
  const lights = world.lights[ped.node];
  switch (ped.state) {
    case 'toWait':
      if (pedStepToward(ped, ped.wait.x, ped.wait.y, dt, ped.speed)) {
        ped.state = 'waiting';
      }
      break;
    case 'waiting': {
      ped.waitTime += dt;
      const walkOn = lights && walkSignal(lights, ped.arm);
      if (walkOn) {
        ped.state = 'crossing';
        ped.crossing = true;
      } else if (ped.waitTime > ped.patience) {
        // A jaywalker still looks both ways: only step out when no car
        // is close enough to be a danger. Otherwise keep waiting.
        let danger = false;
        for (let i = 0; i < world.cars.length; i++) {
          const car = world.cars[i];
          if (car.state !== 'driving') continue;
          const dx = car.x - ped.x;
          const dy = car.y - ped.y;
          if (dx * dx + dy * dy < 85 * 85) { danger = true; break; }
        }
        if (!danger) {
          ped.state = 'crossing';
          ped.crossing = true;
          ped.jaywalking = true;
        }
      }
      break;
    }
    case 'crossing': {
      const speed = ped.jaywalking ? ped.speed * 1.4 : ped.speed;
      if (pedStepToward(ped, ped.target.x, ped.target.y, dt, speed)) {
        ped.crossing = false;
        ped.crossed = true;
        ped.state = 'leaving';
        world.events.push({ type: 'pedCrossed', ped: ped });
      }
      break;
    }
    case 'leaving':
      if (pedStepToward(ped, ped.leave.x, ped.leave.y, dt, ped.speed)) {
        ped.done = true;
      }
      break;
  }
}
