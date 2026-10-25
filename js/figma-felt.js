// Felt pieces built from the Figma design.
// assets/figma/atlas.png holds every "chunk" of the design (rendered from Figma at 3x),
// assets/figma/chunks.json says where each chunk sits in its Figma frame and in the atlas.
// Each chunk becomes a thick felt cutout: outline traced from the art's alpha, front face
// printed with the art + felt fibres, solid felt sides, and a soft drop shadow beneath it.
import * as THREE from 'three';
import { fibreCanvas } from './felt.js';

const MARGIN = 24;            // slot margin used when the atlas was built (frame px)
export const FRAME_PX = 40;   // Figma frame px per card unit (same scale the vectors were exported at)

let atlasImg = null, meta = null;
export async function loadFigmaAtlas() {
  [atlasImg, meta] = await Promise.all([
    new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'assets/figma/atlas.png?v=2'; }),
    fetch('assets/figma/chunks.json?v=2').then((r) => r.json()),
  ]);
}
export const chunksOf = (layer) => meta.chunks.filter((c) => c[0] === layer).map(([, name, r]) => ({
  name, frame: { x: r[0], y: r[1], w: r[2], h: r[3] }, slot: { x: r[4], y: r[5], w: r[6], h: r[7] },
}));

const fibreBump = new THREE.CanvasTexture(fibreCanvas);
fibreBump.wrapS = fibreBump.wrapT = THREE.RepeatWrapping;

// ------------------------------------------------------------ outline tracing
const DIRS = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]];

function components(mask, W, H, minArea) {
  const label = new Int32Array(W * H);
  const out = [];
  let id = 0;
  for (let i = 0; i < W * H; i++) {
    if (!mask[i] || label[i]) continue;
    id++;
    const stack = [i];
    label[i] = id;
    let n = 0;
    while (stack.length) {
      const p = stack.pop(); n++;
      const x = p % W, y = (p / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const qx = x + dx, qy = y + dy;
        if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue;
        const q = qy * W + qx;
        if (mask[q] && !label[q]) { label[q] = id; stack.push(q); }
      }
    }
    if (n >= minArea) out.push({ id, start: i });
  }
  return { label, out };
}

// Moore-neighbour boundary trace of one labelled component
function trace(label, W, H, id, start) {
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && label[y * W + x] === id;
  const sx = start % W, sy = (start / W) | 0;
  const pts = [[sx, sy]];
  let px = sx, py = sy, back = 0;    // backtrack direction (west of the first pixel is empty)
  for (let guard = 0; guard < W * H * 4; guard++) {
    let found = -1;
    for (let k = 1; k <= 8; k++) {
      const d = (back + k) % 8;
      if (inside(px + DIRS[d][0], py + DIRS[d][1])) { found = d; break; }
    }
    if (found < 0) break;                          // isolated pixel
    const bx = px + DIRS[(found + 7) % 8][0], by = py + DIRS[(found + 7) % 8][1];
    px += DIRS[found][0]; py += DIRS[found][1];
    back = DIRS.findIndex(([dx, dy]) => dx === bx - px && dy === by - py);
    if (px === sx && py === sy) break;
    pts.push([px, py]);
  }
  return pts;
}

function simplify(pts, eps) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const L = Math.hypot(bx - ax, by - ay) || 1;
    let md = 0, mi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L;
      if (d > md) { md = d; mi = i; }
    }
    if (md > eps) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// one round of Chaikin smoothing: softens pixel stair-steps into cut-felt curves
const chaikin = (pts) => pts.flatMap(([x, y], i) => {
  const [nx, ny] = pts[(i + 1) % pts.length];
  return [[x * 0.75 + nx * 0.25, y * 0.75 + ny * 0.25], [x * 0.25 + nx * 0.75, y * 0.25 + ny * 0.75]];
});

// ------------------------------------------------------------ piece
/**
 * Build one felt chunk.
 * toCard(fx, fy) maps Figma frame px -> card units (y up).
 * Returns a Group (piece + its drop shadow) positioned at z = 0; caller sets group.position.z.
 */
