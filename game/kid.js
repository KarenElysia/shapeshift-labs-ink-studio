/* The kid: a K.character spec. Big head, hooded top, shorts, big trainers, a cap worn back to front, something to hit with.
     K.character(B, kidSpec(look), 0)     look: { hood, short, cap, hair, shoe } ramps of palette colours (dark to light), any left out
                                          are the first kid's; look.tool 'bat' | 'racket'; look.speed { walk, run } */
function kidSpec(look) {
  look = look || {};
  const HOOD = look.hood || [25, 26, 26, 27],
    SKIN = look.skin || [28, 29, 29],
    HAIR = look.hair || [30, 31, 31],
    SHORT = look.short || [32, 33, 33, 34],
    SHOE = look.shoe || [23, 24, 24, 24],
    WHITE = [16, 6, 6],
    CAP = look.cap || [23, 24, 24];
  return {
    id: 'kid',
    height: 1.5,
    res: 0.045,
    x0: look.x0 || 0,
    hp: 3,
    atk: 'slash',
    reach: 1.25,
    lunge: 0.6,
    fx: 6,
    dust: 5,
    shadow: 0.5,
    light: { lo: 0.18, hi: 1.02 },
    anim: { breath: 0.02, sway: 0.03, sf: 1.6, nodI: 0.02 },
    speed: look.speed || { walk: 2.4, run: 5 },
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
      if (look.tool === 'racket') {
        S.tube([[0.13, 0.47, 0.34], [0.17, 0.82, 0.37]], 0.03, 0.028, { r: [32, 33] }, T('item'));
        S.torus([0.2, 1.06, 0.39], 0.21, 0.035, { r: CAP }, Object.assign({ ax: S.AX }, T('item')));
        S.ball([0.2, 1.06, 0.39], [0.02, 0.2, 0.2], { r: [16, 6, 6] }, T('item'));
      } else {
        S.tube([[0.13, 0.46, 0.34], [0.2, 1.22, 0.4]], 0.032, 0.075, { r: [11, 5, 6, 6] }, T('item'));
        S.ball([0.13, 0.45, 0.34], 0.05, { r: CAP }, T('item'));
        S.tube([[0.165, 0.84, 0.37], [0.172, 0.92, 0.376]], 0.066, 0.07, { r: [32, 33] }, T('item'));
      }
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
}
if (typeof module !== 'undefined') module.exports = { kidSpec };
