/* The town going about its day: people walking up and down the pavements (some with a dog), a few who stop to watch and cheer,
   cars crossing at the side street, bicycles coming down the street and turning into it. Each figure is a few things (makeThing)
   written again every frame; make them after the scenery, from where what moves begins.
     const life = makeLife(B, T, town, opt)   before B.finish. town = makeTown(...) with opt.side, so that there is a side street
       opt.watch   [[x, z], ...] where onlookers stand, facing the middle of the street
     life.bind(world)                         after B.finish
     life.update(dt, t)                       move everyone on
     life.cheer()                             the onlookers jump and wave */
function makeLife(B, T, town, opt) {
  opt = opt || {};
  const { rr, R } = B,
    X = [1, 0, 0],
    Y = [0, 1, 0],
    Z = [0, 0, 1],
    WALL = town.WALL,
    gap = town.gap,
    cx = gap ? (gap[0] + gap[1]) / 2 : 30,
    mul = (a, b) => {
      const o = new Array(9);
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
      return o;
    },
    app = (m, v) => [
      m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
      m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
      m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
    ],
    plus = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    ramp = r => lit => r[Math.min(r.length - 1, Math.floor(lit * r.length))],
    thing = (parts, r, sh) => makeThing(B, T, { parts, r, sh: sh || undefined, shadow: sh !== false }),
    /* which way something faces, as a turn about the vertical: its own +x goes along (dx, dz) */
    facing = (dx, dz) => Math.atan2(-dz, dx),
    toward = (h, goal, k) => {
      let d = goal - h;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      return h + d * Math.min(1, k);
    };
  const SKIN = [28, 29, 29],
    TOPS = [[35, 36, 36], [32, 33, 34], [23, 24, 24], [17, 18, 18], [25, 26, 27], [19, 20, 21], [16, 6, 6], [14, 15, 16]],
    LEGS = [[17, 18], [1, 14], [22, 11], [11, 12], [30, 31]],
    HAIR = [[30, 31], [22, 22], [11, 12], [23, 24], [1, 30]],
    pick = a => a[Math.floor(R() * a.length)];

  // ---------------------------------------------------------------- people
  function person(o) {
    const t = o.tall || rr(0.92, 1.08),
      top = o.top || pick(TOPS),
      legs = o.legs || pick(LEGS),
      hair = o.hair || pick(HAIR);
    const p = Object.assign(
      {
        t,
        hip: 0.8 * t,
        body: thing(
          [
            { c: [0, 0.3 * t, 0], r: [0.13, 0.3 * t, 0.19], n: 30, col: ramp(top) },
            { c: [0.01, 0.8 * t, 0], r: 0.135, n: 20, col: ramp(SKIN) },
            { c: [-0.03, 0.88 * t, 0], r: [0.15, 0.085, 0.15], n: 14, col: ramp(hair) }
          ],
          0.26,
          [0.2, 0.26]
        ),
        legs: [0, 1].map(() => thing([{ c: [0, -0.38 * t, 0], r: [0.07, 0.4 * t, 0.07], n: 12, col: ramp(legs) }], 0, false)),
        arms: [0, 1].map(() => thing([{ c: [0, -0.25 * t, 0], r: [0.05, 0.27 * t, 0.05], n: 9, col: ramp(top) }], 0, false)),
        x: 0,
        z: 0,
        h: 0,
        ph: rr(0, 6),
        go: 0, // how much it is walking, 0..1
        cheer: 0,
        jump: 0
      },
      o
    );
    return p;
  }
  function drawPerson(p, on, time) {
    const H = turn(Y, p.h),
      bob = 0.035 * Math.abs(Math.sin(p.ph)) * p.go + p.jump,
      hipP = [p.x, p.hip + bob, p.z],
      lean = turn(Z, -0.06 * p.go + 0.02 * Math.sin(time * 1.3 + p.ph) * (1 - p.go));
    p.body.write(hipP, mul(H, lean), on);
    for (let k = 0; k < 2; k++) {
      const s = k ? 1 : -1,
        a = Math.sin(p.ph) * 0.5 * p.go * s,
        up = Math.min(1, p.cheer * 3);
      p.legs[k].write(plus(hipP, app(H, [0, 0, s * 0.09])), mul(H, turn(Z, a)), on);
      // arms swing against the legs; cheering, they go up and out and wave
      const arm = mul(turn(X, -s * (2.6 + 0.25 * Math.sin(time * 16 + k)) * up), turn(Z, -a * 1.1 * (1 - up)));
      p.arms[k].write(plus(hipP, app(H, [0, 0.55 * p.t, s * 0.21])), mul(H, arm), on);
    }
  }

  // ---------------------------------------------------------------- dogs
  function dog(owner) {
    const fur = pick([[22, 11, 11], [16, 6, 6], [30, 31, 31], [25, 26, 27]]),
      F = ramp(fur);
    return {
      owner,
      body: thing(
        [
          { c: [0, 0.32, 0], r: [0.28, 0.13, 0.12], n: 26, col: F },
          { c: [0.3, 0.46, 0], r: 0.12, n: 16, col: F },
          { c: [0.43, 0.43, 0], r: [0.07, 0.05, 0.05], n: 6, col: ramp([1, 30]) },
          { c: [0.27, 0.58, 0.07], r: [0.04, 0.08, 0.03], n: 4, col: ramp([22, 30]) },
          { c: [0.27, 0.58, -0.07], r: [0.04, 0.08, 0.03], n: 4, col: ramp([22, 30]) },
          { c: [0.18, 0.12, 0.08], r: [0.035, 0.12, 0.035], n: 4, col: F },
          { c: [0.18, 0.12, -0.08], r: [0.035, 0.12, 0.035], n: 4, col: F },
          { c: [-0.18, 0.12, 0.08], r: [0.035, 0.12, 0.035], n: 4, col: F },
          { c: [-0.18, 0.12, -0.08], r: [0.035, 0.12, 0.035], n: 4, col: F }
        ],
        0.2,
        [0.32, 0.16]
      ),
      tail: thing([{ c: [0, 0.12, 0], r: [0.03, 0.13, 0.03], n: 6, col: F }], 0, false),
      x: owner.x - 0.8,
      z: owner.z,
      h: owner.h,
      ph: 0,
      go: 0
    };
  }
  function stepDog(d, dt, time) {
    const o = d.owner,
      back = [Math.cos(o.h), -Math.sin(o.h)],
      gx = o.x - back[0] * 0.75 + back[1] * 0.45,
      gz = o.z - back[1] * 0.75 - back[0] * 0.45,
      dx = gx - d.x,
      dz = gz - d.z,
      l = Math.hypot(dx, dz),
      sp = Math.min(3, l * 3);
    if (l > 0.05) {
      d.x += (dx / l) * sp * dt;
      d.z += (dz / l) * sp * dt;
    }
    d.go += ((sp > 0.25 ? 1 : 0) - d.go) * Math.min(1, dt * 6);
    if (sp > 0.25) d.h = toward(d.h, facing(dx, dz), dt * 7);
    d.ph += dt * (4 + sp * 9);
    const H = turn(Y, d.h),
      bob = 0.04 * Math.abs(Math.sin(d.ph)) * d.go,
      at = [d.x, bob, d.z];
    d.body.write(at, mul(H, turn(Z, 0.08 * Math.sin(d.ph) * d.go)), true);
    d.tail.write(plus(at, app(H, [-0.28, 0.38, 0])), mul(H, mul(turn(X, 0.6 * Math.sin(time * 14 + d.x)), turn(Z, 0.7))), true);
  }

  // ---------------------------------------------------------------- walkers and onlookers
  const x0 = town.X0 + 3,
    stretches = gap
      ? [
          [x0, gap[0] - 1.5],
          [gap[1] + 1.5, 66]
        ]
      : [[x0, 66]],
    walkers = [],
    dogs = [],
    watchers = [];
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1,
      seg = stretches[i < 4 || stretches.length < 2 ? 0 : 1],
      p = person({ side, seg, z: side * rr(4.75, 5.0), speed: rr(0.9, 1.35), mode: 'walk', wait: 0 });
    p.x = rr(seg[0] + 2, seg[1] - 2);
    p.dir = R() < 0.5 ? 1 : -1;
    p.h = p.dir > 0 ? 0 : Math.PI;
    walkers.push(p);
    if (i < 2) dogs.push(dog(p));
  }
  for (const [x, z] of opt.watch || []) {
    const p = person({ x, z, mode: 'watch' });
    p.h = facing(0, -Math.sign(z));
    watchers.push(p);
  }
  function stepWalker(p, dt) {
    if (p.mode === 'walk') {
      p.x += p.dir * p.speed * dt;
      p.go += (1 - p.go) * Math.min(1, dt * 5);
      p.ph += dt * p.speed * 5.4;
      if ((p.dir > 0 && p.x > p.seg[1]) || (p.dir < 0 && p.x < p.seg[0])) {
        p.dir = -p.dir;
        p.mode = 'turn';
        p.wait = 0.7;
      } else if (R() < dt * 0.05) {
        p.mode = 'stop';
        p.wait = rr(1, 3);
      }
    } else {
      p.go += (0 - p.go) * Math.min(1, dt * 6);
      p.wait -= dt;
      if (p.wait <= 0) p.mode = 'walk';
    }
    p.h = toward(p.h, p.dir > 0 ? 0 : Math.PI, dt * 6);
  }

  // ---------------------------------------------------------------- cars, across at the side street
  const CARS = [[23, 24, 24, 9], [32, 33, 33, 34], [25, 26, 26, 27], [17, 18, 18, 16]],
    cars = [];
  if (gap)
    for (let i = 0; i < 2; i++) {
      const col = ramp(CARS[i]),
        dark = ramp([1, 1, 14]);
      cars.push({
        lane: i ? cx + 0.75 : cx - 0.75,
        dir: i ? -1 : 1,
        z: i ? 24 : -24,
        wait: rr(0.5, 4),
        speed: rr(6, 8),
        body: thing(
          [
            { c: [0, 0.5, 0], r: [1.05, 0.28, 0.55], n: 60, col },
            { c: [-0.12, 0.86, 0], r: [0.6, 0.25, 0.47], n: 30, col: ramp([17, 18, 16]) },
            { c: [-0.12, 1.08, 0], r: [0.52, 0.06, 0.45], n: 12, col },
            { c: [0.68, 0.22, 0.52], r: [0.22, 0.22, 0.09], n: 8, col: dark },
            { c: [0.68, 0.22, -0.52], r: [0.22, 0.22, 0.09], n: 8, col: dark },
            { c: [-0.68, 0.22, 0.52], r: [0.22, 0.22, 0.09], n: 8, col: dark },
            { c: [-0.68, 0.22, -0.52], r: [0.22, 0.22, 0.09], n: 8, col: dark },
            { c: [1.04, 0.56, 0.34], r: [0.04, 0.07, 0.1], n: 3, col: ramp([27]) },
            { c: [1.04, 0.56, -0.34], r: [0.04, 0.07, 0.1], n: 3, col: ramp([27]) }
          ],
          0.9,
          [1.15, 0.6]
        )
      });
    }
  function stepCar(c, dt) {
    if (c.wait > 0) {
      c.wait -= dt;
      c.body.write([0, 0, 0], turn(Y, 0), false);
      return;
    }
    c.z += c.dir * c.speed * dt;
    if (Math.abs(c.z) > 24) {
      c.z = -c.dir * 24;
      c.wait = rr(2, 7);
      c.speed = rr(6, 8);
    }
    // past the corner houses it is out of sight (nothing in front of it would hide it)
    c.body.write([c.lane, 0.04 * Math.sin(c.z * 3), c.z], turn(Y, facing(0, c.dir)), Math.abs(c.z) < WALL + 0.8);
  }

  // ---------------------------------------------------------------- bicycles: down the street and round into the side street
  const bikes = [];
  const route = pts => {
    const L = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return {
      len: L[L.length - 1],
      at(s) {
        let i = 1;
        while (i < pts.length - 1 && L[i] < s) i++;
        const f = Math.max(0, Math.min(1, (s - L[i - 1]) / (L[i] - L[i - 1] || 1))),
          a = pts[i - 1],
          b = pts[i];
        return { x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, h: facing(b[0] - a[0], b[1] - a[1]) };
      }
    };
  };
  if (gap)
    [
      route([[74, -1.9], [cx + 2.4, -1.9], [cx + 1.2, -2.6], [cx + 0.7, -3.8], [cx + 0.7, -24]]),
      route([[cx - 0.7, 24], [cx - 0.7, 3.8], [cx - 0.2, 2.6], [cx + 1.4, 1.9], [74, 1.9]])
    ].forEach((path, i) => {
      const frame = ramp(pick([[23, 24], [32, 33], [35, 36], [25, 26]])),
        dark = ramp([1, 1, 14]),
        top = pick(TOPS);
      bikes.push({
        path,
        s: rr(0, path.len),
        speed: rr(3, 4),
        h: 0,
        ph: 0,
        wait: 0,
        frame: thing(
          [
            { c: [0.5, 0.33, 0], r: [0.33, 0.33, 0.03], n: 20, col: dark },
            { c: [-0.5, 0.33, 0], r: [0.33, 0.33, 0.03], n: 20, col: dark },
            { c: [0, 0.6, 0], r: [0.5, 0.035, 0.03], n: 8, col: frame },
            { c: [-0.2, 0.92, 0], r: [0.1, 0.03, 0.06], n: 3, col: dark },
            { c: [0.42, 1.0, 0], r: [0.03, 0.03, 0.24], n: 4, col: dark }
          ],
          0.5,
          [0.8, 0.2]
        ),
        rider: thing(
          [
            { c: [0, 0.27, 0], r: [0.12, 0.28, 0.17], n: 20, col: ramp(top) },
            { c: [0.02, 0.72, 0], r: 0.13, n: 14, col: ramp(SKIN) },
            { c: [-0.02, 0.8, 0], r: [0.15, 0.09, 0.15], n: 10, col: ramp(pick([[23, 24], [32, 33], [6, 16], [26, 27]])) },
            { c: [0.22, 0.42, 0.16], r: [0.24, 0.045, 0.045], n: 5, col: ramp(top) },
            { c: [0.22, 0.42, -0.16], r: [0.24, 0.045, 0.045], n: 5, col: ramp(top) }
          ],
          0,
          false
        ),
        legs: [0, 1].map(() => thing([{ c: [0, -0.3, 0], r: [0.06, 0.32, 0.06], n: 10, col: ramp(pick(LEGS)) }], 0, false))
      });
      if (i) bikes[i].s = 0;
    });
  function stepBike(k, dt) {
    if (k.wait > 0) {
      k.wait -= dt;
      k.frame.write([0, 0, 0], turn(Y, 0), false);
      k.rider.write([0, 0, 0], turn(Y, 0), false);
      for (const l of k.legs) l.write([0, 0, 0], turn(Y, 0), false);
      return;
    }
    k.s += k.speed * dt;
    if (k.s > k.path.len) {
      k.s = 0;
      k.wait = rr(3, 9);
    }
    const q = k.path.at(k.s),
      on = Math.abs(q.z) < WALL + 0.6 && q.x < 75;
    k.h = toward(k.h, q.h, dt * 5);
    k.ph += dt * k.speed * 2.6;
    const H = turn(Y, k.h),
      at = [q.x, 0, q.z],
      hip = plus(at, app(H, [-0.2, 1.0, 0]));
    k.frame.write(at, H, on);
    k.rider.write(hip, mul(H, turn(Z, -0.45)), on);
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      k.legs[i].write(plus(hip, app(H, [0, 0, s * 0.1])), mul(H, turn(Z, 0.45 + 0.45 * Math.sin(k.ph + i * Math.PI))), on);
    }
  }

  return {
    cars,
    bikes,
    walkers,
    bind(world) {
      for (const p of walkers.concat(watchers)) [p.body, ...p.legs, ...p.arms].forEach(t => t.bind(world));
      for (const d of dogs) [d.body, d.tail].forEach(t => t.bind(world));
      for (const c of cars) c.body.bind(world);
      for (const k of bikes) [k.frame, k.rider, ...k.legs].forEach(t => t.bind(world));
    },
    update(dt, time) {
      for (const p of walkers) {
        stepWalker(p, dt);
        drawPerson(p, true, time);
      }
      for (const p of watchers) {
        p.cheer = Math.max(0, p.cheer - dt);
        p.jump = p.cheer > 0 ? 0.16 * Math.abs(Math.sin(time * 13 + p.x)) : 0;
        drawPerson(p, true, time);
      }
      for (const d of dogs) stepDog(d, dt, time);
      for (const c of cars) stepCar(c, dt);
      for (const k of bikes) stepBike(k, dt);
    },
    cheer() {
      for (const p of watchers) p.cheer = rr(0.9, 1.3);
    }
  };
}
if (typeof module !== 'undefined') module.exports = { makeLife };
