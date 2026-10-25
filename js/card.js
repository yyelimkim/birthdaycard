// The felt pop-up card.
//
// Card frame: the base lies on XZ (fold line on the X axis at z = 0, base runs toward +z),
// the back panel hinges up from the fold. alpha = angle between base and back panel
// (0 = closed, PI/2 = open 90deg). Pop-up pieces use parallel folds: each layer's face stays
// parallel to the back panel, standing on the base at depth d, joined to the back panel
// by flat tabs at height h -- the same mechanism as a real paper pop-up.
import * as THREE from 'three';
import {
  felt, roundRect, roundedPoly, blob, star, heart, circle, ellipse,
  text, dots, stitchLine, pom, thread,
} from './felt.js';

export const W = 18, D = 13, H = 13;
const HINGE_Y = 0.32;      // panel rests on top of the base art when closed
const PANEL_T = 0.17;

const C = {
  pink: '#eaa3b3', cream: '#f6eddc', navy: '#34426c', mint: '#a8dccb', blush: '#f4c1c7',
  yellow: '#f6e39a', sponge: '#f7e7a6', choc: '#7b4c38', frost: '#f2b2bd', straw: '#e2453f',
  skin: '#f3c29f', hairDark: '#2f2a2b', hairBrown: '#5d3b2a', teal: '#2f8f80', lime: '#c3da86',
  gold: '#e9b949', grey: '#a9aab4', jacket: '#7c808b', red: '#d9485f', white: '#fbf7ef', orange: '#f2a65a',
};

const confettiColors = ['#f6e39a', '#f2b2bd', '#a8dccb', '#b9c7f2', '#f2a65a', '#fbf7ef', '#e86f7f', '#c3da86'];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// little painted sparkle cross, embroidery style
function sparkle(g, x, y, s, color = '#fff6d8') {
  g.save();
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineWidth = s * 0.22;
  g.beginPath();
  g.moveTo(x - s, y); g.lineTo(x + s, y);
  g.moveTo(x, y - s); g.lineTo(x, y + s);
  g.stroke();
  g.restore();
}

function scatterDots(g, bb, count, colors, r = 0.06) {
  const list = [];
  for (let i = 0; i < count; i++) {
    list.push([rnd(bb.min.x, bb.max.x), rnd(bb.min.y, bb.max.y), pick(colors), r * rnd(0.7, 1.3)]);
  }
  dots(g, list);
}

function add(parent, ...meshes) { meshes.forEach(m => parent.add(m)); return meshes[0]; }

// ======================================================================== base
function buildBase() {
  const g = new THREE.Group();
  g.rotation.x = -Math.PI / 2;     // shape y -> -z, extrusion -> +y
  add(g, felt(roundRect(-W / 2, -D, W, D, 0.55), {
    color: C.pink, depth: 0.1, inset: 0.22,
    paint: (c, bb) => scatterDots(c, bb, 160, ['rgba(255,255,255,0.55)'], 0.07),
  }));
  add(g, felt(roundRect(-W / 2 + 0.6, -D + 0.6, W - 1.2, D - 1.2, 0.4), {
    color: C.cream, depth: 0.05, z: 0.135, stitch: '#e7a1ae', inset: 0.22,
    paint: (c, bb) => {
      scatterDots(c, bb, 70, confettiColors.slice(0, 5), 0.07);
      for (let i = 0; i < 14; i++) sparkle(c, rnd(-8, 8), rnd(-12, -1), rnd(0.12, 0.2), pick(['#e9b949', '#e7a1ae', '#8fcab7']));
      text(c, 'love you lots, happy birthday!', 0, -11.2, { size: 0.95, font: 'Gaegu', weight: 700, color: '#3e4a78' });
    },
  }));
  // a couple of felt appliqués on the base
  add(g, felt(heart(6.2, -11.2, 0.42), { color: C.red, depth: 0.04, z: 0.2, inset: 0.08, stitchWidth: 0.03 }));
  add(g, felt(heart(-6.3, -11.15, 0.32), { color: '#f08aa0', depth: 0.04, z: 0.2, inset: 0.07, stitchWidth: 0.03 }));
  add(g, felt(star(-7.3, -1.6, 0.42), { color: C.yellow, depth: 0.04, z: 0.2, inset: 0.08, stitchWidth: 0.03 }));
  add(g, felt(star(7.4, -2.2, 0.36), { color: C.mint, depth: 0.04, z: 0.2, inset: 0.07, stitchWidth: 0.03 }));
  return g;
}

