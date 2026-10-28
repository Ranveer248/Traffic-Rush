// Copies the game (../capital-street) into www/, which Capacitor packs into the Android and iOS apps.
// The map tools and notes stay out of the app.
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', 'capital-street'), OUT = path.join(__dirname, 'www');
const SKIP = new Set(['tools', 'README.md', 'RESEARCH.md']);
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(SRC, OUT, { recursive: true, filter: f => !SKIP.has(path.relative(SRC, f).split(path.sep)[0]) });
let n = 0, bytes = 0;
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else { n++; bytes += fs.statSync(f).size; } } })(OUT);
console.log(`www: ${n} files, ${(bytes / 1048576).toFixed(1)} MB`);
