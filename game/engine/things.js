/* Things that are thrown about: each a small group of brush dabs over a few rounded parts, written into the world again each frame
   wherever it is and however it is turned, with its shadow on the ground.
     const th = makeThing(B, T, spec)     before B.finish. T = makePaint(B)
       spec.parts   [{ c: [x, y, z], r: radius or [rx, ry, rz], n: dabs, col(lit, d) }]: col picks a palette colour from how lit
                    the dab is (0..1) and where on the part it lies (d, a unit vector in the thing's own frame)
       spec.r       its size for bouncing and for its shadow
     th.bind(world)                       after B.finish
     th.write(p, m, on, big)              p where it is, m a 3 by 3 turn (rows), on whether it is there at all, big its size (1 as made)
     turn(axis, angle)                    such a turn */
function turn(ax, a) {
  const c = Math.cos(a),
    s = Math.sin(a),
    k = 1 - c,
    [x, y, z] = ax;
  return [c + x * x * k, x * y * k - z * s, x * z * k + y * s, y * x * k + z * s, c + y * y * k, y * z * k - x * s, z * x * k - y * s, z * y * k + x * s, c + z * z * k];
}
function makeThing(B, T, spec) {
  const { P, fib, norm } = B,
    { cross, VIS, SUN, SHADE } = T,
    PK = P.map(c => (c[0] | 0) + (c[1] | 0) * 256 + (c[2] | 0) * 65536),
    first = B.count(),
    dabs = [];
  for (const part of spec.parts) {
    const rad = Array.isArray(part.r) ? part.r : [part.r, part.r, part.r],
      n = part.n || 40,
      sp = Math.sqrt((4 * Math.PI) / n) * Math.max(rad[0], rad[1], rad[2]);
    for (let k = 0; k < n; k++) {
      const d = fib(k, n),
        nn = norm([d[0] / rad[0], d[1] / rad[1], d[2] / rad[2]]),
        e = norm(cross(nn, Math.abs(nn[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]));
      dabs.push({
        p: [part.c[0] + d[0] * rad[0], part.c[1] + d[1] * rad[1], part.c[2] + d[2] * rad[2]],
        n: nn,
        e,
        f: cross(nn, e),
        d,
        col: part.col,
        a: Math.pow((sp * 2.5) / VIS, 2),
        b: Math.pow((sp * 2.1) / VIS, 2)
      });
      B.iso(0, -50, 0, 0.05, P[1], 3);
    }
  }
  B.iso(0, -50, 0, 0.1, P[1], 3, SHADE);
  const N = dabs.length;
  let D = null;
  return {
    r: spec.r,
    spec,
    bind(world) {
      D = world.data;
    },
    write(p, m, on, big) {
      big = big || 1;
      const b2 = big * big,
        C = 0.0002;
      for (let k = 0; k < N; k++) {
        const o = (first + k) * 16,
          q = dabs[k];
        if (!on) {
          D[o + 1] = -50;
          continue;
        }
        const t = (v, r) => m[r * 3] * v[0] + m[r * 3 + 1] * v[1] + m[r * 3 + 2] * v[2],
          nx = t(q.n, 0),
          ny = t(q.n, 1),
          nz = t(q.n, 2),
          ex = t(q.e, 0),
          ey = t(q.e, 1),
          ez = t(q.e, 2),
          fx = t(q.f, 0),
          fy = t(q.f, 1),
          fz = t(q.f, 2),
          A = q.a * b2,
          Bq = q.b * b2;
        D[o] = p[0] + t(q.p, 0) * big;
        D[o + 1] = p[1] + t(q.p, 1) * big;
        D[o + 2] = p[2] + t(q.p, 2) * big;
        D[o + 4] = A * ex * ex + Bq * fx * fx + C * nx * nx;
        D[o + 5] = A * ex * ey + Bq * fx * fy + C * nx * ny;
        D[o + 6] = A * ex * ez + Bq * fx * fz + C * nx * nz;
        D[o + 8] = A * ey * ey + Bq * fy * fy + C * ny * ny;
        D[o + 9] = A * ey * ez + Bq * fy * fz + C * ny * nz;
        D[o + 10] = A * ez * ez + Bq * fz * fz + C * nz * nz;
        D[o + 7] = PK[q.col(0.5 + 0.5 * (nx * SUN[0] + ny * SUN[1] + nz * SUN[2]), q.d)];
      }
      const s = (first + N) * 16;
      if (!on || p[1] > 9) {
        D[s + 1] = -50;
        return;
      }
      const k = spec.r * big * (1 + p[1] * 0.12),
        a = k * k * 0.55;
      D[s] = p[0];
      D[s + 1] = 0.045;
      D[s + 2] = p[2];
      D[s + 4] = a;
      D[s + 5] = D[s + 6] = D[s + 9] = 0;
      D[s + 8] = 0.00005;
      D[s + 10] = a;
    }
  };
}
/* a few things ready made: each a spec for makeThing, with how it flies (heavy: how hard it falls, bounce: how much it keeps) */
const THINGS = {
  ball: {
    name: 'ball',
    r: 0.21,
    heavy: 1,
    bounce: 0.72,
    parts: [
      {
        c: [0, 0, 0],
        r: 0.21,
        n: 46,
        col: (lit, d) => (Math.abs(d[1]) < 0.24 ? (lit > 0.35 ? 6 : 16) : lit > 0.8 ? 27 : lit > 0.5 ? 26 : lit > 0.25 ? 25 : 23)
      }
    ]
  },
  melon: {
    name: 'melon',
    r: 0.34,
    heavy: 1.5,
    bounce: 0.45,
    parts: [
      {
        c: [0, 0, 0],
        r: [0.34, 0.3, 0.3],
        n: 70,
        col: (lit, d) => (Math.sin(Math.atan2(d[2], d[1]) * 6) > 0.35 ? 19 : lit > 0.7 ? 21 : lit > 0.3 ? 20 : 19)
      }
    ]
  },
  duck: {
    name: 'duck',
    r: 0.26,
    heavy: 0.75,
    bounce: 0.86,
    parts: [
      { c: [0, 0, 0], r: [0.27, 0.2, 0.2], n: 40, col: lit => (lit > 0.7 ? 27 : lit > 0.3 ? 26 : 25) },
      { c: [0.16, 0.24, 0], r: 0.15, n: 26, col: lit => (lit > 0.7 ? 27 : lit > 0.3 ? 26 : 25) },
      { c: [0.32, 0.22, 0], r: [0.09, 0.04, 0.07], n: 10, col: lit => (lit > 0.4 ? 25 : 24) },
      { c: [-0.26, 0.1, 0], r: [0.1, 0.07, 0.1], n: 10, col: lit => (lit > 0.5 ? 27 : 26) }
    ]
  }
};
if (typeof module !== 'undefined') module.exports = { makeThing, turn, THINGS };
