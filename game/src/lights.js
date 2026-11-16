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
    autoPending: null, // axis waiting for the old axis to clear
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
    if (lights.autoPending) {
      // Wait for the old axis to reach red before greening the new one:
      // the amber phase is the clearance interval, never skipped.
      const oldAxis = lights.autoPending === 'ns' ? ['E', 'W'] : ['N', 'S'];
      const clear = oldAxis.every(function (ap) { return lights.approaches[ap].state === 'red'; });
      if (clear) {
        const newAxis = lights.autoPending === 'ns' ? ['N', 'S'] : ['E', 'W'];
        newAxis.forEach(function (ap) { lightSet(lights, ap, 'green'); });
        lights.autoPending = null;
        lights.autoTimer = 0;
      }
    } else if (lights.autoTimer >= 5.0) {
      const greenAxis = lights.autoPhase === 'ns' ? ['N', 'S'] : ['E', 'W'];
      greenAxis.forEach(function (ap) {
        const a = lights.approaches[ap];
        if (a.state === 'green') { a.state = 'amber'; a.timer = 0; }
      });
      lights.autoPhase = lights.autoPhase === 'ns' ? 'ew' : 'ns';
      lights.autoPending = lights.autoPhase;
      lights.autoTimer = 0;
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
