/* Paints a world's splats with WebGL2, at the size of the art pixels, in real time, as brush strokes laid one over another.
   Each splat is one instanced quad carried to the screen as an ellipse (as cli/render.js does it), but what is drawn in it is a dab of
   a brush: a soft edge, bristles that run dry at different lengths, gaps where the paint gave out. Strokes are blended, so they must go
   down from far to near: the scenery is drawn in the order it was made (the scene makes it far to near), and everything from
   `props` on is sorted each frame. A second picture records which pixels belong to what moves, and how far off they are; the last pass
   draws a dark line round those, and at the moment of a hit replaces the town with flat colour and dots.
     const r = makeRenderer(canvas, world, { walls, groups, props, dyn, hero, eye, target })
       walls, groups   optional: from `walls` to `props` the world is made of groups ([{ a, b, c }]: splats a to b, standing round c),
                       each drawn whole, the groups put in order far to near for the way the eye looks. Before `walls` (or `props`, if
                       there are no groups) everything is drawn in the order it was made: sky first, then the ground
       hero            optional: from here on what moves stays in the picture at the moment of a hit (dyn, if not given)
       eye, target     the way the eye looks until sort is told otherwise
     r.resize(w, h)                       the size of the picture in art pixels
     r.upload(first, count)               send rows of world.data again (what moved)
     r.sort(eye, target)                  put what is sorted in order again for an eye looking this way (after upload)
     r.draw({ eye, target, fov, time, pal, flash, flashCols, shake, deep, near })   near: nothing that stands (from props on) nearer the eye than this is drawn   deep: [near, far] of what moves, for the lines inside it
     r.project(p)                         a point of the world on the picture: [x, y, depth] in art pixels (y down) */
