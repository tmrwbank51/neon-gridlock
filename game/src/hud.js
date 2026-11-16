// HUD, banners and menu overlays. Buttons register their rectangles in
// world.ui.buttons every frame so input.js can hit-test them.

var NG_FONT = 'Trebuchet MS, Verdana, sans-serif';

function hudButton(g, world, id, x, y, w, h, label, active) {
  const hover = world.mouse && world.mouse.x >= x && world.mouse.x <= x + w && world.mouse.y >= y && world.mouse.y <= y + h;
  g.fillStyle = hover ? '#2c2c4e' : 'rgba(20,20,40,0.9)';
  rr(g, x, y, w, h, 7);
  g.fill();
  g.strokeStyle = active ? '#37e2ff' : '#4a4a72';
  g.lineWidth = active ? 2 : 1;
  rr(g, x, y, w, h, 7);
  g.stroke();
  g.fillStyle = active ? '#37e2ff' : '#e8e8f5';
  g.font = 'bold 13px ' + NG_FONT;
  g.textAlign = 'center';
  g.fillText(label, x + w / 2, y + h / 2 + 5);
  world.ui.buttons.push({ id: id, x: x, y: y, w: w, h: h });
}

function drawHUD(g, world) {
  const W = NG_CONFIG.canvasWidth;
  const H = NG_CONFIG.hudHeight;
  world.ui.buttons = [];
  g.fillStyle = NG_PALETTE.hudBg;
  g.fillRect(0, 0, W, H);
  g.fillStyle = NG_PALETTE.hudEdge;
  g.fillRect(0, H - 2, W, 2);

  // Score.
  g.textAlign = 'left';
  g.fillStyle = '#8f8fb8';
  g.font = 'bold 11px ' + NG_FONT;
  g.fillText('SCORE', 16, 20);
  g.fillStyle = '#ffffff';
  g.font = 'bold 26px ' + NG_FONT;
  g.fillText(String(world.score), 16, 48);

  // Combo multiplier + flow bar.
  const mult = world.combo;
  const mx = 150;
  g.fillStyle = '#8f8fb8';
  g.font = 'bold 11px ' + NG_FONT;
  g.fillText('FLOW', mx, 20);
  const pulse = world.comboPulse > 0 ? 1 + world.comboPulse * 0.35 : 1;
  g.save();
  g.translate(mx + 24, 40);
  g.scale(pulse, pulse);
  g.fillStyle = mult >= 3 ? '#7dff6a' : mult >= 2 ? '#ffd166' : '#e8e8f5';
  g.font = 'bold 22px ' + NG_FONT;
  g.textAlign = 'center';
  g.fillText('x' + mult.toFixed(1), 0, 8);
  g.restore();
  g.fillStyle = '#2c2c4e';
  rr(g, mx + 52, 32, 74, 9, 4);
  g.fill();
  g.fillStyle = mult >= 3 ? '#7dff6a' : '#ffd166';
  const frac = (mult - 1) / (NG_CONFIG.comboMax - 1);
  if (frac > 0) {
    rr(g, mx + 52, 32, 74 * Math.min(1, frac), 9, 4);
    g.fill();
  }

  // Wave + progress.
  const cx = 430;
  const def = NG_WAVES[Math.min(world.director.waveIndex, NG_WAVES.length - 1)];
  g.fillStyle = '#8f8fb8';
  g.font = 'bold 11px ' + NG_FONT;
  g.textAlign = 'left';
  g.fillText('WAVE ' + (world.director.waveIndex + 1) + ' / ' + NG_CONFIG.totalWaves + '  ·  ' + def.name.toUpperCase(), cx, 20);
  g.fillStyle = '#2c2c4e';
  rr(g, cx, 30, 210, 10, 5);
  g.fill();
  const wfrac = world.director.waveTime / NG_CONFIG.waveLengthSec;
  g.fillStyle = '#37e2ff';
  rr(g, cx, 30, 210 * Math.min(1, wfrac), 10, 5);
  g.fill();
  g.fillStyle = '#c9c9e0';
  g.font = '11px ' + NG_FONT;
  const remain = Math.max(0, NG_CONFIG.waveLengthSec - world.director.waveTime);
  g.fillText(Math.ceil(remain) + 's left', cx + 220, 39);

  // Throughput + lives.
  g.fillStyle = '#8f8fb8';
  g.font = 'bold 11px ' + NG_FONT;
  g.fillText('PASSED', 700, 20);
  g.fillStyle = '#ffffff';
  g.font = 'bold 20px ' + NG_FONT;
  g.fillText(String(world.throughput), 700, 46);
  g.fillStyle = '#8f8fb8';
  g.font = 'bold 11px ' + NG_FONT;
  g.fillText('LIVES', 790, 20);
  for (let i = 0; i < NG_CONFIG.maxLives; i++) {
    const hx = 790 + i * 22;
    const hy = 38;
    g.fillStyle = i < world.lives ? '#ff4d6d' : '#2c2c4e';
    g.beginPath();
    g.moveTo(hx, hy + 4);
    g.bezierCurveTo(hx - 8, hy - 4, hx - 4, hy - 10, hx, hy - 5);
    g.bezierCurveTo(hx + 4, hy - 10, hx + 8, hy - 4, hx, hy + 4);
    g.fill();
  }

  // Jam meter (only when it matters).
  if (world.jam > 0.02) {
    const jx = 920;
    g.fillStyle = world.jam > 0.7 ? '#ff3b30' : '#ffb02e';
    g.font = 'bold 11px ' + NG_FONT;
    g.fillText('JAM', jx, 20);
    g.fillStyle = '#2c2c4e';
    rr(g, jx, 30, 90, 10, 5);
    g.fill();
    g.fillStyle = world.jam > 0.7 ? '#ff3b30' : '#ffb02e';
    rr(g, jx, 30, 90 * Math.min(1, world.jam), 10, 5);
    g.fill();
  }

  // Buttons.
  hudButton(g, world, 'speed', 1040, 15, 46, 34, world.speed === 2 ? '2x' : '1x', world.speed === 2);
  hudButton(g, world, 'mute', 1092, 15, 46, 34, NG_Audio.isMuted() ? 'OFF' : 'SND', false);
  hudButton(g, world, 'pause', 1144, 15, 46, 34, world.phase === 'paused' ? 'GO' : 'II', world.phase === 'paused');
  hudButton(g, world, 'restart', 1196, 15, 46, 34, 'R', false);

  // Controls hint, bottom-left of the play area.
  if (world.phase === 'playing') {
    g.fillStyle = 'rgba(8,9,20,0.62)';
    rr(g, 10, NG_CONFIG.canvasHeight - 30, 560, 22, 6);
    g.fill();
    g.fillStyle = '#a9a9c9';
    g.font = '12px ' + NG_FONT;
    g.textAlign = 'left';
    g.fillText('Click a traffic light to switch it  ·  Keys 1-6 select, arrows switch  ·  Space pause  ·  M sound', 20, NG_CONFIG.canvasHeight - 15);
  }
}

