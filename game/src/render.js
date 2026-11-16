// Rendering: the static city layer, glow sprites, vehicles, pedestrians,
// weather and the tilt-shift finish. The HUD and menus live in hud.js.

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function makeGlowSprite(color, radius) {
  const c = document.createElement('canvas');
  c.width = radius * 2;
  c.height = radius * 2;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(radius, radius, 0, radius, radius, radius);
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, color.replace('1)', '0.45)').replace('0.9)', '0.45)'));
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, radius * 2, radius * 2);
  return c;
}

function makeConeSprite() {
  const c = document.createElement('canvas');
  c.width = 90;
  c.height = 60;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 90, 0);
  grad.addColorStop(0, 'rgba(255,244,200,0.55)');
  grad.addColorStop(1, 'rgba(255,244,200,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, 24);
  g.lineTo(90, 0);
  g.lineTo(90, 60);
  g.lineTo(0, 36);
  g.closePath();
  g.fill();
  return c;
}

function makeSprites() {
  return {
    glowWarm: makeGlowSprite('rgba(255,220,150,1)', 48),
    glowRed: makeGlowSprite('rgba(255,60,50,1)', 40),
    glowAmber: makeGlowSprite('rgba(255,176,46,1)', 40),
    glowGreen: makeGlowSprite('rgba(46,230,107,1)', 40),
    glowBlue: makeGlowSprite('rgba(60,140,255,1)', 40),
    glowCyan: makeGlowSprite('rgba(55,226,255,1)', 52),
    glowPink: makeGlowSprite('rgba(255,77,141,1)', 52),
    cone: makeConeSprite()
  };
}

// ---- static layer -------------------------------------------------------

