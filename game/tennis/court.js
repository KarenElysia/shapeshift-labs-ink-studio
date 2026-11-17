/* The tennis look test's world: the town with a court chalked on the road and a net across it, three things to hit, and two kids with
   rackets. The court runs along x: the player's half is x < 0, the rival's x > 0.
     const court = makeCourt({ makeBuilder, KIT })
     court.world, court.me, court.rival (K.character, bound), court.things (makeThing), court.fx (K.play.fx, bound)
     court.props, court.dyn      the first splat that is sorted each frame, and the first that changes each frame
     court.town, court.life, court.hero   the town (its groups), the people in it, and where the players' own splats begin
     court.CX, court.CZ, court.NET   half the court's length and width, and how high the net is */
function makeCourt(kit) {
  const { makeBuilder, KIT: K } = kit;
  const B = makeBuilder(11, TOWN_PAL),
    T = makePaint(B),
    { stroke, paint, UP } = T,
    { rr } = B,
    P = B.P,
    CX = 7.4,
    CZ = 2.8,
    NET = 0.95,
    SERVE = 3.7;
  const town = makeTown(B, T, {
    x0: -26,
    crossing: false,
    side: { x: 28.5, w: 5 },
    flags: [17, 28, 40, 52],
    onGround() {
      // the court: a wash of chalky blue, then its lines
      paint([-CX, 0.04, -CZ], [1, 0, 0], [0, 0, 1], UP, CX * 2, CZ * 2, [34, 7, 7, 34], { cu: 1.2, cv: 0.6, along: 'u', under: false });
      const line = (a, b) => {
        const d = [b[0] - a[0], 0, b[2] - a[2]],
          len = Math.hypot(d[0], d[2]),
          n = Math.max(1, Math.round(len / 1.3)),
          e = [d[0] / len, 0, d[2] / len];
        for (let i = 0; i < n; i++) {
          const f = (i + 0.5) / n;
          stroke([a[0] + d[0] * f + rr(-0.03, 0.03), 0.07, a[2] + d[2] * f + rr(-0.03, 0.03)], UP, e, (len / n) * 1.25, rr(0.13, 0.18), 6);
        }
      };
      for (const s of [-1, 1]) {
        line([-CX, 0, s * CZ], [CX, 0, s * CZ]);
        line([s * CX, 0, -CZ], [s * CX, 0, CZ]);
        line([s * SERVE, 0, -CZ], [s * SERVE, 0, CZ]);
      }
      line([-SERVE, 0, 0], [SERVE, 0, 0]);
    },
    onProps() {
      // the net: two posts, a white tape along the top, and cloth you can see through
      for (const s of [-1, 1]) {
        B.stick(0, 0.6, s * (CZ + 0.45), UP, 0.6, 0.06, P[1], 3);
        B.iso(0, 1.22, s * (CZ + 0.45), 0.075, P[24], 3);
      }
      for (let z = -CZ - 0.4; z < CZ + 0.4; z += 0.5) stroke([0, NET + 0.08, z + 0.25], [-1, 0, 0], [0, 0, 1], 0.7, 0.13, 6);
      for (let z = -CZ - 0.35; z < CZ + 0.4; z += 0.2) stroke([0.02, NET * 0.5 + 0.06, z], [-1, 0, 0], UP, NET * 1.05, 0.04, 16);
      for (const y of [0.3, 0.62]) for (let z = -CZ - 0.4; z < CZ + 0.4; z += 0.6) stroke([0.02, y, z + 0.3], [-1, 0, 0], [0, 0, 1], 0.8, 0.035, 16);
    }
  });
  const dyn = B.count(),
    life = makeLife(B, T, town, { watch: [[-3.2, -4.45], [2.6, 4.45], [6.4, -4.45]] }),
    hero = B.count(),
    things = [THINGS.ball, THINGS.melon, THINGS.duck].map(spec => makeThing(B, T, spec)),
    fx = K.play.fx(B, 240),
    fxAt = B.count() - fx.total,
    speed = { walk: 3.2, run: 5.6 },
    meAt = B.count(),
    me = K.character(B, kidSpec({ tool: 'racket', speed }), 0),
    rivalAt = B.count(),
    rival = K.character(
      B,
      kidSpec({ tool: 'racket', speed, hood: [35, 36, 36, 10], short: [17, 18, 18], cap: [32, 33, 33], hair: [23, 25, 26], shoe: [32, 33, 33] }),
      0
    );
  const world = B.finish({
    cam: { target: [0, 1, 0], dist: 20, pitch: 0.5, yaw: -Math.PI / 2 },
    detail: 14,
    dither: 1,
    radius: 60,
    fog: { c: 7, start: 36, end: 110, max: 0.5 }
  });
  me.bind(world, meAt);
  rival.bind(world, rivalAt);
  fx.bind(world, fxAt);
  life.bind(world);
  life.update(0, 0);
  things.forEach(t => {
    t.bind(world);
    t.write([0, 0, 0], [1, 0, 0, 0, 1, 0, 0, 0, 1], false);
  });
  me.st.x = -5;
  me.st.face = 0;
  rival.st.x = 5;
  rival.st.face = Math.PI;
  me.st.born = rival.st.born = 1;
  return { world, me, rival, things, fx, town, life, hero, props: town.props, dyn, CX, CZ, NET, themes: { day: TOWN_PAL, dusk: TOWN_DUSK } };
}
if (typeof module !== 'undefined') module.exports = { makeCourt };
