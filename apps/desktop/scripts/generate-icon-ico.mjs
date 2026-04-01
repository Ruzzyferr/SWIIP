/**
 * Rebuilds build/icon.ico from build/icon-{16,32,...}.png layers.
 * BMP-friendly ICO from png-to-ico improves Windows PE icon embedding vs some PNG-only ICO exports.
 */
import pngToIco from 'png-to-ico';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.join(__dirname, '..', 'build');
const sizes = [16, 32, 48, 64, 128, 256];
const inputs = sizes
  .map((s) => path.join(buildDir, `icon-${s}.png`))
  .filter((p) => fs.existsSync(p));

if (inputs.length === 0) {
  console.error('generate-icon-ico: no build/icon-*.png sources found');
  process.exit(1);
}

const buf = await pngToIco(inputs);
const out = path.join(buildDir, 'icon.ico');
fs.writeFileSync(out, buf);
console.log(`generate-icon-ico: wrote ${out} (${inputs.length} sizes)`);