// ======================================================================== back panel
function buildPanel() {
  const panel = new THREE.Group();
  // structural felt board (the outer card)
  add(panel, felt(roundRect(-W / 2, 0, W, H, 0.55), {
    color: C.pink, depth: 0.1, z: -PANEL_T + 0.035, inset: 0.22,
    paint: (c, bb) => scatterDots(c, bb, 160, ['rgba(255,255,255,0.55)'], 0.07),
  }));

  // inside art, squished flat while the card is closed
  const art = new THREE.Group();
  panel.add(art);
  add(art, felt(roundRect(-W / 2 + 0.6, 0.6, W - 1.2, H - 1.2, 0.4), {
    color: C.navy, depth: 0.05, z: 0.04, stitch: '#c9d3f2', inset: 0.22,
    paint: (c, bb) => {
      scatterDots(c, bb, 90, ['#f6e39a', '#c9d3f2', '#f2b2bd', '#ffffff'], 0.05);
      for (let i = 0; i < 18; i++) sparkle(c, rnd(-8, 8), rnd(1, 12), rnd(0.1, 0.18));
    },
  }));

  // sparkler burst behind the candle (like the felt shadow box)
  const bx = -3.7, by = 9.7;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rnd(-0.1, 0.1);
    const r0 = rnd(1.3, 1.7), len = rnd(1.2, 2.1);
    const ray = felt(roundRect(r0, -0.05, len, 0.1, 0.05), {
      color: C.gold, depth: 0.03, z: 0.14, stitch: false, bump: 0.5,
    });
    ray.position.set(bx, by, 0.14);
    ray.rotation.z = a;
    art.add(ray);
  }
  for (let i = 0; i < 46; i++) {
    const a = rnd(0, Math.PI * 2), r = rnd(1.2, 3.6);
    const x = bx + Math.cos(a) * r, y = by + Math.sin(a) * r * 0.85;
    if (y > 12.2) continue;
    art.add(pom(pick(confettiColors), rnd(0.08, 0.14), x, y, 0.14));
  }

  // felt stars on the night sky
  [[-7.2, 7.4, 0.55, C.yellow], [-6.7, 3.2, 0.4, C.blush], [7.5, 9.3, 0.5, C.yellow], [-0.4, 10.4, 0.38, C.mint],
   [7.2, 2.6, 0.42, C.yellow]].forEach(([x, y, r, col], i) => {
    add(art, felt(star(x, y, r, r * 0.5, 5, i * 0.3), { color: col, depth: 0.05, z: 0.14, inset: 0.09, stitchWidth: 0.03 }));
  });

  // bunting garland across the top
  const sag = (x) => 12.05 - 0.95 * (1 - (x / 8.3) ** 2);
  const pts = [];
  for (let x = -8.3; x <= 8.31; x += 0.5) pts.push([x, sag(x), 0.24]);
  art.add(thread(pts, '#f6eddc', 0.035));
  const flagCols = ['#f2b2bd', '#f6e39a', '#a8dccb', '#b9c7f2', '#f2a65a'];
  const n = 11;
  for (let i = 0; i < n; i++) {
    const x = -7.6 + (15.2 * i) / (n - 1), y = sag(x);
    const tilt = Math.atan(-2 * 0.95 * x / (8.3 * 8.3)) * -1;
    const flag = felt(roundedPoly([[-0.55, 0], [0.55, 0], [0, -1.05]], 0.12), {
      color: flagCols[i % flagCols.length], depth: 0.05, inset: 0.11, stitchWidth: 0.03,
      paint: (c) => i % 2 === 0 && dots(c, [[0, -0.35, 'rgba(255,255,255,0.8)', 0.1]]),
    });
    flag.position.set(x, y + 0.05, 0.16);
    flag.rotation.z = tilt;
    art.add(flag);
  }
  return { panel, art };
}

