// Neon Gridlock entrypoint: copies the game and its screenshots into the
// output directory and writes the dossier the gate compares byte for byte.
// Node standard library only; no network; deterministic across runs.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

const gameOut = join(outDir, 'game');
const shotsOut = join(outDir, 'screenshots');

mkdirSync(outDir, { recursive: true });
rmSync(gameOut, { recursive: true, force: true });
rmSync(shotsOut, { recursive: true, force: true });

const gameSrc = join(repoRoot, 'game');
const shotsSrc = join(repoRoot, 'screenshots');
if (!existsSync(gameSrc)) {
  throw new Error('game/ directory not found in repository');
}
cpSync(gameSrc, gameOut, { recursive: true });
if (existsSync(shotsSrc)) {
  cpSync(shotsSrc, shotsOut, { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
