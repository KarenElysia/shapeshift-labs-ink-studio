/* Draws a world's splats with WebGL2, at the size of the art pixels, in real time.
   Each splat is one instanced quad: its covariance is carried to the screen as an ellipse (as cli/render.js does), a solid one is cut
   hard at half strength, and its depth is worked out for each pixel (where the ray through that pixel passes nearest the middle of the
   splat), so that large flat dabs cross each other and what stands on them correctly. Nothing is sorted. A second pass over the small
   picture draws an edge where it steps back, adds ordered noise, takes the nearest palette colour and shows that colour's counterpart
   in the palette of the hour.
     const r = makeRenderer(canvas, world)
     r.resize(w, h)                       the size of the picture in art pixels
     r.upload(first, count)               send rows of world.data again (what moved)
     r.draw({ eye, target, fov, time, pal, flash, flashCols, shake })
     r.project(p)                         a point of the world on the picture: [x, y, depth] in art pixels (y down) */
function makeRenderer(canvas, world) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL2 is needed');
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
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
layout(location=0) in vec2 a_corner;
layout(location=1) in vec4 a_p;     // x y z density
layout(location=2) in vec4 a_c0;    // c00 c01 c02 packed colour
layout(location=3) in vec4 a_c1;    // c11 c12 c22 kind
layout(location=4) in vec4 a_m;     // phase speed range extra
uniform mat4 u_view;
uniform vec2 u_size;                // art pixels
uniform float u_focal, u_near, u_far, u_time;
uniform vec3 u_fog;                 // start, end, most
uniform vec3 u_fogCol;
out vec2 v_q;
flat out vec3 v_col;
flat out float v_al, v_cut;
flat out vec3 v_mu, v_m0, v_m1, v_m2;
flat out vec2 v_zr;
flat out float v_small;
void main() {
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
  if (al <= 0.0 || a_p.y < -30.0 || c.z > -u_near) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
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
  vec2 d2 = vec2(-d1.y, d1.x);
  float cut = al >= 1.0 ? sqrt(2.0 * log(2.0 * al)) : 2.6;
  vec2 off = (d1 * a_corner.x * sqrt(l1) + d2 * a_corner.y * sqrt(l2)) * cut;
  vec2 mid2 = vec2(c.x, c.y) * iz * u_focal;
  gl_Position = vec4((mid2 + off) / (0.5 * u_size), 0.0, 1.0);
  v_q = a_corner * cut;
  float pk = a_c0.w;
  vec3 col = vec3(mod(pk, 256.0), mod(floor(pk / 256.0), 256.0), floor(pk / 65536.0)) / 255.0;
  if (!glow) col = mix(col, u_fogCol, smoothstep(u_fog.x, u_fog.y, -c.z) * u_fog.z);
  v_col = col; v_al = al; v_cut = cut; v_small = l1 < 9.0 ? 1.0 : 0.0;
  mat3 M = inverse(Sv + mat3(1e-7));
  v_mu = c; v_m0 = M[0]; v_m1 = M[1]; v_m2 = M[2];
  float zs = 2.5 * sqrt(max(Sv[2][2], 1e-8)) + 0.002;
  v_zr = vec2(-c.z - zs, -c.z + zs);
}`,
    `#version 300 es
