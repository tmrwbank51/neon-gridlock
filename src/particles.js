// Particles, floating score popups, rain streaks, fog drift and screen
// shake. All cosmetic: nothing here changes the simulation.

function makeParticles() {
  return { list: [], popups: [], rain: [], fog: [], shake: 0, shakeX: 0, shakeY: 0 };
}

function burst(particles, x, y, opts) {
  const n = opts.count || 10;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = opts.speed * (0.3 + Math.random() * 0.9);
    particles.list.push({
      x: x, y: y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: opts.life * (0.6 + Math.random() * 0.7),
      maxLife: opts.life,
      size: opts.size * (0.6 + Math.random() * 0.8),
      color: opts.color,
      gravity: opts.gravity || 0,
      drag: opts.drag || 0.92,
      grow: opts.grow || 0
    });
  }
}

function crashBurst(particles, x, y) {
  burst(particles, x, y, { count: 22, speed: 130, life: 0.7, size: 3.2, color: '#ffcf3d', gravity: 160 });
  burst(particles, x, y, { count: 10, speed: 60, life: 1.1, size: 5, color: '#ff6b35', gravity: 60 });
  burst(particles, x, y, { count: 8, speed: 26, life: 1.8, size: 9, color: 'rgba(120,120,140,0.55)', grow: 14 });
}

function smokePuff(particles, x, y) {
  burst(particles, x, y, { count: 1, speed: 8, life: 1.4, size: 7, color: 'rgba(140,140,160,0.5)', grow: 16 });
}

function splashRing(particles, x, y) {
  particles.list.push({
    x: x, y: y, vx: 0, vy: 0, life: 0.4, maxLife: 0.4,
    size: 3, color: 'rgba(160,200,255,0.7)', gravity: 0, drag: 1, grow: 26, ring: true
  });
}

function addPopup(particles, x, y, text, color, big) {
  particles.popups.push({ x: x, y: y, text: text, color: color || '#ffffff', life: 1.2, maxLife: 1.2, big: !!big });
  if (particles.popups.length > 24) particles.popups.shift();
}

function addShake(particles, amount) {
  particles.shake = Math.max(particles.shake, amount);
}

function initWeather(particles, rng, width, height) {
  particles.rain = [];
  for (let i = 0; i < 220; i++) {
    particles.rain.push({ x: rng.range(0, width), y: rng.range(0, height), len: rng.range(9, 18), speed: rng.range(420, 620) });
  }
  particles.fog = [];
  for (let i = 0; i < 7; i++) {
    particles.fog.push({ x: rng.range(0, width), y: rng.range(64, height), r: rng.range(90, 190), vx: rng.range(6, 16), alpha: rng.range(0.05, 0.10) });
  }
}

function updateParticles(particles, dt, weather, width, height) {
  const list = particles.list;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) { list.splice(i, 1); continue; }
    p.vy += p.gravity * dt;
    p.vx *= p.drag;
    p.vy *= p.drag;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.grow) p.size += p.grow * dt;
  }
  if (list.length > 400) list.splice(0, list.length - 400);
  for (let i = particles.popups.length - 1; i >= 0; i--) {
    const p = particles.popups[i];
    p.life -= dt;
    p.y -= 34 * dt;
    if (p.life <= 0) particles.popups.splice(i, 1);
  }
  // Rain streaks fall diagonally; splash rings where they land.
  if (weather.rain > 0) {
    for (let i = 0; i < particles.rain.length; i++) {
      const r = particles.rain[i];
      r.y += r.speed * dt;
      r.x += r.speed * 0.22 * dt;
      if (r.y > height) {
        r.y = 60;
        r.x = Math.random() * width;
        if (Math.random() < 0.3) splashRing(particles, r.x, height - Math.random() * 60);
      }
      if (r.x > width) r.x = 0;
    }
  }
  if (weather.fog > 0) {
    for (let i = 0; i < particles.fog.length; i++) {
      const f = particles.fog[i];
      f.x += f.vx * dt;
      if (f.x - f.r > width) { f.x = -f.r; f.y = 64 + Math.random() * (height - 64); }
    }
  }
  if (particles.shake > 0) {
    particles.shake = Math.max(0, particles.shake - dt * 26);
    particles.shakeX = (Math.random() * 2 - 1) * particles.shake;
    particles.shakeY = (Math.random() * 2 - 1) * particles.shake;
  } else {
    particles.shakeX = 0;
    particles.shakeY = 0;
  }
}
