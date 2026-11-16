#!/usr/bin/env node
// ink-studio: look at, measure and check a diorama without opening a browser.   ink-studio help
// Run inside a project that has an ink-studio.config.js ({ load: () => its built module, out, snaps }), or alone, where it shows the library's own demos.
const fs = require('fs'),
  path = require('path'),
  R = require('./render.js'),
  PNG = require('./png.js');
const CWD = process.cwd();
let cfg = {};
try {
  cfg = require(path.join(CWD, 'ink-studio.config.js'));
} catch (e) {
  if (e.code !== 'MODULE_NOT_FOUND' || !/ink-studio\.config/.test(e.message)) throw e;
}
const OUT = path.resolve(CWD, cfg.out || 'studio/out'),
  SNAPS = path.resolve(CWD, cfg.snaps || 'studio/snaps');
const argv = process.argv.slice(2),
  cmd = argv[0] || 'help',
  pos = [],
  opt = {};
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const k = a.slice(2),
      v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) opt[k] = true;
    else {
      opt[k] = v;
      i++;
    }
  } else pos.push(a);
}
const num = (k, d) => (opt[k] === undefined ? d : +opt[k]),
  list = (k, d) => (opt[k] === undefined ? d : String(opt[k]).split(',').map(Number));
let A = null;
const lib = () => A || (A = cfg.load ? cfg.load() : require('../index.js').load());
// a diorama by its id, or a file in lab/ that exports (kit) => ({ id, name, seed, build })
/* a mesh file is a diorama too: fitted to --size, coloured from its own materials, baked and looked at like the rest */
function meshScene(file) {
  const kit = lib(),
    K = kit.KIT,
    raw = require('../index.js').readMesh(path.resolve(file));
  return {
    id: path.basename(file).replace(/\W+/g, '-'),
    name: path.basename(file),
    seed: 1,
    build(seed) {
      const size = num('size', 6),
        mesh = K.mesh.fit(raw, { size, up: opt.up, turn: num('spin', 0) }),
        look = K.mesh.look(mesh, { hues: num('hues', 6), shades: num('shades', 4) }),
        B = kit.makeBuilder(seed, look.pal),
        S = K.sculpt(kit.makeSculpt(B));
      const sol = S.mesh(mesh, look, {
        res: num('res', size / 70),
        cells: num('cells', 64),
        thick: opt.thick === undefined ? undefined : +opt.thick
      });
      S.bake();
      const b = K.mesh.box(mesh);
      return B.finish({
        cam: { target: [0, (b.lo[1] + b.hi[1]) / 2, 0], dist: size * 2.6, pitch: 0.2, yaw: 0.5, sway: 0.3 },
        detail: 14,
        palName: 'Mesh',
        dither: 0.25,
        radius: size * 1.2,
        mesh: Object.assign(K.mesh.info(raw), { hues: look.ramps.length, sheet: sol.field.open, cell: sol.field.h })
      });
    }
  };
}
/* a diorama written as data (see lab/data-shrine.json). --style puts it in another style; meshes it names are looked for beside the file */
function dataScene(file) {
  const K = lib().KIT,
    spec = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')),
    dir = path.dirname(path.resolve(file)),
    assets = {};
  if (opt.style) spec.style = opt.style;
  for (const s of spec.solids || [])
    if (s && s.kind === 'mesh' && typeof s.asset === 'string' && !assets[s.asset]) {
      const f = ['', '.obj', '.glb', '.gltf']
        .map(e => path.join(dir, s.asset + e))
        .find(q => fs.existsSync(q) && fs.statSync(q).isFile());
      if (f) assets[s.asset] = require('../index.js').readMesh(f);
    }
  const problems = K.diorama.check(spec, { assets });
  if (problems.length) console.error(K.diorama.report(problems));
  if (problems.some(p => p.level === 'error'))
    die('not built: ' + problems.filter(p => p.level === 'error').length + ' mistake(s) in ' + file);
  return K.diorama.scene(spec, { assets });
}
function scene(id) {
  if (!id) die('which diorama? try: ink-studio scenes');
  if (/\.(obj|gltf|glb)$/i.test(id)) return meshScene(id);
  if (id.endsWith('.json')) return dataScene(id);
  if (id.endsWith('.js')) return require(path.resolve(id))(lib());
  const s = lib().SCENES.find(q => q.id === id);
  if (!s) die('no diorama called "' + id + '"');
  return s;
}
function build(id) {
  if (opt.focus) {
    const f = list('focus'); // uneven detail: x,y,z then near, far, coarse
    globalThis.INK_FOCUS = { p: [f[0] || 0, f[1] || 0, f[2] || 0], near: f[3], far: f[4], coarse: f[5] };
  }
  if (opt.follow)
    globalThis.INK_FOLLOW =
      opt.follow === true
        ? {}
        : { stretch: +String(opt.follow).split(',')[0], broad: +String(opt.follow).split(',')[1] || undefined };
  if (opt.bounce) globalThis.INK_BOUNCE = true; // bounce light: every dab is also lit by the lit things round it
  if (opt.fine) globalThis.INK_FINE = true; // inked detail: dabs are baked with a tile of the surface under them
  const s = scene(id),
    t0 = Date.now(),
    w = s.build(opt.seed === undefined ? s.seed : +opt.seed);
  w.buildMs = Date.now() - t0;
  w.id = s.id;
  w.name = s.name;
  w.clock = 0;
  if (w.anim && w.anim.stateful) w.anim.update(0, 0);
  for (const note of w.warnings || []) console.error('warning: ' + s.id + ': ' + note);
  return w;
}
/* --poke 2:0.2,1.4,0.9 taps the diorama at 2 seconds, along the line from the camera to that point (several: 2:x,y,z;5:x,y,z) */
const POKES = String(opt.poke || '')
  .split(';')
  .filter(Boolean)
  .map(q => {
    const m = q.split(':');
    return { t: +m[0], p: m[1].split(',').map(Number) };
  });
