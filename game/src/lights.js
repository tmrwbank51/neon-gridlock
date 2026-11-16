// Traffic lights: one signal head per approach, toggled by the player.
// GREEN -> AMBER -> RED on toggle; RED -> GREEN on toggle. Minimum times
// stop flicker spam. AUTO intersections cycle on a fixed timer until the
// player takes them over. Walk signals follow the car lights.

var NG_LIGHT_STATE = { GREEN: 'green', AMBER: 'amber', RED: 'red' };

function makeApproachLight() {
  return { state: 'red', timer: 0, flash: 0 };
}

function makeIntersectionLights(id, auto) {
  return {
    id: id,
    auto: !!auto,
    autoTimer: 0,
    autoPhase: 'ns', // 'ns' = N+S green, 'ew' = E+W green
    roundabout: false,
    approaches: { N: makeApproachLight(), E: makeApproachLight(), S: makeApproachLight(), W: makeApproachLight() }
  };
}

function lightStateAt(lights, approach) {
  return lights.approaches[approach].state;
}

// Can this approach change right now? Enforces minimum green/red times.
function lightCanToggle(lights, approach, mods) {
  const ap = lights.approaches[approach];
  if (ap.state === 'amber') return false;
  const minGreen = NG_CONFIG.minGreenSec * (mods.quick ? 0.6 : 1);
  const minRed = NG_CONFIG.minRedSec * (mods.quick ? 0.6 : 1);
  if (ap.state === 'green' && ap.timer < minGreen) return false;
  if (ap.state === 'red' && ap.timer < minRed) return false;
  return true;
}

function lightToggle(lights, approach, mods) {
  const ap = lights.approaches[approach];
  if (!lightCanToggle(lights, approach, mods)) return false;
  if (ap.state === 'green') {
    ap.state = 'amber';
    ap.timer = 0;
  } else {
    ap.state = 'green';
    ap.timer = 0;
    ap.flash = 0.4;
  }
  return true;
}

function lightSet(lights, approach, state) {
  const ap = lights.approaches[approach];
  ap.state = state;
  ap.timer = 0;
}

function updateLights(lights, dt, mods) {
  const amberSec = NG_CONFIG.amberSec * (mods.quick ? 0.7 : 1);
  for (const key in lights.approaches) {
    const ap = lights.approaches[key];
    ap.timer += dt;
    if (ap.flash > 0) ap.flash -= dt;
    if (ap.state === 'amber' && ap.timer >= amberSec) {
      ap.state = 'red';
      ap.timer = 0;
    }
  }
  if (lights.auto && !lights.roundabout) {
    lights.autoTimer += dt;
    const phaseLen = 5.0;
    if (lights.autoTimer >= phaseLen) {
      lights.autoTimer = 0;
      lights.autoPhase = lights.autoPhase === 'ns' ? 'ew' : 'ns';
      const nsGreen = lights.autoPhase === 'ns';
      lightSet(lights, 'N', nsGreen ? 'green' : 'red');
      lightSet(lights, 'S', nsGreen ? 'green' : 'red');
      lightSet(lights, 'E', nsGreen ? 'red' : 'green');
      lightSet(lights, 'W', nsGreen ? 'red' : 'green');
    }
  }
}

// Walk is safe across an arm when the car approaches parallel to the
// crossing traffic are both red. Arm N/S crosswalks conflict with N/S
// car approaches; arm E/W crosswalks conflict with E/W approaches.
function walkSignal(lights, arm) {
  if (lights.roundabout) return false;
  if (arm === 'N' || arm === 'S') {
    return lightStateAt(lights, 'N') === 'red' && lightStateAt(lights, 'S') === 'red';
  }
  return lightStateAt(lights, 'E') === 'red' && lightStateAt(lights, 'W') === 'red';
}

// Two approaches conflict when their traffic crosses (N vs E/W, etc.).
function approachesConflict(a, b) {
  if (a === b) return false;
  const ns = (a === 'N' || a === 'S');
  const bns = (b === 'N' || b === 'S');
  return ns !== bns;
}

// Is this green approach in conflict with another green approach?
function lightHasConflict(lights, approach) {
  if (lightStateAt(lights, approach) !== 'green') return false;
  for (const key in lights.approaches) {
    if (key !== approach && lightStateAt(lights, key) === 'green' && approachesConflict(approach, key)) return true;
  }
  return false;
}

// Screen position of a signal head: the near right-hand corner of each
// approach, where its drivers look. Generous click target in input.js.
function lightHeadPosition(node, approach) {
  const c = NG_CONFIG.roadWidth / 2 + 12;
  switch (approach) {
    case 'N': return { x: node.x - c, y: node.y - c };
    case 'S': return { x: node.x + c, y: node.y + c };
    case 'E': return { x: node.x + c, y: node.y - c };
    case 'W': return { x: node.x - c, y: node.y + c };
  }
  return { x: node.x, y: node.y };
}
