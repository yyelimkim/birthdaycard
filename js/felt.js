// Felt toolkit: every visible piece of the card is a thin extruded "felt" cutout
// with a painted canvas texture (fibres + stitching + embroidery) and a sheen material.
import * as THREE from 'three';

const PPU = 44;          // texture pixels per world unit
const MAX_TEX = 1024;

// ---------------------------------------------------------------- fibre noise
// One shared grayscale fibre canvas, used as an overlay pattern and as the bump map.
const FIBRE_SIZE = 512;
export const fibreCanvas = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = FIBRE_SIZE;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, FIBRE_SIZE, FIBRE_SIZE);
  const strand = (light) => {
    const x = Math.random() * FIBRE_SIZE, y = Math.random() * FIBRE_SIZE;
    const a = Math.random() * Math.PI * 2, len = 4 + Math.random() * 14;
    const bend = (Math.random() - 0.5) * 8;
    g.strokeStyle = light ? `rgba(255,255,255,${0.08 + Math.random() * 0.18})`
                          : `rgba(0,0,0,${0.06 + Math.random() * 0.16})`;
    g.lineWidth = 0.6 + Math.random() * 0.9;
    // draw wrapped so the tile is seamless
    for (const ox of [-FIBRE_SIZE, 0, FIBRE_SIZE]) for (const oy of [-FIBRE_SIZE, 0, FIBRE_SIZE]) {
      const sx = x + ox, sy = y + oy;
      if (sx < -20 || sx > FIBRE_SIZE + 20 || sy < -20 || sy > FIBRE_SIZE + 20) continue;
      g.beginPath();
      g.moveTo(sx, sy);
      g.quadraticCurveTo(sx + Math.cos(a) * len / 2 - Math.sin(a) * bend, sy + Math.sin(a) * len / 2 + Math.cos(a) * bend,
                         sx + Math.cos(a) * len, sy + Math.sin(a) * len);
      g.stroke();
    }
  };
  for (let i = 0; i < 9000; i++) strand(i % 2 === 0);
  // soft mottling
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * FIBRE_SIZE, y = Math.random() * FIBRE_SIZE, r = 6 + Math.random() * 26;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const v = Math.random() < 0.5 ? '255,255,255' : '0,0,0';
    grd.addColorStop(0, `rgba(${v},0.05)`);
    grd.addColorStop(1, `rgba(${v},0)`);
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return c;
})();

const fibreBump = new THREE.CanvasTexture(fibreCanvas);
fibreBump.wrapS = fibreBump.wrapT = THREE.RepeatWrapping;
fibreBump.colorSpace = THREE.NoColorSpace;

// ---------------------------------------------------------------- shapes
export function circle(r, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  s.absarc(cx, cy, r, 0, Math.PI * 2, false);
  return s;
}

export function ellipse(rx, ry, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  s.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, false, 0);
  return s;
}

export function roundRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// Polygon with every corner rounded (works for concave corners too).
// A point may carry its own radius as a third value: [x, y, r].
export function roundedPoly(pts, r) {
  const s = new THREE.Shape();
  const n = pts.length;
  const P = pts.map(([x, y]) => new THREE.Vector2(x, y));
  for (let i = 0; i < n; i++) {
    const prev = P[(i - 1 + n) % n], cur = P[i], next = P[(i + 1) % n];
    const d1 = prev.clone().sub(cur), d2 = next.clone().sub(cur);
    const rr = Math.min(pts[i][2] ?? r, d1.length() / 2, d2.length() / 2);
    const a = cur.clone().add(d1.normalize().multiplyScalar(rr));
    const b = cur.clone().add(d2.normalize().multiplyScalar(rr));
    if (i === 0) s.moveTo(a.x, a.y); else s.lineTo(a.x, a.y);
    s.quadraticCurveTo(cur.x, cur.y, b.x, b.y);
  }
  s.closePath();
  return s;
}

