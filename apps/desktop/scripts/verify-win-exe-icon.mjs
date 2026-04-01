/**
 * Post-build check: packaged Swiip.exe exists, is a PE file with a .rsrc section (icons + manifest).
 * If Explorer still shows the old Electron atom, delete the desktop shortcut and let the installer
 * recreate it, or refresh the icon cache (e.g. run: ie4uinit.exe -show).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const exePath = path.join(root, 'dist', 'win-unpacked', 'Swiip.exe');

if (!fs.existsSync(exePath)) {
  console.error(`verify-win-exe-icon: missing ${exePath} — run electron-builder first (packaging step).`);
  process.exit(1);
}

const buf = fs.readFileSync(exePath);
if (buf.length < 0x200 || buf.toString('ascii', 0, 2) !== 'MZ') {
  console.error('verify-win-exe-icon: not a valid MZ executable');
  process.exit(1);
}

const peOff = buf.readUInt32LE(0x3c);
if (buf.toString('ascii', peOff, peOff + 4) !== 'PE\0\0') {
  console.error('verify-win-exe-icon: PE signature not found');
  process.exit(1);
}

const numSections = buf.readUInt16LE(peOff + 6);
const optHeaderSize = buf.readUInt16LE(peOff + 20);
const coff = peOff + 24;
const sectionTable = coff + optHeaderSize;

let rsrc = null;
for (let i = 0; i < numSections; i++) {
  const o = sectionTable + i * 40;
  const name = buf.toString('utf8', o, o + 8).replace(/\0.*$/, '');
  if (name === '.rsrc') {
    const rawSize = buf.readUInt32LE(o + 16);
    const rawPtr = buf.readUInt32LE(o + 20);
    rsrc = { rawSize, rawPtr };
    break;
  }
}

if (!rsrc || rsrc.rawSize < 512) {
  console.error('verify-win-exe-icon: .rsrc section missing or unexpectedly small');
  process.exit(1);
}

console.log(
  `verify-win-exe-icon: OK — ${path.basename(exePath)} has .rsrc (rawSize=${rsrc.rawSize}, rawPtr=0x${rsrc.rawPtr.toString(16)})`
);
console.log(
  'verify-win-exe-icon: If the shortcut still shows the Electron logo, remove the shortcut and reinstall, or refresh the Windows icon cache.'
);