function drawBanner(g, world) {
  const b = world.banner;
  if (!b || b.timer <= 0) return;
  const alpha = Math.min(1, b.timer);
  const cx = NG_CONFIG.canvasWidth / 2;
  const y = 108;
  g.save();
  g.globalAlpha = alpha;
  g.font = 'bold 30px ' + NG_FONT;
  const w = g.measureText(b.text).width + 56;
  g.fillStyle = b.alert ? 'rgba(60,10,14,0.88)' : 'rgba(8,9,20,0.88)';
  rr(g, cx - w / 2, y - 32, w, 62, 10);
  g.fill();
  g.strokeStyle = b.alert ? '#ff3b30' : '#37e2ff';
  g.lineWidth = 2;
  rr(g, cx - w / 2, y - 32, w, 62, 10);
  g.stroke();
  g.fillStyle = b.alert ? '#ff8a80' : '#ffffff';
  g.textAlign = 'center';
  g.fillText(b.text, cx, y - 4);
  g.font = '13px ' + NG_FONT;
  g.fillStyle = '#c9c9e0';
  g.fillText(b.sub, cx, y + 18);
  g.restore();
}

function neonTitle(g, text, x, y, size, color) {
  g.font = 'bold ' + size + 'px ' + NG_FONT;
  g.textAlign = 'center';
  g.fillStyle = color;
  g.globalAlpha = 0.25;
  g.fillText(text, x, y + 3);
  g.fillText(text, x, y - 3);
  g.globalAlpha = 0.5;
  g.fillText(text, x, y + 1);
  g.globalAlpha = 1;
  g.fillStyle = '#ffffff';
  g.fillText(text, x, y);
}

