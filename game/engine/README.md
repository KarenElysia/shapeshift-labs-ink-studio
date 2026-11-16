# Brush engine

Draws an ink-studio world in real time as brush strokes. Four plain scripts, loaded after the toolkit bundle:

| File | What it gives |
| --- | --- |
| `paint.js` | `makePaint(B)`: `stroke`, `paint` (a flat patch), `blob` (a ball of dabs), and `SHADE` for shadows drawn as dots. |
| `things.js` | `makeThing(B, T, spec)`: a small group of dabs written again each frame wherever it is, with its shadow. `THINGS` has a ball, a melon and a duck. `turn(axis, angle)`. |
| `renderer.js` | `makeRenderer(canvas, world, { props, dyn, eye, target })`: blended strokes with bristles and dry ends, an ink line round what moves, and a flat-colour frame for the moment of a hit. |
| `ink.js` | `makeInk(ctx)`: speed lines and words on a second canvas. |

## The order things are made in

Strokes are blended, so they go down far to near. The renderer keeps to this with three ranges of the world's splats:

1. Before `props`: scenery, drawn in the order it was made. Make sky first, then ground, then what stands on it from far to near.
2. From `props` to `dyn`: things that stand still among what moves (trees, a net). Sorted by distance once.
3. From `dyn` on: what changes each frame. Sorted every frame, outlined, and sent to the card again by `upload`.

## Smallest use

```js
const B = makeBuilder(1, TOWN_PAL),
  T = makePaint(B);
T.paint([-4, 0, -4], [1, 0, 0], [0, 0, 1], T.UP, 8, 8, [2, 3, 4]); // ground
const props = B.count(),
  dyn = B.count(),
  ball = makeThing(B, T, THINGS.ball),
  world = B.finish({ fog: { c: 7, start: 30, end: 100, max: 0.5 } });
ball.bind(world);
const R = makeRenderer(canvas, world, { props, dyn, eye: [-6, 3, 0], target: [0, 0.5, 0] });
R.resize(200, 300);
function frame(t) {
  ball.write([0, 1 + Math.abs(Math.sin(t / 300)), 0], turn([0, 0, 1], t / 200), true);
  R.upload(dyn, world.count - dyn);
  R.sort();
  R.draw({ eye: [-6, 3, 0], target: [0, 0.5, 0], fov: 50, time: t / 1000 });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

`R.draw` also takes `pal` (another palette of the same length: the same picture at another hour), `flash` and `flashCols` (the moment of a hit), `shake`, and `deep` (how near and far what moves may be, for the lines inside it).

A world's `fog` needs `end` as well as `start` here: both are distances from the eye.