function tap(w, t0, t1) {
  for (const k of POKES) {
    if (!(k.t > t0 && k.t <= t1) || !w.anim.poke) continue;
    const c = w.cam,
      cp = Math.cos(c.pitch),
      eye = [
        c.target[0] + c.dist * cp * Math.sin(c.yaw),
        c.target[1] + c.dist * Math.sin(c.pitch),
        c.target[2] + c.dist * cp * Math.cos(c.yaw)
      ],
      d = k.p.map((v, i) => v - eye[i]),
      l = Math.hypot(d[0], d[1], d[2]);
    w.anim.poke(
      eye,
      d.map(v => v / l)
    );
  }
}
// put the world at time t. A diorama that says it remembers the past (anim.stateful) is walked there a sixtieth of a second at a time
function pose(w, t) {
  if (!w.anim) return;
  if (w.anim.stateful) {
    if (t < w.clock) die('this diorama cannot be run backwards: ask for times in order');
    while (w.clock < t - 1e-9) {
      const dt = Math.min(1 / 60, t - w.clock),
        before = w.clock;
      w.clock += dt;
      /* (the time before the step is kept, not worked back out: taking the step off again can land a hair to the other side of a tap) */
      tap(w, before, w.clock);
      w.anim.update(dt, w.clock);
    }
  } else w.anim.update(1 / 60, t);
  w.clock = t;
  /* splats carried by bones on the graphics card stay at rest in the data: the tools look at a copy with them put in place */
  if (w.anim.bones) {
    if (!w.rest) w.rest = w.data;
    w.data = lib().KIT.bones.posed({
      data: w.rest,
      anim: w.anim,
      get posedBuf() {
        return w.posedBuf;
      },
      set posedBuf(v) {
        w.posedBuf = v;
      }
    });
  }
}
const view = extra =>
  Object.assign(
    {
      yaw: opt.yaw === undefined ? undefined : +opt.yaw,
      pitch: opt.pitch === undefined ? undefined : +opt.pitch,
      zoom: num('zoom', 1),
      target: opt.target ? list('target') : undefined,
      w: num('w', 900),
      h: num('h', 620),
      raw: !!opt.raw,
      colored: !!opt.colored,
      fine: !!opt.fine,
      clean: !!opt.clean
    },
    extra
  );
const save = (name, img) => {
  fs.mkdirSync(OUT, { recursive: true });
  const f = opt.out ? path.resolve(opt.out) : path.join(OUT, name);
  PNG.write(f, img.w, img.h, img.rgb);
  console.log('wrote', f, img.w + 'x' + img.h);
  return f;
};
const times = () =>
  opt.t !== undefined
    ? list('t')
    : (n =>
        Array.from(
          { length: n },
          (_, i) => +(num('from', 0) + ((num('to', 6) - num('from', 0)) * i) / Math.max(1, n - 1)).toFixed(3)
        ))(num('n', 12));
