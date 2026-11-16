// Input: mouse clicks on lights, buttons and cards, plus the full
// keyboard scheme. Every action answers at once, with sound or a popup.

function canvasCoords(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (NG_CONFIG.canvasWidth / rect.width),
    y: (clientY - rect.top) * (NG_CONFIG.canvasHeight / rect.height)
  };
}

function nearestLightHead(world, x, y) {
  let best = null;
  let bestD = 26 * 26;
  for (let i = 0; i < world.director.activeCount; i++) {
    const node = world.city.intersections[i];
    const lights = world.lights[i];
    if (lights.roundabout) continue;
    ['N', 'E', 'S', 'W'].forEach(function (ap) {
      const pos = lightHeadPosition(node, ap);
      const dx = x - pos.x;
      const dy = y - pos.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = { node: i, approach: ap, x: pos.x, y: pos.y }; }
    });
  }
  return best;
}

function nearestIntersection(world, x, y) {
  let best = -1;
  let bestD = 52 * 52;
  for (let i = 0; i < world.director.activeCount; i++) {
    const node = world.city.intersections[i];
    const dx = x - node.x;
    const dy = y - node.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function toggleApproach(world, nodeId, approach) {
  const lights = world.lights[nodeId];
  if (!lights || lights.roundabout) return;
  if (lights.auto) {
    const node = world.city.intersections[nodeId];
    addPopup(world.particles, node.x, node.y - 52, 'AUTO — unlocks later', '#8f8fb8', false);
    return;
  }
  if (lightToggle(lights, approach, world.mods)) {
    NG_Audio.toggle();
    const node = world.city.intersections[nodeId];
    const pos = lightHeadPosition(node, approach);
    const state = lightStateAt(lights, approach);
    addPopup(world.particles, pos.x, pos.y - 20, state === 'green' ? 'GREEN' : state === 'amber' ? 'AMBER' : 'RED',
      state === 'green' ? '#2ee66b' : state === 'amber' ? '#ffb02e' : '#ff3b30', false);
  }
}

function handleButton(world, id) {
  if (id === 'start') {
    startRun(world);
  } else if (id === 'restart') {
    restartRun(world);
  } else if (id === 'resume') {
    world.phase = 'playing';
    NG_Audio.click();
  } else if (id === 'pause') {
    if (world.phase === 'playing') { world.phase = 'paused'; NG_Audio.click(); }
    else if (world.phase === 'paused') { world.phase = 'playing'; NG_Audio.click(); }
  } else if (id === 'mute') {
    NG_Audio.setMuted(!NG_Audio.isMuted());
  } else if (id === 'speed') {
    world.speed = world.speed === 1 ? 2 : 1;
    NG_Audio.click();
  } else if (id.indexOf('upgrade:') === 0) {
    applyUpgrade(world, id.slice(8));
    world.phase = 'playing';
    startWave(world, world.director.waveIndex + 1);
  }
}

function bindInput(canvas, world) {
  canvas.addEventListener('mousemove', function (e) {
    world.mouse = canvasCoords(canvas, e.clientX, e.clientY);
  });
  canvas.addEventListener('click', function (e) {
    const p = canvasCoords(canvas, e.clientX, e.clientY);
    world.mouse = p;
    NG_Audio.unlock();
    // Buttons first (topmost last: iterate in reverse).
    const buttons = world.ui.buttons;
    for (let i = buttons.length - 1; i >= 0; i--) {
      const b = buttons[i];
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
        handleButton(world, b.id);
        return;
      }
    }
    if (world.phase !== 'playing') return;
    const head = nearestLightHead(world, p.x, p.y);
    if (head) {
      world.selected = head.node;
      toggleApproach(world, head.node, head.approach);
      return;
    }
    const node = nearestIntersection(world, p.x, p.y);
    if (node >= 0) {
      world.selected = node;
      NG_Audio.click();
    }
  });

  window.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    const key = e.key;
    NG_Audio.unlock();
    if (key === 'm' || key === 'M') { NG_Audio.setMuted(!NG_Audio.isMuted()); return; }
    if (key === 'f' || key === 'F') {
      if (world.phase === 'playing') { world.speed = world.speed === 1 ? 2 : 1; NG_Audio.click(); }
      return;
    }
    if (key === 'r' || key === 'R') {
      if (world.phase !== 'menu') restartRun(world);
      return;
    }
    if (key === ' ' || key === 'p' || key === 'P' || key === 'Escape') {
      if (world.phase === 'playing') { world.phase = 'paused'; NG_Audio.click(); }
      else if (world.phase === 'paused') { world.phase = 'playing'; NG_Audio.click(); }
      if (key === ' ') e.preventDefault();
      return;
    }
    if (key === 'Enter') {
      if (world.phase === 'menu') startRun(world);
      else if (world.phase === 'gameover' || world.phase === 'victory') restartRun(world);
      return;
    }
    if (world.phase === 'upgrade') {
      const idx = ['1', '2', '3'].indexOf(key);
      if (idx >= 0 && world.director.offer && world.director.offer[idx]) {
        handleButton(world, 'upgrade:' + world.director.offer[idx].id);
      }
      return;
    }
    if (world.phase !== 'playing') return;
    const num = parseInt(key, 10);
    if (num >= 1 && num <= 6 && num <= world.director.activeCount) {
      world.selected = num - 1;
      NG_Audio.click();
      return;
    }
    if (world.selected < 0) return;
    const arrows = { ArrowUp: 'N', ArrowRight: 'E', ArrowDown: 'S', ArrowLeft: 'W' };
    if (arrows[key]) {
      toggleApproach(world, world.selected, arrows[key]);
      e.preventDefault();
    }
  });
}