function buildStaticLayer(world) {
  const W = NG_CONFIG.canvasWidth;
  const H = NG_CONFIG.canvasHeight;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const P = NG_PALETTE;
  const hw = NG_CONFIG.roadWidth / 2;

  // Ground.
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, P.groundTop);
  grad.addColorStop(1, P.groundBottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  // City blocks.
  world.city.blocks.forEach(function (block) {
    g.fillStyle = P.blockFill;
    g.fillRect(block.x, block.y, block.w, block.h);
    g.strokeStyle = P.blockEdge;
    g.lineWidth = 2;
    g.strokeRect(block.x + 1, block.y + 1, block.w - 2, block.h - 2);
    if (block.kind === 'park') {
      g.fillStyle = P.grass;
      rr(g, block.x + 6, block.y + 6, block.w - 12, block.h - 12, 8);
      g.fill();
      block.trees.forEach(function (t) {
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.beginPath();
        g.ellipse(t.x + 2, t.y + 3, t.r, t.r * 0.6, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = t.hue;
        g.beginPath();
        g.arc(t.x, t.y, t.r, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.10)';
        g.beginPath();
        g.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.45, 0, Math.PI * 2);
        g.fill();
      });
    } else if (block.kind === 'plaza') {
      g.fillStyle = '#20203a';
      rr(g, block.x + 6, block.y + 6, block.w - 12, block.h - 12, 8);
      g.fill();
      if (block.sign) {
        // A fountain: filled basin, neon rim, lit centre jet.
        g.fillStyle = '#26264a';
        g.beginPath();
        g.arc(block.sign.x, block.sign.y, block.sign.r, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = block.sign.color;
        g.lineWidth = 2.5;
        g.globalAlpha = 0.8;
        g.beginPath();
        g.arc(block.sign.x, block.sign.y, block.sign.r, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 0.3;
        g.beginPath();
        g.arc(block.sign.x, block.sign.y, block.sign.r * 0.6, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 1;
        g.fillStyle = block.sign.color;
        g.beginPath();
        g.arc(block.sign.x, block.sign.y, 4, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      block.buildings.forEach(function (b) {
        g.fillStyle = 'rgba(0,0,0,0.4)';
        rr(g, b.x + 3, b.y + 4, b.w, b.h, 4);
        g.fill();
        g.fillStyle = b.roof;
        rr(g, b.x, b.y, b.w, b.h, 4);
        g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.08)';
        g.lineWidth = 1;
        rr(g, b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, 4);
        g.stroke();
        b.windows.forEach(function (win) {
          g.fillStyle = win.lit ? P.windowLit : P.windowDark;
          g.globalAlpha = win.lit ? 0.85 : 0.8;
          g.fillRect(win.x, win.y, 8, 7);
        });
        g.globalAlpha = 1;
        if (b.sign) {
          g.fillStyle = b.sign;
          if (b.signSide === 'top') g.fillRect(b.x + 6, b.y - 2, b.w - 12, 3);
          else g.fillRect(b.x - 2, b.y + 6, 3, b.h - 12);
        }
      });
    }
  });

  // Roads: asphalt + edge lines.
  const roads = [];
  [300, 640, 980].forEach(function (x) {
    roads.push({ x: x - hw, y: NG_CONFIG.hudHeight, w: NG_CONFIG.roadWidth, h: H - NG_CONFIG.hudHeight, vertical: true, c: x });
  });
  [262, 498].forEach(function (y) {
    roads.push({ x: 0, y: y - hw, w: W, h: NG_CONFIG.roadWidth, vertical: false, c: y });
  });
  roads.forEach(function (r) {
    g.fillStyle = P.road;
    g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = P.roadEdge;
    if (r.vertical) {
      g.fillRect(r.x, r.y, 2, r.h);
      g.fillRect(r.x + r.w - 2, r.y, 2, r.h);
    } else {
      g.fillRect(r.x, r.y, r.w, 2);
      g.fillRect(r.x, r.y + r.h - 2, r.w, 2);
    }
  });

  // Lane dashes (skip the intersection boxes).
  g.fillStyle = P.laneDash;
  const dash = 14;
  const gap = 16;
  const boxes = world.city.intersections.map(function (n) {
    return { x0: n.x - hw - 4, x1: n.x + hw + 4, y0: n.y - hw - 4, y1: n.y + hw + 4 };
  });
  function inBox(x, y) {
    for (let i = 0; i < boxes.length; i++) {
      if (x > boxes[i].x0 && x < boxes[i].x1 && y > boxes[i].y0 && y < boxes[i].y1) return true;
    }
    return false;
  }
  [300, 640, 980].forEach(function (x) {
    for (let y = NG_CONFIG.hudHeight + 8; y < H - 8; y += dash + gap) {
      if (!inBox(x, y + dash / 2)) g.fillRect(x - 1.5, y, 3, dash);
    }
  });
  [262, 498].forEach(function (y) {
    for (let x = 8; x < W - 8; x += dash + gap) {
      if (!inBox(x + dash / 2, y)) g.fillRect(x, y - 1.5, dash, 3);
    }
  });

  // Stop lines + crosswalks + roundabout markings per intersection.
  world.city.intersections.forEach(function (node) {
    const isRound = world.roundabouts[node.id];
    if (isRound) {
      g.strokeStyle = '#e8e8f0';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(node.x, node.y, 24, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = '#23233d';
      g.beginPath();
      g.arc(node.x, node.y, 15, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = P.neonCyan;
      g.globalAlpha = 0.7;
      g.beginPath();
      g.arc(node.x, node.y, 5, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }
    // Stop lines: one per approach, just outside the crosswalk.
    g.fillStyle = P.stopLine;
    const so = hw + 16;
    g.fillRect(node.x + 3, node.y - so - 3, hw - 5, 3);   // north approach (southbound)
    g.fillRect(node.x - hw + 2, node.y + so, hw - 5, 3);  // south approach (northbound)
    g.fillRect(node.x + so, node.y - hw + 2, 3, hw - 5);  // east approach (westbound)
    g.fillRect(node.x - so - 3, node.y + 3, 3, hw - 5);   // west approach (eastbound)
    // Crosswalks: zebra stripes.
    crosswalksOf(node).forEach(function (cw) {
      g.fillStyle = P.crosswalk;
      if (cw.horizontal) {
        for (let x = cw.x + 2; x < cw.x + cw.w - 4; x += 10) g.fillRect(x, cw.y + 1, 5, cw.h - 2);
      } else {
        for (let y = cw.y + 2; y < cw.y + cw.h - 4; y += 10) g.fillRect(cw.x + 1, y, cw.w - 2, 5);
      }
    });
    // Sky bridge marking.
    if (world.mods.bridges[node.id]) {
      g.strokeStyle = P.neonAmber;
      g.lineWidth = 4;
      g.globalAlpha = 0.9;
      g.strokeRect(node.x - hw - 14, node.y - hw - 14, (hw + 14) * 2, (hw + 14) * 2);
      g.globalAlpha = 1;
    }
  });

  return c;
}

// ---- dynamic drawing ----------------------------------------------------

function drawLightHead(g, world, node, approach, lights, time) {
  const pos = lightHeadPosition(node, approach);
  const state = lightStateAt(lights, approach);
  const conflict = lightHasConflict(lights, approach);
  // Pole.
  g.fillStyle = '#0c0c16';
  g.fillRect(pos.x - 2, pos.y + 14, 4, 12);
  // Head.
  g.fillStyle = '#101018';
  rr(g, pos.x - 8, pos.y - 14, 16, 30, 4);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.18)';
  g.lineWidth = 1;
  rr(g, pos.x - 8, pos.y - 14, 16, 30, 4);
  g.stroke();
  const lamps = [
    { dy: -8, color: NG_PALETTE.lampRed, on: state === 'red', sprite: world.sprites.glowRed },
    { dy: 0, color: NG_PALETTE.lampAmber, on: state === 'amber', sprite: world.sprites.glowAmber },
    { dy: 8, color: NG_PALETTE.lampGreen, on: state === 'green', sprite: world.sprites.glowGreen }
  ];
  lamps.forEach(function (lamp) {
    if (lamp.on) {
      g.globalAlpha = 0.65 + 0.1 * Math.sin(time * 4);
      g.drawImage(lamp.sprite, pos.x - 23, lamp.dy + pos.y - 23, 46, 46);
      g.globalAlpha = 1;
    }
    g.fillStyle = lamp.on ? lamp.color : '#2c2c3e';
    g.beginPath();
    g.arc(pos.x, pos.y + lamp.dy, 4.2, 0, Math.PI * 2);
    g.fill();
  });
  if (conflict) {
    g.strokeStyle = 'rgba(255,59,48,' + (0.5 + 0.5 * Math.sin(time * 8)) + ')';
    g.lineWidth = 2;
    rr(g, pos.x - 10, pos.y - 15, 20, 32, 5);
    g.stroke();
  }
  // Queue-length glow for the Smart Sensors upgrade.
  if (world.mods.sensors && !lights.roundabout) {
    const q = world.queues[node.id] ? (world.queues[node.id][approach] || 0) : 0;
    if (q >= 3) {
      g.fillStyle = 'rgba(255,176,46,0.9)';
      g.font = 'bold 10px sans-serif';
      g.textAlign = 'center';
      g.fillText(String(q), pos.x, pos.y - 16);
    }
  }
}

function drawWalkSignal(g, world, node, arm, lights) {
  const walks = crosswalksOf(node);
  let cw = null;
  for (let i = 0; i < walks.length; i++) if (walks[i].arm === arm) cw = walks[i];
  if (!cw) return;
  const on = walkSignal(lights, arm);
  let x, y;
  if (arm === 'N') { x = node.x + NG_CONFIG.roadWidth / 2 + 8; y = node.y - NG_CONFIG.roadWidth / 2 - 22; }
  else if (arm === 'S') { x = node.x - NG_CONFIG.roadWidth / 2 - 8; y = node.y + NG_CONFIG.roadWidth / 2 + 22; }
  else if (arm === 'E') { x = node.x + NG_CONFIG.roadWidth / 2 + 22; y = node.y - NG_CONFIG.roadWidth / 2 - 8; }
  else { x = node.x - NG_CONFIG.roadWidth / 2 - 22; y = node.y + NG_CONFIG.roadWidth / 2 + 8; }
  g.fillStyle = '#101018';
  rr(g, x - 7, y - 7, 14, 14, 3);
  g.fill();
  g.strokeStyle = on ? '#2ee66b' : '#ff3b30';
  g.lineWidth = 1.5;
  rr(g, x - 7, y - 7, 14, 14, 3);
  g.stroke();
  if (on) {
    // Walking figure: head, body, striding legs.
    g.strokeStyle = '#2ee66b';
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(x, y - 3.5, 1.8, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(x, y - 1.5);
    g.lineTo(x, y + 1.5);
    g.moveTo(x, y + 1.5);
    g.lineTo(x - 2.5, y + 5);
    g.moveTo(x, y + 1.5);
    g.lineTo(x + 2.5, y + 4.5);
    g.moveTo(x, y);
    g.lineTo(x - 2.5, y + 2);
    g.stroke();
  } else {
    // Standing figure: head, straight body, arms out (do not walk).
    g.strokeStyle = '#ff3b30';
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(x, y - 3.5, 1.8, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(x, y - 1.5);
    g.lineTo(x, y + 5);
    g.moveTo(x - 3, y + 0.5);
    g.lineTo(x + 3, y + 0.5);
    g.stroke();
  }
}

function drawCar(g, world, car, time) {
  const arch = car.arch;
  const dark = world.weather.darkness;
  g.save();
  g.translate(car.x, car.y);
  g.rotate(car.angle);
  if (car.state === 'wrecked') g.rotate(0.35);
  // Shadow.
  g.fillStyle = 'rgba(0,0,0,0.4)';
  rr(g, -arch.len / 2 + 1, -arch.wid / 2 + 2, arch.len, arch.wid, 4);
  g.fill();
  // Headlight cones at night (sprite, drawn under the body).
  if (dark > 0.3 && car.state === 'driving') {
    g.globalAlpha = 0.5 * dark;
    g.drawImage(world.sprites.cone, arch.len / 2 - 2, -30, 90, 60);
    g.globalAlpha = 1;
  }
  // Body.
  g.fillStyle = car.state === 'wrecked' ? '#55556a' : car.color;
  rr(g, -arch.len / 2, -arch.wid / 2, arch.len, arch.wid, 4);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.lineWidth = 1;
  rr(g, -arch.len / 2, -arch.wid / 2, arch.len, arch.wid, 4);
  g.stroke();
  // Roof / cabin.
  g.fillStyle = 'rgba(20,20,36,0.85)';
  const roofLen = arch.len * (car.type === 'bus' ? 0.8 : 0.45);
  rr(g, -roofLen / 2 + (car.type === 'truck' ? -arch.len * 0.22 : 0), -arch.wid / 2 + 2.5, roofLen, arch.wid - 5, 3);
  g.fill();
  if (car.type === 'bus') {
    g.fillStyle = 'rgba(160,220,255,0.75)';
    for (let wx = -arch.len / 2 + 5; wx < arch.len / 2 - 6; wx += 8) g.fillRect(wx, -arch.wid / 2 + 3, 5, 3);
  }
  if (car.type === 'truck') {
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(arch.len * 0.08, -arch.wid / 2 + 2, arch.len * 0.36, arch.wid - 4);
  }
  // Emergency markings.
  if (car.type === 'ambulance') {
    g.fillStyle = '#ff3b30';
    g.fillRect(-2, -arch.wid / 2 + 2, 4, arch.wid - 4);
    g.fillRect(-arch.len * 0.2, -2, arch.len * 0.4, 4);
  }
  if (car.type === 'firetruck') {
    g.fillStyle = '#ffd166';
    g.fillRect(-arch.len / 2 + 3, -1.5, arch.len - 6, 3);
  }
  // Headlights.
  g.fillStyle = '#fff8d6';
  g.fillRect(arch.len / 2 - 2, -arch.wid / 2 + 2, 2.5, 3);
  g.fillRect(arch.len / 2 - 2, arch.wid / 2 - 5, 2.5, 3);
  // Taillights.
  g.fillStyle = car.brake ? '#ff2d20' : 'rgba(200,40,35,0.75)';
  g.fillRect(-arch.len / 2 - 0.5, -arch.wid / 2 + 2, 2.5, 3);
  g.fillRect(-arch.len / 2 - 0.5, arch.wid / 2 - 5, 2.5, 3);
  // Turn signal.
  if (car.turnSignal !== 0 && car.state === 'driving' && Math.sin(car.signalTimer * 9) > 0) {
    g.fillStyle = '#ffb02e';
    const sy = car.turnSignal > 0 ? arch.wid / 2 - 4 : -arch.wid / 2 + 1;
    g.beginPath();
    g.arc(arch.len / 2 - 4, sy + 1.5, 2, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();

  // Emergency light bar flash (world space, above the car).
  if (car.emergency && car.state === 'driving') {
    const phase = Math.floor(time * 6) % 2 === 0;
    const sprite = phase ? world.sprites.glowRed : world.sprites.glowBlue;
    g.globalAlpha = 0.8;
    g.drawImage(sprite, car.x - 22, car.y - 22, 44, 44);
    g.globalAlpha = 1;
    // Patience ring.
    const frac = Math.max(0, car.patience / car.patienceMax);
    g.strokeStyle = frac > 0.4 ? '#ffd166' : '#ff3b30';
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(car.x, car.y, 20, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    g.stroke();
  }
  // Red-light runner warning.
  if (car.runFlash > 0 && car.state === 'driving') {
    g.fillStyle = '#ff3b30';
    g.font = 'bold 15px sans-serif';
    g.textAlign = 'center';
    g.fillText('!', car.x, car.y - 16);
  }
}

function drawPedestrian(g, ped) {
  const bobY = Math.sin(ped.bob) * 1.1;
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.ellipse(ped.x, ped.y + 4, 3.5, 2, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = ped.shirt;
  rr(g, ped.x - 2.5, ped.y - 3 + bobY * 0.4, 5, 6, 2);
  g.fill();
  g.fillStyle = '#f2c9a0';
  g.beginPath();
  g.arc(ped.x, ped.y - 5 + bobY * 0.4, 2.6, 0, Math.PI * 2);
  g.fill();
  if (ped.jaywalking && ped.crossing) {
    g.fillStyle = '#ffb02e';
    g.font = 'bold 11px sans-serif';
    g.textAlign = 'center';
    g.fillText('!', ped.x, ped.y - 11);
  }
}

function drawWorld(g, world, time) {
  const W = NG_CONFIG.canvasWidth;
  const H = NG_CONFIG.canvasHeight;
  if (world.staticDirty || !world.staticLayer) {
    world.staticLayer = buildStaticLayer(world);
    world.staticDirty = false;
  }
  g.save();
  g.translate(world.particles.shakeX, world.particles.shakeY);
  g.drawImage(world.staticLayer, 0, 0);

  const dark = world.weather.darkness;
  // Night overlay darkens the ground; lights and cars pop above it.
  if (dark > 0.02) {
    g.fillStyle = 'rgba(5,7,24,' + (dark * 0.44).toFixed(3) + ')';
    g.fillRect(0, NG_CONFIG.hudHeight, W, H - NG_CONFIG.hudHeight);
  }

  // Wet-road reflections under signals when raining.
  if (world.weather.rain > 0.15) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    world.city.intersections.forEach(function (node) {
      const lights = world.lights[node.id];
      if (lights.roundabout) return;
      ['N', 'E', 'S', 'W'].forEach(function (ap) {
        const state = lightStateAt(lights, ap);
        if (state === 'red') return;
        const pos = lightHeadPosition(node, ap);
        const color = state === 'green' ? '46,230,107' : '255,176,46';
        const grad = g.createLinearGradient(pos.x, pos.y + 10, pos.x, pos.y + 46);
        grad.addColorStop(0, 'rgba(' + color + ',0.20)');
        grad.addColorStop(1, 'rgba(' + color + ',0)');
        g.fillStyle = grad;
        g.fillRect(pos.x - 3, pos.y + 10, 6, 36);
      });
    });
    g.restore();
  }

  // Signals + walk signals.
  world.city.intersections.forEach(function (node) {
    const lights = world.lights[node.id];
    if (lights.roundabout) return;
    ['N', 'E', 'S', 'W'].forEach(function (ap) {
      drawLightHead(g, world, node, ap, lights, time);
      drawWalkSignal(g, world, node, ap, lights);
    });
    // AUTO badge on intersections the player does not control yet.
    if (lights.auto) {
      g.fillStyle = 'rgba(8,9,20,0.8)';
      rr(g, node.x - 22, node.y - 46, 44, 15, 4);
      g.fill();
      g.fillStyle = '#8f8fb8';
      g.font = 'bold 9px sans-serif';
      g.textAlign = 'center';
      g.fillText('AUTO', node.x, node.y - 35);
    }
  });

  // Selected-intersection marker: corner brackets around the box.
  if (world.selected >= 0 && world.phase === 'playing') {
    const node = world.city.intersections[world.selected];
    const a = 0.6 + 0.4 * Math.sin(time * 5);
    g.strokeStyle = 'rgba(55,226,255,' + a + ')';
    g.lineWidth = 2.5;
    const r = 42, len = 13;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
      const cx = node.x + c[0] * r, cy = node.y + c[1] * r;
      g.beginPath();
      g.moveTo(cx - c[0] * len, cy);
      g.lineTo(cx, cy);
      g.lineTo(cx, cy - c[1] * len);
      g.stroke();
    });
  }
  for (let i = 0; i < world.director.activeCount; i++) {
    const node = world.city.intersections[i];
    g.fillStyle = 'rgba(8,9,20,0.85)';
    g.beginPath();
    g.arc(node.x - 44, node.y - 44, 9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = world.selected === i ? '#37e2ff' : '#c9c9e0';
    g.font = 'bold 11px sans-serif';
    g.textAlign = 'center';
    g.fillText(String(i + 1), node.x - 44, node.y - 40);
  }

  // Smart-sensor hint arrow: the approach that needs green most.
  if (world.mods.sensors && world.hint) {
    const node = world.city.intersections[world.hint.node];
    const pos = lightHeadPosition(node, world.hint.approach);
    const bounce = Math.sin(time * 6) * 3;
    g.fillStyle = '#7dff6a';
    g.beginPath();
    g.moveTo(pos.x, pos.y - 26 + bounce);
    g.lineTo(pos.x - 6, pos.y - 34 + bounce);
    g.lineTo(pos.x + 6, pos.y - 34 + bounce);
    g.closePath();
    g.fill();
  }

  // Cars, then pedestrians, then particles.
  world.cars.forEach(function (car) { drawCar(g, world, car, time); });
  world.peds.forEach(function (ped) { drawPedestrian(g, ped); });

  const parts = world.particles.list;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const alpha = Math.max(0, p.life / p.maxLife);
    g.globalAlpha = alpha;
    if (p.ring) {
      g.strokeStyle = p.color;
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      g.stroke();
    } else {
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;

  // Score popups.
  world.particles.popups.forEach(function (p) {
    const alpha = Math.max(0, p.life / p.maxLife);
    g.globalAlpha = alpha;
    g.font = (p.big ? 'bold 20px' : 'bold 14px') + ' sans-serif';
    g.textAlign = 'center';
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillText(p.text, p.x + 1, p.y + 1);
    g.fillStyle = p.color;
    g.fillText(p.text, p.x, p.y);
  });
  g.globalAlpha = 1;

  // Rain streaks.
  if (world.weather.rain > 0.15) {
    g.strokeStyle = 'rgba(170,200,255,' + (0.34 * world.weather.rain).toFixed(3) + ')';
    g.lineWidth = 1;
    g.beginPath();
    world.particles.rain.forEach(function (r) {
      g.moveTo(r.x, r.y);
      g.lineTo(r.x - r.len * 0.22, r.y + r.len);
    });
    g.stroke();
  }
  // Fog drift.
  if (world.weather.fog > 0.15) {
    world.particles.fog.forEach(function (f) {
      const grad = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      grad.addColorStop(0, 'rgba(180,190,220,' + (f.alpha * world.weather.fog).toFixed(3) + ')');
      grad.addColorStop(1, 'rgba(180,190,220,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      g.fill();
    });
  }

  // Tilt-shift finish: soft vignette + top/bottom falloff.
  const vig = g.createRadialGradient(640, 392, 300, 640, 392, 760);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.34)');
  g.fillStyle = vig;
  g.fillRect(0, NG_CONFIG.hudHeight, W, H - NG_CONFIG.hudHeight);
  const topFade = g.createLinearGradient(0, NG_CONFIG.hudHeight, 0, NG_CONFIG.hudHeight + 46);
  topFade.addColorStop(0, 'rgba(4,5,14,0.30)');
  topFade.addColorStop(1, 'rgba(4,5,14,0)');
  g.fillStyle = topFade;
  g.fillRect(0, NG_CONFIG.hudHeight, W, 46);
  const botFade = g.createLinearGradient(0, H - 46, 0, H);
  botFade.addColorStop(0, 'rgba(4,5,14,0)');
  botFade.addColorStop(1, 'rgba(4,5,14,0.30)');
  g.fillStyle = botFade;
  g.fillRect(0, H - 46, W, 46);

  g.restore();
}