// Smooth closed blob through control points.
export function blob(pts, samples = 90) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'centripetal');
  return new THREE.Shape(curve.getPoints(samples).slice(0, -1).map(p => new THREE.Vector2(p.x, p.y)));
}

// Puffy hand-cut star.
export function star(cx, cy, R, r = R * 0.5, n = 5, rot = 0) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + Math.PI / 2 + (i * Math.PI) / n;
    const rad = i % 2 === 0 ? R : r;
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  return roundedPoly(pts, R * 0.16);
}

export function heart(cx, cy, size) {
  const s = new THREE.Shape();
  const k = size;
  s.moveTo(cx, cy - k * 0.9);
  s.bezierCurveTo(cx - k * 0.3, cy - k * 0.55, cx - k * 1.05, cy - k * 0.1, cx - k * 0.95, cy + k * 0.35);
  s.bezierCurveTo(cx - k * 0.85, cy + k * 0.85, cx - k * 0.2, cy + k * 0.9, cx, cy + k * 0.45);
  s.bezierCurveTo(cx + k * 0.2, cy + k * 0.9, cx + k * 0.85, cy + k * 0.85, cx + k * 0.95, cy + k * 0.35);
  s.bezierCurveTo(cx + k * 1.05, cy - k * 0.1, cx + k * 0.3, cy - k * 0.55, cx, cy - k * 0.9);
  return s;
}

// ---------------------------------------------------------------- painting helpers
// Inward-offset outline of a shape, for running stitches.
function insetPoints(shape, inset, count) {
  const pts = shape.getSpacedPoints(count).slice(0, -1);
  const cw = THREE.ShapeUtils.isClockWise(pts);
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    let dx = b.x - a.x, dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    dx /= L; dy /= L;
    // left normal is inward for CCW
    const nx = cw ? dy : -dy, ny = cw ? -dx : dx;
    return new THREE.Vector2(p.x + nx * inset, p.y + ny * inset);
  });
}

function tracePts(g, pts, close = true) {
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  if (close) g.closePath();
}

export function stitchPath(g, pts, { color = '#fff8ec', width = 0.045, dash = 0.13, gap = 0.09, close = true } = {}) {
  g.save();
  g.lineCap = 'round';
  g.setLineDash([dash, gap]);
  // tiny shadow beneath the thread
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = width;
  g.translate(0.012, -0.012);
  tracePts(g, pts, close);
  g.stroke();
  g.translate(-0.012, 0.012);
  g.strokeStyle = color;
  tracePts(g, pts, close);
  g.stroke();
  g.restore();
}

export function stitchLine(g, pts, opts) {
  stitchPath(g, pts.map(([x, y]) => new THREE.Vector2(x, y)), { ...opts, close: false });
}

// Upright text in shape space (canvas y is flipped).
export function text(g, str, x, y, { size = 1, font = 'Fredoka', weight = 600, color = '#fff', align = 'center',
  stitch = null, outline = null, rotate = 0, spacing = 0 } = {}) {
  g.save();
  g.translate(x, y);
  g.scale(0.01, -0.01);   // work at 100x so tiny font sizes don't get hinted/clamped
  g.rotate(-rotate);
  size *= 100;
  g.font = `${weight} ${size}px "${font}"`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  if (spacing) g.letterSpacing = `${spacing * 100}px`;
  if (outline) {
    g.lineJoin = 'round';
    g.strokeStyle = outline.color;
    g.lineWidth = outline.width * 100;
    g.strokeText(str, 0, 0);
  }
  g.shadowColor = 'rgba(0,0,0,0.28)';
  g.shadowOffsetY = 0.04 * PPU;
  g.shadowBlur = 0.06 * PPU;
  g.fillStyle = color;
  g.fillText(str, 0, 0);
  g.shadowColor = 'transparent';
  if (stitch) {
    g.setLineDash([size * 0.07, size * 0.06]);
    g.strokeStyle = stitch;
    g.lineWidth = size * 0.025;
    g.strokeText(str, 0, 0);
  }
  g.restore();
}

