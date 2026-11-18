// Signed-Distance-Modellierung + Surface-Nets-Vernetzung: organische Figuren statt zusammengesteckter Grundformen.
import * as THREE from 'three';

// ---------- Primitive (p: [x,y,z]) ----------
export const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
export function sphere(p, c, r) { return len3(p[0] - c[0], p[1] - c[1], p[2] - c[2]) - r; }
export function ellipsoid(p, c, r) {
  const x = (p[0] - c[0]) / r[0], y = (p[1] - c[1]) / r[1], z = (p[2] - c[2]) / r[2];
  const k0 = len3(x, y, z), k1 = len3(x / r[0], y / r[1], z / r[2]);
  return k1 === 0 ? -Math.min(...r) : k0 * (k0 - 1) / k1;
}
// Kapsel mit zwei Radien (round cone, linear interpoliert)
export function cone(p, a, b, ra, rb) {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
  const px = p[0] - a[0], py = p[1] - a[1], pz = p[2] - a[2];
  const l2 = bx * bx + by * by + bz * bz;
  let t = l2 ? (px * bx + py * by + pz * bz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  return len3(px - bx * t, py - by * t, pz - bz * t) - (ra + (rb - ra) * t);
}
export function box(p, c, h, r = 0) {
  const qx = Math.abs(p[0] - c[0]) - h[0] + r, qy = Math.abs(p[1] - c[1]) - h[1] + r, qz = Math.abs(p[2] - c[2]) - h[2] + r;
  return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}
export function cylY(p, c, r, h) { const d1 = Math.hypot(p[0] - c[0], p[2] - c[2]) - r, d2 = Math.abs(p[1] - c[1]) - h; return Math.min(Math.max(d1, d2), 0) + Math.hypot(Math.max(d1, 0), Math.max(d2, 0)); }
export function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
export function smax(a, b, k) { return -smin(-a, -b, k); }

// ---------- Surface Nets ----------
// sdf(x,y,z) -> Distanz; bounds [minX,minY,minZ,maxX,maxY,maxZ]; cell: Kantenlänge
export function mesh(sdf, bounds, cell, { uv = 'cyl', uvScale = 1, center = [0, 0] } = {}) {
  const [x0, y0, z0, x1, y1, z1] = bounds;
  const nx = Math.ceil((x1 - x0) / cell) + 1, ny = Math.ceil((y1 - y0) / cell) + 1, nz = Math.ceil((z1 - z0) / cell) + 1;
  const N = nx * ny * nz, v = new Float32Array(N);
  const P = [0, 0, 0];
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    P[0] = x0 + i * cell; P[1] = y0 + j * cell; P[2] = z0 + k * cell;
    v[i + nx * (j + ny * k)] = sdf(P);
  }
  const idx = (i, j, k) => i + nx * (j + ny * k);
  const cellVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cidx = (i, j, k) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { const [a, b, d] = corners[c]; cv[c] = v[idx(i + a, j + b, k + d)]; if (cv[c] < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [e0, e1] of edges) {
      const a = cv[e0], b = cv[e1];
      if ((a < 0) === (b < 0)) continue;
      const t = a / (a - b), c0 = corners[e0], c1 = corners[e1];
      sx += c0[0] + (c1[0] - c0[0]) * t; sy += c0[1] + (c1[1] - c0[1]) * t; sz += c0[2] + (c1[2] - c0[2]) * t; n++;
    }
    cellVert[cidx(i, j, k)] = pos.length / 3;
    pos.push(x0 + (i + sx / n) * cell, y0 + (j + sy / n) * cell, z0 + (k + sz / n) * cell);
  }
  const ind = [];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) ind.push(a, c, b, a, d, c); else ind.push(a, b, c, a, c, d); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const s = v[idx(i, j, k)] < 0;
    if (i < nx - 1 && s !== (v[idx(i + 1, j, k)] < 0)) quad(cellVert[cidx(i, j - 1, k - 1)], cellVert[cidx(i, j, k - 1)], cellVert[cidx(i, j, k)], cellVert[cidx(i, j - 1, k)], s);
    if (j < ny - 1 && s !== (v[idx(i, j + 1, k)] < 0)) quad(cellVert[cidx(i - 1, j, k - 1)], cellVert[cidx(i - 1, j, k)], cellVert[cidx(i, j, k)], cellVert[cidx(i, j, k - 1)], s);
    if (k < nz - 1 && s !== (v[idx(i, j, k + 1)] < 0)) quad(cellVert[cidx(i - 1, j - 1, k)], cellVert[cidx(i, j - 1, k)], cellVert[cidx(i, j, k)], cellVert[cidx(i - 1, j, k)], s);
  }
  // Normalen über den SDF-Gradienten (glatt)
  const nrm = new Float32Array(pos.length), e = cell * 0.5, q = [0, 0, 0];
  const f = (x, y, z) => { q[0] = x; q[1] = y; q[2] = z; return sdf(q); };
  for (let a = 0; a < pos.length; a += 3) {
    const x = pos[a], y = pos[a + 1], z = pos[a + 2];
    let gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1; nrm[a] = gx / l; nrm[a + 1] = gy / l; nrm[a + 2] = gz / l;
  }
  const uvs = new Float32Array(pos.length / 3 * 2);
  for (let a = 0, b = 0; a < pos.length; a += 3, b += 2) {
    if (uv === 'cyl') { uvs[b] = (Math.atan2(pos[a] - center[0], pos[a + 2] - center[1]) / (Math.PI * 2) + 0.5); uvs[b + 1] = pos[a + 1] * uvScale; }
    else { uvs[b] = pos[a] * uvScale; uvs[b + 1] = pos[a + 1] * uvScale; }
  }
  // Dreiecke konsistent nach außen orientieren (gegen Gradienten-Normale prüfen)
  for (let t = 0; t < ind.length; t += 3) {
    const a = ind[t] * 3, b = ind[t + 1] * 3, c = ind[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const nx2 = nrm[a] + nrm[b] + nrm[c], ny2 = nrm[a + 1] + nrm[b + 1] + nrm[c + 1], nz2 = nrm[a + 2] + nrm[b + 2] + nrm[c + 2];
    if (fx * nx2 + fy * ny2 + fz * nz2 < 0) { const tmp = ind[t + 1]; ind[t + 1] = ind[t + 2]; ind[t + 2] = tmp; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(ind);
  return g;
}
