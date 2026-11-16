# Street look test

A real-time look test for a casual hit-it-back game: a painted street seen from behind a kid with a bat, drawn in the browser with WebGL2.

```sh
node game/build.js
```

This writes `game/dist/index.html`, one self-contained page (the toolkit bundle plus the scripts in `game/src/`). Open it in a browser; tap or press Space to swing.

- `src/scene.js`: the street as brush dabs, the things that fly in, and the kid (`K.character`).
- `src/renderer.js`: instanced splats painted as blended brush strokes (bristles, dry ends, dotted shadows), sorted far to near, then an outline round what moves.
- `src/main.js`: the loop, input, camera, hit stop, flash, speed lines and words.

Page options: `?fps=1` shows the frame rate, `?hour=dusk` starts in the evening, `?auto=0` turns off the self-playing swing.