function bigButton(g, world, id, x, y, w, h, label, sub) {
  const hover = world.mouse && world.mouse.x >= x && world.mouse.x <= x + w && world.mouse.y >= y && world.mouse.y <= y + h;
  g.fillStyle = hover ? '#1f7a8c' : '#155e6e';
  rr(g, x, y, w, h, 12);
  g.fill();
  g.strokeStyle = '#37e2ff';
  g.lineWidth = 2;
  rr(g, x, y, w, h, 12);
  g.stroke();
  g.fillStyle = '#ffffff';
  g.font = 'bold 24px ' + NG_FONT;
  g.textAlign = 'center';
  g.fillText(label, x + w / 2, y + (sub ? h / 2 - 2 : h / 2 + 8));
  if (sub) {
    g.font = '13px ' + NG_FONT;
    g.fillStyle = '#bfefff';
    g.fillText(sub, x + w / 2, y + h / 2 + 22);
  }
  world.ui.buttons.push({ id: id, x: x, y: y, w: w, h: h });
}

function drawStartScreen(g, world) {
  const W = NG_CONFIG.canvasWidth;
  g.fillStyle = 'rgba(4,5,14,0.52)';
  g.fillRect(0, 0, W, NG_CONFIG.canvasHeight);
  // Skyline silhouette strip behind the title.
  const horizon = g.createLinearGradient(0, 40, 0, 230);
  horizon.addColorStop(0, 'rgba(55,226,255,0.14)');
  horizon.addColorStop(1, 'rgba(55,226,255,0)');
  g.fillStyle = horizon;
  g.fillRect(0, 40, W, 190);
  g.fillStyle = 'rgba(16,16,34,0.92)';
  g.beginPath();
  g.moveTo(0, 210);
  const tops = [150, 120, 165, 105, 150, 130, 170, 115, 155, 140, 168, 118, 152, 132, 160];
  const step = W / tops.length;
  for (let i = 0; i < tops.length; i++) {
    g.lineTo(i * step, tops[i]);
    g.lineTo((i + 1) * step - 6, tops[i]);
  }
  g.lineTo(W, 210);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,209,102,0.5)';
  for (let i = 0; i < 40; i++) {
    const wx = (i * 167) % W;
    const wy = 130 + ((i * 53) % 70);
    g.fillRect(wx, wy, 3, 4);
  }
  neonTitle(g, 'NEON GRIDLOCK', W / 2, 118, 64, '#37e2ff');
  g.font = 'bold 19px ' + NG_FONT;
  g.fillStyle = '#ffd166';
  g.textAlign = 'center';
  g.fillText('RUSH-HOUR TRAFFIC CONTROLLER', W / 2, 152);

  // How-to panel.
  const px = W / 2 - 330;
  const py = 236;
  g.fillStyle = 'rgba(8,9,20,0.9)';
  rr(g, px, py, 660, 178, 12);
  g.fill();
  g.strokeStyle = '#34345c';
  g.lineWidth = 1.5;
  rr(g, px, py, 660, 178, 12);
  g.stroke();
  const lines = [
    ['GOAL', 'Keep the city flowing through 6 waves, from morning calm to the midnight surge.'],
    ['LIGHTS', 'Click any traffic light (or keys 1-6 + arrows) to switch it. Conflicting greens crash!'],
    ['FLOW', 'Smooth exits build your combo multiplier. Jams, crashes and delays break it.'],
    ['PRIORITY', 'Ambulances and fire trucks must not wait. Pedestrians cross on the walk signal.'],
    ['UPGRADES', 'After every wave, pick 1 of 3 upgrades: roundabouts, smart sensors, sky bridges...']
  ];
  g.textAlign = 'left';
  lines.forEach(function (line, i) {
    const y = py + 34 + i * 30;
    g.fillStyle = '#37e2ff';
    g.font = 'bold 14px ' + NG_FONT;
    g.fillText(line[0], px + 26, y);
    g.fillStyle = '#d8d8ea';
    g.font = '14px ' + NG_FONT;
    g.fillText(line[1], px + 118, y);
  });

  bigButton(g, world, 'start', W / 2 - 150, 448, 300, 62, 'START SHIFT', 'or press Enter');
  g.font = '13px ' + NG_FONT;
  g.fillStyle = '#8f8fb8';
  g.textAlign = 'center';
  let bestLine = 'Seed ' + world.seed + '  ·  Every run is replayable from its seed';
  if (world.bestScore > 0) bestLine += '  ·  Best score: ' + world.bestScore;
  g.fillText(bestLine, W / 2, 546);
  g.fillText('A tiny neon city, drawn live. No two rush hours play the same.', W / 2, 570);
}