function die(m) {
  console.error(m);
  process.exit(1);
}
const CMD = {
  help() {
    console.log(
      [
        'ink-studio <command> <diorama id | lab/file.js> [options]',
        '',
        '  scenes                      list every diorama',
        '  catalog [words]             what the toolkit can do, searchable',
        '  stats <id>                  splat counts, colours used, size, cost per frame, warnings',
        '  render <id> [--t 1.5]       one picture, drawn the way the page draws it',
        '  ramps <id> [--n 12]         the ramps it is shaded on, and which only get darker without turning; a turning one is offered from the same palette',
        '  values <id> [--t 1.5]       the value check: the picture sorted into dark, middle and light, and whether it reads in three tones',
        '  sheet <id> [--from 0 --to 6 --n 12 | --t 0,1,2]   the same view at several moments, on one sheet',
        '  turn <id> [--n 8] [--t 0]   the diorama from all round, on one sheet',
        '  clip <id> [--from 0 --to 6 --fps 12]   an animated PNG of it moving',
        '  ghost <id> [--t 2 --spacing 0.12 --n 2 | --ghosts 1.6,1.8]   one moment with those either side laid faintly over it',
        '  acts                        the ready clips, reactions, easings and cues, by name',
        '  motion <id> [--from 0 --to 12]   numbers about how it moves: speed, jumps, what goes underground',
        '  mesh <file.obj|.gltf|.glb>  bring a mesh in: what it is made of, and a sheet of it from all round as splats',
        '                              [--size 6 --cells 64 --res 0.09 --hues 6 --shades 4 --up z --spin 0.5 --thick 0.1]; a mesh file also works wherever an id does',
        '  validate <file.json>        check a diorama written as data: every mistake listed, with what was probably meant',
        '                              a .json diorama also works wherever an id does; --style slate|moss|ember puts it in another style',
        '  perf <id> [--secs 5 --fps 60]   what a frame costs: time to work out, bytes sent to the graphics card',
        '  selftest                    every lab module checked in numbers, and the lab dioramas run for a while',
        '  snap <id|all> [--t 0,2]     keep reference pictures',
        '  check [id ...]              draw again and compare with the reference pictures',
        '',
        'any command that plays a diorama takes --poke 2:x,y,z (tap it at 2 seconds, toward that point; several with ;)',
        'view options: --yaw --pitch --zoom 2 --target x,y,z --w 900 --h 620 --raw (no palette) --colored (smooth body-colored contours) --fine (inked detail: colours looked up per pixel) --bounce (bounce light baked in) --focus x,y,z[,near,far,coarse] (uneven detail) --follow [stretch,broad] (dabs along the form) --clean (lone pixels removed) --cols 4 --out file.png --seed n'
      ].join('\n')
    );
  },
  scenes() {
    for (const s of lib().SCENES) console.log(s.id.padEnd(12), s.name.padEnd(20), s.blurb);
  },
  catalog() {
    const cat = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'catalog.json'), 'utf8')),
      words = pos.map(s => s.toLowerCase());
    const hit = e =>
        words.every(w =>
          (e.id + ' ' + e.title + ' ' + e.what + ' ' + (e.tags || []).join(' ') + ' ' + e.kind)
            .toLowerCase()
            .includes(w)
        ),
      found = cat.entries.filter(hit);
    if (found.length === 1 || opt.full)
      for (const e of found)
        console.log(
          '\n' +
            e.id +
            '  [' +
            e.kind +
            ', ' +
            e.status +
            ']\n  ' +
            e.title +
            '\n  ' +
            e.what +
            (e.use ? '\n  use:  ' + e.use : '') +
            (e.example ? '\n  e.g.  ' + e.example : '') +
            (e.where ? '\n  in:   ' + e.where : '') +
            (e.from ? '\n  after: ' + e.from : '')
        );
    else
      for (const e of found)
        console.log((e.status === 'ready' ? '  ' : '~ ') + e.id.padEnd(18), ('[' + e.kind + ']').padEnd(10), e.title);
    if (!found.length) console.log('nothing matches');
    else if (found.length > 1 && !opt.full)
      console.log('\n~ = planned, not built yet.   ink-studio catalog <id> for the details');
  },
  stats() {
    const w = build(pos[0]),
      d = w.data,
      N = w.count,
      lo = [1e9, 1e9, 1e9],
      hi = [-1e9, -1e9, -1e9],
      byCol = new Map();
    let soft = 0,
      glow = 0,
      moving = 0,
      big = 0;
    for (let i = 0, q = 0; i < N; i++, q += 16) {
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], d[q + k]);
        hi[k] = Math.max(hi[k], d[q + k]);
      }
      byCol.set(d[q + 7], (byCol.get(d[q + 7]) || 0) + 1);
      if (d[q + 3] < 1) soft++;
      const kr = Math.round(d[q + 11]);
      if (kr & 32) glow++;
      if (kr % 16) moving++;
      if (Math.sqrt((d[q + 4] + d[q + 8] + d[q + 10]) / 3) > 0.4) big++;
    }
    console.log(w.id + '  "' + w.name + '"   built in ' + w.buildMs + ' ms');
    console.log(
      'splats      ' +
        N +
        '   (soft ' +
        soft +
        ', glowing ' +
        glow +
        ', shader-animated ' +
        moving +
        ', large ' +
        big +
        ')'
    );
    console.log(
      'extent      x ' +
        lo[0].toFixed(1) +
        '..' +
        hi[0].toFixed(1) +
        '   y ' +
        lo[1].toFixed(1) +
        '..' +
        hi[1].toFixed(1) +
        '   z ' +
        lo[2].toFixed(1) +
        '..' +
        hi[2].toFixed(1) +
        '   (radius ' +
        w.radius +
        ', camera ' +
        w.cam.dist +
        ' away)'
    );
    const warn = [];
    if (N > 150000) warn.push('more than 150,000 splats: heavy on a phone');
    if (w.pal.length > 48) warn.push('palette has ' + w.pal.length + ' colours; the page can only use 48');
    if (w.anim) {
      const a = w.anim,
        FR = 60;
      let rowsum = 0;
      if (a.rows) {
        for (let k = 0; k < 90; k++) a.update(1 / 30, k / 30);
        a.rows.fill(0);
      }
      const t0 = Date.now();
      for (let k = 0; k < FR; k++) {
        a.update(1 / 30, a.rows ? 3 + k / 30 : k * 0.37);
        if (a.rows) {
          for (let r = 0; r < a.rows.length; r++) rowsum += a.rows[r];
          a.rows.fill(0);
        }
      }
      const ms = (Date.now() - t0) / FR,
        rows = a.rows ? rowsum / FR : Math.ceil((a.start + a.count) / 512) - Math.floor(a.start / 512),
        mb = (rows * 8192 * 4) / 1e6;
      console.log(
        'animation   ' +
          a.count +
          ' splats in the moving span, ' +
          ms.toFixed(1) +
          ' ms of work and ' +
          mb.toFixed(1) +
          ' MB sent to the graphics card each frame' +
          (a.parts ? '   parts: ' + a.parts.length : '')
      );
      if (mb > 8) warn.push('sends ' + mb.toFixed(1) + ' MB per frame: likely to stutter on a phone');
      if (ms > 8) warn.push('animation takes ' + ms.toFixed(1) + ' ms a frame');
      pose(w, 0);
    }
    const im = R.render(w, view({})),
      hexs = w.pal.map(h => '#' + h.toString(16).padStart(6, '0')),
      tot = im.w * im.h;
    console.log('picture     ' + im.w + ' x ' + im.h + ' art pixels, each ' + im.px + ' screen pixels');
    console.log('colours on screen (share of the picture):');
    im.use.forEach((u, i) =>
      console.log(
        '  ' +
          String(i).padStart(2) +
          ' ' +
          hexs[i] +
          ' ' +
          ((100 * u) / tot).toFixed(1).padStart(5) +
          '%  ' +
          '#'.repeat(Math.round((40 * u) / tot)) +
          (u === 0 ? '  (never shows from here)' : '')
      )
    );
    const unused = [];
    im.use.forEach((u, i) => {
      if (!u) unused.push(i);
    });
    if (unused.length > w.pal.length / 3)
      warn.push(unused.length + ' of ' + w.pal.length + ' colours never show from the default view');
    console.log(warn.length ? 'warnings:\n  ' + warn.join('\n  ') : 'no warnings');
  },
  render() {
    const w = build(pos[0]),
      t = num('t', 0);
    pose(w, t);
    const t0 = Date.now(),
      im = R.render(w, view({ t }));
    console.log('drawn in', Date.now() - t0, 'ms');
    save(w.id + '.png', R.upscale(im, opt.px1 ? 1 : im.px));
  },
  /* the ramps a diorama is shaded on, most used first, and what kind each is: one hue darker and lighter, or turning as it darkens.
     For a one-hue ramp a turning one made from the same palette is offered (the diorama is not changed). */
  ramps() {
    globalThis.INK_RAMPS = new Map();
    const w = build(pos[0]),
      K = lib().KIT,
      hx = i => '#' + w.pal[i].toString(16).padStart(6, '0'),
      all = [...globalThis.INK_RAMPS.entries()].sort((a, b) => b[1] - a[1]),
      total = all.reduce((s, e) => s + e[1], 0);
    let dull = 0;
    console.log(w.id + ': ' + all.length + ' ramps, ' + total.toLocaleString() + ' dabs shaded on them');
    for (const [ramp, cnt] of all.slice(0, num('n', 12))) {
      const c = K.ramp.check(w.pal, ramp);
      console.log(
        (((100 * cnt) / total).toFixed(1) + '%').padStart(6) +
          '  [' +
          ramp.join(', ') +
          ']  ' +
          ramp.map(hx).join(' ') +
          '   ' +
          c.says
      );
      if (c.says.startsWith('one hue')) {
        dull += cnt;
        const mid = w.pal[ramp[ramp.length >> 1]],
          uniq = [...new Set(ramp)],
          m = K.ramp.make(w.pal, {
            base: mid,
            n: uniq.length,
            dark: K.ramp.hsl(w.pal[ramp[0]])[2],
            light: K.ramp.hsl(w.pal[ramp[ramp.length - 1]])[2]
          });
        if (m.ramp.length === uniq.length && m.ramp.join() !== uniq.join() && Math.abs(m.travel) >= 12)
          console.log(
            '          try [' +
              m.ramp.join(', ') +
              ']  ' +
              m.ramp.map(hx).join(' ') +
              '   ' +
              m.says +
              ' (furthest reach ' +
              Math.max(...m.miss).toFixed(2) +
              ')'
          );
      }
    }
    console.log(
      Math.round((100 * dull) / Math.max(1, total)) + '% of the dabs in the ramps listed are on one-hue ramps'
    );
  },
  /* the value check: does the picture read in three tones? The picture is drawn small, the background taken out, and what is left
     sorted into dark, middle and light by how bright it is. A picture that is nearly all one of them is flat however good its colours. */
  values() {
    const w = build(pos[0]),
      t = num('t', 0);
    pose(w, t);
    const im = R.render(w, view({ t })),
      bgc = [(w.pal[0] >> 16) & 255, (w.pal[0] >> 8) & 255, w.pal[0] & 255],
      n = im.w * im.h,
      lum = new Float32Array(n),
      on = new Uint8Array(n);
    let lo = 255,
      hi = 0,
      cnt = 0;
    for (let i = 0; i < n; i++) {
      const r = im.rgb[i * 3],
        g = im.rgb[i * 3 + 1],
        b = im.rgb[i * 3 + 2];
      if (r === bgc[0] && g === bgc[1] && b === bgc[2]) continue;
      on[i] = 1;
      cnt++;
      lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum[i] < lo) lo = lum[i];
      if (lum[i] > hi) hi = lum[i];
    }
    const a = lo + (hi - lo) / 3,
      b = lo + ((hi - lo) * 2) / 3,
      share = [0, 0, 0],
      out = { w: im.w, h: im.h, px: im.px, rgb: new Uint8Array(n * 3) },
      tone = [40, 128, 230];
    for (let i = 0; i < n; i++) {
      if (!on[i]) continue;
      const k = lum[i] < a ? 0 : lum[i] < b ? 1 : 2;
      share[k]++;
      out.rgb[i * 3] = out.rgb[i * 3 + 1] = out.rgb[i * 3 + 2] = tone[k];
    }
    const pc = share.map(v => Math.round((100 * v) / Math.max(1, cnt))),
      least = Math.min(...pc),
      most = Math.max(...pc),
      says =
        hi - lo < 90
          ? 'FLAT: the darkest and lightest things are close together (' +
            Math.round(lo) +
            ' to ' +
            Math.round(hi) +
            ' of 255)'
          : most > 72
            ? 'ONE TONE: ' + most + '% of it is ' + ['dark', 'middle', 'light'][pc.indexOf(most)]
            : least < 8
              ? 'TWO TONES: almost no ' + ['dark', 'middle', 'light'][pc.indexOf(least)] + ' (' + least + '%)'
              : 'reads in three tones';
    console.log(
      w.id +
        '  dark ' +
        pc[0] +
        '%  middle ' +
        pc[1] +
        '%  light ' +
        pc[2] +
        '%   brightness ' +
        Math.round(lo) +
        ' to ' +
        Math.round(hi) +
        '   ' +
        says
    );
    if (!opt.quiet) save(w.id + '-values.png', R.grid([R.upscale(im, im.px), R.upscale(out, im.px)], 2));
  },
  sheet() {
    const w = build(pos[0]),
      ts = times(),
      imgs = [];
    for (const t of ts) {
      pose(w, t);
      const im = R.render(w, view({ t, w: num('w', 600), h: num('h', 420) }));
      imgs.push(R.upscale(im, im.px));
    }
    save(
      w.id + '-sheet.png',
      R.grid(
        imgs,
        num('cols', Math.min(4, ts.length)),
        ts.map(t => t + 's')
      )
    );
    console.log('times', ts.join(' '));
  },
  /* one picture with the moments either side laid faintly over it: what moved, and how far, at a glance */
  ghost() {
    const w = build(pos[0]),
      t = num('t', 1),
      sp = num('spacing', 0.12),
      n = num('n', 2),
      ts = opt.ghosts
        ? list('ghosts')
            .concat([t])
            .sort((a, b) => a - b)
        : Array.from({ length: 2 * n + 1 }, (_, i) => +(t + (i - n) * sp).toFixed(4)).filter(x => x >= 0),
      imgs = [];
    for (const q of ts) {
      pose(w, q);
      const im = R.render(w, view({ t: q, w: num('w', 600), h: num('h', 420) }));
      imgs.push({ t: q, im: R.upscale(im, im.px) });
    }
    const main = imgs.find(q => q.t === t) || imgs[imgs.length - 1],
      others = imgs.filter(q => q !== main),
      out = main.im.rgb.slice(),
      a = num('fade', 0.5) / Math.max(1, others.length);
    for (let i = 0; i < out.length; i++) {
      let v = main.im.rgb[i] * (1 - a * others.length);
      for (const g of others) v += g.im.rgb[i] * a;
      out[i] = Math.round(v);
    }
    save(w.id + '-ghost.png', { w: main.im.w, h: main.im.h, rgb: out });
    console.log('at', main.t + 's, with ghosts at', others.map(q => q.t + 's').join(' '));
  },
  /* the ready clips and reactions, by name */
  acts() {
    const K = lib().KIT;
    console.log(
      'squash and stretch clips (K.acts.clip):',
      K.acts.KINDS.map(k => k + ' ' + K.acts.DUR[k] + 's').join(', ')
    );
    console.log('reaction fields (K.deform.emote):', K.deform.EMOTES.join(', '));
    console.log('reactions (K.acts.emotes):');
    for (const r of K.acts.REACTIONS)
      console.log('  ' + r.id.padEnd(18) + r.motion.padEnd(11) + r.expression.padEnd(12) + r.label);
    console.log('easings (K.anim.ease):', K.anim.EASES.join(', '));
    console.log('presentation cues (K.anim.cue):', Object.keys(K.anim.CUES).join(', '));
    console.log('presets (K.anim.preset): heavy-impact, contact-impact, lightning, discovery, slow');
    console.log('actions (K.acts.clock):', Object.keys(K.acts.ACTION.duration).join(', '));
  },
  perf() {
    const w = build(pos[0]),
      a = w.anim,
      secs = num('secs', 5),
      fps = num('fps', 60);
    console.log(w.id + ': ' + w.count.toLocaleString() + ' splats, built in ' + w.buildMs + ' ms');
    if (!a) {
      console.log('it does not move: nothing is computed or sent after the first frame');
      return;
    }
    let bytes = 0,
      frames = 0,
      worst = 0,
      total = 0;
    for (let t = 0; t < secs; t += 1 / fps) {
      const s = process.hrtime.bigint();
      a.update(1 / fps, t);
      const ms = Number(process.hrtime.bigint() - s) / 1e6;
      worst = Math.max(worst, ms);
      total += ms;
      frames++;
      if (a.rows) {
        for (let r = 0; r < a.rows.length; r++)
          if (a.rows[r]) {
            bytes += 32768;
            a.rows[r] = 0;
          }
      } else if (a.count) bytes += (Math.ceil((a.start + a.count) / 512) - Math.floor(a.start / 512)) * 32768;
      if (a.bones) bytes += Math.ceil(((a.bones.length / 12) * 3) / 768) * 768 * 16;
    }
    const per = bytes / frames;
    console.log(
      'each frame, on this machine: ' +
        (total / frames).toFixed(2) +
        ' ms to work out (worst ' +
        worst.toFixed(1) +
        '), ' +
        (per > 1e6 ? (per / 1e6).toFixed(1) + ' MB' : Math.round(per / 1e3) + ' KB') +
        ' sent to the graphics card' +
        (a.boned ? ' (' + a.boned.length.toLocaleString() + ' splats ride on ' + a.bones.length / 12 + ' bones)' : '')
    );
    console.log(
      "(the page shows the same for a real device, with sort, draw and the card's own time: Esc menu, or __splat.perf)"
    );
  },
  validate() {
    if (!pos[0]) die('validate which file?');
    const s = dataScene(pos[0]);
    console.log(pos[0] + ': sound (' + s.id + ', "' + s.name + '")');
  },
  mesh() {
    const w = build(pos[0]),
      m = w.mesh;
    console.log(
      m.tris +
        ' faces, ' +
        m.verts +
        ' points; ' +
        (m.sheet
          ? 'open (' + (m.open * 100).toFixed(0) + '% of its edges are loose): treated as a sheet with thickness'
          : 'closed: treated as a solid') +
        '; materials: ' +
        m.mats.join(', ')
    );
    console.log(
      w.count +
        ' splats in ' +
        m.hues +
        ' colours of ' +
        (w.pal.length - 1) / m.hues +
        ' shades, field cell ' +
        m.cell.toFixed(3) +
        ', built in ' +
        w.buildMs +
        ' ms'
    );
    opt.n = opt.n || 4;
    CMD.turn(w);
  },
  turn(w0) {
    const w = w0 || build(pos[0]),
      n = num('n', 8),
      t = num('t', 0),
      imgs = [],
      labs = [];
    pose(w, t);
    for (let k = 0; k < n; k++) {
      const yaw = w.cam.yaw + (k / n) * Math.PI * 2,
        im = R.render(w, view({ t, yaw, w: num('w', 600), h: num('h', 420) }));
      imgs.push(R.upscale(im, im.px));
      labs.push('y' + yaw.toFixed(1));
    }
    save(w.id + '-turn.png', R.grid(imgs, num('cols', 4), labs));
  },
  clip() {
    const zlib = require('zlib'),
      w = build(pos[0]),
      fps = num('fps', 12),
      from = num('from', 0),
      to = num('to', 6),
      n = Math.max(2, Math.round((to - from) * fps)),
      frames = [];
    for (let k = 0; k < n; k++) {
      const t = from + k / fps;
      pose(w, t);
      const im = R.render(w, view({ t, w: num('w', 600), h: num('h', 420) }));
      frames.push(R.upscale(im, im.px));
    }
    const f = opt.out ? path.resolve(opt.out) : path.join(OUT, w.id + '-clip.png');
    fs.mkdirSync(OUT, { recursive: true });
    PNG.animate(f, frames, fps);
    console.log('wrote', f, frames.length, 'frames at', fps, 'a second (an animated PNG: a browser will play it)');
  },
  motion() {
    const w = build(pos[0]);
    if (!w.anim) die(w.id + ' has no animation of its own');
    const a = w.anim,
      d = w.data,
      n0 = a.start,
      n1 = a.start + a.count,
      M = n1 - n0,
      from = num('from', 0),
      to = num('to', 12),
      dt = 1 / 30,
      prev = new Float32Array(M * 3),
      rest = new Float32Array(M * 3),
      peak = new Float32Array(M);
    pose(w, from);
    for (let i = 0; i < M; i++) for (let k = 0; k < 3; k++) rest[i * 3 + k] = prev[i * 3 + k] = d[(n0 + i) * 16 + k];
    let worst = 0,
      worstT = 0,
      worstI = 0,
      low = 1e9,
      lowT = 0,
      bad = 0;
    const jumps = [],
      JUMP = num('jump', 0.6);
    for (let t = from + dt; t <= to + 1e-9; t += dt) {
      pose(w, t);
      let stepMax = 0,
        cnt = 0,
        jx = 0,
        jy = 0,
        jz = 0;
      for (let i = 0; i < M; i++) {
        const q = (n0 + i) * 16,
          x = d[q],
          y = d[q + 1],
          z = d[q + 2];
        if (!(x === x && y === y && z === z)) {
          bad++;
          continue;
        }
        const m = Math.hypot(x - prev[i * 3], y - prev[i * 3 + 1], z - prev[i * 3 + 2]);
        if (m > peak[i]) peak[i] = m;
        if (m > stepMax) stepMax = m;
        if (m > JUMP) {
          cnt++;
          jx += rest[i * 3];
          jy += rest[i * 3 + 1];
          jz += rest[i * 3 + 2];
        }
        if (m > worst) {
          worst = m;
          worstT = t;
          worstI = i;
        }
        if (y < low) {
          low = y;
          lowT = t;
        }
        prev[i * 3] = x;
        prev[i * 3 + 1] = y;
        prev[i * 3 + 2] = z;
      }
      if (cnt)
        jumps.push(
          t.toFixed(2) +
            's  ' +
            String(cnt).padStart(6) +
            ' splats, up to ' +
            (stepMax / dt).toFixed(0) +
            ' units a second, around (' +
            (jx / cnt).toFixed(1) +
            ', ' +
            (jy / cnt).toFixed(1) +
            ', ' +
            (jz / cnt).toFixed(1) +
            ') at rest'
        );
    }
    const sorted = Float32Array.from(peak).sort(),
      pc = f => (sorted[Math.min(M - 1, Math.floor(f * M))] / dt).toFixed(1);
    let still = 0;
    for (let i = 0; i < M; i++) if (peak[i] < 1e-4) still++;
    console.log(w.id + ': ' + M + ' splats watched from ' + from + 's to ' + to + 's, thirty times a second');
    console.log(
      'fastest any splat moves   ' +
        (worst / dt).toFixed(1) +
        ' units a second, at ' +
        worstT.toFixed(2) +
        's, a splat that rests at (' +
        [0, 1, 2].map(k => rest[worstI * 3 + k].toFixed(1)).join(', ') +
        ')'
    );
    console.log(
      'peak speed by share       half are under ' +
        pc(0.5) +
        ', 90% under ' +
        pc(0.9) +
        ', 99% under ' +
        pc(0.99) +
        ' units a second'
    );
    console.log(
      'never move at all         ' +
        still +
        ' (' +
        ((100 * still) / M).toFixed(0) +
        '% of the span: these are sent to the graphics card for nothing)'
    );
    console.log('lowest point reached      y = ' + low.toFixed(2) + ' at ' + lowT.toFixed(2) + 's');
    console.log(
      jumps.length
        ? 'FAST: more than ' +
            (JUMP / dt).toFixed(0) +
            ' units a second (a strike, or something teleporting):\n  ' +
            jumps.slice(0, 12).join('\n  ') +
            (jumps.length > 12 ? '\n  and ' + (jumps.length - 12) + ' more' : '')
        : 'nothing moves faster than ' + (JUMP / dt).toFixed(0) + ' units a second'
    );
    if (bad) console.log('NOT A NUMBER: ' + bad + ' positions');
    if (a.parts) {
      const pk = new Float32Array(a.parts.length);
      for (let i = 0; i < M; i++) {
        const b = a.partOf ? a.partOf(n0 + i) : 0;
        if (peak[i] > pk[b]) pk[b] = peak[i];
      }
      console.log(
        'fastest part: ' +
          Array.from(pk)
            .map((v, i) => [v, a.parts[i]])
            .sort((p, q) => q[0] - p[0])
            .slice(0, 8)
            .map(e => e[1] + ' ' + (e[0] / dt).toFixed(1))
            .join(',  ')
      );
    }
    if (a.period) {
      pose(w, from);
      const p0 = Float32Array.from({ length: M * 3 }, (_, k) => d[(n0 + ((k / 3) | 0)) * 16 + (k % 3)]);
      if (!a.stateful) {
        pose(w, from + a.period);
        let mx = 0;
        for (let i = 0; i < M; i++)
          mx = Math.max(
            mx,
            Math.hypot(
              d[(n0 + i) * 16] - p0[i * 3],
              d[(n0 + i) * 16 + 1] - p0[i * 3 + 1],
              d[(n0 + i) * 16 + 2] - p0[i * 3 + 2]
            )
          );
        console.log('loop: after one period of ' + a.period + 's the pose is off by at most ' + mx.toFixed(3));
      }
    }
  },
  selftest() {
    process.exit(require('./selftest.js')(lib()) ? 1 : 0);
  },
  snap() {
    fs.mkdirSync(SNAPS, { recursive: true });
    const ids = pos[0] === 'all' ? lib().SCENES.map(s => s.id) : pos;
    if (!ids.length) die('snap which diorama? (or: all)');
    for (const id of ids) {
      const w = build(id),
        ts = opt.t !== undefined ? list('t') : w.anim ? [0, 1.7] : [0];
      for (const t of ts) {
        pose(w, t);
        const im = R.render(w, { t });
        PNG.write(path.join(SNAPS, w.id + '@' + t + '.png'), im.w, im.h, im.rgb);
      }
      console.log('kept', w.id, 'at', ts.join(', '));
    }
  },
  check() {
    const files = fs.existsSync(SNAPS)
      ? fs
          .readdirSync(SNAPS)
          .filter(f => f.endsWith('.png') && (!pos.length || pos.includes(f.split('@')[0])))
          .sort()
      : [];
    if (!files.length) die('no reference pictures: make some with  ink-studio snap <id>');
    let fails = 0,
      cur = null,
      w = null;
    for (const f of files) {
      const [id, tt] = f.replace('.png', '').split('@'),
        t = +tt;
      if (id !== cur) {
        w = build(id);
        cur = id;
      }
      pose(w, t);
      const im = R.render(w, { t }),
        ref = PNG.read(path.join(SNAPS, f));
      let diff = 0;
      if (ref.w !== im.w || ref.h !== im.h) diff = im.w * im.h;
      else
        for (let i = 0; i < im.w * im.h; i++)
          if (
            ref.rgb[i * 3] !== im.rgb[i * 3] ||
            ref.rgb[i * 3 + 1] !== im.rgb[i * 3 + 1] ||
            ref.rgb[i * 3 + 2] !== im.rgb[i * 3 + 2]
          )
            diff++;
      const pct = (100 * diff) / (im.w * im.h),
        ok = pct <= num('allow', 0.2);
      if (!ok) {
        fails++;
        fs.mkdirSync(OUT, { recursive: true });
        const both = R.grid([R.upscale(ref.w === im.w && ref.h === im.h ? ref : im, 3), R.upscale(im, 3)], 2, [
          '0',
          '1'
        ]);
        PNG.write(path.join(OUT, 'check-' + id + '@' + t + '.png'), both.w, both.h, both.rgb);
      }
      console.log(
        (ok ? 'same     ' : 'CHANGED  ') +
          f.padEnd(26) +
          pct.toFixed(2) +
          '% of pixels differ' +
          (ok ? '' : '   (before | after in studio/out/check-' + id + '@' + t + '.png)')
      );
    }
    console.log(fails ? fails + ' changed' : 'all ' + files.length + ' the same');
    process.exit(fails ? 1 : 0);
  }
};
(CMD[cmd] || (() => die('unknown command "' + cmd + '". try: ink-studio help')))();
