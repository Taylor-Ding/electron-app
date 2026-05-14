import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svgPath = 'public/icons/api_post.svg';
const buildDir = 'build';
const pngPath = path.join(buildDir, 'icon.png');

if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir);
}

// electron-builder uses build/icon.png automatically for mac and linux
// it also auto-generates ico/icns from the png.
// Let's create a 1024x1024 PNG from the SVG
sharp(svgPath)
  .resize(1024, 1024)
  .png()
  .toFile(pngPath)
  .then(() => {
    console.log(`Generated ${pngPath} successfully.`);
  })
  .catch(err => {
    console.error('Error generating icon:', err);
  });
