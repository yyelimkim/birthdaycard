// Felt envelope with a hinged flap and a noise "dissolve" for arriving / leaving.
import * as THREE from 'three';
import { felt, roundRect, roundedPoly, heart, circle, text, dots } from './felt.js';

export const EW = 21, EH = 15.5;

const NOISE = /* glsl */`
  float dsHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float dsNoise(vec3 x){
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(dsHash(i + vec3(0,0,0)), dsHash(i + vec3(1,0,0)), f.x),
                   mix(dsHash(i + vec3(0,1,0)), dsHash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(dsHash(i + vec3(0,0,1)), dsHash(i + vec3(1,0,1)), f.x),
                   mix(dsHash(i + vec3(0,1,1)), dsHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }`;

function addDissolve(material, uniform) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDissolve = uniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDsPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvDsPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vDsPos;\nuniform float uDissolve;\n${NOISE}`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        if (uDissolve > 0.0) {
          vec3 q = vDsPos - uDsOrigin;
          float n = dsNoise(q * 0.55) * 0.65 + dsNoise(q * 2.3) * 0.35;
          if (n < uDissolve * 1.05) discard;
          float edge = smoothstep(uDissolve * 1.05, uDissolve * 1.05 + 0.05, n);
          gl_FragColor.rgb = mix(vec3(1.0, 0.93, 0.78), gl_FragColor.rgb, edge);
        }`)
      .replace('uniform float uDissolve;', 'uniform float uDissolve;\nuniform vec3 uDsOrigin;');
    shader.uniforms.uDsOrigin = uniform.origin;
  };
  material.customProgramCacheKey = () => 'dissolve';
}

export function buildEnvelope() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const base = '#a9cbe8', side = '#a0c3e2', bottom = '#b6d3ec', flapCol = '#94b9dc';
  const thread = '#f3f8ff';

  // back panel (its inside lining is visible once the flap opens)
  body.add(felt(roundRect(-EW / 2, -EH / 2, EW, EH, 0.45), {
    color: base, depth: 0.06, z: -0.95, stitch: thread, inset: 0.25,
    paint: (c) => {
      const list = [];
      for (let x = -EW / 2; x < EW / 2; x += 0.9) for (let y = -EH / 2; y < EH / 2; y += 0.9) list.push([x + ((y * 1.1) % 0.9), y, 'rgba(255,255,255,0.45)', 0.1]);
      dots(c, list);
    },
  }));
  // pocket
  const hw = EW / 2, hh = EH / 2;
  body.add(felt(roundedPoly([[-hw, -hh], [-0.6, -0.4], [-hw, hh]], 0.35), { color: side, depth: 0.05, z: 0.18, stitch: thread, inset: 0.2 }));
  body.add(felt(roundedPoly([[hw, -hh], [hw, hh], [0.6, -0.4]], 0.35), {
    color: side, depth: 0.05, z: 0.18, stitch: thread, inset: 0.2,
  }));
  body.add(felt(roundedPoly([[-hw, -hh], [hw, -hh], [hw, -hh + 0.4], [0, 0.7], [-hw, -hh + 0.4]], 0.35), {
    color: bottom, depth: 0.05, z: 0.28, stitch: thread, inset: 0.2,
    paint: (c) => {
      text(c, 'to: Kiara', 0, -4.5, { size: 1.3, font: 'Gaegu', weight: 700, color: '#3e4a78' });
      c.strokeStyle = 'rgba(62,74,120,0.5)'; c.lineWidth = 0.04;
      c.beginPath(); c.moveTo(-2.6, -5.35); c.lineTo(2.6, -5.35); c.stroke();
    },
  }));

  // stamp
  const stampPts = [];
  const sw = 1.9, sh = 2.3, teeth = 7;
  for (let i = 0; i < teeth; i++) stampPts.push([-sw / 2 + (sw * i) / teeth, -sh / 2], [-sw / 2 + (sw * (i + 0.5)) / teeth, -sh / 2 + 0.12]);
  for (let i = 0; i < teeth; i++) stampPts.push([sw / 2, -sh / 2 + (sh * i) / teeth], [sw / 2 - 0.12, -sh / 2 + (sh * (i + 0.5)) / teeth]);
  for (let i = 0; i < teeth; i++) stampPts.push([sw / 2 - (sw * i) / teeth, sh / 2], [sw / 2 - (sw * (i + 0.5)) / teeth, sh / 2 - 0.12]);
  for (let i = 0; i < teeth; i++) stampPts.push([-sw / 2, sh / 2 - (sh * i) / teeth], [-sw / 2 + 0.12, sh / 2 - (sh * (i + 0.5)) / teeth]);
  const stamp = felt(roundedPoly(stampPts, 0.03), {
    color: '#fbf7ef', depth: 0.04, stitch: false,
    paint: (c) => {
      c.fillStyle = '#f2b2bd'; c.fillRect(-0.65, -0.85, 1.3, 1.7);
      c.fillStyle = '#f6e39a'; c.beginPath(); c.arc(0, 0.1, 0.35, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#e2453f'; c.beginPath(); c.arc(0, 0.1, 0.16, 0, Math.PI * 2); c.fill();
      text(c, '♥', 0, -0.55, { size: 0.35, color: '#d9485f' });
    },
  });
  stamp.position.set(7.4, 2.4, 0.26);
  stamp.rotation.z = -0.08;
  body.add(stamp);

  // flap, hinged along the top edge
  const flap = new THREE.Group();
  flap.position.set(0, hh, 0.42);
  flap.add(felt(roundedPoly([[-hw, 0], [hw, 0], [0, -EH * 0.6]], 0.45), { color: flapCol, depth: 0.05, stitch: thread, inset: 0.22 }));
  flap.add(felt(circle(0.95, 0, -EH * 0.6 + 1.15), { color: '#fbf7ef', depth: 0.05, z: 0.09, stitch: '#f2b2bd', inset: 0.13 }));
  flap.add(felt(heart(0, -EH * 0.6 + 1.15, 0.6), { color: '#e05a6a', depth: 0.06, z: 0.18, inset: 0.1, stitchWidth: 0.035 }));
  body.add(flap);

  const dissolve = { value: 1, origin: { value: new THREE.Vector3() } };
  group.traverse((o) => {
    if (o.isMesh) {
      addDissolve(o.material, dissolve);
      o.castShadow = false;
    }
  });

  return { group, body, flap, dissolve };
}