// ======================================================================== cover (outside)
function buildCover() {
  // cover pieces are designed upright with y in [-H, 0], y = 0 at the fold (top-fold card)
  const g = new THREE.Group();
  g.rotation.x = Math.PI;
  g.position.z = -PANEL_T;
  add(g, felt(roundRect(-5.2, -10.2, 10.4, 7.4, 1.2), {
    color: C.cream, depth: 0.06, stitch: '#e7a1ae', inset: 0.25,
    paint: (c) => {
      text(c, 'for you', 0, -5.7, { size: 2.2, font: 'Gaegu', weight: 700, color: '#3e4a78' });
      text(c, 'open me, gently', 0, -8.1, { size: 0.85, font: 'Gaegu', weight: 400, color: '#c4697c' });
    },
  }));
  add(g, felt(heart(0, -3.0, 0.9), { color: C.red, depth: 0.07, z: 0.1, inset: 0.12 }));
  add(g, felt(star(-6.6, -2.4, 0.7), { color: C.yellow, depth: 0.05, inset: 0.1 }));
  add(g, felt(star(6.7, -11.1, 0.6, 0.3, 5, 0.4), { color: C.mint, depth: 0.05, inset: 0.1 }));
  add(g, felt(star(6.4, -2.0, 0.42, 0.21, 5, 0.2), { color: C.blush, depth: 0.05, inset: 0.08 }));
  add(g, felt(circle(0.35, -6.8, -11.2), { color: C.orange, depth: 0.05, inset: 0.08, stitchWidth: 0.03 }));
  return g;
}

// ======================================================================== pop-up layers
function makeLayer(root, d, h, tabXs, tabColor) {
  const layer = new THREE.Group();     // stands at (0, hinge, d), rotates with the panel
  layer.position.set(0, HINGE_Y, d);
  const art = new THREE.Group();
  layer.add(art);
  root.add(layer);

  const tabs = tabXs.map((x) => {
    const tab = new THREE.Group();
    const m = felt(roundRect(x - 0.55, -d, 1.1, d, 0.12), { color: tabColor, depth: 0.04, inset: 0.1, stitchWidth: 0.03 });
    tab.add(m);
    tab.rotation.x = -Math.PI / 2;
    root.add(tab);
    return tab;
  });

  return {
    art,
    update(alpha, squish) {
      layer.rotation.x = Math.PI / 2 - alpha;
      art.scale.z = squish;
      for (const tab of tabs) tab.position.set(0, HINGE_Y + h * Math.sin(alpha) - 0.05, h * Math.cos(alpha));
    },
  };
}

