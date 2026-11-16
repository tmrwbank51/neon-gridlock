// Seeded random number generation for Neon Gridlock.
// Every random choice in the game flows through these streams so a run
// with a given seed replays identically for verification and screenshots.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next: next,
    range: function (lo, hi) { return lo + next() * (hi - lo); },
    int: function (lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); },
    pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
    chance: function (p) { return next() < p; },
    shuffle: function (arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i]; out[i] = out[j]; out[j] = tmp;
      }
      return out;
    },
    weighted: function (pairs) {
      let total = 0;
      for (let i = 0; i < pairs.length; i++) total += pairs[i][1];
      let roll = next() * total;
      for (let i = 0; i < pairs.length; i++) {
        roll -= pairs[i][1];
        if (roll <= 0) return pairs[i][0];
      }
      return pairs[pairs.length - 1][0];
    }
  };
}

// One RNG stream per concern: world layout never disturbs gameplay rolls.
function makeGameStreams(seed) {
  return {
    world: makeRng(seed ^ 0x9e3779b9),
    traffic: makeRng(seed ^ 0x51ed2703),
    people: makeRng(seed ^ 0x2a4b6e11),
    effects: makeRng(seed ^ 0x77c3a5d1)
  };
}
