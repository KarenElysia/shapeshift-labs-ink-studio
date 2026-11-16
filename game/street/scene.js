/* The street look test's world: the town, three rubber balls that fly in, and the kid with a bat standing at the origin facing +x.
     const street = makeStreet({ makeBuilder, KIT })
     street.world, street.ch (the K.character, bound), street.balls (makeThing), street.fx (K.play.fx, bound)
     street.props, street.dyn      the first splat that is sorted each frame, and the first that changes each frame
     street.themes                 { day, dusk } */
function makeStreet(kit) {
  const { makeBuilder, KIT: K } = kit;
  const B = makeBuilder(11, TOWN_PAL),
    T = makePaint(B),
    town = makeTown(B, T);
  const dyn = B.count(),
    balls = [0, 1, 2].map(() => makeThing(B, T, THINGS.ball)),
    fx = K.play.fx(B, 220),
    fxAt = B.count() - fx.total,
    ch = K.character(B, kidSpec(), 0);
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
  return { world, ch, balls, fx, props: town.props, dyn, sun: T.SUN, themes: { day: TOWN_PAL, dusk: TOWN_DUSK } };
}
if (typeof module !== 'undefined') module.exports = { makeStreet };
