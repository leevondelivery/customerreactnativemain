const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

// 1. Read source App Icon.png
const projectRoot = path.resolve(__dirname, '..');
const srcPath = path.resolve(projectRoot, 'assets/images/App Icon.png');
const srcBuffer = fs.readFileSync(srcPath);
const srcPng = PNG.sync.read(srcBuffer);

const bgR = srcPng.data[0];
const bgG = srcPng.data[1];
const bgB = srcPng.data[2];

// 2. Find logo bounding box
let minX = srcPng.width, maxX = 0, minY = srcPng.height, maxY = 0;
for (let y = 0; y < srcPng.height; y++) {
  for (let x = 0; x < srcPng.width; x++) {
    const idx = (srcPng.width * y + x) << 2;
    const r = srcPng.data[idx];
    const g = srcPng.data[idx + 1];
    const b = srcPng.data[idx + 2];
    if (Math.abs(r - bgR) > 15 || Math.abs(g - bgG) > 15 || Math.abs(b - bgB) > 15) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

const logoW = maxX - minX + 1;
const logoH = maxY - minY + 1;
const logoCenterX = (minX + maxX) / 2;
const logoCenterY = (minY + maxY) / 2;

console.log(`Original logo bounding box: ${logoW}x${logoH} at center (${logoCenterX}, ${logoCenterY})`);

// Extract logo into a clean transparent PNG
function getPixelBilinear(x, y, removeBg = false) {
  const x0 = Math.max(0, Math.min(srcPng.width - 1, Math.floor(x)));
  const x1 = Math.max(0, Math.min(srcPng.width - 1, Math.ceil(x)));
  const y0 = Math.max(0, Math.min(srcPng.height - 1, Math.floor(y)));
  const y1 = Math.max(0, Math.min(srcPng.height - 1, Math.ceil(y)));

  const wx = x - x0;
  const wy = y - y0;

  function sample(px, py) {
    const idx = (srcPng.width * py + px) << 2;
    const r = srcPng.data[idx];
    const g = srcPng.data[idx + 1];
    const b = srcPng.data[idx + 2];
    let a = srcPng.data[idx + 3];

    if (removeBg) {
      // Calculate color distance from background
      const dist = Math.sqrt(
        (r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2
      );
      if (dist < 15) {
        a = 0;
      } else if (dist < 40) {
        a = Math.round((a * (dist - 15)) / 25);
      }
    }
    return [r, g, b, a];
  }

  const p00 = sample(x0, y0);
  const p10 = sample(x1, y0);
  const p01 = sample(x0, y1);
  const p11 = sample(x1, y1);

  const out = [];
  for (let c = 0; c < 4; c++) {
    const top = p00[c] * (1 - wx) + p10[c] * wx;
    const bot = p01[c] * (1 - wx) + p11[c] * wx;
    out[c] = Math.round(top * (1 - wy) + bot * wy);
  }
  return out;
}

// Generate an image of size (W, H)
// fitFraction: fraction of canvas width/height the logo should occupy (e.g. 0.58 for safe zone)
// fillBg: boolean, if true, fills background with #000000; if false, transparent
function renderIcon(targetSize, fitFraction = 0.58, fillBg = false, isCircleCrop = false) {
  const png = new PNG({ width: targetSize, height: targetSize });
  
  // Calculate scaling so logo occupies fitFraction of targetSize
  const maxLogoDim = Math.max(logoW, logoH);
  const targetLogoDim = targetSize * fitFraction;
  const scale = targetLogoDim / maxLogoDim;

  const halfT = targetSize / 2;
  const radius = targetSize / 2;

  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      const idx = (targetSize * y + x) << 2;

      if (isCircleCrop) {
        const dx = x - halfT;
        const dy = y - halfT;
        if (dx * dx + dy * dy > radius * radius) {
          png.data[idx] = 0;
          png.data[idx + 1] = 0;
          png.data[idx + 2] = 0;
          png.data[idx + 3] = 0;
          continue;
        }
      }

      // Map (x, y) back to source logo coordinates
      const srcX = logoCenterX + (x - halfT) / scale;
      const srcY = logoCenterY + (y - halfT) / scale;

      if (srcX >= 0 && srcX < srcPng.width && srcY >= 0 && srcY < srcPng.height) {
        const [r, g, b, a] = getPixelBilinear(srcX, srcY, !fillBg);
        if (fillBg) {
          png.data[idx] = r;
          png.data[idx + 1] = g;
          png.data[idx + 2] = b;
          png.data[idx + 3] = 255;
        } else {
          png.data[idx] = r;
          png.data[idx + 1] = g;
          png.data[idx + 2] = b;
          png.data[idx + 3] = a;
        }
      } else {
        if (fillBg) {
          png.data[idx] = bgR;
          png.data[idx + 1] = bgG;
          png.data[idx + 2] = bgB;
          png.data[idx + 3] = 255;
        } else {
          png.data[idx] = 0;
          png.data[idx + 1] = 0;
          png.data[idx + 2] = 0;
          png.data[idx + 3] = 0;
        }
      }
    }
  }

  return PNG.sync.write(png);
}

// 1. Generate high-res android-icon-foreground.png (1024x1024, transparent, fit 58% for perfect safe zone)
console.log('Generating assets/images/android-icon-foreground.png...');
const fg1024 = renderIcon(1024, 0.58, false);
fs.writeFileSync(path.resolve(projectRoot, 'assets/images/android-icon-foreground.png'), fg1024);

// 2. Generate standard icon.png (1024x1024, full black bg, fit 75%)
console.log('Generating assets/images/icon.png...');
const icon1024 = renderIcon(1024, 0.72, true);
fs.writeFileSync(path.resolve(projectRoot, 'assets/images/icon.png'), icon1024);

// 3. Android Mipmap densities
const densities = [
  { dir: 'mipmap-mdpi', fgSize: 108, iconSize: 48 },
  { dir: 'mipmap-hdpi', fgSize: 162, iconSize: 72 },
  { dir: 'mipmap-xhdpi', fgSize: 216, iconSize: 96 },
  { dir: 'mipmap-xxhdpi', fgSize: 324, iconSize: 144 },
  { dir: 'mipmap-xxxhdpi', fgSize: 432, iconSize: 192 },
];

const resDir = path.resolve(projectRoot, 'android/app/src/main/res');

for (const d of densities) {
  const targetDir = path.join(resDir, d.dir);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Remove existing .webp files if any to avoid AAPT collision
  ['ic_launcher_foreground.webp', 'ic_launcher.webp', 'ic_launcher_round.webp'].forEach(f => {
    const p = path.join(targetDir, f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });

  // 1. Adaptive foreground (fit 58%, transparent background)
  const fgBuf = renderIcon(d.fgSize, 0.58, false);
  fs.writeFileSync(path.join(targetDir, 'ic_launcher_foreground.png'), fgBuf);

  // 2. Legacy launcher square/rounded icon (fit 75%, black bg)
  const icBuf = renderIcon(d.iconSize, 0.72, true, false);
  fs.writeFileSync(path.join(targetDir, 'ic_launcher.png'), icBuf);

  // 3. Legacy launcher round icon (fit 70%, black bg, circular crop)
  const icRoundBuf = renderIcon(d.iconSize, 0.68, true, true);
  fs.writeFileSync(path.join(targetDir, 'ic_launcher_round.png'), icRoundBuf);

  console.log(`Generated ${d.dir} icons (foreground: ${d.fgSize}px, legacy: ${d.iconSize}px)`);
}

// 4. Android Splash Screen densities
const splashDensities = [
  { dir: 'drawable-mdpi', size: 288 },
  { dir: 'drawable-hdpi', size: 432 },
  { dir: 'drawable-xhdpi', size: 576 },
  { dir: 'drawable-xxhdpi', size: 864 },
  { dir: 'drawable-xxxhdpi', size: 1152 },
];

for (const d of splashDensities) {
  const targetDir = path.join(resDir, d.dir);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Splash icon with 60% safe zone to prevent any clipping on Android 12+ circular splash window
  const splashBuf = renderIcon(d.size, 0.60, false);
  fs.writeFileSync(path.join(targetDir, 'splashscreen_logo.png'), splashBuf);

  console.log(`Generated ${d.dir}/splashscreen_logo.png (${d.size}px)`);
}

// Generate assets/images/splash-icon.png
const splashIconBuf = renderIcon(512, 0.60, false);
fs.writeFileSync(path.resolve(projectRoot, 'assets/images/splash-icon.png'), splashIconBuf);
console.log('Generated assets/images/splash-icon.png');

console.log('All icons and splash screens generated successfully with safe zone margins!');
