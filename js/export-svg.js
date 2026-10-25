// Dev tool: export the felt designs as flat, editable SVG (one file per asset).
// Usage from the console:  const m = await import('/js/export-svg.js'); m.exportAssets(bday)
// Every felt piece becomes its outline path + its painted details (re-run through a
// recording canvas, so embroidery, faces and text come out as vectors) + its running stitch.
import * as THREE from 'three';
import { insetPoints } from './felt.js';

const S = 40;           // SVG px per card unit
const f = (n) => Math.round(n * 100) / 100;

// rgba(...) -> [color, opacity]  (SVG attributes don't reliably take rgba)
function paintOf(c) {
  if (typeof c !== 'string') return ['none', 1];
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return [c, 1];
  const [r, g, b, a = 1] = m[1].split(',').map(Number);
  return [`rgb(${r},${g},${b})`, a];
}

// Affine 2D matrix [a b c d e f]: x' = a x + c y + e, y' = b x + d y + f
const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const scaleOf = (m) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));

// Cubic approximation of an elliptical arc (affine-safe), in local coords.
function arcCubics(cx, cy, rx, ry, a0, delta, rot = 0) {
  const n = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9));
  const seg = delta / n, k = (4 / 3) * Math.tan(seg / 4);
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const P = (t) => { const x = rx * Math.cos(t), y = ry * Math.sin(t); return [cx + x * cr - y * sr, cy + x * sr + y * cr]; };
  const T = (t) => { const x = -rx * Math.sin(t), y = ry * Math.cos(t); return [x * cr - y * sr, x * sr + y * cr]; };
  const out = [];
  for (let i = 0; i < n; i++) {
    const t0 = a0 + seg * i, t1 = t0 + seg;
    const p0 = P(t0), p1 = P(t1), d0 = T(t0), d1 = T(t1);
    out.push([[p0[0] + k * d0[0], p0[1] + k * d0[1]], [p1[0] - k * d1[0], p1[1] - k * d1[1]], p1]);
  }
  return { start: P(a0), cubics: out };
}

class Bounds {
  constructor() { this.x0 = Infinity; this.y0 = Infinity; this.x1 = -Infinity; this.y1 = -Infinity; }
  add(x, y, pad = 0) {
    this.x0 = Math.min(this.x0, x - pad); this.y0 = Math.min(this.y0, y - pad);
    this.x1 = Math.max(this.x1, x + pad); this.y1 = Math.max(this.y1, y + pad);
  }
}

// THREE.Shape / Path -> SVG path data under matrix M
function curvesToD(path, M, B) {
  let d = '';
  const P = (x, y) => { const [X, Y] = apply(M, x, y); B.add(X, Y); return `${f(X)} ${f(Y)}`; };
  path.curves.forEach((c, i) => {
    if (c.isEllipseCurve) {
      let delta = c.aEndAngle - c.aStartAngle;
      const same = Math.abs(delta) < 1e-6;
      while (delta < 0) delta += Math.PI * 2;
      while (delta > Math.PI * 2) delta -= Math.PI * 2;
      if (delta < 1e-6) delta = same ? 0 : Math.PI * 2;
      if (c.aClockwise && !same) delta = delta === Math.PI * 2 ? -Math.PI * 2 : delta - Math.PI * 2;
      const { start, cubics } = arcCubics(c.aX, c.aY, c.xRadius, c.yRadius, c.aStartAngle, delta, c.aRotation);
      d += (i === 0 ? 'M' : 'L') + P(...start);
      for (const [c1, c2, p] of cubics) d += `C${P(...c1)} ${P(...c2)} ${P(...p)}`;
      return;
    }
    const s = c.v0 || c.v1;
    if (i === 0) d += 'M' + P(s.x, s.y);
    if (c.isLineCurve) d += 'L' + P(c.v2.x, c.v2.y);
    else if (c.isQuadraticBezierCurve) d += `Q${P(c.v1.x, c.v1.y)} ${P(c.v2.x, c.v2.y)}`;
    else if (c.isCubicBezierCurve) d += `C${P(c.v1.x, c.v1.y)} ${P(c.v2.x, c.v2.y)} ${P(c.v3.x, c.v3.y)}`;
    else c.getPoints(12).slice(1).forEach((p) => (d += 'L' + P(p.x, p.y)));
  });
  return d + 'Z';
}

