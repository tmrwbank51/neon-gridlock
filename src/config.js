// Tuning, wave definitions, upgrades and the neon-dusk palette.
// All balance numbers live here so the sim files stay readable.

var NG_CONFIG = {
  canvasWidth: 1280,
  canvasHeight: 720,
  hudHeight: 64,
  roadWidth: 56,
  laneOffset: 14,
  stopGap: 8,          // gap kept behind a stop line / the car ahead
  carLength: 26,
  fixedDt: 1 / 60,
  maxLives: 5,
  startLives: 3,
  totalWaves: 6,
  waveLengthSec: 52,
  intermissionSec: 999, // upgrade choice waits for the player
  minGreenSec: 2.0,
  minRedSec: 1.2,
  amberSec: 1.0,
  allRedClearSec: 0.0,
  jamCapacity: 7,       // queued cars on one approach before the jam meter climbs
  jamFillPerSec: 0.055,
  jamDrainPerSec: 0.10,
  comboPerExit: 0.12,
  comboMax: 5,
  comboDecayPerSec: 0.05,
  wreckClearSec: 5,
  maxCars: 64,
  maxPedestrians: 26,
  nearMissDist: 26,
  seedDefault: 20261116
};

// Vehicle archetypes: size in px, cruise speed px/s, score, spawn weight.
var NG_VEHICLES = {
  car:       { len: 26, wid: 13, speed: 92,  score: 10, weight: 46, colors: ['#ffd166', '#7bdff2', '#f7f7ff', '#ff6b9d', '#9bf6a3', '#c792ff'] },
  taxi:      { len: 26, wid: 13, speed: 100, score: 15, weight: 16, colors: ['#ffcf3d'] },
  bus:       { len: 44, wid: 15, speed: 62,  score: 25, weight: 9,  colors: ['#38e1c6', '#4d96ff'] },
  truck:     { len: 38, wid: 15, speed: 68,  score: 20, weight: 11, colors: ['#ff8c42', '#b8c0ff'] },
  ambulance: { len: 30, wid: 14, speed: 118, score: 150, weight: 0, colors: ['#ffffff'], emergency: true },
  firetruck: { len: 40, wid: 15, speed: 108, score: 150, weight: 0, colors: ['#ff3b30'], emergency: true }
};

// One wave: spawn pressure, weather, time of day, which intersection joins.
var NG_WAVES = [
  { name: 'Morning Calm',    spawnEvery: 1.55, emergencyEvery: 26, pedEvery: 3.4, weather: 'clear',  darkness: 0.10, activate: 0, rain: 0, fog: 0 },
  { name: 'First Commute',   spawnEvery: 1.30, emergencyEvery: 24, pedEvery: 3.0, weather: 'clear',  darkness: 0.22, activate: 1, rain: 0, fog: 0 },
  { name: 'Evening Rain',    spawnEvery: 1.12, emergencyEvery: 22, pedEvery: 2.7, weather: 'rain',   darkness: 0.38, activate: 2, rain: 1, fog: 0 },
  { name: 'Harbour Fog',     spawnEvery: 0.98, emergencyEvery: 20, pedEvery: 2.5, weather: 'fog',    darkness: 0.52, activate: 3, rain: 0, fog: 1 },
  { name: 'Neon Rush Hour',  spawnEvery: 0.82, emergencyEvery: 17, pedEvery: 2.2, weather: 'rain',   darkness: 0.66, activate: 4, rain: 1, fog: 0 },
  { name: 'Midnight Surge',  spawnEvery: 0.70, emergencyEvery: 15, pedEvery: 2.0, weather: 'storm',  darkness: 0.80, activate: 5, rain: 1, fog: 1 }
];

// Upgrades offered between waves: pick 1 of 3.
var NG_UPGRADES = [
  { id: 'life',      name: 'Extra Life',       icon: '+',  desc: '+1 life, up to 5. A second chance when the city bites back.' },
  { id: 'quick',     name: 'Quick Cycle',      icon: '>',  desc: 'Lights switch 40% faster. Amber phases shrink. Snappier control.' },
  { id: 'roundabout',name: 'Roundabout',       icon: 'O',  desc: 'Your busiest intersection becomes a roundabout: cars yield and flow on their own.' },
  { id: 'sensors',   name: 'Smart Sensors',    icon: '*',  desc: 'Lights glow with queue length and a hint arrow marks the approach that needs green most.' },
  { id: 'buslane',   name: 'Bus Lane',         icon: 'B',  desc: 'Buses score double and drive 25% faster.' },
  { id: 'tires',     name: 'Rain Tyres',       icon: '~',  desc: 'Rain no longer slows braking. Wet roads, same stopping power.' },
  { id: 'tow',       name: 'Tow Crew',         icon: 'T',  desc: 'Wrecks clear in 2 seconds instead of 5. Crashes hurt less.' },
  { id: 'siren',     name: 'Siren Priority',   icon: '!',  desc: 'Emergency patience +60% and emergency bonuses +50%.' },
  { id: 'bridge',    name: 'Sky Bridge',       icon: 'n',  desc: 'Pedestrians use a sky bridge at your busiest crossing. No more foot traffic there.' },
  { id: 'asphalt',   name: 'Smooth Asphalt',   icon: '=',  desc: 'Every vehicle drives 10% faster. The whole city flows.' }
];

var NG_PALETTE = {
  groundTop: '#23233d',
  groundBottom: '#141423',
  blockFill: '#1c1c30',
  blockEdge: '#2a2a48',
  roofA: '#2e2e4d',
  roofB: '#262640',
  roofC: '#34345c',
  windowLit: '#ffd166',
  windowDark: '#3a3a58',
  road: '#171724',
  roadEdge: '#0e0e18',
  laneDash: '#8f8fb8',
  stopLine: '#e8e8f0',
  crosswalk: '#d9d9e8',
  grass: '#14352a',
  grassEdge: '#1d4a3a',
  neonPink: '#ff4d8d',
  neonCyan: '#37e2ff',
  neonAmber: '#ffb02e',
  neonLime: '#7dff6a',
  neonViolet: '#b388ff',
  lampRed: '#ff3b30',
  lampAmber: '#ffb02e',
  lampGreen: '#2ee66b',
  hudBg: 'rgba(8, 9, 20, 0.88)',
  hudEdge: '#34345c'
};
