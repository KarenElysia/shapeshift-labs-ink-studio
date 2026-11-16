/* The street: a bright painted town seen from behind a kid with a bat. The scenery is laid straight down as large brush dabs
   (B.dab), not baked from solids, so that it reads as paint and costs few splats; the kid is a K.character. The street runs along +x:
   the kid stands at the origin facing +x, +z is to the right of the picture.
     const street = makeStreet({ makeBuilder, KIT })
     street.world          the finished world (data, count, pal ...)
     street.ch             the character (K.character), already bound
     street.balls          [{ write(p, rot, on), ... }] the things that fly in
     street.fx             K.play.fx pool, already bound
     street.dyn            first splat that changes from frame to frame (everything from here to the end is sent again each frame)
     street.themes         { day, dusk }: palettes of the same length as the world's own */
const STREET_PAL = [
  0x7ccdea, // 0 sky
  0x2a4478, // 1 ink: shadows and lines
  0xd9c7b6, // 2 ground dark
  0xf0dfc6, // 3 ground mid
  0xfaf0dc, // 4 ground light
  0xf3e6c8, // 5 cream
  0xfffaf0, // 6 white
  0xc4ecf6, // 7 sky light
  0x4faadd, // 8 sky deep
  0xf9d6c4, // 9 cloud pink
  0xfdeee0, // 10 cloud pink light
  0xc9a57f, // 11 wall cream dark
  0xeacb9c, // 12 wall cream
  0xfbe9c4, // 13 wall light
  0x7f95c8, // 14 wall blue-grey dark
  0xb7c5e6, // 15 wall blue-grey
  0xdce4f4, // 16 wall blue-grey light
  0x2f5f9e, // 17 window dark
  0x4f8fd0, // 18 window
  0x1f6a3a, // 19 leaf dark
  0x3fa046, // 20 leaf
  0x8fd05a, // 21 leaf light
  0x5a3a2c, // 22 trunk
  0x9c1f3c, // 23 red dark
  0xe23a4e, // 24 red
  0xf58a2c, // 25 orange
  0xffd23c, // 26 yellow
  0xffec8a, // 27 yellow light
  0xd9764a, // 28 skin shadow
  0xf7b27a, // 29 skin
  0x2a1a3a, // 30 hair dark
  0x51306a, // 31 hair
  0x146b78, // 32 teal dark
  0x22a6a6, // 33 teal
  0x6fdcc8, // 34 teal light
  0xd83a8c, // 35 magenta
  0xf77fb0 // 36 pink
];
/* the same town late in the day: every colour has its evening one */
const STREET_DUSK = [
  0xf7b45a, 0x1f2550, 0x8a6a78, 0xc98f6e, 0xf0b77c, 0xf6d9a0, 0xfff1cf, 0xfbd28a, 0xf08a4a, 0xf2775e, 0xf9a878, 0x8f6f72,
  0xc48f6a, 0xf3c07c, 0x3d4a78, 0x5c6b98, 0x8b98b8, 0x161f48, 0x2a3f78, 0x16473c, 0x2b6e44, 0x7fa850, 0x3c2630, 0x7a1838,
  0xc93048, 0xe06a2a, 0xf7b83a, 0xfde08a, 0xb85a48, 0xe89468, 0x1e1230, 0x3f2458, 0x124a5e, 0x1f7f88, 0x62b8ac, 0xb02c7c,
  0xe0689a
];

