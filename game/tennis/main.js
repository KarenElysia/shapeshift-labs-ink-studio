/* The tennis look test: a court chalked on the street, a rival across the net, things to hit back and forth, seen from above and
   behind by an eye that follows the play. No score: a rally is counted and, when it ends, another thing is served.
   Expects the toolkit bundle (makeBuilder, KIT), the engine, the town, the kid and makeCourt in scope, and a page with #view, #ink,
   #score, #hour, #hint. */
(function () {
  const $ = id => document.getElementById(id),
    view = $('view'),
    inkEl = $('ink'),
    ctx = inkEl.getContext('2d'),
    q = new URLSearchParams(location.search);
  const court = makeCourt({ makeBuilder, KIT }),
    { world, me, rival, things, fx, CX, CZ, NET } = court,
    CAM = {
      tall: { eye: [-16.5, 8.2, 0], target: [-0.6, 0.6, 0], fov: 50 },
      wide: { eye: [-13.5, 6.6, 0], target: [0, 0.6, 0], fov: 40 }
    },
    R = makeRenderer(view, world, { props: court.props, dyn: court.dyn, eye: CAM.tall.eye, target: CAM.tall.target }),
    INK = makeInk(ctx),
    rnd = (a, b) => a + (b - a) * Math.random(),
    clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  let W = 0,
    H = 0,
    tall = true;
  function fit() {
    const cw = window.innerWidth,
      chh = window.innerHeight,
      dpr = window.devicePixelRatio || 1;
    tall = chh >= cw;
    const px = Math.max(1, Math.round((chh * dpr) / (tall ? 420 : 300)));
    W = Math.ceil((cw * dpr) / px);
    H = Math.ceil((chh * dpr) / px);
    R.resize(W, H);
    inkEl.width = W;
    inkEl.height = H;
    for (const c of [view, inkEl]) {
      c.style.width = (W * px) / dpr + 'px';
      c.style.height = (H * px) / dpr + 'px';
    }
  }
  window.addEventListener('resize', fit);
  fit();

  // ------------------------------------------------------------ state
  const GRAV = 17,
    FLASH = { day: [0xff7a66, 0xd9604f], dusk: [0x4a3486, 0x3a2670] },
    BIG = ['POW!', 'BAM!', 'KAPOW!', 'WHAM!', 'BOOM!'],
    SMALL = ['pok', 'tok', 'pon', 'pak'];
  const G = {
    t: 0,
    rally: 0,
    best: 0,
    hour: q.get('hour') === 'dusk' ? 'dusk' : 'day',
    stop: 0,
    flash: 0,
    shake: 0,
    punch: 0,
    lines: 0,
    focus: [0, 0],
    words: [],
    auto: q.get('auto') !== '0',
    lastInput: -99,
    stick: [0, 0], // forward, right
    keys: {},
    tap: false,
    kind: 0,
    serveIn: 0.8,
    shots: [], // (for looking at what the swing does: where each of the player's shots was sent)
    done: [], // (and how long each rally that has ended was)
    ball: { on: false, th: things[0], p: [0, 1, 0], v: [0, 0, 0], spin: 0, ax: [0, 0, 1], bounces: 0, side: 0, by: null, dead: 0, big: 1 },
    cam: { z: 0, tz: 0, tx: 0 }
  };
  window.__game = G;
  const say = (str, p, o) => {
    const s = R.project(p);
    INK.say(G.words, str, [s[0], s[1]], o);
  };

  // ------------------------------------------------------------ input: drag to move, tap to swing
  const touch = new Map();
  const used = () => {
    G.auto = false;
    G.lastInput = G.t;
    $('hint').style.opacity = 0;
  };
  window.addEventListener(
    'pointerdown',
    e => {
      if (e.target && e.target.closest && e.target.closest('button')) return;
      e.preventDefault();
      used();
      // a second finger while one is dragging is a swing at once
      if (touch.size > 0) G.tap = true;
      touch.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), moved: false, lead: touch.size === 0 });
    },
    { passive: false }
  );
  window.addEventListener('pointermove', e => {
    const p = touch.get(e.pointerId);
    if (!p || !p.lead) return;
    const dx = e.clientX - p.x,
      dy = e.clientY - p.y,
      reach = Math.max(36, Math.min(window.innerWidth, window.innerHeight) * 0.11);
    if (Math.hypot(dx, dy) > 9) p.moved = true;
    if (p.moved) {
      const l = Math.hypot(dx, dy),
        k = Math.min(1, l / reach) / (l || 1);
      G.stick = [-dy * k, dx * k];
      // the place the drag is measured from follows the finger, so that turning back is quick
      if (l > reach * 1.6) {
        p.x += (dx / l) * (l - reach * 1.6);
        p.y += (dy / l) * (l - reach * 1.6);
      }
    }
    G.lastInput = G.t;
  });
  const lift = e => {
    const p = touch.get(e.pointerId);
    if (!p) return;
    touch.delete(e.pointerId);
    if (p.lead) {
      G.stick = [0, 0];
      if (!p.moved && performance.now() - p.t < 320) G.tap = true;
    }
  };
  window.addEventListener('pointerup', lift);
  window.addEventListener('pointercancel', lift);
  const KEYS = { ArrowUp: 'f', KeyW: 'f', ArrowDown: 'b', KeyS: 'b', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
  window.addEventListener('keydown', e => {
    if (KEYS[e.code]) {
      G.keys[KEYS[e.code]] = true;
      used();
      e.preventDefault();
    } else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyZ') {
      if (!e.repeat) G.tap = true;
      used();
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', e => {
    if (KEYS[e.code]) G.keys[KEYS[e.code]] = false;
  });
  const setHour = () => ($('hour').textContent = G.hour === 'day' ? '夕方にする' : '昼にする');
  $('hour').addEventListener('click', () => {
    G.hour = G.hour === 'day' ? 'dusk' : 'day';
    setHour();
  });
  setHour();

  // ------------------------------------------------------------ the thing in the air
  /* send it from where it is to land at (tx, tz) after `time` seconds; if that would not clear the net, lob it higher */
  function send(b, tx, tz, time) {
    const g = GRAV * b.th.spec.heavy,
      r = b.th.r;
    for (let k = 0; k < 8; k++) {
      const vx = (tx - b.p[0]) / time,
        vy = (r - b.p[1]) / time + 0.5 * g * time,
        tn = -b.p[0] / vx,
        yn = b.p[1] + vy * tn - 0.5 * g * tn * tn;
      b.v = [vx, vy, (tz - b.p[2]) / time];
      if (!(tn > 0 && tn < time) || yn > NET + r + 0.3) break;
      time *= 1.13;
    }
    b.bounces = 0;
    b.side = Math.sign(tx);
  }
  function serve() {
    const b = G.ball;
    b.th.write(b.p, turn(b.ax, 0), false);
    b.th = things[G.kind % things.length];
    G.kind++;
    b.on = true;
    b.dead = 0;
    b.big = 1;
    b.by = 'rival';
    b.p = [rival.st.x - 0.6, 1.5, rival.st.z];
    b.ax = [0, 0, 1];
    send(b, rnd(-5.6, -3.4), rnd(-1.6, 1.6), 1.25);
    if (G.kind > 1) G.done.push(G.rally);
    if (G.done.length > 60) G.done.shift();
    G.rally = 0;
    $('score').textContent = 0;
    say(b.th.spec.name + '!', [b.p[0], 2.6, b.p[2]], { size: 0.9, life: 0.8, max: 0.8 });
  }
  function end(why) {
    const b = G.ball;
    if (b.dead > 0) return;
    b.dead = 0.9;
    if (why) say(why, [b.p[0], b.p[1] + 0.8, b.p[2]], { size: 0.8, life: 0.8, max: 0.8 });
  }
  function stepBall(dt) {
    const b = G.ball;
    if (!b.on) return;
    const r = b.th.r,
      spec = b.th.spec,
      x0 = b.p[0];
    b.v[1] -= GRAV * spec.heavy * dt;
    b.p[0] += b.v[0] * dt;
    b.p[1] += b.v[1] * dt;
    b.p[2] += b.v[2] * dt;
    b.spin += dt * (4 + Math.hypot(b.v[0], b.v[2]) * 1.6);
    // the net
    if (x0 * b.p[0] <= 0 && x0 !== b.p[0] && b.p[1] < NET + r * 0.6 && Math.abs(b.p[2]) < CZ + 0.5) {
      b.p[0] = x0;
      b.v[0] *= -0.2;
      b.v[2] *= 0.4;
      fx.sparks(0, b.p[1], b.p[2], 6, 6, 3);
      end('net');
    }
    // the ground
    if (b.p[1] < r) {
      b.p[1] = r;
      if (b.v[1] < -1.2) {
        b.v[1] = -b.v[1] * spec.bounce;
        b.v[0] *= 0.8;
        b.v[2] *= 0.8;
        b.bounces++;
        fx.ring(b.p[0], 0.08, b.p[2], 6, 0.12, 0.7, 0.3, 14, 0.035);
        const out = Math.abs(b.p[0]) > CX + 0.3 || Math.abs(b.p[2]) > CZ + 0.3;
        if (b.bounces === 1 && out) end('out');
        else if (b.bounces >= 2) end(b.dead > 0 ? '' : Math.sign(b.p[0]) < 0 ? 'miss…' : 'nice!');
      } else {
        b.v[1] = 0;
        b.v[0] *= 1 - 2.5 * dt;
        b.v[2] *= 1 - 2.5 * dt;
        if (Math.hypot(b.v[0], b.v[2]) < 0.6) end('');
      }
    }
    // the houses on each side throw it back; past either end it is gone
    if (Math.abs(b.p[2]) > 4.9) {
      b.p[2] = Math.sign(b.p[2]) * 4.9;
      b.v[2] *= -0.5;
    }
    if (Math.abs(b.p[0]) > 15) end('');
    if (b.dead > 0) {
      b.dead -= dt;
      if (b.dead <= 0) {
        b.on = false;
        fx.sparks(b.p[0], b.p[1], b.p[2], 27, 10, 5);
        G.serveIn = 0.7;
      }
    }
    b.big += (1 - b.big) * Math.min(1, dt * 5);
    b.th.write(b.p, turn(b.ax, b.spin), b.on, b.big);
  }
  /* where the thing will be when someone on side s (-1 the player's, 1 the rival's) can best meet it: after its first bounce there,
     as it comes up to hip height; or wherever it is lowest if it never gets there */
  function meet(s) {
    const b = G.ball,
      g = GRAV * b.th.spec.heavy,
      r = b.th.r,
      p = b.p.slice(),
      v = b.v.slice();
    let n = b.bounces,
      best = null;
    for (let t = 0; t < 2.6; t += 1 / 30) {
      v[1] -= g / 30;
      p[0] += v[0] / 30;
      p[1] += v[1] / 30;
      p[2] += v[2] / 30;
      if (p[1] < r) {
        p[1] = r;
        v[1] = -v[1] * b.th.spec.bounce;
        v[0] *= 0.8;
        v[2] *= 0.8;
        n++;
        if (n >= 2) break;
      }
      if (Math.sign(p[0]) !== s) continue;
      if (n >= 1 && p[1] > 0.75 && p[1] < 1.5) return { p: p.slice(), t };
      if (!best || p[1] < best.p[1]) best = { p: p.slice(), t };
    }
    return best;
  }

  // ------------------------------------------------------------ the two of them
  const SWING = 0.34;
  const who = [
    { ch: me, s: -1, name: 'me', inp: { move: 0, mz: 0, run: true, face: 0, attack: false }, swing: -1, home: [-5.2, 0], cool: 0, trig: 1 },
    { ch: rival, s: 1, name: 'rival', inp: { move: 0, mz: 0, run: true, face: Math.PI, attack: false }, swing: -1, home: [5.2, 0], cool: 0, trig: 1.1 }
  ];
  /* where the racket meets things: a little in front of whoever holds it, on their racket side */
  const sweet = w => [w.ch.st.x - w.s * 0.55, w.ch.st.z - w.s * 0.3];
  /* someone playing by themselves: go to where the thing can be met, swing when it is there */
  function think(w, dt) {
    const b = G.ball,
      st = w.ch.st;
    let gx = w.home[0],
      gz = w.home[1],
      want = false;
    if (b.on && b.dead <= 0 && b.by !== w.name) {
      const m = meet(w.s);
      if (m) {
        gx = clamp(m.p[0] + w.s * 0.55, w.s < 0 ? -CX - 0.6 : 1.1, w.s < 0 ? -1.1 : CX + 0.6);
        gz = m.p[2] + w.s * 0.3;
        const sw = sweet(w);
        want = Math.hypot(b.p[0] - sw[0], b.p[2] - sw[1]) < w.trig && b.p[1] < 1.9 && m.t < 0.16;
      }
    }
    const dx = gx - st.x,
      dz = gz - st.z,
      l = Math.hypot(dx, dz);
    w.inp.move = l > 0.12 ? (dx / l) * Math.min(1, l * 2) : 0;
    w.inp.mz = l > 0.12 ? (dz / l) * Math.min(1, l * 2) : 0;
    return want;
  }
  function strike(w) {
    const b = G.ball,
      st = w.ch.st,
      sw = sweet(w);
    if (!b.on || b.dead > 0 || b.by === w.name || b.p[1] > 2.3) return;
    if (Math.hypot(b.p[0] - sw[0], b.p[2] - sw[1]) > 1.35) return;
    w.ch.st.connected = true;
    b.by = w.name;
    G.rally++;
    G.best = Math.max(G.best, G.rally);
    $('score').textContent = G.rally;
    let big = false;
    if (w.name === 'me') {
      /* where it goes is in how it was met. Ahead of you is early: it is pulled across to the left. Beside or behind you is late: it
         slides off to the right. Out wide on either side it comes back across the court. Met just right, it goes deep and fast */
      const ahead = b.p[0] - st.x, // 0.85 is just right
        wide = b.p[2] - st.z - 0.3,
        early = clamp((ahead - 0.85) / 0.6, -1, 1),
        good = clamp(1 - Math.abs(early) * 0.9 - Math.abs(wide) * 0.45, 0, 1),
        tz = clamp(-early * 1.9 - wide * 1.5 + st.z * 0.25, -CZ + 0.4, CZ - 0.4),
        front = clamp((st.x + 5.5) / 3.5, 0, 1), // up at the net it goes down steeper and sooner
        tx = 2.6 + 3.9 * good - 0.8 * front,
        time = (1.2 - 0.48 * good) * (1 - 0.22 * front);
      send(b, tx, tz, time);
      big = good > 0.8;
      G.shots.push({ early: +early.toFixed(2), wide: +wide.toFixed(2), good: +good.toFixed(2), tz: +tz.toFixed(2), tx: +tx.toFixed(2), time: +time.toFixed(2) });
      if (G.shots.length > 40) G.shots.shift();
    } else send(b, rnd(-6.3, -3.2), rnd(-2.1, 2.1), rnd(1.05, 1.3));
    b.ax = [0, 0, -w.s];
    fx.sparks(b.p[0], b.p[1], b.p[2], 27, big ? 16 : 7, big ? 9 : 5, -w.s, 0);
    w.ch.react('spring', { dur: 0.5, k: big ? 0.7 : 0.35 });
    if (big) {
      b.big = 1.5;
      G.stop = 0.09;
      G.flash = 1;
      G.shake = 1;
      G.punch = 1;
      G.lines = 0.45;
      const s = R.project(b.p);
      G.focus = [s[0], s[1]];
      fx.flash(b.p[0], b.p[1], b.p[2], 6, 0.36, 0.1);
      fx.ring(b.p[0], 0.08, b.p[2], 6, 0.3, 2, 0.35, 20, 0.05);
      say(BIG[Math.floor(Math.random() * BIG.length)], [b.p[0], b.p[1] + 1.1, b.p[2]], { size: 1.3, life: 0.85, max: 0.85 });
    } else {
      b.big = 1.2;
      G.shake = Math.max(G.shake, 0.35);
      say(SMALL[Math.floor(Math.random() * SMALL.length)], [b.p[0], b.p[1] + 0.7, b.p[2]], { size: 0.75, life: 0.5, max: 0.5 });
    }
  }
  function stepWho(w, dt) {
    const ch = w.ch,
      st = ch.st,
      mine = w.name === 'me' && !G.auto;
    let attack = false;
    if (mine) {
      const k = G.keys,
        f = (k.f ? 1 : 0) - (k.b ? 1 : 0) + G.stick[0],
        r = (k.r ? 1 : 0) - (k.l ? 1 : 0) + G.stick[1];
      // (it goes up and down the court more slowly than across it)
      w.inp.move = clamp(f, -1, 1) * 0.62;
      w.inp.mz = clamp(r, -1, 1);
      attack = G.tap;
    } else {
      attack = think(w, dt) && w.cool <= 0;
      if (w.name === 'me') w.inp.move *= 0.75;
    }
    if (w.name === 'me') G.tap = false;
    w.cool -= dt;
    if (attack) {
      w.cool = 0.5;
      w.trig = rnd(0.55, 1.25); // (sometimes early, sometimes late: the next one goes somewhere else)
    }
    w.inp.attack = attack;
    const was = st.atk;
    // the swing: the whole of them turns once round with the racket out, rising and stretching as it goes
    if (w.swing >= 0) {
      w.swing += dt;
      const u = Math.min(1, w.swing / SWING),
        e = 1 - (1 - u) * (1 - u) * (1 - u),
        b = Math.sin(Math.PI * u);
      st.act = { spin: -Math.PI * 2 * e, stretch: 1 + 0.14 * b, lean: 0.22 * b, flare: 0.25 * b };
      if (u >= 1) {
        w.swing = -1;
        st.act = null;
      }
    }
    ch.update(dt, w.inp, G.t);
    if (was < 0 && st.atk >= 0) w.swing = 0;
    // each keeps to their own half
    const x0 = w.s < 0 ? -CX - 1.2 : 1.0,
      x1 = w.s < 0 ? -1.0 : CX + 1.2;
    if (st.x < x0 || st.x > x1) {
      st.x = clamp(st.x, x0, x1);
      st.vx = 0;
    }
    if (Math.abs(st.z) > CZ + 0.7) {
      st.z = clamp(st.z, -CZ - 0.7, CZ + 0.7);
      st.vz = 0;
    }
    if (ch.striking()) strike(w);
  }

  // ------------------------------------------------------------ the frame
  let last = 0,
    fpsT = 0,
    fpsN = 0,
    frame = 0,
    lineSeed = 1;
  function step(dt) {
    if (G.stop > 0) {
      G.stop -= dt;
      G.flash = G.stop > 0.03 ? 1 : 0;
      return;
    }
    G.flash = 0;
    G.t += dt;
    if (!G.auto && G.t - G.lastInput > 8 && touch.size === 0) G.auto = true;
    if (!G.ball.on) {
      G.serveIn -= dt;
      if (G.serveIn <= 0) serve();
    }
    for (const w of who) stepWho(w, dt);
    stepBall(dt);
    fx.update(dt);
    G.shake = Math.max(0, G.shake - dt * 3.2);
    G.punch = Math.max(0, G.punch - dt * 2.2);
    G.lines = Math.max(0, G.lines - dt);
    for (const wd of G.words) wd.life -= dt;
    G.words = G.words.filter(wd => wd.life > 0);
    // the eye: it leans after the player, and a little after the thing in the air
    const b = G.ball,
      c = G.cam,
      k = Math.min(1, dt * 3.5),
      bz = b.on ? b.p[2] : 0,
      bx = b.on ? b.p[0] : 0;
    c.z += (me.st.z * 0.62 + bz * 0.12 - c.z) * k;
    c.tz += (me.st.z * 0.3 + bz * 0.3 - c.tz) * k;
    c.tx += (bx * 0.1 + (me.st.x + 5.2) * 0.35 - c.tx) * k;
  }
  function draw() {
    const base = tall ? CAM.tall : CAM.wide,
      c = G.cam,
      k = G.punch * G.punch * (3 - 2 * G.punch),
      eye = [base.eye[0] + c.tx * 0.6, base.eye[1], base.eye[2] + c.z],
      tgt = [base.target[0] + c.tx, base.target[1], base.target[2] + c.tz],
      b = G.ball;
    // at a great hit it goes in a little toward where it happened
    if (k > 0 && b.on) {
      for (let i = 0; i < 3; i++) {
        eye[i] += (b.p[i] - eye[i]) * 0.14 * k;
        tgt[i] += (b.p[i] - tgt[i]) * 0.3 * k;
      }
    }
    const sk = G.shake * G.shake * 4;
    if (frame % 2 === 0) lineSeed = 1 + Math.floor(Math.random() * 1e6);
    R.draw({
      eye,
      target: tgt,
      fov: base.fov - 5 * k,
      time: G.t,
      pal: court.themes[G.hour],
      flash: G.flash,
      flashCols: FLASH[G.hour],
      shake: [Math.sin(frame * 2.7) * sk, Math.cos(frame * 3.9) * sk],
      deep: [5, 37]
    });
    ctx.clearRect(0, 0, W, H);
    if (G.lines > 0) INK.lines(W, H, G.focus, Math.min(1, G.lines / 0.3), lineSeed);
    INK.words(W, H, G.words);
  }
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    frame++;
    step(dt);
    R.upload(court.dyn, world.count - court.dyn);
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
    R.upload(court.dyn, world.count - court.dyn);
    R.sort();
    draw();
  };
  G.who = who;
  G.ready = true;
  if (q.get('still')) G.run(0.02);
  else requestAnimationFrame(tick);
})();
