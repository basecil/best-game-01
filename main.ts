// The hand-in program: copies game/ and screenshots/ into the output
// directory and writes dossier.json there with the kit's vendored builder.
// Usage: MAKEFUN_OUTPUT_DIR=out node main.ts
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = dirname(fileURLToPath(import.meta.url));
// In the grader MAKEFUN_OUTPUT_DIR is not set and /bot (the repo) is
// read-only, so the output MUST default to /output (the writable dir),
// exactly as the kit starter does. A repo-relative default ('out') makes
// mkdir throw on the read-only filesystem and the grade run exit non-zero.
// Never rm the output dir: in the grader /output is a MOUNTED volume, and
// rmdir on a mount point fails with EBUSY (round 2's run_completes failure).
// Like the starter, only mkdir + copy into it.
const out = resolve(root, process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

await mkdir(join(out, 'game'), { recursive: true });
await mkdir(join(out, 'screenshots'), { recursive: true });
await cp(join(root, 'game'), join(out, 'game'), { recursive: true });
await cp(join(root, 'screenshots'), join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
await writeFile(join(out, 'dossier.json'), dossier);
console.log(`dossier written: ${dossier.length} bytes -> ${join(out, 'dossier.json')}`);
