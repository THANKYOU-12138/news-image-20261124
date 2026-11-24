// news-image-20261124 — "The World in One Picture"
// A world-map-centred front page summing up Tuesday 24 November 2026.
// Hand-written from scratch: software rasteriser, 5x7 bitmap font,
// stored-block DEFLATE + CRC32/Adler32 PNG encoder. Node 22 stdlib only,
// no network, no randomness, no dates at runtime — fully deterministic.

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------- palette ----------
const NAVY: RGB = [10, 27, 51]; // deep navy background
const OCEAN: RGB = [13, 35, 66]; // map panel
const GRID: RGB = [22, 48, 79]; // graticule lines
const LAND: RGB = [53, 104, 138]; // continents
const LAND_EDGE: RGB = [120, 165, 195]; // continent outline
const CREAM: RGB = [245, 237, 216]; // headline text
const GOLD: RGB = [227, 179, 65]; // gold accents
const GOLD_DIM: RGB = [201, 168, 106]; // subline text
const MUTED: RGB = [159, 179, 200]; // quiet text
const DARK: RGB = [10, 27, 51]; // text on gold

type RGB = [number, number, number];

// ---------- framebuffer ----------
const px = new Uint8Array(W * H * 3);

function fillAll(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = c[0];
    px[i * 3 + 1] = c[1];
    px[i * 3 + 2] = c[2];
  }
}

function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) setPixel(i, j, c);
  }
}

function drawLine(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    setPixel(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = cy - r; y <= cy + r; y++) {
    const dy = y - cy;
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    for (let x = cx - dx; x <= cx + dx; x++) setPixel(x, y, c);
  }
}

function drawCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    setPixel(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad)), c);
  }
}

// Even-odd scanline polygon fill.
function fillPolygon(pts: Array<[number, number]>, c: RGB): void {
  let minY = H;
  let maxY = 0;
  for (const p of pts) {
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        const t = (y - a[1]) / (b[1] - a[1]);
        xs.push(Math.round(a[0] + t * (b[0] - a[0])));
      }
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = xs[k]; x <= xs[k + 1]; x++) setPixel(x, y, c);
    }
  }
}

function strokePolygon(pts: Array<[number, number]>, c: RGB): void {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    drawLine(a[0], a[1], b[0], b[1], c);
  }
}

// ---------- 5x7 bitmap font (hand-written glyphs) ----------
// Each glyph: 7 rows, bit 4 = leftmost column.
const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  ":": [0, 0x04, 0x04, 0, 0x04, 0x04, 0],
  ";": [0, 0x04, 0x04, 0, 0x0c, 0x04, 0x08],
  "-": [0, 0, 0, 0x0e, 0, 0, 0],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  "/": [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "+": [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  "%": [0x19, 0x19, 0x02, 0x04, 0x08, 0x13, 0x13],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04],
  "=": [0, 0, 0x1f, 0, 0x1f, 0, 0],
  "\u2022": [0, 0x04, 0x0e, 0x0e, 0x04, 0, 0],
};

function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}

