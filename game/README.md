# Painted look tests

Real-time look tests drawn in the browser with WebGL2: the toolkit's splats painted as brush strokes.

```sh
node game/build.js
```

This writes one self-contained page for each look test to `game/dist/`:

- `street.html`: a street seen from behind a kid with a bat. Tap or press Space to hit back what flies in.
- `tennis.html`: a court chalked on the street, a rival across the net, seen from above and behind by an eye that follows the play. Drag (or arrow keys) to move, tap (or Space) to swing. How early or late you meet the thing, and which side of you it is on, decides where it goes. There is no score. Four eyes are chosen with the buttons under the hour button, or keys 1 to 4 (C goes on to the next): from high behind, just behind the player's back, side on, and from in front. People walk the pavements (two with dogs), three onlookers cheer a great shot, cars cross at the side street and bicycles turn into it.

Page options: `?fps=1` shows the frame rate, `?hour=dusk` starts in the evening, `?auto=0` turns off self-play, `?cam=2` starts with the second eye (tennis).

## Layout

- `engine/`: what any page can reuse. See [engine/README.md](engine/README.md).
- `town.js`: the painted street and its two palettes (day and dusk), with an optional side street. Each house is a group the renderer puts in order for the eye, so the street can be seen from any side.
- `life.js`: people, dogs, cars and bicycles going about the town.
- `kid.js`: the character spec, with its colours and what it holds as options.
- `street/`, `tennis/`: each look test's world and its loop.