// ---- cake (inspired by the felt strawberry cake)
function buildCake(art) {
  const cx = -3.7;
  const cake = new THREE.Group();
  cake.position.x = cx;
  art.add(cake);
  const a1 = 3.0, a2 = 2.1, yStep = 3.75, yTop = 5.85;
  const strawberries = [[-1.3, 6.4, 0.7], [1.3, 6.4, 0.7]];
  const outline = (p, color, z) => {
    add(cake, felt(roundedPoly([
      [-a1 - p, 0.35], [a1 + p, 0.35], [a1 + p, yStep + p * 0.4], [a2 + p, yStep + p * 0.4],
      [a2 + p, yTop + p], [-a2 - p, yTop + p], [-a2 - p, yStep + p * 0.4], [-a1 - p, yStep + p * 0.4],
    ], 0.55), { color, depth: 0.05, z, inset: 0.14 }));
    strawberries.forEach(([x, y, s]) => add(cake, felt(circle(s * 0.95 + p, x, y + 0.05), { color, depth: 0.05, z: z - 0.015, stitch: false })));
  };
  outline(0.75, C.mint, 0);
  outline(0.4, C.blush, 0.11);

  // top tier: lemon sponge with embroidered red bows
  add(cake, felt(roundRect(-a2, yStep - 0.2, a2 * 2, yTop - yStep + 0.25, 0.15), {
    color: C.sponge, depth: 0.05, z: 0.22, stitch: false,
    paint: (c) => {
      c.strokeStyle = '#d63b3b'; c.lineWidth = 0.05; c.lineCap = 'round';
      for (const [x, y, s] of [[-1.25, 4.8, 0.32], [0, 4.85, 0.42], [1.25, 4.8, 0.32]]) {
        c.beginPath();
        c.ellipse(x - s * 0.7, y + s * 0.15, s * 0.6, s * 0.35, -0.4, 0, Math.PI * 2);
        c.ellipse(x + s * 0.7, y + s * 0.15, s * 0.6, s * 0.35, 0.4, 0, Math.PI * 2);
        c.moveTo(x, y); c.lineTo(x - s * 0.6, y - s * 1.1);
        c.moveTo(x, y); c.lineTo(x + s * 0.6, y - s * 1.1);
        c.stroke();
      }
      [[-1.8, 5.5], [1.8, 5.4], [-0.6, 5.55], [0.65, 4.2], [-0.7, 4.15]].forEach(([x, y]) => sparkle(c, x, y, 0.1, '#d63b3b'));
    },
  }));
  // cookie row
  for (let i = 0; i < 5; i++) {
    add(cake, felt(ellipse(0.42, 0.24, -1.6 + i * 0.8, yTop), {
      color: '#c98b5f', depth: 0.05, z: 0.33, inset: 0.07, stitchWidth: 0.025,
    }));
  }
  // bottom tier
  add(cake, felt(roundRect(-a1, 0.55, a1 * 2, yStep - 0.4, 0.18), {
    color: C.sponge, depth: 0.05, z: 0.22, stitch: false,
    paint: (c) => {
      // chocolate band with white lattice
      c.fillStyle = C.choc;
      c.fillRect(-a1, 0.95, a1 * 2, 0.75);
      c.strokeStyle = '#fbf7ef'; c.lineWidth = 0.05;
      c.save(); c.beginPath(); c.rect(-a1, 0.95, a1 * 2, 0.75); c.clip();
      for (let x = -a1 - 1; x < a1 + 1; x += 0.32) {
        c.beginPath(); c.moveTo(x, 0.95); c.lineTo(x + 0.75, 1.7); c.stroke();
        c.beginPath(); c.moveTo(x + 0.75, 0.95); c.lineTo(x, 1.7); c.stroke();
      }
      c.restore();
      c.fillStyle = '#f0d27d';
      c.fillRect(-a1, 1.85, a1 * 2, 0.12);
    },
  }));
  // pink drip frosting
  const drips = [];
  const n = 7, x0 = -a1 - 0.15, x1 = a1 + 0.15;
  const top = yStep + 0.15, lip = 2.95;
  drips.push([x0, top], [x1, top]);
  for (let i = n - 1; i >= 0; i--) {
    const xa = x0 + ((x1 - x0) * i) / n, xb = x0 + ((x1 - x0) * (i + 1)) / n, xm = (xa + xb) / 2;
    const deep = i % 2 === 0 ? 2.3 : 2.65;
    drips.push([xb, lip], [xm + 0.28, deep], [xm - 0.28, deep], [xa, lip]);
  }
  drips[drips.length - 1][1] = 2.7;
  add(cake, felt(roundedPoly(drips, 0.24), {
    color: C.frost, depth: 0.05, z: 0.33, inset: 0.13,
    paint: (c) => {
      for (let i = 0; i < 26; i++) {
        const x = rnd(-a1 + 0.2, a1 - 0.2), y = rnd(3.05, 3.65), a = rnd(0, Math.PI);
        c.strokeStyle = pick(['#fbf7ef', '#b9c7f2', '#e2453f', '#a8dccb']);
        c.lineWidth = 0.07; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 0.16, y + Math.sin(a) * 0.16); c.stroke();
      }
      [[-1.9, 3.45], [0.9, 3.5], [2.4, 3.2]].forEach(([x, y]) => sparkle(c, x, y, 0.1, '#fbf7ef'));
    },
  }));

  // strawberries
  strawberries.forEach(([x, y, s]) => {
    const berry = felt(blob([[0, -1], [0.7, -0.35], [0.85, 0.35], [0.45, 0.85], [-0.45, 0.85], [-0.85, 0.35], [-0.7, -0.35]].map(([px, py]) => [x + px * s, y + py * s])), {
      color: C.straw, depth: 0.07, z: 0.4, stitch: false,
      paint: (c) => {
        c.strokeStyle = '#fbf7ef'; c.lineWidth = 0.035; c.lineCap = 'round';
        for (let i = 0; i < 9; i++) {
          const px = x + rnd(-0.5, 0.5) * s, py = y + rnd(-0.55, 0.6) * s;
          c.beginPath(); c.moveTo(px, py); c.lineTo(px + 0.02, py + 0.11); c.stroke();
        }
      },
    });
    cake.add(berry);
  });

  // candle + flame
  add(cake, felt(roundRect(-0.36, yTop - 0.3, 0.72, 2.25, 0.16), {
    color: C.mint, depth: 0.07, z: 0.48, stitch: false,
    paint: (c) => {
      c.strokeStyle = '#fbf7ef'; c.lineWidth = 0.09;
      for (let y = yTop; y < yTop + 2.1; y += 0.42) {
        c.beginPath(); c.moveTo(-0.4, y); c.lineTo(0.4, y + 0.22); c.stroke();
      }
    },
  }));
  const wickY = yTop + 1.95;
  cake.add(thread([[0, wickY - 0.05, 0.56], [0, wickY + 0.25, 0.56]], '#3a2e2a', 0.035));
  const flame = new THREE.Group();
  flame.position.set(0, wickY + 0.1, 0.5);
  flame.add(felt(blob([[0, 0], [0.42, 0.35], [0.3, 0.8], [0, 1.3], [-0.3, 0.8], [-0.42, 0.35]]), {
    color: '#e8473c', depth: 0.06, stitch: '#ffb4a1', inset: 0.08, stitchWidth: 0.03,
  }));
  flame.add(felt(blob([[0, 0.08], [0.2, 0.32], [0.14, 0.62], [0, 0.85], [-0.14, 0.62], [-0.2, 0.32]]), {
    color: '#f9c74f', depth: 0.04, z: 0.09, stitch: false,
  }));
  cake.add(flame);

  // plate
  add(cake, felt(roundRect(-a1 - 1.25, 0, (a1 + 1.25) * 2, 0.95, 0.47), {
    color: C.white, depth: 0.06, z: 0.55, stitch: '#c9d3f2', inset: 0.13,
  }));
  // spoon + fork
  add(cake, felt(ellipse(0.42, 0.62, -a1 - 0.55, 3.1), { color: C.grey, depth: 0.05, z: 0.5, inset: 0.1, stitchWidth: 0.03 }));
  add(cake, felt(roundRect(-a1 - 0.7, 0.6, 0.3, 2.2, 0.15), { color: C.grey, depth: 0.05, z: 0.5, stitch: false }));
  add(cake, felt(roundedPoly([[a1 + 0.12, 2.65], [a1 + 1.02, 2.65], [a1 + 1.02, 3.95], [a1 + 0.84, 3.95], [a1 + 0.84, 3.2],
    [a1 + 0.66, 3.2], [a1 + 0.66, 3.95], [a1 + 0.48, 3.95], [a1 + 0.48, 3.2], [a1 + 0.3, 3.2], [a1 + 0.3, 3.95], [a1 + 0.12, 3.95]], 0.08),
    { color: C.grey, depth: 0.05, z: 0.5, stitch: false }));
  add(cake, felt(roundRect(a1 + 0.42, 0.6, 0.3, 2.2, 0.15), { color: C.grey, depth: 0.05, z: 0.5, stitch: false }));

  // gingham bow
  const bow = new THREE.Group();
  bow.position.set(-1.9, 1.0, 0.66);
  const gingham = (c, bb) => {
    c.fillStyle = '#fbf7ef'; c.fillRect(bb.min.x, bb.min.y, 9, 9);
    c.fillStyle = 'rgba(214,59,59,0.55)';
    for (let x = bb.min.x; x < bb.max.x; x += 0.24) c.fillRect(x, bb.min.y, 0.12, bb.max.y - bb.min.y);
    for (let y = bb.min.y; y < bb.max.y; y += 0.24) c.fillRect(bb.min.x, y, bb.max.x - bb.min.x, 0.12);
  };
  bow.add(felt(blob([[0, 0], [-0.9, 0.55], [-1.1, 0.05], [-0.95, -0.45]]), { color: '#fbf7ef', depth: 0.04, stitch: false, paint: gingham }));
  bow.add(felt(blob([[0, 0], [0.9, 0.55], [1.1, 0.05], [0.95, -0.45]]), { color: '#fbf7ef', depth: 0.04, stitch: false, paint: gingham }));
  bow.add(felt(roundedPoly([[-0.12, -0.1], [-0.55, -1.0], [-0.25, -0.95], [0.05, -0.15]], 0.06), { color: '#fbf7ef', depth: 0.04, z: -0.02, stitch: false, paint: gingham }));
  bow.add(felt(roundedPoly([[0.12, -0.1], [0.55, -1.0], [0.25, -0.95], [-0.05, -0.15]], 0.06), { color: '#fbf7ef', depth: 0.04, z: -0.02, stitch: false, paint: gingham }));
  bow.add(felt(circle(0.2), { color: '#d63b3b', depth: 0.05, z: 0.05, stitch: false }));
  cake.add(bow);

  // heart cookie
  add(cake, felt(heart(2.0, 1.25, 0.55), {
    color: '#f5c27a', depth: 0.06, z: 0.66, stitch: false,
    paint: (c) => dots(c, [[1.8, 1.4, '#d99a4e'], [2.2, 1.4, '#d99a4e'], [2.0, 1.05, '#d99a4e'], [1.75, 1.0, '#d99a4e'], [2.25, 1.0, '#d99a4e']], 0.05),
  }));

  return { flame, flameWorld: new THREE.Vector3(cx, wickY + 0.7, 0.7) };
}

