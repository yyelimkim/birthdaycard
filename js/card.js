// The felt pop-up card.
//
// Card frame: the base lies on XZ (fold line on the X axis at z = 0, base runs toward +z),
// the back panel hinges up from the fold. alpha = angle between base and back panel
// (0 = closed, PI/2 = open 90deg). Pop-up pieces use parallel folds: each layer's face stays
// parallel to the back panel, standing on the base at depth d, joined to the back panel
// by flat tabs at height h -- the same mechanism as a real paper pop-up.
import * as THREE from 'three';
import { felt, roundRect, star, heart, circle, text, dots } from './felt.js';
import { loadFigmaAtlas, chunksOf, figmaPiece, FRAME_PX } from './figma-felt.js';

export const W = 18, D = 13, H = 13;
const HINGE_Y = 0.52;      // panel rests on top of the base art when closed
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
    color: C.cream, depth: 0.1, z: 0.16, stitch: '#e7a1ae', inset: 0.22,
    paint: (c, bb) => {
      scatterDots(c, bb, 70, confettiColors.slice(0, 5), 0.07);
      for (let i = 0; i < 14; i++) sparkle(c, rnd(-8, 8), rnd(-12, -1), rnd(0.12, 0.2), pick(['#e9b949', '#e7a1ae', '#8fcab7']));
      text(c, 'love you lots, happy birthday!', 0, -11.2, { size: 0.95, font: 'Gaegu', weight: 700, color: '#3e4a78' });
    },
  }));
  // a couple of felt appliqués on the base
  add(g, felt(heart(6.2, -11.2, 0.42), { color: C.red, depth: 0.08, z: 0.36, inset: 0.08, stitchWidth: 0.03 }));
  add(g, felt(heart(-6.3, -11.15, 0.32), { color: '#f08aa0', depth: 0.08, z: 0.36, inset: 0.07, stitchWidth: 0.03 }));
  add(g, felt(star(-7.3, -1.6, 0.42), { color: C.yellow, depth: 0.08, z: 0.36, inset: 0.08, stitchWidth: 0.03 }));
  add(g, felt(star(7.4, -2.2, 0.36), { color: C.mint, depth: 0.08, z: 0.36, inset: 0.07, stitchWidth: 0.03 }));
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

  // inside art (from the Figma design), squished flat while the card is closed
  const art = new THREE.Group();
  panel.add(art);
  stackChunks(art, chunksOf('panel'), panelToCard(), { start: 0.04 });
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
      text(c, 'from: Yelim', 0, -8.1, { size: 0.95, font: 'Gaegu', weight: 700, color: '#c4697c' });
    },
  }));
  add(g, felt(heart(0, -3.0, 0.9), { color: C.red, depth: 0.12, z: 0.22, inset: 0.12 }));
  add(g, felt(star(-6.6, -2.4, 0.7), { color: C.yellow, depth: 0.05, inset: 0.1 }));
  add(g, felt(star(6.7, -11.1, 0.6, 0.3, 5, 0.4), { color: C.mint, depth: 0.05, inset: 0.1 }));
  add(g, felt(star(6.4, -2.0, 0.42, 0.21, 5, 0.2), { color: C.blush, depth: 0.05, inset: 0.08 }));
  add(g, felt(circle(0.35, -6.8, -11.2), { color: C.orange, depth: 0.05, inset: 0.08, stitchWidth: 0.03 }));
  return g;
}

// ======================================================================== pop-up layers
// tabs: [{ x, from }] -- each tab runs from the plane at depth `from` (0 = back panel, or the
// depth of the layer behind) to this layer, so no tab ever passes through another layer.
function makeLayer(root, d, h, tabs, tabColor) {
  const layer = new THREE.Group();     // stands at (0, hinge, d), rotates with the panel
  layer.position.set(0, HINGE_Y, d);
  const art = new THREE.Group();
  layer.add(art);
  root.add(layer);

  const tabMeshes = tabs.map(({ x, from = 0 }) => {
    const len = d - from;
    const tab = new THREE.Group();
    tab.add(felt(roundRect(x - 0.55, -len, 1.1, len, 0.12), { color: tabColor, depth: 0.06, stitch: false }));
    tab.rotation.x = -Math.PI / 2;
    tab.userData.from = from;
    root.add(tab);
    return tab;
  });

  return {
    art,
    update(alpha, squish) {
      layer.rotation.x = Math.PI / 2 - alpha;
      art.scale.z = squish;
      for (const tab of tabMeshes) {
        tab.position.set(0, HINGE_Y + h * Math.sin(alpha) - 0.08, tab.userData.from + h * Math.cos(alpha));
      }
    },
  };
}

