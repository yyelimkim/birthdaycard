import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { gsap } from 'gsap';
import { buildCard } from './card.js';
import { buildEnvelope } from './envelope.js';
import { createConfetti } from './confetti.js';
import { fibreCanvas } from './felt.js';
import { sfx, setMuted, isMuted } from './audio.js';

const $ = (id) => document.getElementById(id);
history.scrollRestoration = 'manual';   // always start at the envelope, not the letter
const ui = { title: $('title'), hint: $('hint'), controls: $('controls'), replay: $('replay'), sound: $('sound') };

// fonts are painted into felt textures, so they must be ready before we build
await Promise.race([
  Promise.all(['700 64px Fredoka', '600 64px Fredoka', '700 64px Gaegu', '400 64px Gaegu'].map((f) => document.fonts.load(f))),
  new Promise((r) => setTimeout(r, 3000)),
]);

// ------------------------------------------------------------------ renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
$('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.5, 300);

scene.add(new THREE.HemisphereLight('#fff7f0', '#e7c3cc', 1.05));
const sun = new THREE.DirectionalLight('#fff0dd', 3.4);
sun.position.set(-9, 22, 13);
sun.castShadow = true;
const SHADOW = Math.min(innerWidth, innerHeight) < 600 ? 2048 : 4096;   // lighter on phones
sun.shadow.mapSize.set(SHADOW, SHADOW);
Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 70 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
sun.shadow.radius = 2.5;
scene.add(sun);
const fill = new THREE.DirectionalLight('#dfe7ff', 0.7);
fill.position.set(12, 6, 10);
scene.add(fill);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0, color: '#6b3a4a', depthWrite: false }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.44;
ground.receiveShadow = true;
scene.add(ground);

// ------------------------------------------------------------------ objects
const card = await buildCard();
const cardPivot = new THREE.Group();           // pivots the whole card about its closed centre
card.root.position.copy(card.closedCenter).negate();
cardPivot.add(card.root);
scene.add(cardPivot);

const env = buildEnvelope();
scene.add(env.group);

const confetti = createConfetti(scene);

// ------------------------------------------------------------------ camera framing
const view = { pos: new THREE.Vector3(), target: new THREE.Vector3() };

// distance at which a w x h region fills the viewport
function fitDistance(w, h) {
  const v = THREE.MathUtils.degToRad(camera.fov) / 2;
  const hz = Math.atan(Math.tan(v) * camera.aspect);
  return Math.max(w / 2 / Math.tan(hz), h / 2 / Math.tan(v));
}
const poses = {
  front: () => ({ pos: new THREE.Vector3(0, 0, fitDistance(28, 27)), target: new THREE.Vector3(0, 0, 0) }),
  open: () => {
    const dir = new THREE.Vector3(0, 0.5, 1).normalize();
    const target = new THREE.Vector3(0, 4.3, -0.5);
    // portrait phones: frame tighter so the card fills the width
    const fit = camera.aspect < 1 ? fitDistance(19.5, 22) : fitDistance(24, 22) * 0.98;
    return { pos: target.clone().addScaledVector(dir, fit), target };
  },
};
function snapView(pose) { view.pos.copy(pose.pos); view.target.copy(pose.target); }
function tweenView(pose, opts) {
  gsap.to(view.pos, { ...pose.pos, ...opts });
  gsap.to(view.target, { ...pose.target, ...opts });
}

const controls = new OrbitControls(camera, renderer.domElement);
Object.assign(controls, {
  enabled: false, enableDamping: true, dampingFactor: 0.08, enablePan: false,
  enableZoom: false,   // the wheel scrolls to the letter instead
  minDistance: 16, maxDistance: 75, minPolarAngle: 0.15, maxPolarAngle: Math.PI / 2 - 0.04, rotateSpeed: 0.7,
  minAzimuthAngle: -1.3, maxAzimuthAngle: 1.3,   // keep the inside of the card in view
});

// vertical swipes scroll the page to the letter; horizontal drags still orbit
renderer.domElement.style.touchAction = 'pan-y';

