/** @type {import('next').NextConfig} */
const fs = require('fs');
const path = require('path');

// Deploy safety: ensure public/fonts/melodrame.ttf exists at build time so next/font/local doesn't crash
const fontDir = path.join(__dirname, 'public', 'fonts');
const fontPath = path.join(fontDir, 'melodrame.ttf');
const fallbackMarker = path.join(fontDir, '.is-fallback');

if (!fs.existsSync(fontPath)) {
  fs.mkdirSync(fontDir, { recursive: true });
  const fallbackSource = path.join(__dirname, 'node_modules', 'three', 'examples', 'fonts', 'ttf', 'kenpixel.ttf');
  if (fs.existsSync(fallbackSource)) {
    fs.copyFileSync(fallbackSource, fontPath);
    fs.writeFileSync(fallbackMarker, 'true');
  }
} else if (fs.existsSync(fallbackMarker) && fs.statSync(fontPath).size > 50000) {
  // If a real melodrame.ttf was provided (> 50KB), remove the fallback marker
  try { fs.unlinkSync(fallbackMarker); } catch (_) {}
}

const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['images.unsplash.com', 'source.unsplash.com'],
  },
  // Add any other Next.js config options here
};

module.exports = nextConfig;