// ---- Figma chunks
// Back panel art frame px -> card units (the navy panel inset starts at frame (12, 48.54))
const panelToCard = (shiftY = 0) => (fx, fy) => [(fx - 12) / FRAME_PX - (W / 2 - 0.6), H - 0.6 - (fy - 48.54) / FRAME_PX + shiftY];
// banner frame px -> card units, centred, bottom on the base
const bannerToCard = (fx, fy) => [(fx - 242) / FRAME_PX, (120.8 - fy) / FRAME_PX];

// shift that puts a layer's lowest point on the base, so nothing floats
const groundShift = (chunks) => -Math.min(...chunks.map((c) => H - 0.6 - (c.frame.y + c.frame.h - 48.54) / FRAME_PX));

// Stack chunks in design order. Each chunk rests on top of every earlier chunk it overlaps,
// so every overlap gets its own felt thickness and its own drop shadow.
// Appliqués (embroidery-like details) are thin and sit almost flush, with only a faint shadow.
const APPLIQUE = new Set(['swirl', 'bow 1', 'bow 2', 'bow 3', 'A mouth', 'A tuft', 'thread']);
const GROW = { 'A fringe': 3, 'B fringe': 3 };   // hair slightly larger than the head under it
const CLOSE = { 'A fringe': 2.5, 'B fringe': 2.5 };   // smooth hair outlines (no skin slivers in the parting)
const GAP = 0.02;
function stackChunks(parent, chunks, toCard, { start = 0, depth = 0.08, shiftY = () => 0 } = {}) {
  const placed = [];
  for (const c of chunks) {
    const f = c.frame;
    const applique = APPLIQUE.has(c.name);
    const below = placed.filter((p) => f.x < p.f.x + p.f.w && p.f.x < f.x + f.w && f.y < p.f.y + p.f.h && p.f.y < f.y + f.h);
    const dy = shiftY(c);
    const map = (fx, fy) => { const [x, y] = toCard(fx, fy); return [x, y + dy]; };
    const piece = figmaPiece(c, map, applique
      ? { depth: 0.025, shadow: 0.16, shadowOffset: 0.025, castShadow: false }
      : { depth, grow: GROW[c.name] || 0, close: CLOSE[c.name] || 0 });
    const { depth: d, bev } = piece.userData;
    const floor = below.length ? Math.max(...below.map((p) => p.top)) : start;
    piece.position.z = floor + (applique ? 0.004 : GAP) + bev;
    parent.add(piece);
    placed.push({ f, top: piece.position.z + d + bev, piece });
  }
  return placed.map((p) => p.piece);
}

// ---- candle flame: wavers like a real flame; tap it to blow it out (smoke), tap again to relight
const smokeTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(235,232,240,0.9)');
  grd.addColorStop(0.5, 'rgba(220,216,228,0.4)');
  grd.addColorStop(1, 'rgba(220,216,228,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

function makeCandle(art, flame) {
  // re-parent the flame under a pivot at its base so it can sway and shrink
  const geo = flame.children[0].geometry;
  geo.computeBoundingBox();
  const box = geo.boundingBox;   // card units (the piece is built in card coordinates)
  const base = new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, flame.position.z);
  const pivot = new THREE.Group();
  pivot.position.copy(base);
  art.add(pivot);
  pivot.add(flame);
  flame.position.set(-base.x, -base.y, 0);
  const tipY = box.max.y - box.min.y;

  // invisible tap target that stays put even when the flame is out
  const hitArea = new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 6), new THREE.MeshBasicMaterial());
  hitArea.visible = false;
  hitArea.position.set(base.x, base.y + tipY * 0.45, base.z + 0.2);
  art.add(hitArea);

  const glow = new THREE.PointLight('#ffb36b', 0, 14, 2);
  glow.position.set(0, tipY * 0.5, 0.6);
  pivot.add(glow);

  const puffs = [];
  for (let i = 0; i < 16; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 }));
    s.visible = false;
    art.add(s);
    puffs.push({ s, age: 99, life: 1, v: new THREE.Vector3() });
  }

  let lit = true, level = 1;
  function toggle() {
    lit = !lit;
    if (!lit) {
      puffs.forEach((p, i) => {
        p.age = -i * 0.06;
        p.life = 1.8 + Math.random() * 0.8;
        p.s.position.set(base.x + (Math.random() - 0.5) * 0.1, base.y + tipY * 0.6, base.z + 0.3);
        p.v.set((Math.random() - 0.5) * 0.25, 0.9 + Math.random() * 0.5, 0.05);
      });
    }
    return lit;
  }

  function tick(t, dt = 0.016, open = 1) {
    level += ((lit ? 1 : 0) - level) * Math.min(1, dt * (lit ? 5 : 12));
    pivot.rotation.z = (Math.sin(t * 3.1) * 0.07 + Math.sin(t * 7.7) * 0.035) * level;
    pivot.scale.set(0.9 + 0.1 * level + Math.sin(t * 11) * 0.02 * level, Math.max(0.001, level * (1 + Math.sin(t * 9.3) * 0.06)), 1);
    flame.visible = level > 0.02;
    glow.intensity = open * level * (7 + Math.sin(t * 13) * 1.2 + Math.sin(t * 5.7) * 1.4);
    for (const p of puffs) {
      p.age += dt;
      const k = p.age / p.life;
      if (p.age < 0 || k >= 1) { p.s.visible = false; continue; }
      p.s.visible = true;
      p.s.position.addScaledVector(p.v, dt);
      p.s.position.x += Math.sin(t * 2 + p.life * 5) * dt * 0.25;
      const size = 0.25 + k * 1.1;
      p.s.scale.set(size, size, 1);
      p.s.material.opacity = Math.sin(Math.min(1, k * 4) * Math.PI / 2) * (1 - k) * 0.75;
    }
  }
  return { target: hitArea, toggle, tick, get lit() { return lit; } };
}

