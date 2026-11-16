/* What is drawn over the picture on a second canvas of the same size: speed lines in dry brush, and words.
     const ink = makeInk(ctx)
     ink.lines(W, H, focus, amount, seed)     lines running in on focus [x, y]; amount 0..1 how far in they reach; seed changes them
     ink.say(words, str, at, o)               add a word at [x, y] (art pixels): o.size, o.life, o.col
     ink.words(W, H, words, dt)               draw them, and age them by dt; returns the ones still alive */
function makeInk(ctx) {
  return {
    lines(W, H, focus, k, seed) {
      const [cx, cy] = focus,
        far = Math.hypot(W, H);
      let s = seed;
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
    },
    say(words, str, at, o) {
      words.push(Object.assign({ str, x: at[0], y: at[1], life: 0.7, max: (o && o.life) || 0.7, rot: (Math.random() - 0.5) * 0.6, size: 1 }, o));
    },
    words(W, H, words) {
      for (const wd of words) {
        const u = 1 - wd.life / wd.max,
          pop = u < 0.12 ? 0.6 + (u / 0.12) * 0.6 : 1.2 - Math.min(1, (u - 0.12) * 4) * 0.2,
          px = Math.round(H * 0.052 * wd.size * pop);
        ctx.save();
        ctx.translate(Math.round(Math.max(W * 0.2, Math.min(W * 0.8, wd.x))), Math.round(Math.max(H * 0.1, wd.y) - u * H * 0.03));
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
  };
}
if (typeof module !== 'undefined') module.exports = { makeInk };