// A Canvas2D-compatible recorder that emits SVG elements
class SvgCtx {
  constructor(M, B, defs) {
    this.B = B; this.defs = defs; this.out = [];
    this.st = { m: M, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', dash: [],
      globalAlpha: 1, font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic', clip: null };
    this.stack = []; this.d = ''; this.cur = null;
  }
  // state passthrough
  get fillStyle() { return this.st.fillStyle; } set fillStyle(v) { this.st.fillStyle = v; }
  get strokeStyle() { return this.st.strokeStyle; } set strokeStyle(v) { this.st.strokeStyle = v; }
  get lineWidth() { return this.st.lineWidth; } set lineWidth(v) { this.st.lineWidth = v; }
  get lineCap() { return this.st.lineCap; } set lineCap(v) { this.st.lineCap = v; }
  get lineJoin() { return this.st.lineJoin; } set lineJoin(v) { this.st.lineJoin = v; }
  get globalAlpha() { return this.st.globalAlpha; } set globalAlpha(v) { this.st.globalAlpha = v; }
  get font() { return this.st.font; } set font(v) { this.st.font = v; }
  get textAlign() { return this.st.textAlign; } set textAlign(v) { this.st.textAlign = v; }
  get textBaseline() { return this.st.textBaseline; } set textBaseline(v) { this.st.textBaseline = v; }
  set letterSpacing(v) {} set shadowColor(v) {} set shadowBlur(v) {} set shadowOffsetX(v) {} set shadowOffsetY(v) {}
  set globalCompositeOperation(v) {}
  setLineDash(a) { this.st.dash = a; }
  save() { this.stack.push({ ...this.st, dash: [...this.st.dash] }); }
  restore() { if (this.stack.length) this.st = this.stack.pop(); }
  transform(a, b, c, d, e, f2) { this.st.m = mul(this.st.m, [a, b, c, d, e, f2]); }
  translate(x, y) { this.transform(1, 0, 0, 1, x, y); }
  scale(x, y) { this.transform(x, 0, 0, y, 0, 0); }
  rotate(t) { this.transform(Math.cos(t), Math.sin(t), -Math.sin(t), Math.cos(t), 0, 0); }
  setTransform() {}   // only used by the texture code, never by paint routines
  createPattern() { return null; }
  // path building (device coords)
  P(x, y) { const [X, Y] = apply(this.st.m, x, y); return `${f(X)} ${f(Y)}`; }
  beginPath() { this.d = ''; this.cur = null; }
  moveTo(x, y) { this.d += 'M' + this.P(x, y); this.cur = [x, y]; }
  lineTo(x, y) { this.d += (this.cur ? 'L' : 'M') + this.P(x, y); this.cur = [x, y]; }
  quadraticCurveTo(a, b, x, y) { this.d += `Q${this.P(a, b)} ${this.P(x, y)}`; this.cur = [x, y]; }
  bezierCurveTo(a, b, c, d, x, y) { this.d += `C${this.P(a, b)} ${this.P(c, d)} ${this.P(x, y)}`; this.cur = [x, y]; }
  closePath() { this.d += 'Z'; }
  rect(x, y, w, h) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); }
  ellipse(x, y, rx, ry, rot, a0, a1, ccw = false) {
    let delta = a1 - a0;
    if (!ccw) { if (delta >= Math.PI * 2) delta = Math.PI * 2; else while (delta < 0) delta += Math.PI * 2; }
    else { if (delta <= -Math.PI * 2) delta = -Math.PI * 2; else while (delta > 0) delta -= Math.PI * 2; }
    const { start, cubics } = arcCubics(x, y, rx, ry, a0, delta, rot);
    this.d += (this.cur ? 'L' : 'M') + this.P(...start);
    for (const [c1, c2, p] of cubics) this.d += `C${this.P(...c1)} ${this.P(...c2)} ${this.P(...p)}`;
    this.cur = cubics.length ? cubics[cubics.length - 1][2] : start;
  }
  arc(x, y, r, a0, a1, ccw) { this.ellipse(x, y, r, r, 0, a0, a1, ccw); }
  clip() {
    const id = `c${this.defs.n++}`;
    this.defs.list.push(`<clipPath id="${id}"><path d="${this.d}"/></clipPath>`);
    this.st.clip = id;
  }
  attrsClip() { return this.st.clip ? ` clip-path="url(#${this.st.clip})"` : ''; }
  fill() {
    const [c, a] = paintOf(this.st.fillStyle);
    if (c === 'none' || !this.d) return;
    this.out.push(`<path d="${this.d}" fill="${c}"${a * this.st.globalAlpha < 1 ? ` fill-opacity="${f(a * this.st.globalAlpha)}"` : ''}${this.attrsClip()}/>`);
  }
  stroke() {
    const [c, a] = paintOf(this.st.strokeStyle);
    if (c === 'none' || !this.d) return;
    const k = scaleOf(this.st.m);
    const dash = this.st.dash.length ? ` stroke-dasharray="${this.st.dash.map((v) => f(v * k)).join(' ')}"` : '';
    this.out.push(`<path d="${this.d}" fill="none" stroke="${c}"${a < 1 ? ` stroke-opacity="${f(a)}"` : ''} stroke-width="${f(this.st.lineWidth * k)}" stroke-linecap="${this.st.lineCap}" stroke-linejoin="${this.st.lineJoin}"${dash}${this.attrsClip()}/>`);
  }
  fillRect(x, y, w, h) { const d = this.d, cur = this.cur; this.beginPath(); this.rect(x, y, w, h); this.fill(); this.d = d; this.cur = cur; }
  strokeText() {}
  fillText(str, x, y) {
    const m = this.st.font.match(/(\d+)\s+([\d.]+)px\s+"?([^"]+)"?/);
    if (!m) return;
    const [, weight, size, family] = m;
    const [c, a] = paintOf(this.st.fillStyle);
    const M = mul(this.st.m, [1, 0, 0, 1, x, y]);
    const anchor = { center: 'middle', left: 'start', start: 'start', right: 'end', end: 'end' }[this.st.textAlign] || 'start';
    const esc = str.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    this.out.push(`<text transform="matrix(${M.map(f).join(' ')})" font-family="${family}" font-weight="${weight}" font-size="${size}" text-anchor="${anchor}" dominant-baseline="${this.st.textBaseline === 'middle' ? 'central' : 'auto'}" fill="${c}"${a < 1 ? ` fill-opacity="${a}"` : ''}>${esc}</text>`);
    const [X, Y] = apply(M, 0, 0);
    this.B.add(X, Y, Number(size) * scaleOf(M) * str.length * 0.3);
  }
}

