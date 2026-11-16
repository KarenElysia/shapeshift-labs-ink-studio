#!/usr/bin/env node
// Puts the look test together as one page: the toolkit bundle, then the game's own scripts, inside game/dist/index.html.
//   node game/build.js
const fs = require('fs'),
  path = require('path'),
  studio = require('../index.js');
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8').replace(/\nif \(typeof module[^\n]*\n?$/, '\n'),
  code = [studio.bundle(), src('scene.js'), src('renderer.js'), src('main.js')].join('\n').replace(/<\/script/gi, '<\\/script');
const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>Street Slugger</title>
<style>
  :root { --ink: #27305e; --paper: #fffaf0; --sun: #ffd23c; }
  html, body { margin: 0; height: 100%; overflow: hidden; background: #6fc3e8; touch-action: none; user-select: none; -webkit-user-select: none; }
  body { font-family: "Arial Black", "Hiragino Kaku Gothic ProN", "Noto Sans JP", system-ui, sans-serif; color: var(--paper); }
  canvas { position: fixed; left: 0; top: 0; image-rendering: pixelated; image-rendering: crisp-edges; }
  #ink { pointer-events: none; }
  .hud { position: fixed; z-index: 2; text-shadow: 2px 2px 0 var(--ink), -2px 2px 0 var(--ink), 2px -2px 0 var(--ink), -2px -2px 0 var(--ink); }
  #tally { left: max(16px, env(safe-area-inset-left)); top: max(12px, env(safe-area-inset-top)); font-size: 15px; letter-spacing: 0.08em; }
  #score { font-size: 44px; line-height: 1; color: var(--sun); display: block; font-style: italic; }
  #hour { position: fixed; z-index: 2; right: max(16px, env(safe-area-inset-right)); top: max(14px, env(safe-area-inset-top));
    font: inherit; font-size: 13px; color: var(--ink); background: var(--paper); border: 3px solid var(--ink); border-radius: 0;
    padding: 8px 12px; box-shadow: 4px 4px 0 var(--ink); cursor: pointer; }
  #hour:active { transform: translate(2px, 2px); box-shadow: 2px 2px 0 var(--ink); }
  #hint { left: 0; right: 0; bottom: max(28px, env(safe-area-inset-bottom)); text-align: center; font-size: 15px; transition: opacity 0.4s; }
  #fps { left: 16px; bottom: 8px; font-size: 11px; font-family: ui-monospace, monospace; }
  #wait { position: fixed; inset: 0; display: grid; place-items: center; background: #6fc3e8; z-index: 3; font-size: 18px; }
</style>
</head>
<body>
<canvas id="view"></canvas>
<canvas id="ink"></canvas>
<div id="tally" class="hud">HIT<span id="score">0</span></div>
<button id="hour" type="button"></button>
<div id="hint" class="hud">画面をタップ / スペースキーで打ち返す</div>
<div id="fps" class="hud"></div>
<div id="wait" class="hud">まちを描いています…</div>
<script>
window.addEventListener('load', () => setTimeout(() => {
  try {
${code}
    document.getElementById('wait').remove();
  } catch (e) {
    document.getElementById('wait').textContent = 'この端末では表示できませんでした: ' + e.message;
    throw e;
  }
}, 30));
</script>
</body>
</html>
`;
const out = path.join(__dirname, 'dist');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('wrote game/dist/index.html', (html.length / 1024).toFixed(0) + ' KB');