export function figmaPiece(chunk, toCard, { depth = 0.08, shadow = 0.42, shadowOffset = 0.07, castShadow = true, grow = 0, close = 0 } = {}) {
  const S = meta.scale;
  const { slot, frame } = chunk;
  const cw = Math.round(slot.w * S), ch = Math.round(slot.h * S);

  // the chunk's art (optionally dilated by `grow` frame px, e.g. so hair fully covers the skin edge below it)
  const art = document.createElement('canvas');
  art.width = cw; art.height = ch;
  const g = art.getContext('2d', { willReadFrequently: true });
  const sx = Math.round(slot.x * S), sy = Math.round(slot.y * S);
  if (grow) {
    const r = grow * S;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) g.drawImage(atlasImg, sx, sy, cw, ch, Math.cos(a) * r, Math.sin(a) * r, cw, ch);
  }
  g.drawImage(atlasImg, sx, sy, cw, ch, 0, 0, cw, ch);
  const data = g.getImageData(0, 0, cw, ch).data;
  // `close` (frame px): outline from a blurred alpha, so needle-thin gaps and slivers close up
  let maskData = data;
  if (close) {
    const bc = document.createElement('canvas');
    bc.width = cw; bc.height = ch;
    const bg = bc.getContext('2d', { willReadFrequently: true });
    bg.filter = `blur(${close * S}px)`;
    bg.drawImage(art, 0, 0);
    maskData = bg.getImageData(0, 0, cw, ch).data;
  }

  // alpha mask on a 1-frame-px grid
  const W = Math.ceil(slot.w), H = Math.ceil(slot.h);
  const mask = new Uint8Array(W * H);
  let r = 0, gg = 0, b = 0, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (Math.min(ch - 1, Math.round((y + 0.5) * S)) * cw + Math.min(cw - 1, Math.round((x + 0.5) * S))) * 4;
    if (maskData[i + 3] > 120) mask[y * W + x] = 1;
    if (data[i + 3] > 120) { r += data[i]; gg += data[i + 1]; b += data[i + 2]; n++; }
  }
  const sideColor = new THREE.Color(`rgb(${Math.round(r / n)},${Math.round(gg / n)},${Math.round(b / n)})`).multiplyScalar(0.9);

  // slot px -> frame px -> card units
  const ox = frame.x - MARGIN, oy = frame.y - MARGIN;
  const toC = (gx, gy) => toCard(ox + gx, oy + gy);
  const { label, out } = components(mask, W, H, 12);
  const shapes = out.map(({ id, start }) => {
    let pts = trace(label, W, H, id, start).map(([x, y]) => [x + 0.5, y + 0.5]);
    pts = chaikin(simplify(pts, 0.6));
    return new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(...toC(x, y))));
  });

  // printed face: art with felt fibres laid over it (kept inside the art's alpha)
  const fib = document.createElement('canvas');
  fib.width = cw; fib.height = ch;
  const fg = fib.getContext('2d');
  fg.drawImage(art, 0, 0);
  fg.globalCompositeOperation = 'overlay';
  fg.globalAlpha = 0.5;
  fg.fillStyle = fg.createPattern(fibreCanvas, 'repeat');
  fg.fillRect(0, 0, cw, ch);
  fg.globalCompositeOperation = 'destination-in';
  fg.globalAlpha = 1;
  fg.drawImage(art, 0, 0);
  if (close) {   // solid face: any closed-up gap is filled with the piece's own colour
    fg.globalCompositeOperation = 'destination-over';
    fg.fillStyle = `rgb(${Math.round(r / n)},${Math.round(gg / n)},${Math.round(b / n)})`;
    fg.fillRect(0, 0, cw, ch);
  }
  const map = new THREE.CanvasTexture(fib);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const [x0, y1] = toC(0, 0), [x1, y0] = toC(slot.w, slot.h);
  const bump = fibreBump.clone();
  bump.repeat.set(cw / 512, ch / 512);
  bump.needsUpdate = true;
  const capMat = new THREE.MeshPhysicalMaterial({
    map, alphaTest: close ? 0 : 0.5, bumpMap: bump, bumpScale: 2.2, roughness: 1, sheen: 0.9, sheenRoughness: 0.55,
    sheenColor: new THREE.Color(0xffffff).multiplyScalar(0.35),
  });
  const sideMat = new THREE.MeshPhysicalMaterial({ color: sideColor, roughness: 1, sheen: 0.9, sheenRoughness: 0.55, bumpMap: fibreBump, bumpScale: 2 });

  const bev = Math.min(0.025, depth * 0.35);
  const geo = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.6, bevelSegments: 2, curveSegments: 4 });
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - x0) / (x1 - x0), (pos.getY(i) - y0) / (y1 - y0));
  uv.needsUpdate = true;

  const group = new THREE.Group();
  group.name = chunk.name;
  const mesh = new THREE.Mesh(geo, [capMat, sideMat]);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  group.add(mesh);

  // soft drop shadow decal just beneath the piece (felt-on-felt, like the Figma drop shadows)
  if (shadow) {
    const sc = document.createElement('canvas');
    const k = 0.5;
    sc.width = Math.ceil(cw * k); sc.height = Math.ceil(ch * k);
    const sg = sc.getContext('2d');
    sg.filter = `blur(${(3.2 * S * k).toFixed(1)}px)`;
    sg.drawImage(art, 0, 0, sc.width, sc.height);
    sg.filter = 'none';
    sg.globalCompositeOperation = 'source-in';
    sg.fillStyle = '#2b0f17';
    sg.fillRect(0, 0, sc.width, sc.height);
    const st = new THREE.CanvasTexture(sc);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(x1 - x0, y1 - y0),
      new THREE.MeshBasicMaterial({ map: st, transparent: true, opacity: shadow, depthWrite: false }),
    );
    plane.position.set((x0 + x1) / 2 + shadowOffset * 0.3, (y0 + y1) / 2 - shadowOffset, -bev - 0.004);
    plane.renderOrder = 1;
    group.add(plane);
  }
  group.userData.depth = depth;
  group.userData.bev = bev;
  return group;
}
