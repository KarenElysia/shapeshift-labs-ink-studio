/* The look test: the street from behind the kid, things flying in from the far end, a tap to swing.
   Expects the toolkit bundle (makeBuilder, KIT), makeStreet and makeRenderer in scope, and a page with #view, #ink, #score, #hour, #hint. */
(function () {
  const $ = id => document.getElementById(id),
    view = $('view'),
    ink = $('ink'),
    ctx = ink.getContext('2d'),
    q = new URLSearchParams(location.search);
  const street = makeStreet({ makeBuilder, KIT }),
    { world, ch, balls, fx } = street,
    BASE = { eye: [-3.4, 0.6, 0.7], target: [3, 1.7, 0.45] },
    R = makeRenderer(view, world, { props: street.props, dyn: street.dyn, eye: BASE.eye, target: BASE.target }),
    rnd = (a, b) => a + (b - a) * Math.random();
  let W = 0,
    H = 0,
    tall = true;
  function fit() {
    const cw = window.innerWidth,
      chh = window.innerHeight,
      dpr = window.devicePixelRatio || 1;
    tall = chh >= cw;
    const px = Math.max(1, Math.round((chh * dpr) / (tall ? 400 : 290)));
    W = Math.ceil((cw * dpr) / px);
    H = Math.ceil((chh * dpr) / px);
    R.resize(W, H);
    ink.width = W;
    ink.height = H;
    for (const c of [view, ink]) {
      c.style.width = (W * px) / dpr + 'px';
      c.style.height = (H * px) / dpr + 'px';
    }
  }
  window.addEventListener('resize', fit);
  fit();

  // ------------------------------------------------------------ state
  const HITX = 1.0, // where the bat meets what comes
    HITZ = 0.55,
    SWING = 0.36,
    FLASH = {
      day: [0xff7a66, 0xd9604f],
      dusk: [0x4a3486, 0x3a2670]
    },
    WORDS = ['POW!', 'BAM!', 'KAPOW!', 'WHAM!', 'BOOM!'];
  const G = {
    t: 0,
    score: 0,
    hour: q.get('hour') === 'dusk' ? 'dusk' : 'day',
    stop: 0, // the world held still at the moment of a hit
    flash: 0,
    shake: 0,
    punch: 0,
    lines: 0,
    focus: [0, 0],
    words: [],
    next: 1.2,
    tap: false,
    swing: -1,
    lastTap: -99,
    auto: q.get('auto') !== '0',
    things: balls.map(b => ({ b, mode: 'off', p: [0, 0, 0], v: [0, 0, 0], u: 0, spin: 0, ax: [0, 0, 1], age: 0 }))
  };
  window.__game = G;
  const say = (str, p, o) => {
    const s = R.project(p);
    G.words.push(Object.assign({ str, x: Math.max(W * 0.34, Math.min(W * 0.66, s[0])), y: Math.max(H * 0.12, s[1]), life: 0.7, max: 0.7, rot: rnd(-0.3, 0.3), size: 1 }, o));
  };
  const swing = () => {
    G.tap = true;
    G.lastTap = G.t;
  };
  const press = e => {
    if (e.target && e.target.closest && e.target.closest('button')) return;
    e.preventDefault();
    G.auto = false;
    $('hint').style.opacity = 0;
    swing();
  };
  window.addEventListener('pointerdown', press, { passive: false });
  window.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyZ') press(e);
  });
  $('hour').addEventListener('click', () => {
    G.hour = G.hour === 'day' ? 'dusk' : 'day';
    $('hour').textContent = G.hour === 'day' ? '夕方にする' : '昼にする';
  });
  $('hour').textContent = G.hour === 'day' ? '夕方にする' : '昼にする';

  // ------------------------------------------------------------ things in the air
  const rot = (ax, a) => {
    const c = Math.cos(a),
      s = Math.sin(a),
      k = 1 - c,
      [x, y, z] = ax;
    return [c + x * x * k, x * y * k - z * s, x * z * k + y * s, y * x * k + z * s, c + y * y * k, y * z * k - x * s, z * x * k - y * s, z * y * k + x * s, c + z * z * k];
  };
  function launch() {
    const th = G.things.find(k => k.mode === 'off');
    if (!th) return;
    th.mode = 'in';
    th.u = 0;
    th.dur = rnd(1.15, 1.6);
    th.from = [36, rnd(1.5, 4), HITZ + rnd(-2, 2)];
    th.to = [HITX, rnd(0.9, 1.2), HITZ + rnd(-0.1, 0.1)];
    th.arc = rnd(1.2, 3.4);
    th.ax = [0, 0, 1];
    th.spin = 0;
    th.big = 1;
    th.swung = false;
  }
  function stepThings(dt) {
    for (const th of G.things) {
      if (th.mode === 'off') {
        th.b.write(th.p, rot(th.ax, 0), false);
        continue;
      }
      if (th.mode === 'in') {
        th.u += dt / th.dur;
        const u = th.u;
        th.p = [
          th.from[0] + (th.to[0] - th.from[0]) * u,
          th.from[1] + (th.to[1] - th.from[1]) * u + th.arc * 4 * u * (1 - u),
          th.from[2] + (th.to[2] - th.from[2]) * u
        ];
        if (th.p[1] < 0.22) th.p[1] = 0.22 + (0.22 - th.p[1]) * 0.5;
        th.spin -= dt * 11;
        // the player who is not playing: swing when it is nearly here
        if (G.auto && !th.swung && (1 - u) * th.dur < 0.1) {
          th.swung = true;
          swing();
        }
        if (ch.striking() && th.p[0] > HITX - 1.1 && th.p[0] < HITX + 2.2) hit(th);
        else if (u > 1.2) {
          th.mode = 'off';
          say('miss…', [0.6, 1.9, 0], { size: 0.7, life: 0.6, max: 0.6 });
        }
      } else if (th.mode === 'out') {
        th.age += dt;
        th.v[1] -= 6 * dt;
        th.p[0] += th.v[0] * dt;
        th.p[1] += th.v[1] * dt;
        th.p[2] += th.v[2] * dt;
        th.spin += dt * 26;
        if (th.age < 0.5 && Math.random() < 0.8) fx.mote(th.p[0], th.p[1], th.p[2], rnd(-1, 1), rnd(-1, 1), rnd(-1, 1), 27, 0.3);
        if (th.age > 1.15 || th.p[0] > 74) {
          fx.flash(th.p[0], th.p[1], th.p[2], 6, 3.2, 0.3);
          fx.sparks(th.p[0], th.p[1], th.p[2], 27, 14, 16);
          th.mode = 'off';
        }
      }
      th.b.write(th.p, rot(th.ax, th.spin), th.mode !== 'off', th.big);
    }
  }
  function hit(th) {
    ch.st.connected = true;
    th.mode = 'out';
    th.age = 0;
    const side = rnd(-0.22, 0.22);
    th.v = [34, rnd(7, 12), side * 34];
    th.ax = [0, 0, -1];
    th.big = 1.25;
    G.score++;
    $('score').textContent = G.score;
    G.stop = 0.1;
    G.flash = 1;
    G.shake = 1;
    G.punch = 1;
    G.lines = 0.5;
    const s = R.project(th.p);
    G.focus = [s[0], s[1]];
    say(WORDS[Math.floor(Math.random() * WORDS.length)], [th.p[0], th.p[1] + 0.9, th.p[2]], { size: 1.2, life: 0.85, max: 0.85 });
    fx.flash(th.p[0], th.p[1], th.p[2], 6, 0.36, 0.1);
    fx.sparks(th.p[0], th.p[1], th.p[2], 27, 16, 9, 1, 0);
    fx.sparks(th.p[0], th.p[1], th.p[2], 6, 10, 6);
    fx.ring(th.p[0], 0.08, th.p[2], 6, 0.3, 2.2, 0.35, 22, 0.05);
    ch.react('spring', { dur: 0.55, k: 0.7 });
    if (G.score % 6 === 0) $('hour').click();
  }

  // ------------------------------------------------------------ what is drawn over the picture: speed lines and words
  let lineSeed = 1;
  function drawInk() {
    ctx.clearRect(0, 0, W, H);
    if (G.lines > 0) {
      const k = Math.min(1, G.lines / 0.3),
        [cx, cy] = G.focus,
        far = Math.hypot(W, H);
      let s = lineSeed;
      const rn = () => ((s = (s * 16807) % 2147483647) & 0xffff) / 0xffff;
      for (let i = 0; i < 26; i++) {
        const a0 = (i / 26) * Math.PI * 2 + rn() * 0.2,
          r0 = H * (0.2 + 0.25 * rn() + 0.25 * (1 - k)),
          wide = 0.012 + 0.03 * rn(),
          hairs = 3 + Math.floor(rn() * 4);
        ctx.fillStyle = i % 3 === 2 ? '#2a4478' : '#fffaf0';
        ctx.globalAlpha = 0.6 + 0.4 * k;
        // each line is a few hairs of a dry brush, starting and stopping where they like
        for (let j = 0; j < hairs; j++) {
          const a = a0 + (j / hairs - 0.5) * wide * 2,
            w = (wide / hairs) * (0.5 + rn()),
            r1 = r0 * (1 + 0.5 * rn());
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
          ctx.lineTo(cx + Math.cos(a - w) * far, cy + Math.sin(a - w) * far);
          ctx.lineTo(cx + Math.cos(a + w) * far, cy + Math.sin(a + w) * far);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
    for (const wd of G.words) {
      const u = 1 - wd.life / wd.max,
        pop = u < 0.12 ? 0.6 + (u / 0.12) * 0.6 : 1.2 - Math.min(1, (u - 0.12) * 4) * 0.2,
        px = Math.round(H * 0.052 * wd.size * pop);
      ctx.save();
      ctx.translate(Math.round(wd.x), Math.round(wd.y - u * H * 0.03));
      ctx.rotate(wd.rot);
      ctx.font = '900 italic ' + px + 'px "Arial Black", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = u > 0.8 ? (1 - u) / 0.2 : 1;
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, px * 0.28);
      ctx.strokeStyle = '#fffaf0';
      ctx.strokeText(wd.str, 0, 0);
      ctx.fillStyle = wd.col || '#2a4478';
      ctx.fillText(wd.str, 0, 0);
      ctx.restore();
    }
  }

  // ------------------------------------------------------------ the frame
  const inp = { move: 0, face: 0, attack: false };
  let last = 0,
    fpsT = 0,
    fpsN = 0,
    frame = 0;
  function step(dt) {
    // the world stands still for a moment when the bat lands
    if (G.stop > 0) {
      G.stop -= dt;
      G.flash = G.stop > 0.03 ? 1 : 0;
      return;
    }
    G.flash = 0;
    G.t += dt;
    G.next -= dt;
    if (G.next <= 0) {
      launch();
      G.next = rnd(1.5, 2.3);
    }
    if (!G.auto && G.t - G.lastTap > 9) G.auto = true;
    inp.attack = G.tap;
    G.tap = false;
    const was = ch.st.atk;
    // the swing: the whole of it turns once round with the bat out, rising and stretching as it goes
    if (G.swing >= 0) {
      G.swing += dt;
      const u = Math.min(1, G.swing / SWING),
        e = 1 - (1 - u) * (1 - u) * (1 - u),
        b = Math.sin(Math.PI * u);
      ch.st.act = { spin: -Math.PI * 2 * e, stretch: 1 + 0.14 * b, lean: 0.22 * b, flare: 0.25 * b };
      if (u >= 1) {
        G.swing = -1;
        ch.st.act = null;
      }
    }
    ch.update(dt, inp, G.t);
    if (was < 0 && ch.st.atk >= 0) G.swing = 0;
    // it stays where it stands: what the swing carried it forward by is taken back
    ch.st.x += (0 - ch.st.x) * Math.min(1, dt * 6);
    ch.st.z += (0 - ch.st.z) * Math.min(1, dt * 6);
    stepThings(dt);
    fx.update(dt);
    G.shake = Math.max(0, G.shake - dt * 3.2);
    G.punch = Math.max(0, G.punch - dt * 2.4);
    G.lines = Math.max(0, G.lines - dt);
    for (const wd of G.words) wd.life -= dt;
    G.words = G.words.filter(wd => wd.life > 0);
  }
  function draw() {
    const k = G.punch * G.punch * (3 - 2 * G.punch),
      t = G.t,
      eye = tall ? [-3.4, 0.58, 0.62] : [-3.7, 0.72, 0.95],
      tgt = tall ? [3, 1.75, 0.4] : [3, 1.45, 0.55];
    eye[0] += 0.35 * k;
    eye[1] += 0.03 * Math.sin(t * 0.9) - 0.1 * k;
    eye[2] += 0.05 * Math.sin(t * 0.6) - 0.12 * k;
    tgt[1] += 0.3 * k;
    const sk = G.shake * G.shake * 5;
    if (frame % 2 === 0) lineSeed = 1 + Math.floor(Math.random() * 1e6);
    R.draw({
      eye,
      target: tgt,
      fov: (tall ? 64 : 46) - 5 * k,
      time: t,
      pal: street.themes[G.hour],
      flash: G.flash,
      flashCols: FLASH[G.hour],
      shake: [Math.sin(frame * 2.7) * sk, Math.cos(frame * 3.9) * sk]
    });
    drawInk();
  }
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    frame++;
    step(dt);
    R.upload(street.dyn, world.count - street.dyn);
    R.sort();
    draw();
    fpsN++;
    if (now - fpsT > 1000) {
      G.fps = Math.round((fpsN * 1000) / (now - fpsT));
      if (q.get('fps')) $('fps').textContent = G.fps + ' fps  ' + W + 'x' + H + '  ' + world.count + ' splats';
      fpsT = now;
      fpsN = 0;
    }
    requestAnimationFrame(tick);
  }
  /* for looking at it without a clock: G.run(seconds) steps the world on at sixty frames a second and draws once */
  G.run = secs => {
    for (let i = 0; i < Math.round(secs * 60); i++) {
      frame++;
      step(1 / 60);
    }
    R.upload(street.dyn, world.count - street.dyn);
    R.sort();
    draw();
  };
  if (q.get('still')) {
    G.run(0.02);
    G.ready = true;
  } else {
    G.ready = true;
    requestAnimationFrame(tick);
  }
})();
