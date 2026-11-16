/* Brush tools: lay paint straight down as large dabs (B.dab) instead of baking solids, so that scenery reads as brushwork and costs
   few splats. The renderer draws each dab as a stroke of a brush; a dab of ink (palette colour 1) made with SHADE is drawn as rows of
   dots, which is how shadows are put down.
     const T = makePaint(B, sun)             B a builder (makeBuilder), sun the way to the light (unit)
     T.stroke(p, n, e, len, wid, ci, an)     one dab: p its middle, n the way the surface faces, e the way the brush went
     T.paint(o, u, v, n, su, sv, ramp, opt)  a flat patch of dabs over a wash of its middle colour
     T.blob(c, r, ramp, n, an, squash)       a ball of dabs, lit from the sun
     T.SHADE                                 the flags of a shadow dab */
function makePaint(B, sun) {
  const { P, rr, R, fbm, norm, fib, clamp } = B;
  const SUN = sun || norm([-0.45, 0.7, 0.55]),
    UP = [0, 1, 0],
    SHADE = { nd: true },
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

  return { stroke, paint, blob, add, cross, dot, pick, VIS, SUN, UP, SHADE };
}
if (typeof module !== 'undefined') module.exports = { makePaint };