// ---- two felt friends (like the felt shadow-box kids)
function face(c, { cx, cy, r, eyes, smile, blush = true }) {
  if (blush) dots(c, [[cx - r * 0.55, cy - r * 0.3, 'rgba(240,128,128,0.55)', r * 0.2], [cx + r * 0.55, cy - r * 0.3, 'rgba(240,128,128,0.55)', r * 0.2]]);
  if (eyes) dots(c, [[cx - r * 0.33, cy + 0.02, '#2a2222', r * 0.08], [cx + r * 0.33, cy + 0.02, '#2a2222', r * 0.08]]);
  if (smile) {
    c.strokeStyle = '#2a2222'; c.lineWidth = 0.06; c.lineCap = 'round';
    c.beginPath(); c.arc(cx, cy - r * 0.2, r * 0.22, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
  }
}

function buildKids(art) {
  let z = 0;
  const step = () => (z += 0.11);
  const P = (shape, color, opts = {}) => add(art, felt(shape, { color, depth: 0.05, z, inset: 0.11, stitchWidth: 0.035, ...opts }));

  // big star backdrop
  P(star(4.2, 6.1, 4.3, 2.15, 5, -0.12), C.lime, { inset: 0.2 });
  P(star(0.6, 8.7, 1.05, 0.52, 5, 0.25), C.yellow, { inset: 0.12 });
  step();

  // kid A (back, big grin)
  const ax = 5.1, ay = 7.7, ar = 1.55;
  P(roundRect(ax - 1.3, ay - 3.0, 2.6, 1.9, 0.75), '#e9b949');
  P(blob([[ax - 1.0, ay - 2.2], [ax - 2.6, ay - 1.5], [ax - 3.1, ay - 1.75], [ax - 2.8, ay - 2.25], [ax - 1.2, ay - 2.75]]), C.skin);
  P(blob([[ax + 1.0, ay - 2.2], [ax + 2.6, ay - 1.4], [ax + 3.0, ay - 1.75], [ax + 2.7, ay - 2.3], [ax + 1.2, ay - 2.75]]), C.skin);
  P(circle(0.42, ax - ar, ay - 0.1), C.skin);
  P(circle(0.42, ax + ar, ay - 0.1), C.skin);
  step();
  P(circle(ar, ax, ay), C.skin, { paint: (c) => face(c, { cx: ax, cy: ay, r: ar }) });
  step();
  P(blob([[-1.7, -0.05], [-1.65, 0.85], [-1.05, 1.55], [0, 1.82], [1.05, 1.55], [1.65, 0.85], [1.7, -0.05], [1.0, 0.42], [0, 0.55], [-1.0, 0.42]].map(([x, y]) => [ax + x, ay + y])), C.hairDark, { stitch: '#5a5050' });
  step();
  P(ellipse(0.42, 0.15, ax - 0.62, ay + 0.48), C.teal, { stitch: false });
  P(ellipse(0.42, 0.15, ax + 0.62, ay + 0.48), C.teal, { stitch: false });
  const mouth = new THREE.Shape();
  mouth.moveTo(ax - 0.85, ay - 0.3);
  mouth.quadraticCurveTo(ax, ay - 0.18, ax + 0.85, ay - 0.3);
  mouth.quadraticCurveTo(ax + 0.75, ay - 1.2, ax, ay - 1.18);
  mouth.quadraticCurveTo(ax - 0.75, ay - 1.2, ax - 0.85, ay - 0.3);
  P(mouth, C.white, {
    stitch: false, paint: (c) => {
      c.strokeStyle = '#9b9aa6'; c.lineWidth = 0.035;
      c.beginPath(); c.moveTo(ax - 0.8, ay - 0.62); c.quadraticCurveTo(ax, ay - 0.55, ax + 0.8, ay - 0.62);
      for (const dx of [-0.5, -0.17, 0.17, 0.5]) { c.moveTo(ax + dx, ay - 0.25); c.lineTo(ax + dx * 0.95, ay - 1.1); }
      c.stroke();
    },
  });
  step();

  // kid B (front, gentle smile)
  const bx = 3.2, by = 4.35, br = 1.5;
  P(roundRect(bx - 1.55, 0, 3.1, 2.95, 1.0), C.jacket, { stitch: '#b3b6c0' });
  P(blob([[bx - 1.2, 2.3], [bx - 2.7, 1.55], [bx - 3.25, 1.75], [bx - 3.0, 1.15], [bx - 1.3, 1.5]]), C.skin);
  P(blob([[bx + 1.2, 2.3], [bx + 2.7, 1.65], [bx + 3.25, 1.95], [bx + 3.05, 1.3], [bx + 1.3, 1.5]]), C.skin);
  P(circle(0.4, bx - br, by - 0.15), C.skin);
  P(circle(0.4, bx + br, by - 0.15), C.skin);
  step();
  P(roundRect(bx - 0.38, 0.25, 0.76, 2.55, 0.25), C.white, { stitch: false });
  P(circle(br, bx, by), C.skin, { paint: (c) => face(c, { cx: bx, cy: by, r: br, eyes: true, smile: true }) });
  step();
  P(blob([[-1.62, -0.1], [-1.6, 0.8], [-1.0, 1.5], [0, 1.72], [1.0, 1.5], [1.6, 0.8], [1.62, -0.1], [1.25, 0.45], [0.75, 0.3], [0.3, 0.6], [-0.2, 0.35], [-0.7, 0.62], [-1.25, 0.35]].map(([x, y]) => [bx + x, by + y])), C.hairBrown, { stitch: '#8a6450' });
  // two buttons
  art.add(pom('#c9a27a', 0.15, bx + 0.75, 1.3, z + 0.05), pom('#c9a27a', 0.15, bx + 0.75, 0.6, z + 0.05));
}

// ---- "happy birthday" ribbon banner
function buildBanner(art) {
  add(art, felt(roundRect(-1.6, 0, 3.2, 0.8, 0.2), { color: C.blush, depth: 0.05, stitch: false }));
  add(art, felt(roundedPoly([[-5.75, 0.45], [-4.2, 0.55], [-4.2, 2.0], [-5.75, 2.1], [-5.15, 1.27]], 0.12), { color: '#f08aa0', depth: 0.05, z: 0.04, inset: 0.12 }));
  add(art, felt(roundedPoly([[5.75, 0.45], [5.15, 1.27], [5.75, 2.1], [4.2, 2.0], [4.2, 0.55]], 0.12), { color: '#f08aa0', depth: 0.05, z: 0.04, inset: 0.12 }));
  add(art, felt(roundRect(-4.7, 0.35, 9.4, 2.05, 0.55), {
    color: C.white, depth: 0.07, z: 0.14, stitch: '#f08aa0', inset: 0.16,
    paint: (c) => text(c, 'Happy Birthday!', 0, 1.38, { size: 1.25, font: 'Fredoka', weight: 700, color: C.red, stitch: '#fbe1e5' }),
  }));
  add(art, felt(star(-4.4, 2.3, 0.42), { color: C.yellow, depth: 0.05, z: 0.27, inset: 0.08, stitchWidth: 0.03 }));
  add(art, felt(star(4.45, 0.45, 0.36, 0.18, 5, 0.3), { color: C.mint, depth: 0.05, z: 0.27, inset: 0.07, stitchWidth: 0.03 }));
}

// ======================================================================== assemble
export function buildCard() {
  const root = new THREE.Group();     // card frame (fold at origin)
  root.add(buildBase());

  const hinge = new THREE.Group();
  hinge.position.y = HINGE_Y;
  root.add(hinge);
  const { panel, art: panelArt } = buildPanel();
  hinge.add(panel);
  panel.add(buildCover());

  const kids = makeLayer(root, 1.6, 3.6, [2.6, 5.4], C.lime);
  buildKids(kids.art);
  const cakeLayer = makeLayer(root, 3.4, 3.0, [-5.2, -2.2], C.blush);
  const { flame, flameWorld } = buildCake(cakeLayer.art);
  const banner = makeLayer(root, 7.0, 1.3, [-2.6, 2.6], C.cream);
  buildBanner(banner.art);

  // candle glow
  const glow = new THREE.PointLight('#ffb36b', 0, 14, 2);
  glow.position.copy(flameWorld);
  cakeLayer.art.add(glow);

  const layers = [kids, cakeLayer, banner];
  let alpha = 0;
  function setOpen(a) {
    alpha = a;
    hinge.rotation.x = Math.PI / 2 - a;
    const squish = THREE.MathUtils.clamp(Math.sin(a) * 3, 0.03, 1);
    panelArt.scale.z = squish;
    layers.forEach(l => l.update(a, squish));
  }
  setOpen(0);

  function tick(t) {
    const open = Math.sin(alpha);
    flame.rotation.z = Math.sin(t * 3.1) * 0.06 + Math.sin(t * 7.3) * 0.03;
    flame.scale.y = 1 + Math.sin(t * 9.0) * 0.04;
    glow.intensity = open * (9 + Math.sin(t * 13) * 1.2 + Math.sin(t * 5.7) * 1.5);
  }

  // center of the closed card in card-frame coordinates (used to pivot the whole card)
  const closedCenter = new THREE.Vector3(0, 0.25, D / 2);
  return { root, setOpen, tick, closedCenter, get alpha() { return alpha; } };
}