// ======================================================================== assemble
export async function buildCard() {
  await loadFigmaAtlas();
  const root = new THREE.Group();     // card frame (fold at origin)
  const base = buildBase();
  base.userData.asset = 'Base (inside)';
  root.add(base);

  const hinge = new THREE.Group();
  hinge.position.y = HINGE_Y;
  root.add(hinge);
  const { panel, art: panelArt } = buildPanel();
  hinge.add(panel);
  panelArt.userData.asset = 'Back panel art';
  const cover = buildCover();
  cover.userData.asset = 'Cover';
  panel.add(cover);

  // pop-up layers, back to front (the Figma design split into parallel folds)
  const frontChunks = chunksOf('front');
  const frontShift = groundShift(frontChunks);
  // the girl behind is lowered with her friend, so they overlap as in the design
  const stars = makeLayer(root, 1.4, 6.0, [{ x: 2.5 }, { x: 5.5 }], '#c3da86');
  stackChunks(stars.art, chunksOf('stars'), panelToCard(), { shiftY: (c) => (c.name.startsWith('A ') ? frontShift : 0) });
  const friend = makeLayer(root, 2.8, 2.5, [{ x: 3.0, from: 1.4 }, { x: 5.0, from: 1.4 }], '#f4a3b8');
  stackChunks(friend.art, frontChunks, panelToCard(frontShift));
  const cakeChunks = chunksOf('cake');
  const cake = makeLayer(root, 2.4, 3.5, [{ x: -5.5 }, { x: -2.5 }], '#f0f2a1');
  // cake shown 1.2x the design size, scaled about its bottom centre
  const CAKE_SCALE = 1.2, cakeCx = -3.3;
  const cakeArt = new THREE.Group();
  cakeArt.scale.set(CAKE_SCALE, CAKE_SCALE, 1);
  cakeArt.position.x = cakeCx * (1 - CAKE_SCALE);
  cake.art.add(cakeArt);
  const cakePieces = stackChunks(cakeArt, cakeChunks, panelToCard(groundShift(cakeChunks)));
  const candle = makeCandle(cakeArt, cakePieces.find((p) => p.name === 'flame'));
  // banner tabs hook onto the layer directly behind each side, never through it
  const banner = makeLayer(root, 7.0, 0.35, [{ x: -2.6, from: 2.4 }, { x: 2.6, from: 2.8 }], C.cream);
  stackChunks(banner.art, chunksOf('banner'), bannerToCard);

  const layers = [stars, friend, cake, banner];
  let alpha = 0;
  function setOpen(a) {
    alpha = a;
    hinge.rotation.x = Math.PI / 2 - a;
    const squish = THREE.MathUtils.clamp(Math.sin(a) * 3, 0.03, 1);
    panelArt.scale.z = squish;
    layers.forEach(l => l.update(a, squish));
  }
  setOpen(0);

  function tick(t, dt) { candle.tick(t, dt, Math.sin(alpha)); }

  // center of the closed card in card-frame coordinates (used to pivot the whole card)
  const closedCenter = new THREE.Vector3(0, 0.4, D / 2);
  return { root, setOpen, tick, closedCenter, candle, get alpha() { return alpha; } };
}
