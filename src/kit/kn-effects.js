/* kn-effects: four things that already existed, each given one name and one way in.
   They were written where they were first needed (a cathedral, a pond, the game's breaking, a character's death). Nothing about how they
   look has changed; this is where to find them.

   K.windowLight(o)   light through a window, as the cathedral has it. o: { at: [x, y, z] the middle of the window (it stands square to z),
                      dir: the way its light travels, pane(u, v): the palette colour of the glass u across and v up from the middle, 0 for
                      lead or stone, clear: how far behind the window the light begins (0.3) }. Gives back three parts of the one effect:
                        .beam(x, y, z)       the pane whose light falls at a place, or 0
                        .lit                 a material's tex: surfaces facing up enough take the pane's colour where the light lands
                        .lamp(far, s)        the lamp to push onto S.lights, far back along the light, casting shadows
                        .air(r, cols, k)     what to give the finished world as .glass, so the page draws the light in the air itself
   K.reflect(B, o)    things standing over still water, seen in it. o: { y: the water's height, where(x, z): where there is water,
                      colours: { palette colour above: the colour of its reflection }, gap, maxH }. Before B.finish, after everything
                      that is to be reflected.
   K.shatter(B, n)    loose pieces for whatever gets broken: n spare splats. .burst(list, centre, power, floor, cols) throws the splats
                      in list outward where they stand; .fall(list, pivot, angle, floor, cols, len) topples them over like a felled
                      trunk and smashes them where they land. (The game carves the hole first: stream.carve gives the list.)
   K.dissolve.at(i, t, nx, nz, out)   a body coming apart into its own splats: where splat i has got to at time t (0 to about 0.9), given
                      which way its surface faces across the ground. out: [dx, dy, dz, how much of its size is left]. Run backwards it
                      is an arrival. This is what every character does when it is defeated and when it is summoned. */
(function (K) {
  K.windowLight = o => {
    const WC = o.at,
      D = o.dir,
      clear = o.clear === undefined ? 0.3 : o.clear,
      beam = (x, y, z) => {
        const t = (z - WC[2]) / D[2];
        if (t <= clear) return 0;
        return o.pane(x - D[0] * t - WC[0], y - D[1] * t - WC[1]);
      };
    return {
      beam,
      lit: (x, y, z, ny) => {
        if (ny < 0.3) return undefined;
        const c = beam(x, y, z);
        return c ? c : undefined;
      },
      lamp: (far, s) => ({
        p: [WC[0] - D[0] * far, WC[1] - D[1] * far, WC[2] - D[2] * far],
        r: far * 2.8,
        s,
        sh: true
      }),
      air: (r, cols, k) => ({ at: WC, r, dir: D, cols, k })
    };
  };
  K.reflect = (B, o) => B.mirror(o.y || 0, o.where || (() => true), o.colours, { gap: o.gap, maxH: o.maxH });
  K.shatter = (B, n) => K.play.debris(B, n);
  K.dissolve = {
    at(i, t, nx, nz, out) {
      const h1 = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1,
        h2 = Math.abs(Math.sin(i * 78.233) * 12543.123) % 1,
        v = 1.2 + 3.2 * h1,
        ang = h2 * 6.283185307179586;
      out[0] = (nx * 0.6 + Math.cos(ang) * 0.5) * v * t;
      out[1] = (1.5 + 3 * h1) * t - 9 * t * t;
      out[2] = (nz * 0.6 + Math.sin(ang) * 0.5) * v * t;
      out[3] = Math.max(0, 1 - t / (0.45 + 0.45 * h2));
      return out;
    }
  };
})(KIT);