export function dots(g, list, r = 0.06) {
  for (const [x, y, c, rr] of list) {
    g.fillStyle = c;
    g.beginPath();
    g.arc(x, y, rr ?? r, 0, Math.PI * 2);
    g.fill();
  }
}

// ---------------------------------------------------------------- material + mesh
function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + amt, 0, 1));
  return '#' + c.getHexString();
}

export const pieces = []; // every felt mesh, for raycasting / bookkeeping

/**
 * Build one felt cutout.
 * shape: THREE.Shape in local XY; extruded toward +Z by `depth`.
 * opts.color, opts.stitch (thread colour or false), opts.inset, opts.paint(g, bbox)
 */
export function felt(shape, opts = {}) {
  const {
    color = '#f2e6d0', depth = 0.14, z = 0, stitch = shade(color, 0.22), inset = 0.16,
    paint = null, stitchWidth = 0.045, sheen = 0.9, bump = 1, holes = null,
  } = opts;
  if (holes) shape.holes.push(...holes);
  const bev = Math.min(0.06, depth * 0.4);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.8, bevelSegments: 3, curveSegments: 32,
  });
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const w = bb.max.x - bb.min.x, h = bb.max.y - bb.min.y;

  // planar UVs over the XY bounding box, for front, back and sides alike
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - bb.min.x) / w, (pos.getY(i) - bb.min.y) / h);
  }
  uv.needsUpdate = true;

  // paint the texture in shape space
  const scale = Math.min(PPU, MAX_TEX / w, MAX_TEX / h);
  const cw = Math.max(8, Math.ceil(w * scale)), ch = Math.max(8, Math.ceil(h * scale));
  const cvs = document.createElement('canvas');
  cvs.width = cw; cvs.height = ch;
  const g = cvs.getContext('2d');
  g.fillStyle = color;
  g.fillRect(0, 0, cw, ch);
  g.setTransform(cw / w, 0, 0, -ch / h, -bb.min.x * cw / w, bb.max.y * ch / h);

  if (paint) paint(g, bb);
  if (stitch) stitchPath(g, insetPoints(shape, inset, Math.max(60, Math.round(shape.getLength() * 9))), { color: stitch, width: stitchWidth });

  // fibres on top of everything (thread included) so it all reads as textile
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'overlay';
  g.globalAlpha = 0.55;
  g.fillStyle = g.createPattern(fibreCanvas, 'repeat');
  g.fillRect(0, 0, cw, ch);
  g.restore();

  const map = new THREE.CanvasTexture(cvs);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const bumpMap = fibreBump.clone();
  bumpMap.repeat.set(cw / FIBRE_SIZE, ch / FIBRE_SIZE);
  bumpMap.needsUpdate = true;

  const mat = new THREE.MeshPhysicalMaterial({
    map, bumpMap, bumpScale: 2.2 * bump, roughness: 1, metalness: 0,
    sheen, sheenRoughness: 0.55, sheenColor: new THREE.Color(shade(color, 0.25)),
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = z;
  mesh.userData.felt = { shape, color, stitch, inset, stitchWidth, paint };   // for the SVG exporter
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  pieces.push(mesh);
  return mesh;
}

// A soft round felt ball (pom-pom bead)
const ballGeo = new THREE.SphereGeometry(1, 16, 12);
export function pom(color, r, x, y, z = 0) {
  const m = new THREE.Mesh(ballGeo, new THREE.MeshPhysicalMaterial({
    color, roughness: 1, sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color(shade(color, 0.3)),
    bumpMap: fibreBump, bumpScale: 1.5,
  }));
  m.scale.set(r, r, r * 0.8);
  m.position.set(x, y, z + r * 0.6);
  m.userData.pom = { color, r };
  m.castShadow = true;
  return m;
}

// Thread / string as a tube along points.
export function thread(points, color = '#e9dcc5', radius = 0.03) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z = 0]) => new THREE.Vector3(x, y, z)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, radius, 6, false),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
  m.castShadow = true;
  m.userData.thread = { points, color, radius };
  return m;
}

export { shade, insetPoints };