function pieceSVG(mesh, M, B, defs, n) {
  const { shape, color, stitch, inset, stitchWidth, paint } = mesh.userData.felt;
  const parts = [];
  let d = curvesToD(shape, M, B);
  for (const h of shape.holes) d += curvesToD(h, M, B);
  parts.push(`<path d="${d}" fill="${color}" fill-rule="evenodd"/>`);
  if (paint) {
    const id = `p${defs.n++}`;
    defs.list.push(`<clipPath id="${id}"><path d="${d}" clip-rule="evenodd"/></clipPath>`);
    const ctx = new SvgCtx(M, new Bounds(), defs);
    const bb = new THREE.Box2();
    shape.getPoints(24).forEach((p) => bb.expandByPoint(p));
    paint(ctx, { min: bb.min, max: bb.max });
    if (ctx.out.length) parts.push(`<g id="details" clip-path="url(#${id})">${ctx.out.join('')}</g>`);
  }
  if (stitch) {
    const pts = insetPoints(shape, inset, Math.max(60, Math.round(shape.getLength() * 9)));
    const sd = pts.map((p, i) => (i ? 'L' : 'M') + apply(M, p.x, p.y).map(f).join(' ')).join('') + 'Z';
    const k = scaleOf(M);
    parts.push(`<path id="stitch" d="${sd}" fill="none" stroke="${stitch}" stroke-width="${f(stitchWidth * k)}" stroke-linecap="round" stroke-dasharray="${f(0.13 * k)} ${f(0.09 * k)}"/>`);
  }
  return `<g id="piece ${n}">${parts.join('')}</g>`;
}