function drawUpgradeScreen(g, world) {
  const W = NG_CONFIG.canvasWidth;
  g.fillStyle = 'rgba(4,5,14,0.66)';
  g.fillRect(0, 0, W, NG_CONFIG.canvasHeight);
  neonTitle(g, 'WAVE ' + (world.director.waveIndex + 1) + ' CLEAR', W / 2, 128, 40, '#7dff6a');
  g.font = '17px ' + NG_FONT;
  g.fillStyle = '#d8d8ea';
  g.textAlign = 'center';
  g.fillText('Traffic kept moving. Choose one upgrade before the next wave.', W / 2, 160);
  const offer = world.director.offer || [];
  const cardW = 270;
  const cardH = 290;
  const gap = 28;
  const totalW = offer.length * cardW + (offer.length - 1) * gap;
  let x = W / 2 - totalW / 2;
  const y = 210;
  offer.forEach(function (up, i) {
    const hover = world.mouse && world.mouse.x >= x && world.mouse.x <= x + cardW && world.mouse.y >= y && world.mouse.y <= y + cardH;
    g.fillStyle = hover ? 'rgba(30,34,66,0.97)' : 'rgba(14,15,32,0.97)';
    rr(g, x, y, cardW, cardH, 14);
    g.fill();
    g.strokeStyle = hover ? '#37e2ff' : '#4a4a72';
    g.lineWidth = hover ? 2.5 : 1.5;
    rr(g, x, y, cardW, cardH, 14);
    g.stroke();
    // Icon medallion.
    g.fillStyle = '#155e6e';
    g.beginPath();
    g.arc(x + cardW / 2, y + 66, 34, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = 'bold 34px ' + NG_FONT;
    g.textAlign = 'center';
    g.fillText(up.icon, x + cardW / 2, y + 78);
    g.fillStyle = '#ffffff';
    g.font = 'bold 20px ' + NG_FONT;
    g.fillText(up.name, x + cardW / 2, y + 138);
    // Wrapped description.
    g.font = '14px ' + NG_FONT;
    g.fillStyle = '#c9c9e0';
    const words = up.desc.split(' ');
    let line = '';
    let ly = y + 168;
    words.forEach(function (word) {
      const test = line ? line + ' ' + word : word;
      if (g.measureText(test).width > cardW - 44 && line) {
        g.fillText(line, x + cardW / 2, ly);
        ly += 21;
        line = word;
      } else {
        line = test;
      }
    });
    if (line) g.fillText(line, x + cardW / 2, ly);
    g.fillStyle = '#8f8fb8';
    g.font = '12px ' + NG_FONT;
    g.fillText('Press ' + (i + 1), x + cardW / 2, y + cardH - 18);
    world.ui.buttons.push({ id: 'upgrade:' + up.id, x: x, y: y, w: cardW, h: cardH });
    x += cardW + gap;
  });
  g.font = '13px ' + NG_FONT;
  g.fillStyle = '#8f8fb8';
  g.fillText('Score ' + world.score + '  ·  ' + world.throughput + ' vehicles passed  ·  ' + world.lives + ' lives left', W / 2, 548);
}

function drawPauseScreen(g, world) {
  const W = NG_CONFIG.canvasWidth;
  g.fillStyle = 'rgba(4,5,14,0.6)';
  g.fillRect(0, 0, W, NG_CONFIG.canvasHeight);
  neonTitle(g, 'PAUSED', W / 2, 250, 52, '#37e2ff');
  g.font = '16px ' + NG_FONT;
  g.fillStyle = '#d8d8ea';
  g.textAlign = 'center';
  g.fillText('The city holds its breath. Lights frozen, horns silent.', W / 2, 288);
  bigButton(g, world, 'resume', W / 2 - 150, 330, 300, 56, 'RESUME', 'Space');
  bigButton(g, world, 'restart', W / 2 - 150, 402, 300, 56, 'RESTART RUN', 'R');
}

function drawEndScreen(g, world, victory) {
  const W = NG_CONFIG.canvasWidth;
  g.fillStyle = victory ? 'rgba(6,20,12,0.68)' : 'rgba(20,6,10,0.68)';
  g.fillRect(0, 0, W, NG_CONFIG.canvasHeight);
  neonTitle(g, victory ? 'CITY SAVED!' : 'GRIDLOCK!', W / 2, 168, 56, victory ? '#7dff6a' : '#ff4d6d');
  g.font = '18px ' + NG_FONT;
  g.fillStyle = '#e8e8f5';
  g.textAlign = 'center';
  g.fillText(victory ? 'Every wave survived. The neon city flows because of you.'
    : 'The city ground to a halt. The horns fade into the neon night.', W / 2, 204);
  // Score panel.
  const px = W / 2 - 260;
  const py = 240;
  g.fillStyle = 'rgba(8,9,20,0.92)';
  rr(g, px, py, 520, 168, 12);
  g.fill();
  g.strokeStyle = '#34345c';
  g.lineWidth = 1.5;
  rr(g, px, py, 520, 168, 12);
  g.stroke();
  g.fillStyle = '#8f8fb8';
  g.font = 'bold 12px ' + NG_FONT;
  g.fillText('FINAL SCORE', W / 2, py + 28);
  g.fillStyle = '#ffffff';
  g.font = 'bold 44px ' + NG_FONT;
  g.fillText(String(world.score), W / 2, py + 74);
  const stats = world.endStats || {
    throughput: world.throughput, crashes: world.crashes,
    nearMisses: world.nearMisses, emergencies: world.emergenciesSaved
  };
  g.font = '14px ' + NG_FONT;
  g.fillStyle = '#c9c9e0';
  g.fillText(stats.throughput + ' vehicles passed   ·   ' + stats.crashes + ' crashes   ·   ' +
    stats.nearMisses + ' near misses   ·   ' + stats.emergencies + ' emergencies saved', W / 2, py + 108);
  g.fillStyle = '#8f8fb8';
  g.font = '13px ' + NG_FONT;
  g.fillText('Best score: ' + Math.max(world.bestScore, world.score) + '  ·  Seed ' + world.seed, W / 2, py + 136);
  bigButton(g, world, 'restart', W / 2 - 150, 448, 300, 62, 'PLAY AGAIN', 'or press R');
}

function drawOverlays(g, world) {
  if (world.phase === 'menu') drawStartScreen(g, world);
  else if (world.phase === 'upgrade') drawUpgradeScreen(g, world);
  else if (world.phase === 'paused') drawPauseScreen(g, world);
  else if (world.phase === 'gameover') drawEndScreen(g, world, false);
  else if (world.phase === 'victory') drawEndScreen(g, world, true);
}