function makeRenderer(canvas, world, lay) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL2 is needed');
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const program = (vs, fs) => {
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {},
      n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '');
      u[name] = gl.getUniformLocation(p, name);
    }
    return { p, u };
  };

  const splat = program(
    `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec2 a_corner;
layout(location=1) in uint a_idx;
uniform highp sampler2D u_data;     // four texels a splat: [x y z density] [c00 c01 c02 colour] [c11 c12 c22 kind] [phase speed range extra]
uniform mat4 u_view;
uniform vec2 u_size;                // art pixels
uniform float u_focal, u_near, u_time;
uniform vec3 u_fog;                 // start, end, most
uniform vec3 u_pal[48];
uniform vec3 u_out[48];
uniform int u_n, u_fogI;
uniform uint u_dyn;                 // from here on a splat is of something that moves: it is outlined
uniform uint u_hero;                // from here on it is still there at the moment of a hit
uniform uint u_props;               // from here on u_near applies: scenery before it is always drawn
uniform float u_near0;
uniform vec2 u_deep;                // how far off the nearest and the farthest of those may be
out vec2 v_uv;
flat out vec4 v_col;
flat out vec4 v_s;                  // seed, mode (0 brush, 1 soft, 2 dots), outlined, depth
flat out float v_hero;
flat out float v_near;
flat out vec4 v_t;                  // cut squared, how long for its width, large on screen, how ragged
flat out vec3 v_mu, v_m0, v_m1, v_m2;
float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
void main() {
  int row = int(a_idx >> 8u), at = int(a_idx & 255u) * 4;
  vec4 a_p = texelFetch(u_data, ivec2(at, row), 0), a_c0 = texelFetch(u_data, ivec2(at + 1, row), 0),
       a_c1 = texelFetch(u_data, ivec2(at + 2, row), 0), a_m = texelFetch(u_data, ivec2(at + 3, row), 0);
  vec3 p = a_p.xyz; float al = a_p.w;
  float kraw = a_c1.w, kind = mod(kraw, 16.0);
  bool glow = mod(floor(kraw / 32.0), 2.0) >= 1.0;
  float ph = a_m.x, sp = a_m.y, rg = a_m.z, ex = a_m.w;
  if (kind == 1.0) al *= 0.62 + 0.38 * sin(u_time * sp + ph);
  else if (kind == 6.0) p.y += sin(u_time * sp + ph) * rg;
  else if (kind == 14.0) {
    float hg = max(0.0, p.y - ex);
    p.x += rg * hg * sin(u_time * sp + ph);
    p.z += rg * 0.6 * hg * sin(u_time * sp * 0.73 + ph * 1.7);
  } else if (kind == 11.0) {
    float x0 = p.x;
    p.x += rg * sin(u_time * sp + p.y * 1.3 + p.z * 0.9 + ph);
    p.y += rg * 0.6 * sin(u_time * sp * 1.3 + x0 * 1.1 + ph);
  }
  vec3 c = (u_view * vec4(p, 1.0)).xyz;
  float nr = a_idx >= u_props ? u_near : u_near0;
  v_near = nr;
  if (al <= 0.0 || a_p.y < -30.0 || c.z > -nr) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  // its colour: the nearest of the palette, then that colour at this hour
  float pk = a_c0.w;
  vec3 col = vec3(mod(pk, 256.0), mod(floor(pk / 256.0), 256.0), floor(pk / 65536.0)) / 255.0;
  int best = 0; float bd = 1e9;
  for (int i = 0; i < 48; i++) {
    if (i >= u_n) break;
    vec3 df = col - u_pal[i]; float dq = dot(df, df);
    if (dq < bd) { bd = dq; best = i; }
  }
  col = u_out[best];
  float seed = hash(float(a_idx) + 0.37), seed2 = hash(float(a_idx) * 1.7 + 5.1);
  float mode = al < 1.0 ? 1.0 : (kraw == 16.0 && best == 1) ? 2.0 : 0.0;
  bool dyn = a_idx >= u_dyn;

  mat3 S = mat3(a_c0.x, a_c0.y, a_c0.z, a_c0.y, a_c1.x, a_c1.y, a_c0.z, a_c1.y, a_c1.z);
  mat3 V = mat3(u_view);
  mat3 Sv = V * S * transpose(V);
  float iz = -1.0 / c.z;
  vec2 lim = 1.3 * 0.5 * u_size / u_focal;
  float tx = clamp(c.x * iz, -lim.x, lim.x) / iz, ty = clamp(c.y * iz, -lim.y, lim.y) / iz;
  vec3 ja = vec3(u_focal * iz, 0.0, u_focal * tx * iz * iz), jb = vec3(0.0, u_focal * iz, u_focal * ty * iz * iz);
  vec3 ua = Sv * ja, ub = Sv * jb;
  float A = dot(ja, ua) + 0.15, Bq = dot(jb, ua), C = dot(jb, ub) + 0.15;
  float mid = 0.5 * (A + C), rad = sqrt(max(0.0, 0.25 * (A - C) * (A - C) + Bq * Bq));
  float l1 = mid + rad, l2 = max(mid - rad, 0.05);
  vec2 d1 = abs(Bq) > 1e-6 ? normalize(vec2(Bq, l1 - A)) : (A >= C ? vec2(1.0, 0.0) : vec2(0.0, 1.0));
  float big = l1 > 500.0 ? 1.0 : 0.0;
  if (mode == 0.0 && l1 < 2.4 * l2) {
    // a round dab becomes a stroke: drawn out one way, a way of its own
    float an = seed * 6.2832, lm = sqrt(l1 * l2);
    d1 = vec2(cos(an), sin(an));
    l1 = lm * (dyn ? 2.0 : 2.9); l2 = lm * (dyn ? 0.8 : 1.0);
  }
  vec2 d2 = vec2(-d1.y, d1.x);
  float cut = al >= 1.0 ? sqrt(2.0 * log(2.0 * al)) : 2.6;
  vec2 off = (d1 * a_corner.x * sqrt(l1) + d2 * a_corner.y * sqrt(l2)) * cut;
  vec2 mid2 = vec2(c.x, c.y) * iz * u_focal;
  gl_Position = vec4((mid2 + off) / (0.5 * u_size), 0.0, 1.0);
  v_uv = a_corner;
  if (mode != 2.0) col *= 0.93 + 0.14 * seed2;
  if (!glow) col = mix(col, u_out[u_fogI], smoothstep(u_fog.x, u_fog.y, -c.z) * u_fog.z);
  v_col = vec4(col, min(al, 1.0));
  v_s = vec4(seed, mode, dyn && mode == 0.0 && !glow ? 1.0 : 0.0, clamp((-c.z - u_deep.x) / (u_deep.y - u_deep.x), 0.0, 1.0));
  v_t = vec4(cut * cut, sqrt(l1 / l2), big, dyn ? 0.3 : 1.0);
  v_hero = a_idx >= u_hero && v_s.z > 0.5 ? 1.0 : 0.0;
  mat3 M = inverse(Sv + mat3(1e-7));
  v_mu = c; v_m0 = M[0]; v_m1 = M[1]; v_m2 = M[2];
}`,
    `#version 300 es
precision highp float;
in vec2 v_uv;
flat in vec4 v_col;
flat in vec4 v_s;
flat in vec4 v_t;
flat in float v_hero;
flat in float v_near;
flat in vec3 v_mu, v_m0, v_m1, v_m2;
uniform vec2 u_size;
uniform float u_focal, u_near;
layout(location=0) out vec4 o_col;
layout(location=1) out vec4 o_id;
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  // the ray through this pixel: where it passes nearest the middle of the splat
  vec3 d = vec3((gl_FragCoord.xy - 0.5 * u_size) / u_focal, -1.0);
  mat3 M = mat3(v_m0, v_m1, v_m2);
  vec3 Md = M * d;
  float dd = max(dot(Md, d), 1e-9), dm = dot(Md, v_mu);
  if (dm < v_near * dd) discard;
  float u = v_uv.x, v = v_uv.y, a;
  vec3 col = v_col.rgb;
  if (v_s.y == 1.0) a = v_col.a * exp(-0.5 * dot(v_uv, v_uv) * v_t.x);
  else {
    float seed = v_s.x * 91.7, rag = v_t.w;
    float bn = noise(vec2(v * 4.5 + seed, seed * 1.7));                                 // one value a bristle, the length of the stroke
    float fine = noise(vec2(v * 12.0 + seed * 3.1, u * 1.1 * v_t.y + seed));
    float side = 1.0 - smoothstep(0.7, 0.98, abs(v) + (fine - 0.5) * 0.2);
    float len = 1.0 - rag * (0.06 + 0.4 * bn);                                         // where this bristle runs dry
    float end = 1.0 - smoothstep(len - 0.14, len + 0.02, abs(u));
    float dry = smoothstep(0.2, 0.42, fine + (1.0 - abs(u)) * 0.55);
    a = side * end;
    if (v_s.y == 2.0) {
      // a shadow: dots in rows across the picture
      vec2 g = mat2(0.7071, -0.7071, 0.7071, 0.7071) * gl_FragCoord.xy / 2.6;
      a *= step(length(fract(g) - 0.5), 0.39);
    } else {
      a *= mix(1.0, dry, 0.85 * rag) * 0.97;
      col *= 0.92 + 0.16 * bn;
    }
    if (v_t.z > 0.5) {
      vec3 x = d * (dm / dd) - v_mu;
      a *= 1.0 - smoothstep(0.6, 1.2, dot(x, M * x) / v_t.x);
    }
  }
  if (a < 0.02) discard;
  o_col = vec4(col, a);
  o_id = vec4(v_s.z, v_s.w, v_hero, a);
}`
  );

  const post = program(
    `#version 300 es
precision highp float;
layout(location=0) in vec2 a_corner;
void main() { gl_Position = vec4(a_corner, 0.0, 1.0); }`,
    `#version 300 es
precision highp float;
uniform sampler2D u_scene;
uniform sampler2D u_id;
uniform float u_flash, u_step;
uniform vec3 u_ink, u_flashA, u_flashB;
uniform ivec2 u_shake;
out vec4 o_col;
vec4 idAt(ivec2 p) { return texelFetch(u_id, clamp(p, ivec2(0), textureSize(u_id, 0) - 1), 0); }
void main() {
  ivec2 size = textureSize(u_scene, 0);
  ivec2 p = clamp(ivec2(gl_FragCoord.xy) + u_shake, ivec2(0), size - 1);
  vec3 col = texelFetch(u_scene, p, 0).rgb;
  vec4 me = idAt(p), a = idAt(p + ivec2(1, 0)), b = idAt(p - ivec2(1, 0)), c = idAt(p + ivec2(0, 1)), e = idAt(p - ivec2(0, 1));
  bool mine = me.r > 0.5;
  float near4 = max(max(a.r, b.r), max(c.r, e.r));
  // a line round what moves, and inside it wherever one part of it stands in front of another
  bool line = !mine && near4 > 0.5;
  if (mine) {
    float step4 = 0.0;
    if (a.r > 0.5) step4 = max(step4, a.g - me.g);
    if (b.r > 0.5) step4 = max(step4, b.g - me.g);
    if (c.r > 0.5) step4 = max(step4, c.g - me.g);
    if (e.r > 0.5) step4 = max(step4, e.g - me.g);
    if (step4 > u_step) col = mix(col, u_ink, 0.75);
  }
  if (u_flash > 0.0) {
    // the moment of a hit: the town gone to one flat colour with dots, what moves in a few loud colours
    vec3 f;
    if (me.b > 0.5) {
      float l = dot(col, vec3(0.30, 0.55, 0.15));
      f = clamp(mix(vec3(l), col, 1.7), 0.0, 1.0);
      f = floor(f * 3.0 + 0.5) / 3.0;
    } else {
      vec2 g = vec2(p) / 9.0;
      g.x += 0.5 * floor(mod(g.y, 2.0));
      f = length(fract(g) - 0.5) < 0.2 ? u_flashB : u_flashA;
    }
    col = mix(col, f, u_flash);
  }
  if (line && (u_flash < 0.5 || max(max(a.b, b.b), max(c.b, e.b)) > 0.5)) col = mix(col, u_ink, 0.9);
  o_col = vec4(col, 1.0);
}`
  );

  // ------------------------------------------------------------ what is sent to the card
  const N = world.count,
    ROW = 256,
    rows = Math.ceil(N / ROW),
    padded = new Float32Array(rows * ROW * 16);
  padded.set(world.data);
  for (let i = N; i < rows * ROW; i++) padded[i * 16 + 1] = -99;
  const dataTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, dataTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, ROW * 4, rows, 0, gl.RGBA, gl.FLOAT, padded);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const order = new Uint32Array(N);
  for (let i = 0; i < N; i++) order[i] = i;
  const orderBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, orderBuf);
  gl.bufferData(gl.ARRAY_BUFFER, order, gl.DYNAMIC_DRAW);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, orderBuf);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribIPointer(1, 1, gl.UNSIGNED_INT, 0, 0);
  gl.vertexAttribDivisor(1, 1);
  const pvao = gl.createVertexArray();
  gl.bindVertexArray(pvao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  /* far to near, for everything from lay.props on, measured along the way the eye looks; a shadow goes down before what stands on
     it. Groups (whole houses) are put in order the same way, each drawn as it was made */
  const P0 = lay.props,
    G0 = lay.groups ? lay.walls : P0,
    groups = lay.groups || [],
    gkeys = groups.map((g, i) => [0, i]),
    NS = N - P0,
    keys = new Uint32Array(NS),
    D = world.data,
    shadowCol = ((world.pal[1] >> 16) & 255) + ((world.pal[1] >> 8) & 255) * 256 + (world.pal[1] & 255) * 65536;
  if (NS > 65535) throw new Error('too many splats to sort');
  let drawn = N;
  function sort(eye, target) {
    const ex = eye || lay.eye,
      tg = target || lay.target,
      fl = Math.hypot(tg[0] - ex[0], tg[1] - ex[1], tg[2] - ex[2]) || 1,
      f0 = (tg[0] - ex[0]) / fl,
      f1 = (tg[1] - ex[1]) / fl,
      f2 = (tg[2] - ex[2]) / fl;
    if (groups.length) {
      for (const k of gkeys) {
        const c = groups[k[1]].c;
        k[0] = (c[0] - ex[0]) * f0 + (c[1] - ex[1]) * f1 + (c[2] - ex[2]) * f2;
      }
      gkeys.sort((p, q) => q[0] - p[0]);
      let at = G0;
      for (const k of gkeys) {
        const g = groups[k[1]];
        for (let i = g.a; i < g.b; i++) order[at++] = i;
      }
    }
    let n = 0;
    for (let i = P0; i < N; i++) {
      const o = i * 16;
      if (i >= lay.dyn && (D[o + 1] < -30 || D[o + 3] <= 0)) continue;
      let z = (D[o] - ex[0]) * f0 + (D[o + 1] - ex[1]) * f1 + (D[o + 2] - ex[2]) * f2;
      if (D[o + 11] === 16 && D[o + 7] === shadowCol) z += 4;
      const q = z <= 0 ? 0 : z >= 160 ? 65535 : (z * 409.59) | 0;
      keys[n++] = (65535 - q) * 65536 + (i - P0);
    }
    keys.subarray(0, n).sort();
    for (let k = 0; k < n; k++) order[P0 + k] = P0 + (keys[k] & 65535);
    drawn = P0 + n;
    gl.bindBuffer(gl.ARRAY_BUFFER, orderBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, G0 * 4, order, G0, drawn - G0);
  }

  let W = 0,
    H = 0,
    fbo = null,
    colTex = null,
    idTex = null;
  function resize(w, h) {
    if (w === W && h === H) return;
    W = w;
    H = h;
    canvas.width = w;
    canvas.height = h;
    if (fbo) {
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(colTex);
      gl.deleteTexture(idTex);
    }
    const tex = () => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    colTex = tex();
    idTex = tex();
    fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colTex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, idTex, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  const rgb = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255],
    flat = pal => {
      const a = new Float32Array(48 * 3);
      pal.forEach((h, i) => a.set(rgb(h), i * 3));
      return a;
    },
    basePal = flat(world.pal),
    flats = new Map(),
    NEAR = 0.25;
  let view = new Float32Array(16),
    focal = 1;
  function lookAt(e, t) {
    let zx = e[0] - t[0],
      zy = e[1] - t[1],
      zz = e[2] - t[2];
    const zl = Math.hypot(zx, zy, zz);
    zx /= zl;
    zy /= zl;
    zz /= zl;
    let xx = zz,
      xz = -zx;
    const xl = Math.hypot(xx, xz) || 1;
    xx /= xl;
    xz /= xl;
    const yx = zy * xz,
      yy = zz * xx - zx * xz,
      yz = -zy * xx;
    view.set([
      xx,
      yx,
      zx,
      0,
      0,
      yy,
      zy,
      0,
      xz,
      yz,
      zz,
      0,
      -(xx * e[0] + xz * e[2]),
      -(yx * e[0] + yy * e[1] + yz * e[2]),
      -(zx * e[0] + zy * e[1] + zz * e[2]),
      1
    ]);
  }
  return {
    gl,
    resize,
    sort,
    size: () => [W, H],
    upload(first, count) {
      padded.set(world.data.subarray(first * 16, (first + count) * 16), first * 16);
      const r0 = Math.floor(first / ROW),
        r1 = Math.floor((first + count - 1) / ROW);
      gl.bindTexture(gl.TEXTURE_2D, dataTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, r0, ROW * 4, r1 - r0 + 1, gl.RGBA, gl.FLOAT, padded, r0 * ROW * 16);
    },
    project(p) {
      const x = view[0] * p[0] + view[4] * p[1] + view[8] * p[2] + view[12],
        y = view[1] * p[0] + view[5] * p[1] + view[9] * p[2] + view[13],
        z = view[2] * p[0] + view[6] * p[1] + view[10] * p[2] + view[14];
      return [W / 2 + (x / -z) * focal, H / 2 - (y / -z) * focal, -z];
    },
    draw(o) {
      lookAt(o.eye, o.target);
      focal = H / 2 / Math.tan((o.fov * Math.PI) / 360);
      const pal = o.pal || world.pal,
        fog = world.fog;
      if (!flats.has(pal)) flats.set(pal, flat(pal));
      const out = flats.get(pal),
        bg = rgb(pal[0]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, W, H);
      gl.disable(gl.BLEND);
      gl.clearBufferfv(gl.COLOR, 0, [bg[0], bg[1], bg[2], 1]);
      gl.clearBufferfv(gl.COLOR, 1, [0, 1, 0, 0]);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(splat.p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, dataTex);
      gl.uniform1i(splat.u.u_data, 0);
      gl.uniformMatrix4fv(splat.u.u_view, false, view);
      gl.uniform2f(splat.u.u_size, W, H);
      gl.uniform1f(splat.u.u_focal, focal);
      gl.uniform1f(splat.u.u_near, o.near || NEAR);
      gl.uniform1f(splat.u.u_near0, NEAR);
      gl.uniform1ui(splat.u.u_props, lay.props);
      gl.uniform1f(splat.u.u_time, o.time || 0);
      gl.uniform3f(splat.u.u_fog, fog.start, fog.end || fog.start + 1, fog.max);
      gl.uniform3fv(splat.u.u_pal, basePal);
      gl.uniform3fv(splat.u.u_out, out);
      gl.uniform1i(splat.u.u_n, world.pal.length);
      gl.uniform1i(splat.u.u_fogI, fog.c);
      gl.uniform1ui(splat.u.u_dyn, lay.dyn);
      gl.uniform1ui(splat.u.u_hero, lay.hero === undefined ? lay.dyn : lay.hero);
      const deep = o.deep || [0, 12];
      gl.uniform2f(splat.u.u_deep, deep[0], deep[1]);
      gl.bindVertexArray(vao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, drawn);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.disable(gl.BLEND);
      gl.useProgram(post.p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, colTex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, idTex);
      gl.uniform1i(post.u.u_scene, 0);
      gl.uniform1i(post.u.u_id, 1);
      gl.uniform1f(post.u.u_flash, o.flash || 0);
      gl.uniform1f(post.u.u_step, Math.max(0.0045, 0.11 / (deep[1] - deep[0])));
      gl.uniform3fv(post.u.u_ink, rgb(pal[1]));
      const fc = o.flashCols || [0xff7a66, 0xd9604f];
      gl.uniform3fv(post.u.u_flashA, rgb(fc[0]));
      gl.uniform3fv(post.u.u_flashB, rgb(fc[1]));
      const sk = o.shake || [0, 0];
      gl.uniform2i(post.u.u_shake, Math.round(sk[0]), Math.round(sk[1]));
      gl.bindVertexArray(pvao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
    }
  };
}
if (typeof module !== 'undefined') module.exports = { makeRenderer };