function assetSVG(root) {
  root.updateWorldMatrix(true, true);
  const inv = root.matrixWorld.clone().invert();
  const B = new Bounds();
  const defs = { list: [], n: 0 };
  const items = [];
  let order = 0;
  root.traverse((o) => {
    const u = o.userData;
    if (!(u.felt || u.pom || u.thread)) return;
    const rel = inv.clone().multiply(o.matrixWorld).elements;
    // card units -> svg px, y flipped
    const M = [S * rel[0], -S * rel[1], S * rel[4], -S * rel[5], S * rel[12], -S * rel[13]];
    let group = null;
    for (let p = o.parent; p && p !== root; p = p.parent) if (p.name) { group = p.name; break; }
    items.push({ o, M, z: rel[14], group, order: order++ });
  });
  items.sort((a, b) => a.z - b.z || a.order - b.order);

  const body = [];
  let open = null;
  items.forEach((it, i) => {
    if (it.group !== open) {
      if (open) body.push('</g>');
      if (it.group) body.push(`<g id="${it.group}">`);
      open = it.group;
    }
    const u = it.o.userData;
    if (u.felt) body.push(pieceSVG(it.o, it.M, B, defs, i));
    else if (u.pom) {
      const [X, Y] = apply(it.M, 0, 0);
      const r = u.pom.r * S;
      B.add(X, Y, r);
      body.push(`<circle id="pom" cx="${f(X)}" cy="${f(Y)}" r="${f(r)}" fill="${u.pom.color}"/>`);
    } else if (u.thread) {
      const d = u.thread.points.map(([x, y], j) => { const [X, Y] = apply(it.M, x, y); B.add(X, Y); return (j ? 'L' : 'M') + f(X) + ' ' + f(Y); }).join('');
      body.push(`<path id="thread" d="${d}" fill="none" stroke="${u.thread.color}" stroke-width="${f(u.thread.radius * 2 * S)}" stroke-linecap="round"/>`);
    }
  });
  if (open) body.push('</g>');

  const pad = 12;
  const x = B.x0 - pad, y = B.y0 - pad, w = B.x1 - B.x0 + pad * 2, h = B.y1 - B.y0 + pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(w)}" height="${f(h)}" viewBox="${f(x)} ${f(y)} ${f(w)} ${f(h)}">` +
    `<defs>${defs.list.join('')}</defs>${body.join('')}</svg>`;
}

// Returns { name: svgString } for every tagged asset; poses the card open and the envelope closed first.
export function exportAssets({ card, env }) {
  const prevAlpha = card.alpha;
  const flapRot = env.flap.rotation.x, flapZ = env.flap.position.z;
  card.setOpen(Math.PI / 2);
  env.flap.rotation.x = 0;
  env.flap.position.z = 0.66;
  const out = {};
  for (const root of [card.root, env.body]) {
    root.traverse((o) => { if (o.userData.asset) out[o.userData.asset] = assetSVG(o); });
  }
  card.setOpen(prevAlpha);
  env.flap.rotation.x = flapRot;
  env.flap.position.z = flapZ;
  return out;
}