function makeStreet(kit) {
  const { makeBuilder, KIT: K } = kit;
  const B = makeBuilder(11, STREET_PAL),
    { P, rr, R, fbm, norm, fib, clamp } = B;
  const SUN = norm([-0.45, 0.7, 0.55]),
    UP = [0, 1, 0],
    add = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s],
    cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    pick = (ramp, t) => ramp[clamp(Math.floor(t * ramp.length), 0, ramp.length - 1)];
  /* one brush dab: p its middle, n the way the surface faces, e the way the brush went, len and wid what is seen of it */
  const VIS = 3.78; // a solid dab shows out to 1.89 of its spread each way
  const stroke = (p, n, e, len, wid, ci, an) =>
    B.dab(p[0], p[1], p[2], n, e, len / VIS, wid / VIS, 0.012, P[ci], 3, an);
  /* a flat patch filled with dabs: o a corner, u and v its two edges (unit), su and sv their lengths, n the way it faces.
     o.cu, o.cv the spacing each way; o.along 'u' | 'v' the way the brush goes; o.tone(fu, fv) 0..1 picks from the ramp */
  function paint(o, u, v, n, su, sv, ramp, opt) {
    opt = opt || {};
    const cu = opt.cu || 0.9,
      cv = opt.cv || cu,
      nu = Math.max(1, Math.ceil(su / cu)),
      nv = Math.max(1, Math.ceil(sv / cv)),
      au = opt.along === 'u',
      lift = opt.lift || 0;
    // first a wash of the middle colour in fat strokes, so that where the brush on top runs dry there is paint under it
    if (opt.under !== false) {
      const mu = Math.max(1, Math.ceil(nu / 2)),
        mv = Math.max(1, Math.ceil(nv / 2)),
        mid = ramp[Math.floor(ramp.length * (opt.wash === undefined ? 0.55 : opt.wash))];
      for (let i = 0; i < mu; i++)
        for (let j = 0; j < mv; j++) {
          const p = add(add(o, u, ((i + 0.5) / mu) * su), v, ((j + 0.5) / mv) * sv);
          stroke(p, n, au ? u : v, ((au ? su / mu : sv / mv) * 2.6), ((au ? sv / mv : su / mu) * 2.4), mid, opt.an);
        }
    }
    for (let i = 0; i < nu; i++)
      for (let j = 0; j < nv; j++) {
        const fu = ((i + 0.5 + rr(-0.3, 0.3)) / nu) * su,
          fv = ((j + 0.5 + rr(-0.3, 0.3)) / nv) * sv,
          p = add(add(add(o, u, fu), v, fv), n, lift + rr(0, 0.03)),
          base = opt.tone ? opt.tone(fu, fv, p) : 0.5,
          t = clamp(base + (fbm(p[0] * 0.35, p[1] * 0.35 + 7, p[2] * 0.35, 2) - 0.5) * 0.5 + rr(-0.12, 0.12), 0, 0.999),
          tilt = rr(-0.22, 0.22),
          e = norm(au ? add(u, v, tilt) : add(v, u, tilt));
        stroke(
          p,
          n,
          e,
          (au ? cu : cv) * rr(2.3, 3.2),
          (au ? cv : cu) * rr(1.6, 2.1),
          pick(ramp, t),
          opt.an
        );
      }
  }
  /* a ball of dabs, lit from the sun: leaves, clouds, lamps */
  function blob(c, r, ramp, n, an, squash) {
    const sp = Math.sqrt((4 * Math.PI) / n);
    for (let k = 0; k < n; k++) {
      const d = fib(k, n),
        rad = Array.isArray(r) ? r : [r, r * (squash || 1), r],
        p = [c[0] + d[0] * rad[0], c[1] + d[1] * rad[1], c[2] + d[2] * rad[2]],
        e = norm(cross(d, Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [rr(-0.4, 0.4), 1, rr(-0.4, 0.4)])),
        t = clamp(0.5 + 0.5 * dot(d, SUN) + rr(-0.14, 0.14), 0, 0.999),
        s = sp * Math.max(rad[0], rad[2]);
      stroke(p, d, e, s * rr(2.2, 3), s * rr(1.7, 2.2), pick(ramp, t), an);
    }
  }

  // ---------------------------------------------------------------- sky
  const SKYAN = { em: true, nd: true };
  {
    const e0 = norm([0.15, 0.55, 1]);
    for (let k = 0; k < 150; k++) {
      const d = norm([rr(-0.15, 1), rr(0.02, 0.95), rr(-1, 1)]),
        p = [d[0] * 150, d[1] * 150 - 4, d[2] * 150],
        n = [-d[0], -d[1], -d[2]],
        e = norm(add(e0, n, -dot(e0, n))),
        hi = d[1];
      stroke(p, n, e, rr(30, 75), rr(4, 11), hi > 0.55 ? (R() < 0.6 ? 8 : 0) : R() < 0.45 ? 7 : R() < 0.5 ? 6 : 0, SKYAN);
    }
    // big soft clouds standing up behind the roofs
    [
      [96, 30, -34, 17],
      [112, 20, 30, 15],
      [84, 46, 12, 12],
      [70, 34, -52, 14],
      [60, 26, 50, 12]
    ].forEach(c => blob([c[0], c[1], c[2]], [c[3], c[3] * 1.5, c[3]], [9, 9, 10, 10], 46, SKYAN));
    // the sun, high on the left: soft light, then a hard white middle and a few rays
    const sun = [78, 104, -62];
    B.iso(sun[0], sun[1], sun[2], 13, P[7], 0.5, SKYAN);
    B.iso(sun[0], sun[1], sun[2], 7, P[6], 0.75, SKYAN);
    stroke(sun, norm([-0.5, -0.7, 0.4]), norm([0.2, 0.3, 1]), 13, 9, 6, SKYAN);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * 6.283 + 0.3,
        dir = norm([0.3 * Math.cos(a), Math.sin(a), Math.cos(a)]);
      stroke(add(sun, dir, 15), norm([-0.5, -0.7, 0.4]), dir, rr(9, 15), 1.1, 6, SKYAN);
    }
  }

  // ---------------------------------------------------------------- the ground
  const ROAD = 3.4,
    WALL = 5.3,
    X0 = -14,
    X1 = 78;
  const ground = B.count();
  const trees = [];
  for (const side of [-1, 1])
    for (let x = side < 0 ? 4 : 8.5; x < X1 - 6; x += rr(8.5, 12))
      trees.push({ x, side, z: side * (ROAD + 0.75), th: rr(1.9, 2.4), r: rr(1.15, 1.55) });
  const SHADE = { nd: true }; // (the renderer draws a dab of ink with only this flag as rows of dots)
  {
    // road: pale, warm
    paint([X0, 0, -ROAD], [1, 0, 0], [0, 0, 1], UP, X1 - X0, ROAD * 2, [2, 3, 3, 4, 4, 4], {
      cu: 1.3,
      cv: 0.5,
      along: 'u'
    });
    // lane marks
    for (let x = X0; x < X1; x += 4.2) {
      stroke([x + rr(-0.2, 0.2), 0.05, rr(-0.05, 0.05)], UP, norm([1, 0, rr(-0.03, 0.03)]), rr(2, 2.5), 0.2, R() < 0.5 ? 6 : 16);
    }
    for (let x = X0; x < X1; x += 2.6)
      for (const s of [-1, 1])
        stroke([x + rr(-0.3, 0.3), 0.05, s * (ROAD - 0.35)], UP, [1, 0, 0], rr(2.6, 3.4), 0.13, R() < 0.5 ? 6 : 16);
    // a crossing ahead
    for (let k = 0; k < 9; k++)
      stroke([7.5 + rr(-0.1, 0.1), 0.06, -ROAD + 0.6 + k * 0.7], UP, [1, 0, 0], rr(2.5, 2.9), 0.42, 6);
    // pavements and kerbs
    for (const s of [-1, 1]) {
      const lit = s < 0;
      paint(
        [X0, 0.16, s < 0 ? -WALL : ROAD],
        [1, 0, 0],
        [0, 0, 1],
        UP,
        X1 - X0,
        WALL - ROAD,
        lit ? [12, 5, 13, 13, 6] : [3, 5, 13, 4],
        { cu: 1.1, cv: 0.6, along: 'u' }
      );
      paint([X0, 0, s * ROAD], [1, 0, 0], [0, 1, 0], [0, 0, -s], X1 - X0, 0.17, lit ? [11, 12] : [11, 2], {
        cu: 0.9,
        cv: 0.17,
        along: 'u',
        under: false
      });
    }
    // shadows, in dots: the right-hand houses across the pavement and the edge of the road, and one under every tree
    for (let x = X0; x < X1; x += 2.4)
      stroke([x, 0.2, WALL - 0.3 - rr(0, 0.5)], UP, [1, 0, 0], rr(4.5, 6), rr(3.6, 5.2), 1, SHADE);
    for (const t of trees)
      stroke([t.x + 0.9, t.side < 0 ? 0.2 : 0.07, t.z - 1.5], UP, norm([0.5, 0, -1]), t.r * 4.2, t.r * 2.3, 1, SHADE);
  }

  // ---------------------------------------------------------------- houses
  const LIT = [
      [11, 12, 12, 13, 13],
      [12, 13, 13, 6],
      [9, 10, 10, 13],
      [11, 12, 13, 5],
      [25, 26, 27, 27]
    ],
    DIM = [
      [14, 14, 15, 15, 16],
      [2, 14, 15, 15],
      [14, 15, 16, 16],
      [3, 4, 15, 16]
    ],
    AWN = [24, 26, 33, 35, 25, 36, 6];
  function house(x, w, h, side) {
    const lit = side < 0,
      ramp = (lit ? LIT : DIM)[Math.floor(R() * (lit ? (R() < 0.15 ? 5 : 4) : 4))],
      z = side * WALL,
      n = [0, 0, -side],
      shop = 2.5,
      trim = lit ? 6 : 16;
    // the front, then the end that faces up the street
    paint([x, 0.1, z], [1, 0, 0], [0, 1, 0], n, w, h, ramp, {
      cu: 0.95,
      along: 'v',
      tone: (fu, fv) => 0.35 + 0.4 * (fv / h)
    });
    paint([x, 0.1, z], [0, 0, side], [0, 1, 0], [-1, 0, 0], 7, h, lit ? DIM[2] : DIM[1], { cu: 1.1, along: 'v' });
    // cornice and the line over the shop
    for (let fx = 0.4; fx < w; fx += 1.5) {
      stroke([x + fx, h + 0.05, z - side * 0.1], n, [1, 0, 0], 2.2, 0.34, lit ? 11 : 1);
      stroke([x + fx, shop + 0.25, z - side * 0.08], n, [1, 0, 0], 2.1, 0.16, trim);
    }
    // windows, floor by floor
    const cols = Math.max(2, Math.floor(w / 1.45)),
      gap = w / cols;
    for (let fy = shop + 0.95; fy + 0.6 < h; fy += 1.55)
      for (let c = 0; c < cols; c++) {
        const wx = x + (c + 0.5) * gap + rr(-0.05, 0.05),
          wc = R() < 0.25 ? 18 : 17;
        stroke([wx, fy, z - side * 0.07], n, norm([rr(-0.06, 0.06), 1, 0]), 1.0, 0.56, wc);
        if (R() < 0.7) stroke([wx, fy - 0.52, z - side * 0.11], n, [1, 0, 0], 0.78, 0.12, trim);
        if (R() < 0.3) stroke([wx - 0.12, fy + 0.12, z - side * 0.1], n, norm([0.3, 1, 0]), 0.45, 0.1, 16);
      }
    // the shop: dark glass, a door, an awning
    const ac = AWN[Math.floor(R() * AWN.length)],
      ac2 = R() < 0.5 ? 6 : ac;
    for (let fx = 0.55; fx < w - 0.3; fx += 0.9) {
      stroke([x + fx, 1.25, z - side * 0.06], n, [0, 1, 0], 1.7, 0.8, R() < 0.2 ? 18 : 17);
      const k = Math.round(fx / 0.9);
      stroke(
        [x + fx, shop - 0.1, z - side * 0.45],
        norm([0, 0.75, -side * 0.65]),
        norm([0, 0.65, side * 0.75]),
        1.0,
        0.86,
        k % 2 ? ac : ac2
      );
    }
  }
  /* everything that stands is made from the far end of the street to the near: paint goes down in the order it is made */
  const walls = B.count();
  {
    const tx = X1 + 4;
    paint([tx, 0, -3.2], [0, 0, 1], [0, 1, 0], [-1, 0, 0], 6.4, 24, [9, 10, 10, 13], {
      cu: 1.3,
      along: 'v',
      tone: (fu, fv) => 0.25 + 0.6 * (fu / 6.4)
    });
    blob([tx, 27, 0], [4.2, 5.5, 4.2], [32, 33, 33, 34], 40);
    stroke([tx - 0.3, 34, 0], [-1, 0, 0], UP, 5, 0.5, 32);
    blob([tx - 0.4, 19, 0], [0.3, 2.3, 2.3], [5, 6, 6], 26);
    stroke([tx - 0.9, 19.6, 0], [-1, 0, 0], UP, 1.9, 0.3, 1);
    stroke([tx - 0.9, 19, 0.6], [-1, 0, 0], [0, 0, 1], 1.5, 0.3, 1);
    for (let y = 3; y < 16; y += 3.2) stroke([tx - 0.3, y, 0], [-1, 0, 0], UP, 1.8, 1.0, 17);
  }
  paint([X1, 0, -16], [0, 0, 1], [0, 1, 0], [-1, 0, 0], 32, 9, [14, 15, 9, 10], { cu: 1.6, along: 'v' });
  {
    const row = [];
    for (const side of [-1, 1]) {
      let x = X0;
      while (x < X1 - 2) {
        const w = rr(5.5, 9.5);
        row.push({ x, w, h: rr(7, 12.5), side });
        x += w;
      }
    }
    row.sort((a, b) => b.x - a.x).forEach(q => house(q.x, q.w, q.h, q.side));
  }

  // ---------------------------------------------------------------- trees, lamps, flags
  const props = B.count();
  for (const { x, side, z, th, r } of trees) {
    {
      const ph = rr(0, 6),
        sway = { k: 14, ph, sp: rr(0.9, 1.4), rg: 0.035, ex: th },
        leaf = side < 0 ? [19, 20, 20, 21, 21] : [19, 19, 20, 20, 21];
      B.stick(x, th / 2 + 0.1, z, UP, th / 2, 0.11, P[22], 3);
      blob([x, th + r * 0.8, z], r, leaf, 34, sway, 0.9);
      blob([x + rr(-0.5, 0.5), th + r * 1.55, z + rr(-0.4, 0.4)], r * 0.68, leaf, 20, sway);
      blob([x + rr(-0.8, 0.8), th + r * 0.6, z - side * rr(0.5, 0.9)], r * 0.6, leaf, 16, sway);
      // a ring of earth round the foot
      stroke([x, 0.2, z], UP, [1, 0, 0], 1.1, 0.8, 22);
    }
  }
  for (const side of [-1, 1])
    for (let x = -1; x < X1 - 10; x += 13) {
      const z = side * (ROAD + 0.3);
      B.stick(x, 2.0, z, UP, 1.95, 0.05, P[1], 3);
      B.stick(x, 3.9, z - side * 0.3, [0, 0, 1], 0.32, 0.045, P[1], 3);
      B.iso(x, 3.72, z - side * 0.6, 0.11, P[27], 3, { em: true });
    }
  for (const side of [-1, 1])
    for (let x = -6; x < 40; x += 3.1) {
      if (Math.abs(x - 7.5) < 2) continue;
      const z = side * (ROAD + 0.12);
      B.stick(x, 0.5, z, UP, 0.34, 0.075, P[24], 3);
      B.iso(x, 0.86, z, 0.062, P[6], 3);
    }
  // strings of flags across the street
  [9, 19, 31, 46].forEach((x, q) => {
    const y0 = 7.2 - q * 0.2,
      N = 26;
    for (let i = 0; i <= N; i++) {
      const f = i / N,
        z = -WALL + f * WALL * 2,
        y = y0 - 1.5 * Math.sin(Math.PI * f);
      if (i < N) B.stick(x, y, z + WALL / N, norm([0, -Math.cos(Math.PI * f) * 0.7, 1]), WALL / N, 0.016, P[1], 3);
      if (i % 2 === 0 && i > 0 && i < N)
        stroke([x, y - 0.3, z], [-1, 0, 0], norm([0, 1, rr(-0.2, 0.2)]), 0.6, 0.42, AWN[(i / 2 + q) % AWN.length], {
          k: 11,
          ph: i * 0.9 + q,
          sp: 3.2,
          rg: 0.05
        });
    }
  });

  // ---------------------------------------------------------------- what moves
  const dyn = B.count();
  /* the things that fly in: a rubber ball each, a band round it so that its turning shows, and its shadow on the road */
  const NBALL = 3,
    BN = 46,
    BR = 0.21,
    BSP = Math.sqrt((4 * Math.PI) / BN) * BR,
    BSA = (BSP * 2.5) / VIS,
    BSB = (BSP * 2.1) / VIS,
    balls = [];
  const PK = P.map(c => (c[0] | 0) + (c[1] | 0) * 256 + (c[2] | 0) * 65536);
  for (let b = 0; b < NBALL; b++) {
    const first = B.count(),
      dabs = [];
    for (let k = 0; k < BN; k++) {
      const d = fib(k, BN),
        e = norm(cross(d, Math.abs(d[1]) > 0.9 ? [1, 0, 0] : UP));
      dabs.push({ d, e, f: cross(d, e), band: Math.abs(d[1]) < 0.24 });
      B.iso(0, -50, 0, 0.05, P[25], 3);
    }
    B.iso(0, -50, 0, 0.1, P[1], 3, SHADE); // its shadow
    let D = null;
    balls.push({
      r: BR,
      bind(world) {
        D = world.data;
      },
      /* p where it is, m a 3 by 3 turn (rows), on whether it is there at all, big its size (1 as made) */
      write(p, m, on, big) {
        big = big || 1;
        const A = BSA * BSA * big * big,
          Bq = BSB * BSB * big * big,
          C = 0.0002;
        for (let k = 0; k < BN; k++) {
          const o = (first + k) * 16,
            q = dabs[k];
          if (!on) {
            D[o + 1] = -50;
            continue;
          }
          const t = (v, r) => m[r * 3] * v[0] + m[r * 3 + 1] * v[1] + m[r * 3 + 2] * v[2],
            nx = t(q.d, 0),
            ny = t(q.d, 1),
            nz = t(q.d, 2),
            ex = t(q.e, 0),
            ey = t(q.e, 1),
            ez = t(q.e, 2),
            fx = t(q.f, 0),
            fy = t(q.f, 1),
            fz = t(q.f, 2);
          D[o] = p[0] + nx * BR * big;
          D[o + 1] = p[1] + ny * BR * big;
          D[o + 2] = p[2] + nz * BR * big;
          D[o + 4] = A * ex * ex + Bq * fx * fx + C * nx * nx;
          D[o + 5] = A * ex * ey + Bq * fx * fy + C * nx * ny;
          D[o + 6] = A * ex * ez + Bq * fx * fz + C * nx * nz;
          D[o + 8] = A * ey * ey + Bq * fy * fy + C * ny * ny;
          D[o + 9] = A * ey * ez + Bq * fy * fz + C * ny * nz;
          D[o + 10] = A * ez * ez + Bq * fz * fz + C * nz * nz;
          const lit = 0.5 + 0.5 * (nx * SUN[0] + ny * SUN[1] + nz * SUN[2]);
          D[o + 7] = PK[q.band ? (lit > 0.35 ? 6 : 16) : lit > 0.8 ? 27 : lit > 0.5 ? 26 : lit > 0.25 ? 25 : 23];
        }
        const s = (first + BN) * 16;
        if (!on || p[1] > 9) {
          D[s + 1] = -50;
          return;
        }
        const k = BR * big * (1 + p[1] * 0.12),
          a = k * k * 0.55;
        D[s] = p[0];
        D[s + 1] = 0.045;
        D[s + 2] = p[2];
        D[s + 4] = a;
        D[s + 5] = D[s + 6] = D[s + 9] = 0;
        D[s + 8] = 0.00005;
        D[s + 10] = a;
      }
    });
  }
  const fx = K.play.fx(B, 220),
    fxAt = B.count() - fx.total;

  // ---------------------------------------------------------------- the kid
  const HOOD = [25, 26, 26, 27],
    SKIN = [28, 29, 29],
    HAIR = [30, 31, 31],
    SHORT = [32, 33, 33, 34],
    SHOE = [23, 24, 24, 24],
    WHITE = [16, 6, 6],
    CAP = [23, 24, 24];
  const spec = {
    id: 'kid',
    height: 1.5,
    res: 0.045,
    x0: 0,
    hp: 3,
    atk: 'slash',
    reach: 1.25,
    lunge: 0.6,
    fx: 6,
    dust: 5,
    shadow: 0.5,
    light: { lo: 0.18, hi: 1.02 },
    anim: { breath: 0.02, sway: 0.03, sf: 1.6, nodI: 0.02 },
    speed: { walk: 2.4, run: 5 },
    pts: {
      hip: [0, 0.5, 0],
      chest: [0, 0.74, 0],
      hem: [0, 0.4, 0],
      neck: [0, 0.94, 0],
      sock: [0, 0.44, 0.115],
      ank: [0, 0.13, 0.135],
      sho: [0.02, 0.86, 0.27],
      hand: [0.14, 0.56, 0.34]
    },
    legs: { r0: 0.075, r1: 0.062, mat: { r: SKIN }, foot: [0.23, 0.115, 0.14], footMat: { r: SHOE } },
    world: { height: () => 0 },
    sculpt(S, T) {
      // body: a big hooded top over shorts
      S.ball([0, 0.72, 0], [0.22, 0.25, 0.27], { r: HOOD }, T('chest'));
      S.ball([0.01, 0.56, 0], [0.215, 0.14, 0.26], { r: HOOD }, T('root'));
      S.ball([0, 0.49, 0], [0.225, 0.05, 0.275], { r: WHITE }, T('root'));
      S.ball([0, 0.43, 0.115], [0.135, 0.125, 0.135], { r: SHORT }, T('hem'));
      S.ball([0, 0.43, -0.115], [0.135, 0.125, 0.135], { r: SHORT }, T('hem'));
      // the hood lying on the back, and a small pack under it
      S.ball([-0.17, 0.93, 0], [0.15, 0.13, 0.24], { r: HOOD, b: -0.1 }, T('chest'));
      S.box([-0.24, 0.68, 0], [0.075, 0.15, 0.15], { r: SHORT }, T('chest'));
      S.box([-0.31, 0.63, 0], [0.03, 0.075, 0.1], { r: WHITE }, T('chest'));
      S.tube(
        [
          [-0.2, 0.84, 0.14],
          [0.1, 0.9, 0.15]
        ],
        0.03,
        0.03,
        { r: SHORT },
        T('chest')
      );
      S.tube(
        [
          [-0.2, 0.84, -0.14],
          [0.1, 0.9, -0.15]
        ],
        0.03,
        0.03,
        { r: SHORT },
        T('chest')
      );
      // head: big, hair out from under a cap worn back to front
      S.ball([0.02, 1.2, 0], [0.27, 0.26, 0.29], { r: SKIN }, T('head'));
      S.ball([-0.05, 1.23, 0], [0.285, 0.265, 0.315], { r: HAIR }, T('head'));
      S.ball([-0.2, 1.1, 0.17], [0.13, 0.15, 0.12], { r: HAIR }, T('head'));
      S.ball([-0.2, 1.1, -0.17], [0.13, 0.15, 0.12], { r: HAIR }, T('head'));
      S.ball([-0.25, 1.04, 0], [0.11, 0.13, 0.16], { r: HAIR }, T('head'));
      S.ball([0, 1.34, 0], [0.275, 0.17, 0.295], { r: CAP }, T('head'));
      S.ball([-0.3, 1.3, 0], [0.17, 0.035, 0.19], { r: CAP, b: -0.15 }, T('head'));
      S.ball([0, 1.5, 0], 0.04, { r: WHITE }, T('head'));
      S.ball([0.04, 1.17, 0.285], [0.05, 0.07, 0.035], { r: SKIN }, T('head'));
      S.ball([0.04, 1.17, -0.285], [0.05, 0.07, 0.035], { r: SKIN }, T('head'));
      S.ball([0.26, 1.18, 0.1], [0.03, 0.05, 0.035], { r: [30] }, T.eye('head'));
      S.ball([0.26, 1.18, -0.1], [0.03, 0.05, 0.035], { r: [30] }, T.eye('head'));
      // the arm that swings, and the bat in its hand
      S.tube([[0.02, 0.86, 0.27], [0.14, 0.56, 0.34]], 0.085, 0.075, { r: HOOD }, T('arm'));
      S.ball([0.14, 0.54, 0.34], 0.075, { r: SKIN }, T('item'));
      S.tube([[0.13, 0.46, 0.34], [0.2, 1.22, 0.4]], 0.032, 0.075, { r: [11, 5, 6, 6] }, T('item'));
      S.ball([0.13, 0.45, 0.34], 0.05, { r: CAP }, T('item'));
      S.tube([[0.165, 0.84, 0.37], [0.172, 0.92, 0.376]], 0.066, 0.07, { r: [32, 33] }, T('item'));
      // the other arm, held out a little
      S.tube([[0.02, 0.86, -0.27], [0.1, 0.6, -0.36]], 0.085, 0.075, { r: HOOD }, T('chest'));
      S.ball([0.11, 0.57, -0.365], 0.07, { r: SKIN }, T('chest'));
      // socks, and the soles and toes of big trainers
      for (const s of [-1, 1]) {
        const leg = s < 0 ? 'legL' : 'legR',
          foot = s < 0 ? 'footL' : 'footR',
          z = s * 0.135;
        S.tube([[0, 0.22, z], [0, 0.15, z]], 0.08, 0.086, { r: WHITE }, T(leg));
        S.ball([0.06, 0.02, z], [0.24, 0.03, 0.14], { r: WHITE }, T(foot));
        S.ball([0.25, 0.07, z], [0.05, 0.05, 0.1], { r: [26, 27] }, T(foot));
        S.ball([-0.17, 0.15, z], [0.03, 0.05, 0.05], { r: [33, 34] }, T(foot));
      }
    }
  };
  const ch = K.character(B, spec, 0);

  const world = B.finish({
    cam: { target: [3, 1.3, 0], dist: 9, pitch: 0.12, yaw: -Math.PI / 2 },
    detail: 14,
    dither: 1,
    radius: 60,
    fog: { c: 7, start: 30, end: 100, max: 0.5 }
  });
  ch.bind(world, world.count - ch.total);
  fx.bind(world, fxAt);
  balls.forEach(b => {
    b.bind(world);
    b.write([0, 0, 0], [1, 0, 0, 0, 1, 0, 0, 0, 1], false);
  });
  ch.st.face = 0;
  ch.st.born = 1; // already here: no arriving
  return { world, ch, balls, fx, ground, walls, props, dyn, sun: SUN, themes: { day: STREET_PAL, dusk: STREET_DUSK } };
}
if (typeof module !== 'undefined') module.exports = { makeStreet, STREET_PAL, STREET_DUSK };