// ------------------------------------------------------------------ letter overlay
const veil = $('veil');
const SCROLL_HINT = 'scroll to read your card \u2193';
// felt flags hanging from the letter's string (same curve as the svg path: M4 6 Q160 34 316 6)
document.querySelector('.bunting').insertAdjacentHTML('beforeend', ['#f2b2bd', '#f6e39a', '#a8dccb', '#b9c7f2', '#f2a65a', '#f2b2bd', '#f6e39a', '#a8dccb', '#b9c7f2']
  .map((c, i) => {
    const x = 22 + i * 34.5, t = (x - 4) / 312, y = 6 + 2 * t * (1 - t) * 28;
    return `<span class="flag" style="left:${(x / 320) * 100}%;top:${(y / 40) * 100}%;--c:${c}"></span>`;
  }).join(''));
// the letter uses the same felt fibres as the 3D card
document.documentElement.style.setProperty('--fibre', `url(${fibreCanvas.toDataURL()})`);
function onScroll() {
  const p = THREE.MathUtils.clamp(scrollY / innerHeight, 0, 1);
  veil.style.opacity = p;
  ui.hint.style.opacity = p > 0.01 ? Math.max(0, 1 - p * 4) : '';
  ui.title.style.opacity = p > 0.01 ? Math.max(0, 1 - p * 4) : '';
}
addEventListener('scroll', onScroll, { passive: true });
// tapping anywhere outside the letter glides back up to the card
const backToCard = () => scrollTo({ top: 0, behavior: 'smooth' });
$('letter').addEventListener('click', (e) => { if (!e.target.closest('.felt-frame')) backToCard(); });
function allowScroll(on) {
  document.documentElement.classList.toggle('can-scroll', on);
  if (!on) scrollTo(0, 0);
  onScroll();
}

// ------------------------------------------------------------------ state machine
let stage = 'arrive';
const fold = { alpha: 0 };
const IN_ENVELOPE = new THREE.Vector3(0, -0.3, -0.3);

function setHint(title, hint) {
  for (const [el, txt] of [[ui.title, title], [ui.hint, hint]]) {
    if (txt === undefined) continue;
    el.classList.remove('show');
    if (txt) setTimeout(() => { el.textContent = txt; el.classList.add('show'); }, 220);
  }
}

function reset() {
  gsap.killTweensOf([fold, view.pos, view.target, cardPivot.position, cardPivot.rotation, cardPivot.scale,
    env.group.position, env.group.rotation, env.flap.position, env.flap.rotation, env.dissolve, ground.material]);
  stage = 'arrive';
  allowScroll(false);
  controls.enabled = false;
  ui.controls.classList.remove('show');
  confetti.clear();
  fold.alpha = 0;
  card.setOpen(0);
  cardPivot.position.copy(IN_ENVELOPE);
  cardPivot.rotation.set(Math.PI / 2, 0, 0);
  cardPivot.scale.setScalar(1);
  cardPivot.visible = false;
  env.group.visible = true;
  env.group.position.set(34, 0, 0);
  env.group.rotation.set(0, 0, 0.22);
  env.flap.rotation.x = 0;
  env.flap.position.z = 0.66;
  env.dissolve.value = 1;
  ground.material.opacity = 0;
  snapView(poses.front());
  setHint('', '');
  arrive();
}

function arrive() {
  setHint("You've got mail!", '');
  $('note').classList.add('show');
  sfx.arrive();
  const tl = gsap.timeline({ delay: 0.35 });
  tl.to(env.group.position, { x: 0, duration: 1.6, ease: 'power3.out' }, 0)
    .to(env.group.rotation, { z: 0, duration: 1.9, ease: 'elastic.out(1, 0.6)' }, 0)
    .to(env.dissolve, { value: 0, duration: 1.4, ease: 'power1.out' }, 0)
    .add(() => {
      cardPivot.visible = true;
      stage = 'envelope';
      setHint(undefined, 'tap the envelope to open it');
    });
}

function openEnvelope() {
  stage = 'busy';
  $('note').classList.remove('show');
  setHint('', '');
  sfx.openFlap();
  const tl = gsap.timeline();
  tl.to(env.flap.rotation, { x: -Math.PI, duration: 0.8, ease: 'power2.inOut' }, 0)
    .to(env.flap.position, { z: -1.0, duration: 0.01 }, 0.42)
    .add(() => sfx.slide(), 0.75)
    .to(env.group.position, { y: -10.5, duration: 1.1, ease: 'power2.inOut' }, 0.8)
    .to(cardPivot.position, { y: 5, duration: 1.1, ease: 'power2.inOut' }, 0.8)
    .to(env.dissolve, { value: 1, duration: 1.0, ease: 'power1.in' }, 1.85)
    .to(env.group.position, { y: -16, duration: 1.0, ease: 'power2.in' }, 1.85)
    .to(cardPivot.position, { x: 0, y: 0, z: 2.2, duration: 1.1, ease: 'power3.inOut' }, 1.85)
    .add(() => {
      env.group.visible = false;
      stage = 'card';
      setHint('', 'tap the card to open it');
    });
}

