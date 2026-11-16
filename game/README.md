# Painted look tests

Real-time look tests drawn in the browser with WebGL2: the toolkit's splats painted as brush strokes.

```sh
node game/build.js
```

This writes one self-contained page for each look test to `game/dist/`:

- `street.html`: a street seen from behind a kid with a bat. Tap or press Space to hit back what flies in.
- `tennis.html`: a court chalked on the street, a rival across the net, seen from above and behind by an eye that follows the play. Drag (or arrow keys) to move, tap (or Space) to swing. How early or late you meet the thing, and which side of you it is on, decides where it goes. There is no score.

Page options: `?fps=1` shows the frame rate, `?hour=dusk` starts in the evening, `?auto=0` turns off self-play.

## Layout

- `engine/`: what any page can reuse. See [engine/README.md](engine/README.md).
- `town.js`: the painted street and its two palettes (day and dusk).
- `kid.js`: the character spec, with its colours and what it holds as options.
- `street/`, `tennis/`: each look test's world and its loop.