function drawText(s: string, x: number, y: number, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s) {
    const g = FONT[ch] ?? FONT["?"];
    for (let row = 0; row < 7; row++) {
      const bits = g[row];
      for (let col = 0; col < 5; col++) {
        if (bits & (1 << (4 - col))) {
          fillRect(cx + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
}

function drawTextCentered(s: string, y: number, scale: number, c: RGB): void {
  drawText(s, Math.round((W - textWidth(s, scale)) / 2), y, scale, c);
}

// ---------- PNG encoder (stored DEFLATE, hand-written) ----------
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(buf: Buffer): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < buf.length; i++) {
    a = (a + buf[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePNG(): Buffer {
  // Raw scanlines: filter byte 0 + RGB per row.
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (1 + W * 3) + 1);
  }
  // zlib stream: DEFLATE via Node stdlib (deterministic for fixed input).
  const idat = zlib.deflateSync(raw, { level: 9 });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- world map ----------
// Equirectangular projection into the map panel (y 190..555).
function proj(lon: number, lat: number): [number, number] {
  return [
    Math.round(20 + ((lon + 180) / 360) * 984),
    Math.round(190 + ((78 - lat) / 136) * 365),
  ];
}

function polyLL(coords: Array<[number, number]>): Array<[number, number]> {
  return coords.map(([lo, la]) => proj(lo, la));
}

// Coarse hand-drawn continent outlines (lon/lat).
const CONTINENTS: Array<Array<[number, number]>> = [
  // North America
  [[-168, 66], [-150, 70], [-135, 69], [-125, 71], [-115, 73], [-105, 73], [-95, 80], [-85, 76], [-78, 72], [-70, 68], [-65, 62], [-60, 58], [-55, 52], [-59, 47], [-65, 44], [-70, 42], [-74, 39], [-76, 35], [-80, 32], [-81, 26], [-84, 30], [-89, 29], [-90, 21], [-94, 18], [-97, 16], [-101, 17], [-105, 20], [-110, 23], [-114, 28], [-117, 32], [-122, 37], [-124, 42], [-124, 48], [-130, 54], [-140, 60], [-152, 58], [-162, 60]],
  // South America
  [[-79, 9], [-72, 11], [-64, 10], [-58, 8], [-52, 5], [-50, 0], [-44, -3], [-37, -6], [-35, -9], [-38, -15], [-40, -21], [-46, -24], [-49, -28], [-54, -33], [-58, -38], [-62, -41], [-66, -45], [-68, -50], [-70, -54], [-73, -50], [-73, -44], [-73, -37], [-71, -30], [-70, -20], [-75, -15], [-79, -8], [-81, -4], [-80, 1]],
  // Europe
  [[-10, 37], [-9, 39], [-9, 43], [-4, 44], [-2, 44], [-1, 46], [1, 44], [3, 43], [6, 43], [8, 44], [12, 44], [14, 45], [18, 40], [19, 42], [23, 40], [26, 38], [28, 38], [30, 36], [28, 40], [26, 42], [24, 45], [21, 45], [19, 46], [16, 46], [13, 45], [10, 44], [7, 44], [4, 43], [1, 44], [-2, 44], [-4, 43], [-7, 43], [-9, 42], [-9, 38]],
  // Scandinavia + UK
  [[5, 58], [6, 62], [10, 64], [13, 66], [17, 69], [21, 70], [26, 71], [30, 70], [28, 66], [24, 63], [21, 60], [19, 57], [17, 56], [13, 55], [10, 57], [7, 58]],
  [[-5, 50], [-4, 53], [-6, 55], [-4, 57], [-2, 58], [0, 57], [1, 53], [0, 51], [-2, 50]],
  // Africa
  [[-6, 35], [-1, 35], [4, 37], [9, 37], [11, 34], [15, 32], [20, 32], [25, 31], [30, 31], [32, 31], [34, 28], [36, 24], [37, 20], [38, 18], [39, 15], [41, 13], [44, 11], [48, 11], [51, 12], [50, 7], [47, 2], [44, -2], [41, -6], [40, -10], [39, -15], [36, -20], [34, -25], [32, -28], [29, -32], [25, -34], [20, -35], [17, -32], [14, -28], [13, -22], [12, -18], [12, -12], [11, -6], [9, -1], [9, 4], [6, 4], [2, 6], [-3, 5], [-8, 5], [-12, 8], [-15, 11], [-17, 15], [-17, 20], [-16, 25], [-14, 28], [-10, 31]],
  // Asia: south coast east, Pacific coast north, Arctic coast west,
  // then down through eastern Europe back to Istanbul.
  [[28, 41], [30, 36], [36, 36], [40, 34], [43, 31], [47, 30], [51, 28], [55, 27], [57, 26], [60, 25], [64, 25], [67, 24], [70, 22], [73, 20], [75, 16], [77, 9], [80, 7], [80, 12], [84, 18], [88, 22], [91, 22], [93, 17], [95, 16], [97, 10], [99, 7], [101, 3], [103, 1], [104, 3], [106, 10], [108, 12], [109, 16], [108, 19], [110, 20], [114, 22], [118, 25], [121, 28], [122, 31], [120, 34], [119, 37], [122, 39], [124, 40], [127, 40], [130, 42], [135, 44], [138, 46], [141, 50], [144, 56], [156, 58], [160, 60], [165, 62], [170, 66], [178, 66], [180, 66], [170, 68], [160, 70], [150, 71], [140, 72], [130, 72], [120, 73], [110, 74], [100, 75], [90, 75], [80, 74], [70, 73], [60, 72], [50, 71], [40, 70], [30, 70], [26, 71], [28, 66], [30, 62], [32, 58], [34, 54], [36, 50], [38, 47], [40, 44], [38, 42], [36, 40], [34, 38], [32, 37], [30, 36], [28, 38]],
  // Australia
  [[113, -22], [114, -28], [115, -33], [118, -35], [124, -33], [129, -32], [132, -32], [135, -35], [138, -35], [140, -38], [145, -38], [150, -37], [153, -32], [153, -27], [150, -23], [146, -19], [144, -15], [142, -11], [141, -13], [137, -12], [135, -12], [132, -11], [130, -13], [126, -14], [122, -17], [118, -20], [114, -22]],
  // New Zealand
  [[167, -45], [170, -43], [173, -41], [175, -38], [177, -38], [174, -41], [172, -43], [169, -46]],
  // Japan
  [[130, 31], [132, 33], [134, 34], [136, 35], [138, 35], [140, 36], [141, 39], [142, 42], [144, 44], [143, 42], [141, 38], [139, 36], [136, 34], [133, 33]],
  // Madagascar
  [[44, -16], [47, -15], [50, -16], [50, -20], [47, -24], [45, -25], [43, -22], [43, -18]],
  // Iceland
  [[-18, 64], [-15, 64], [-14, 66], [-18, 66], [-20, 65], [-22, 64]],
];

// Indonesia islands as small blobs.
const ISLANDS: Array<[number, number, number, number]> = [
  [96, -3, 9, 4], [104, -4, 12, 4], [112, -7, 12, 4], [120, -4, 10, 4],
  [128, -3, 10, 4], [136, -4, 12, 4], [141, -5, 8, 4], [100, 0, 8, 3],
];

interface Story {
  n: number;
  lon: number;
  lat: number;
  head: string;
  sub: string;
}

// The 10 stories of 24 Nov 2026 — only the facts given in the brief.
const STORIES: Story[] = [
  { n: 1, lon: 57, lat: 26.5, head: "HORMUZ - 3 TANKERS HIT MINES", sub: "THREE TANKERS ABLAZE IN THE STRAIT" },
  { n: 2, lon: 127.5, lat: 36.5, head: "KOREA - RUSSIAN JETS ENTER ZONE", sub: "WARPLANES IN AIR DEFENCE ZONE" },
  { n: 3, lon: 110, lat: -7.5, head: "INDONESIA - FACTORY FIRE TOLL 26", sub: "DEATH TOLL RISES AT SWEETS FACTORY" },
  { n: 4, lon: 20, lat: 30, head: "UKRAINE - KYIV DEFENDS LIBYA STRIKE", sub: "KYIV CALLS LIBYA RAID SELF-DEFENCE" },
  { n: 5, lon: 34.5, lat: 31.5, head: "GAZA - ISRAELI STRIKES KILL 6", sub: "AT LEAST SIX DEAD IN AIR STRIKES" },
  { n: 6, lon: 25, lat: -2, head: "DR CONGO - FIGHTING TRAPS EBOLA TEAMS", sub: "CLASHES BLOCK EBOLA RESPONSE TEAMS" },
  { n: 7, lon: 46, lat: 34, head: "IRAQ - BAGHDAD SEIZES KURDISH OILFIELDS", sub: "FEDERAL TAKEOVER OF OIL AND PORTS" },
  { n: 8, lon: 4.4, lat: 50.8, head: "EU - 22ND SANCTIONS, FLAG BAN", sub: "BRUSSELS PROPOSES NEW RUSSIA CURBS" },
  { n: 9, lon: -122, lat: 37.4, head: "NVIDIA - COOLS AFTER +31% DAY", sub: "CHIP GIANT SLIPS AFTER MONDAY SURGE" },
  { n: 10, lon: 96, lat: 20, head: "MYANMAR - UK SANCTIONS 5 GENERALS", sub: "LONDON ACTS AFTER GENOCIDE RULING" },
];

function drawMap(): void {
  // Map panel.
  fillRect(0, 188, W, 370, OCEAN);
  // Graticule.
  for (let lon = -150; lon <= 150; lon += 30) {
    const x = proj(lon, 0)[0];
    drawLine(x, 188, x, 558, GRID);
  }
  for (let lat = 60; lat >= -30; lat -= 30) {
    const y = proj(0, lat)[1];
    drawLine(0, y, W, y, GRID);
  }
  // Continents.
  for (const c of CONTINENTS) {
    const p = polyLL(c);
    fillPolygon(p, LAND);
    strokePolygon(p, LAND_EDGE);
  }
  for (const [lon, lat, rx, ry] of ISLANDS) {
    const [x, y] = proj(lon, lat);
    for (let j = y - ry; j <= y + ry; j++) {
      const dx = Math.floor((rx * Math.sqrt(Math.max(0, ry * ry - (j - y) * (j - y)))) / ry);
      for (let i = x - dx; i <= x + dx; i++) setPixel(i, j, LAND);
    }
  }
  // Numbered story dots.
  for (const s of STORIES) {
    const [x, y] = proj(s.lon, s.lat);
    fillCircle(x, y, 12, GOLD);
    drawCircle(x, y, 12, CREAM);
    const label = String(s.n);
    const sc = label.length > 1 ? 1 : 2;
    drawText(label, x - Math.floor(textWidth(label, sc) / 2), y - Math.floor((7 * sc) / 2), sc, DARK);
  }
}

function draw(): void {
  fillAll(NAVY);

  // ---- header: the date, biggest on the page ----
  fillRect(40, 22, 944, 4, GOLD);
  drawTextCentered("24 NOVEMBER 2026", 40, 7, CREAM);
  // "TUESDAY" flanked by gold rules.
  const tueW = textWidth("TUESDAY", 5);
  const tueX = Math.round((W - tueW) / 2);
  drawLine(40, 117, tueX - 30, 117, GOLD);
  drawLine(tueX + tueW + 30, 117, 984, 117, GOLD);
  drawText("TUESDAY", tueX, 100, 5, GOLD);
  fillRect(40, 150, 944, 2, GOLD_DIM);
  drawText("WHERE IT HAPPENED  •  10 STORIES, ONE DAY", 40, 164, 2, MUTED);

  // ---- world map with numbered dots ----
  drawMap();

  // ---- story list ----
  let y = 578;
  for (const s of STORIES) {
    fillCircle(58, y + 19, 14, GOLD);
    const label = String(s.n);
    const sc = label.length > 1 ? 1 : 2;
    drawText(label, 58 - Math.floor(textWidth(label, sc) / 2), y + 19 - Math.floor((7 * sc) / 2), sc, DARK);
    drawText(s.head, 86, y + 2, 2, CREAM);
    drawText(s.sub, 86, y + 22, 1, GOLD_DIM);
    if (s.n < 10) drawLine(40, y + 39, 984, y + 39, [24, 52, 84]);
    y += 40;
  }

  // ---- footer ----
  fillRect(40, 982, 944, 2, GOLD_DIM);
  drawTextCentered("SOURCES: REUTERS  •  AP  •  IRNA  •  YONHAP  •  AL JAZEERA  •  UN NEWS  •  SCMP  •  IRRAWADDY", 994, 1, MUTED);
}

function main(): void {
  draw();
  const png = encodePNG();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "entry.png"), png);
}

main();