function openCard() {
  stage = 'busy';
  setHint('', '');
  const tl = gsap.timeline();
  tl.to(cardPivot.rotation, { x: 0, y: 0, duration: 1.7, ease: 'power2.inOut' }, 0)
    .to(cardPivot.position, { x: 0, y: 0, z: 0, duration: 1.7, ease: 'power2.inOut' }, 0)
    .add(() => tweenView(poses.open(), { duration: 2.2, ease: 'power2.inOut' }), 0)
    .to(ground.material, { opacity: 0.28, duration: 1.0 }, 1.0)
    .add(() => sfx.pop(), 0.95)
    .to(fold, { alpha: Math.PI / 2, duration: 1.5, ease: 'back.out(1.6)', onUpdate: () => card.setOpen(fold.alpha) }, 0.9)
    .add(() => confetti.burst(new THREE.Vector3(0, 3, 1)), 1.9)
    .add(() => sfx.song(), 2.4)
    .add(() => {
      stage = 'open';
      controls.target.copy(view.target);
      controls.enabled = true;
      ui.controls.classList.add('show');
      setHint('', SCROLL_HINT);
      allowScroll(true);
    }, 2.3);
}

// once open, tapping the card folds it fully shut or springs it fully open
function toggleFold() {
  const closing = fold.alpha > Math.PI / 4;
  gsap.killTweensOf(fold);
  if (closing) sfx.slide(); else sfx.pop();
  gsap.to(fold, {
    alpha: closing ? 0 : Math.PI / 2,
    duration: closing ? 1.1 : 1.4,
    ease: closing ? 'power2.inOut' : 'back.out(1.6)',
    onUpdate: () => card.setOpen(fold.alpha),
  });
  setHint(undefined, closing ? 'tap the card to open it' : SCROLL_HINT);
}

// ------------------------------------------------------------------ input
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function hit(e, obj) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObject(obj, true).length > 0;
}
const target = () => (stage === 'envelope' ? env.group : stage === 'card' || stage === 'open' ? cardPivot : null);

let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
  if (scrollY > 20) { backToCard(); return; }   // letter is up: a tap on the card area returns to it
  const t = target();
  if (!t || !hit(e, t)) return;
  if (stage === 'open' && hit(e, card.candle.target)) {   // easter egg: blow out / relight the candle
    if (card.candle.toggle()) sfx.light(); else sfx.blow();
    return;
  }
  if (stage === 'envelope') openEnvelope();
  else if (stage === 'card') openCard();
  else if (stage === 'open') toggleFold();
});
renderer.domElement.addEventListener('pointermove', (e) => {
  const t = target();
  renderer.domElement.style.cursor = t && hit(e, t) ? 'pointer' : stage === 'open' ? 'grab' : 'default';
});

ui.replay.addEventListener('click', reset);
ui.sound.addEventListener('click', () => {
  setMuted(!isMuted());
  ui.sound.classList.toggle('muted', isMuted());
  ui.sound.setAttribute('aria-label', isMuted() ? 'Unmute' : 'Mute');
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (!controls.enabled) snapView(stage === 'open' ? poses.open() : poses.front());
  else {
    // keep the viewing direction, refit the distance for the new aspect
    const fit = poses.open();
    const dir = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(controls.target).addScaledVector(dir, fit.pos.distanceTo(fit.target));
  }
});

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta(), t = clock.elapsedTime;
  card.tick(t, dt);
  confetti.update(dt);
  env.body.position.y = Math.sin(t * 1.4) * 0.18;
  env.dissolve.origin.value.copy(env.group.position);
  if (stage === 'card') cardPivot.rotation.y = Math.sin(t * 0.9) * 0.05;
  if (controls.enabled) {
    controls.update();
  } else {
    camera.position.copy(view.pos);
    camera.lookAt(view.target);
  }
  renderer.render(scene, camera);
});

document.body.classList.remove('loading');
camera.aspect = innerWidth / innerHeight;
camera.updateProjectionMatrix();
reset();

// handy for debugging from the console
window.bday = { card, cardPivot, env, camera, controls, reset };
