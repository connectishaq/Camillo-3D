/*
 * Web versions of the hero video (project-assets/high.mp4):
 *   public/videos/hero-1920.mp4   desktop, H.264, 30 fps, no audio, fast start, at SPEED×
 *   public/videos/hero-1280.mp4   phones and small screens
 *   public/videos/hero-poster.webp  first frame: shown instantly, and instead of the video
 *                                   for reduced motion / data saver
 * Needs ffmpeg: on PATH, or its path in FFMPEG. Run `npm run video`, then commit the files.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const src = path.join(root, 'project-assets/high.mp4');
const out = path.join(root, 'public/videos');
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
fs.mkdirSync(out, { recursive: true });
/** Playback speed-up: the 20 s original becomes a ~10 s film (the hero's first slide lasts one play). */
const SPEED = 2;

const run = (args) => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, ...args], { stdio: 'inherit' });
const h264 = (width, crf) => [
  '-an',
  '-vf',
  `setpts=PTS/${SPEED},scale=${width}:-2,fps=30`,
  '-c:v',
  'libx264',
  '-preset',
  'slow',
  '-crf',
  String(crf),
  '-profile:v',
  'high',
  '-pix_fmt',
  'yuv420p',
  '-movflags',
  '+faststart',
];

run([...h264(1920, 29), path.join(out, 'hero-1920.mp4')]);
run([...h264(1280, 29), path.join(out, 'hero-1280.mp4')]);
const frame = path.join(out, 'poster.png');
run(['-frames:v', '1', '-vf', 'scale=1920:-2', frame]);
await sharp(frame).webp({ quality: 74 }).toFile(path.join(out, 'hero-poster.webp'));
fs.rmSync(frame);
for (const f of fs.readdirSync(out)) console.log(`public/videos/${f}`, `${Math.round(fs.statSync(path.join(out, f)).size / 1024)} kB`);
