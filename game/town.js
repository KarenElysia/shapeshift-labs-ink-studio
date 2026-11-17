/* The town: a bright painted street, made far to near in the order the renderer wants it. The street runs along +x, +z is to the right
   of someone looking up it, the light comes from behind them on the right.
     const town = makeTown(B, T, opt)     B a builder made with TOWN_PAL, T = makePaint(B)
       opt.x0        where the street starts behind the eye (-14)
       opt.crossing  false for no crossing painted at x = 7.5
       opt.flags     where strings of flags hang across the street ([9, 19, 31, 46])
       opt.onGround  called when the ground is down and nothing yet stands on it: paint lines on the road here
       opt.onProps   called before trees and lamps: make what stands in the street here (it is sorted with what moves)
       opt.side      { x, w }: a side street crossing at x, w wide, with houses down it
     town.ground, town.walls, town.props  the first splat of each layer; town.ROAD, town.WALL half-widths
     town.groups   [{ a, b, c }]: each house (splats a to b, its middle c), for the renderer to put in order for the eye
     town.gap      [x0, x1] of the side street, or null
   TOWN_PAL is the palette by day and TOWN_DUSK the same colours late in the day. */
const TOWN_PAL = [
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
const TOWN_DUSK = [
  0xf7b45a, 0x1f2550, 0x8a6a78, 0xc98f6e, 0xf0b77c, 0xf6d9a0, 0xfff1cf, 0xfbd28a, 0xf08a4a, 0xf2775e, 0xf9a878, 0x8f6f72,
  0xc48f6a, 0xf3c07c, 0x3d4a78, 0x5c6b98, 0x8b98b8, 0x161f48, 0x2a3f78, 0x16473c, 0x2b6e44, 0x7fa850, 0x3c2630, 0x7a1838,
  0xc93048, 0xe06a2a, 0xf7b83a, 0xfde08a, 0xb85a48, 0xe89468, 0x1e1230, 0x3f2458, 0x124a5e, 0x1f7f88, 0x62b8ac, 0xb02c7c,
  0xe0689a
];

function makeTown(B, T, opt) {
  opt = opt || {};
  const { P, rr, R, norm } = B,
    { stroke, paint, blob, add, dot, cross, SUN, UP, SHADE } = T;
  // ---------------------------------------------------------------- sky
  const SKYAN = { em: true, nd: true };
  {
    const e0 = norm([0.15, 0.55, 1]);
    for (let k = 0; k < 230; k++) {
      const d = norm([rr(-1, 1), rr(0.02, 0.95), rr(-1, 1)]),
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
      [60, 26, 50, 12],
      [-90, 32, 24, 16],
      [-78, 42, -40, 13]
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
    X0 = opt.x0 === undefined ? -14 : opt.x0,
    X1 = 78;
  const ground = B.count(),
    gap = opt.side ? [opt.side.x - opt.side.w / 2, opt.side.x + opt.side.w / 2] : null,
    open = (x, m) => !gap || x < gap[0] - (m || 0) || x > gap[1] + (m || 0),
    SIDE = 24;
  const trees = [];
  for (const side of [-1, 1])
    for (let x = side < 0 ? 4 : 8.5; x < X1 - 6; x += rr(8.5, 12))
      if (open(x, 1.6)) trees.push({ x, side, z: side * (ROAD + 0.75), th: rr(1.9, 2.4), r: rr(1.15, 1.55) });
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
    for (let k = 0; k < (opt.crossing === false ? 0 : 9); k++)
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
    if (gap) {
      // the side street: road across the pavements and on between the houses, a line down it, a crossing at each mouth
      paint([gap[0], 0.02, -SIDE], [0, 0, 1], [1, 0, 0], UP, SIDE * 2, gap[1] - gap[0], [2, 3, 3, 4, 4], { cu: 1.3, cv: 0.5, along: 'u' });
      for (let z = -SIDE + 1; z < SIDE; z += 2.2)
        if (Math.abs(z) > ROAD + 0.3) stroke([opt.side.x + rr(-0.05, 0.05), 0.06, z], UP, [0, 0, 1], 1.3, 0.14, 6);
      for (const sd of [-1, 1])
        for (let x = gap[0] + 0.45; x < gap[1] - 0.2; x += 0.62)
          stroke([x, 0.06, sd * (WALL + 1.1)], UP, [0, 0, 1], rr(1.3, 1.5), 0.36, 6);
    }
    // shadows, in dots: the right-hand houses across the pavement and the edge of the road, and one under every tree
    for (let x = X0; x < X1; x += 2.4)
      if (open(x, 1)) stroke([x, 0.2, WALL - 0.3 - rr(0, 0.5)], UP, [1, 0, 0], rr(4.5, 6), rr(3.6, 5.2), 1, SHADE);
    for (const t of trees)
      stroke([t.x + 0.9, t.side < 0 ? 0.2 : 0.07, t.z - 1.5], UP, norm([0.5, 0, -1]), t.r * 4.2, t.r * 2.3, 1, SHADE);
    if (opt.onGround) opt.onGround({ ROAD, WALL, X0, X1 });
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
  const walls = B.count(),
    groups = [];
  const group = (c, make) => {
    const a = B.count();
    make();
    groups.push({ a, b: B.count(), c });
  };
  group([X1 + 4, 12, 0], () => {
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
  });
  group([X1, 4.5, 0], () => paint([X1, 0, -16], [0, 0, 1], [0, 1, 0], [-1, 0, 0], 32, 9, [14, 15, 9, 10], { cu: 1.6, along: 'v' }));
  // the near end of the street, behind the eye: seen only when it turns round
  group([X0 - 0.5, 4.5, 0], () =>
    paint([X0 - 0.5, 0, -16], [0, 0, 1], [0, 1, 0], [1, 0, 0], 32, 9, [14, 15, 15, 16], { cu: 1.6, along: 'v' })
  );
  if (gap)
    for (const sd of [-1, 1]) {
      // down the side street: the sides of the corner houses, and the end of it
      const z0 = sd < 0 ? -SIDE : WALL;
      group([gap[0], 4.5, sd * 14], () => {
        paint([gap[0], 0.1, z0], [0, 0, 1], [0, 1, 0], [1, 0, 0], SIDE - WALL, 9, sd < 0 ? [12, 13, 13, 6] : [14, 15, 15, 16], {
          cu: 1.1,
          along: 'v'
        });
        for (let z = WALL + 1; z < SIDE; z += 1.5)
          for (let y = 3.4; y < 8.5; y += 1.55) stroke([gap[0] + 0.07, y, sd * z], [1, 0, 0], UP, 1.0, 0.56, R() < 0.25 ? 18 : 17);
      });
      group([gap[1], 4.5, sd * 15], () => {
        const z1 = sd < 0 ? -SIDE : WALL + 7;
        paint([gap[1], 0.1, z1], [0, 0, 1], [0, 1, 0], [-1, 0, 0], SIDE - WALL - 7, 9, sd < 0 ? [14, 15, 15, 16] : [12, 13, 13, 6], {
          cu: 1.1,
          along: 'v'
        });
      });
      group([opt.side.x, 4.5, sd * SIDE], () =>
        paint([gap[0] - 2, 0, sd * SIDE], [1, 0, 0], [0, 1, 0], [0, 0, -sd], gap[1] - gap[0] + 4, 9, [9, 10, 10, 13], { cu: 1.2, along: 'v' })
      );
    }
  {
    const row = [];
    for (const side of [-1, 1]) {
      let x = X0;
      while (x < X1 - 2) {
        let w = rr(5.5, 9.5);
        if (gap && x < gap[0] && x + w > gap[0]) w = gap[0] - x;
        row.push({ x, w, h: rr(7, 12.5), side });
        x += w;
        if (gap && Math.abs(x - gap[0]) < 1e-6) x = gap[1];
      }
    }
    row.sort((a, b) => b.x - a.x).forEach(q => group([q.x + q.w / 2, q.h / 2, q.side * WALL], () => house(q.x, q.w, q.h, q.side)));
  }

  // ---------------------------------------------------------------- trees, lamps, flags
  const props = B.count();
  if (opt.onProps) opt.onProps({ ROAD, WALL, X0, X1 });
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
      if (!open(x, 1)) continue;
      const z = side * (ROAD + 0.3);
      B.stick(x, 2.0, z, UP, 1.95, 0.05, P[1], 3);
      B.stick(x, 3.9, z - side * 0.3, [0, 0, 1], 0.32, 0.045, P[1], 3);
      B.iso(x, 3.72, z - side * 0.6, 0.11, P[27], 3, { em: true });
    }
  for (const side of [-1, 1])
    for (let x = -6; x < 40; x += 3.1) {
      if ((opt.crossing !== false && Math.abs(x - 7.5) < 2) || !open(x, 0.3)) continue;
      const z = side * (ROAD + 0.12);
      B.stick(x, 0.5, z, UP, 0.34, 0.075, P[24], 3);
      B.iso(x, 0.86, z, 0.062, P[6], 3);
    }
  // strings of flags across the street
  (opt.flags || [9, 19, 31, 46]).forEach((x, q) => {
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

  return { ground, walls, groups, props, trees, gap, ROAD, WALL, X0, X1 };
}
if (typeof module !== 'undefined') module.exports = { makeTown, TOWN_PAL, TOWN_DUSK };
