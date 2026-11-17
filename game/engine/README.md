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

1. Before `walls` (or `props`): sky and ground, drawn in the order they were made.
2. From `walls` to `props`, if `groups` is given: whole buildings, each drawn as it was made, the buildings put in order far to near for the way the eye looks now. Without `groups` this range is drawn as made, which only suits an eye that keeps looking one way.
3. From `props` to `dyn`: things that stand still among what moves (trees, a net). Sorted dab by dab.
4. From `dyn` on: what changes each frame. Sorted every frame, outlined, and sent to the card again by `upload`. From `hero` on it also stays in the picture at the moment of a hit; between `dyn` and `hero` (people in the street) it goes with the town.

Call `R.sort(eye, target)` with the eye of the frame after `upload`. `R.draw` takes `near` to leave out what stands between a close eye and what it looks at (it never hides sky, ground or buildings).

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
const EYE = [-6, 3, 0], AT = [0, 0.5, 0];
R.resize(200, 300);
function frame(t) {
  ball.write([0, 1 + Math.abs(Math.sin(t / 300)), 0], turn([0, 0, 1], t / 200), true);
  R.upload(dyn, world.count - dyn);
  R.sort(EYE, AT);
  R.draw({ eye: EYE, target: AT, fov: 50, time: t / 1000 });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

`R.draw` also takes `pal` (another palette of the same length: the same picture at another hour), `flash` and `flashCols` (the moment of a hit), `shake`, and `deep` (how near and far what moves may be, for the lines inside it).

A world's `fog` needs `end` as well as `start` here: both are distances from the eye.
