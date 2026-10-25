// Little felt confetti that bursts out of the card and settles on the table.
import * as THREE from 'three';
import { fibreCanvas } from './felt.js';

const COLORS = ['#f6e39a', '#f2b2bd', '#a8dccb', '#b9c7f2', '#f2a65a', '#fbf7ef', '#e86f7f', '#c3da86'];

export function createConfetti(scene, count = 180) {
  const bump = new THREE.CanvasTexture(fibreCanvas);
  const mat = new THREE.MeshPhysicalMaterial({ roughness: 1, sheen: 1, sheenRoughness: 0.5, bumpMap: bump, bumpScale: 1.5 });
  const geos = [new THREE.CylinderGeometry(0.17, 0.17, 0.05, 12), new THREE.BoxGeometry(0.36, 0.05, 0.18)];
  const meshes = geos.map((g) => {
    const m = new THREE.InstancedMesh(g, mat, count / 2);
    m.castShadow = true;
    m.frustumCulled = false;
    m.visible = false;
    scene.add(m);
    return m;
  });
  const parts = [];
  const color = new THREE.Color();
  meshes.forEach((m, mi) => {
    for (let i = 0; i < m.count; i++) {
      m.setColorAt(i, color.set(COLORS[(i + mi * 3) % COLORS.length]));
      parts.push({ m, i, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), rest: false });
    }
  });
  const dummy = new THREE.Object3D();

  function burst(origin) {
    for (const q of parts) {
      q.p.copy(origin).add(new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 2, (Math.random() - 0.5) * 3));
      const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 7;
      q.v.set(Math.cos(a) * s, 10 + Math.random() * 9, Math.sin(a) * s * 0.7 + 2);
      q.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      q.w.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      q.rest = false;
    }
    meshes.forEach((m) => (m.visible = true));
  }

  // floor: top of the card base inside its footprint, otherwise the table
  const floorAt = (p) => (Math.abs(p.x) < 9 && Math.abs(p.z) < 6.5 ? 0.02 : -0.24);

  function update(dt) {
    if (!meshes[0].visible) return;
    dt = Math.min(dt, 0.05);
    for (const q of parts) {
      if (!q.rest) {
        q.v.y -= 22 * dt;
        q.v.multiplyScalar(1 - 1.6 * dt);       // felt bits are floaty
        q.v.y = Math.max(q.v.y, -5.5);
        q.p.addScaledVector(q.v, dt);
        q.r.x += q.w.x * dt; q.r.y += q.w.y * dt; q.r.z += q.w.z * dt;
        const f = floorAt(q.p);
        if (q.p.y <= f && q.v.y < 0) {
          q.p.y = f;
          q.rest = true;
          q.r.x = 0; q.r.z = 0;
        }
      }
      dummy.position.copy(q.p);
      dummy.rotation.copy(q.r);
      dummy.updateMatrix();
      q.m.setMatrixAt(q.i, dummy.matrix);
    }
    meshes.forEach((m) => (m.instanceMatrix.needsUpdate = true));
  }

  function clear() { meshes.forEach((m) => (m.visible = false)); }

  return { burst, update, clear };
}