precision highp float;
in vec2 v_q;
flat in vec3 v_col;
flat in float v_al, v_cut;
flat in vec3 v_mu, v_m0, v_m1, v_m2;
flat in vec2 v_zr;
flat in float v_small;
uniform vec2 u_size;
uniform float u_focal, u_near, u_far;
out vec4 o_col;
const float BAYER[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
void main() {
  // the ray through this pixel, and how near it passes to the middle of the splat (measured in the splat's own spread)
  vec3 d = vec3((gl_FragCoord.xy - 0.5 * u_size) / u_focal, -1.0);
  mat3 M = mat3(v_m0, v_m1, v_m2);
  vec3 Md = M * d;
  float dd = max(dot(Md, d), 1e-9), dm = dot(Md, v_mu);
  if (dm < u_near * dd) discard;   // (nearest behind the eye: the ray never meets it)
  float r2 = dot(v_q, v_q);
  if (v_small < 0.5) { vec3 x = d * (dm / dd) - v_mu; r2 = max(r2, dot(x, M * x)); }
  if (v_al >= 1.0) { if (r2 > v_cut * v_cut) discard; }
  else {
    ivec2 ip = ivec2(gl_FragCoord.xy);
    float th = (BAYER[(ip.x & 3) + ((ip.y & 3) << 2)] + 0.5) / 16.0;
    if (v_al * exp(-0.5 * r2) < th) discard;
  }
  float t = clamp(dm / dd, v_zr.x, v_zr.y);
  gl_FragDepth = clamp((t - u_near) / (u_far - u_near), 0.0, 0.9999);
  o_col = vec4(v_col, 1.0);
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
uniform highp sampler2D u_depth;
uniform vec3 u_pal[48];
uniform vec3 u_out[48];
uniform int u_n;
uniform float u_dither, u_flash, u_near, u_far;
uniform vec3 u_flashA, u_flashB, u_flashC;
uniform ivec2 u_shake;
out vec4 o_col;
const float BAYER[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
int nearest(vec3 c) {
  int best = 0; float bd = 1e9;
  for (int i = 0; i < 48; i++) {
    if (i >= u_n) break;
    vec3 df = c - u_pal[i]; float d = dot(df * df, vec3(0.30, 0.55, 0.15));
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
float depthAt(ivec2 p) {
  p = clamp(p, ivec2(0), textureSize(u_depth, 0) - 1);
  return u_near + texelFetch(u_depth, p, 0).r * (u_far - u_near);
}
void main() {
  ivec2 size = textureSize(u_scene, 0);
  ivec2 p = clamp(ivec2(gl_FragCoord.xy) + u_shake, ivec2(0), size - 1);
  vec3 c = texelFetch(u_scene, p, 0).rgb;
  float z = depthAt(p);
  float zn = max(max(depthAt(p + ivec2(1, 0)), depthAt(p - ivec2(1, 0))), max(depthAt(p + ivec2(0, 1)), depthAt(p - ivec2(0, 1))));
  bool edge = zn - z > 0.22 + 0.07 * z;
  float noise = ((BAYER[(p.x & 3) + ((p.y & 3) << 2)] + 0.5) / 16.0 - 0.5) * u_dither;
  int i = nearest(clamp(c + noise, 0.0, 1.0));
  vec3 col = u_out[i];
  if (edge) {
    vec3 tone = col * 0.6;
    tone = min(vec3(1.0), tone * max(1.0, 0.1 / max(dot(tone, vec3(0.30, 0.55, 0.15)), 0.001)));
    col = mix(col, tone, 0.75);
  }
  if (u_flash > 0.0) {
    // the moment of a hit: three flat colours, the far town gone
    float l = dot(u_pal[i], vec3(0.30, 0.55, 0.15));
    vec3 f = z > 14.0 ? u_flashA : (edge || l < 0.34) ? u_flashA : l > 0.62 ? u_flashC : u_flashB;
    col = mix(col, f, u_flash);
  }
  o_col = vec4(col, 1.0);
}`
  );

  // one quad, drawn once for each splat
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const inst = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, inst);
  gl.bufferData(gl.ARRAY_BUFFER, world.data, gl.DYNAMIC_DRAW);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, inst);
  for (let i = 0; i < 4; i++) {
    gl.enableVertexAttribArray(1 + i);
    gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, 64, i * 16);
    gl.vertexAttribDivisor(1 + i, 1);
  }
  const pvao = gl.createVertexArray();
  gl.bindVertexArray(pvao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  let W = 0,
    H = 0,
    fbo = null,
    colTex = null,
    depTex = null;
  function resize(w, h) {
    if (w === W && h === H) return;
    W = w;
    H = h;
    canvas.width = w;
    canvas.height = h;
    if (fbo) {
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(colTex);
      gl.deleteTexture(depTex);
    }
    const tex = (ifmt, fmt, type) => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    colTex = tex(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    depTex = tex(gl.DEPTH_COMPONENT32F, gl.DEPTH_COMPONENT, gl.FLOAT);
    fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colTex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  const rgb = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255],
    flat = pal => {
      const a = new Float32Array(48 * 3);
      pal.forEach((h, i) => a.set(rgb(h), i * 3));
      return a;
    },
    basePal = flat(world.pal),
    NEAR = 0.25,
    FAR = 400;
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
    size: () => [W, H],
    upload(first, count) {
      gl.bindBuffer(gl.ARRAY_BUFFER, inst);
      gl.bufferSubData(gl.ARRAY_BUFFER, first * 64, world.data, first * 16, count * 16);
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
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, W, H);
      const bg = rgb(world.pal[0]);
      gl.clearColor(bg[0], bg[1], bg[2], 1);
      gl.clearDepth(1);
      gl.depthMask(true);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LESS);
      gl.disable(gl.BLEND);
      gl.useProgram(splat.p);
      gl.uniformMatrix4fv(splat.u.u_view, false, view);
      gl.uniform2f(splat.u.u_size, W, H);
      gl.uniform1f(splat.u.u_focal, focal);
      gl.uniform1f(splat.u.u_near, NEAR);
      gl.uniform1f(splat.u.u_far, FAR);
      gl.uniform1f(splat.u.u_time, o.time || 0);
      gl.uniform3f(splat.u.u_fog, fog.start, fog.end || fog.start + 1, fog.max);
      gl.uniform3fv(splat.u.u_fogCol, rgb(world.pal[fog.c]));
      gl.bindVertexArray(vao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, world.count);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(post.p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, colTex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, depTex);
      gl.uniform1i(post.u.u_scene, 0);
      gl.uniform1i(post.u.u_depth, 1);
      gl.uniform3fv(post.u.u_pal, basePal);
      gl.uniform3fv(post.u.u_out, pal === world.pal ? basePal : flat(pal));
      gl.uniform1i(post.u.u_n, world.pal.length);
      gl.uniform1f(post.u.u_dither, o.dither === undefined ? 0.035 : o.dither);
      gl.uniform1f(post.u.u_flash, o.flash || 0);
      const fc = o.flashCols || [0x24336e, 0xf77fb0, 0xfffaf0];
      gl.uniform3fv(post.u.u_flashA, rgb(fc[0]));
      gl.uniform3fv(post.u.u_flashB, rgb(fc[1]));
      gl.uniform3fv(post.u.u_flashC, rgb(fc[2]));
      gl.uniform1f(post.u.u_near, NEAR);
      gl.uniform1f(post.u.u_far, FAR);
      const sk = o.shake || [0, 0];
      gl.uniform2i(post.u.u_shake, Math.round(sk[0]), Math.round(sk[1]));
      gl.bindVertexArray(pvao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
    }
  };
}
if (typeof module !== 'undefined') module.exports = { makeRenderer };
