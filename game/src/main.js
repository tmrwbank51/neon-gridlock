// Boot: canvas setup, the fixed-step loop, URL parameters for probes,
// and the probe API (window.__game / window.__shotReady).

(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const params = new URLSearchParams(window.location.search);
  const seedParam = parseInt(params.get('seed') || '', 10);
  const seed = Number.isFinite(seedParam) ? (seedParam >>> 0) : NG_CONFIG.seedDefault;

  const world = createWorld(seed);
  bindInput(canvas, world);

  const scene = params.get('scene') || '';
  if (scene) {
    setScene(world, scene);
  } else {
    setupAttract(world);
  }
  if (params.get('autoplay') === '1') {
    world.autoplay = true;
    if (world.phase === 'menu') startRun(world);
  }
  const speedParam = parseInt(params.get('speed') || '', 10);
  if (speedParam === 2) world.speed = 2;

  // Fixed-step loop: 60 ticks per second, 1x or 2x.
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const elapsed = Math.min(0.25, (now - last) / 1000);
    last = now;
    acc += elapsed;
    const dt = NG_CONFIG.fixedDt;
    let steps = 0;
    const maxSteps = 4 * world.speed;
    while (acc >= dt && steps < maxSteps) {
      if (world.phase !== 'paused') {
        for (let s = 0; s < world.speed; s++) updateWorld(world, dt);
      }
      acc -= dt;
      steps++;
    }
    if (steps >= maxSteps) acc = 0;

    world.ui.buttons = [];
    ctx.clearRect(0, 0, NG_CONFIG.canvasWidth, NG_CONFIG.canvasHeight);
    drawWorld(ctx, world, world.time);
    if (world.phase === 'playing' || world.phase === 'paused' || world.phase === 'upgrade') {
      drawHUD(ctx, world);
    }
    drawBanner(ctx, world);
    drawOverlays(ctx, world);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Probe API: state inspection, scene setup and verification sweeps.
  window.__game = {
    world: world,
    version: 'neon-gridlock-1',
    get state() { return world.phase; },
    get score() { return world.score; },
    get wave() { return world.director.waveIndex + 1; },
    get lives() { return world.lives; },
    get cars() { return world.cars.length; },
    get throughput() { return world.throughput; },
    get combo() { return world.combo; },
    get seed() { return world.seed; },
    start: function () { startRun(world); },
    restart: function () { restartRun(world); },
    setScene: function (name) { setScene(world, name); },
    toggle: function (node, approach) { toggleApproach(world, node, approach); },
    setAutoplay: function (on) { world.autoplay = !!on; },
    runSweep: function (seeds, opts) { return runSweep(seeds, opts); },
    fastForward: function (seconds, useAutoplay) { fastForward(world, seconds, useAutoplay); }
  };
  Object.defineProperty(window, '__shotReady', {
    get: function () { return world.shotReady || world.phase !== 'menu' || world.time > 1; },
    configurable: true
  });
  if (scene) world.shotReady = true;
})();
