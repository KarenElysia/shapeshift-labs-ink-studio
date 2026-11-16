module.exports = ({ makeBuilder, makeSculpt, KIT: K }) => ({
  id: 'puppet-example',
  name: 'Celebrating puppet',
  seed: 3,
  build(seed) {
    const B = makeBuilder(seed);
    const S = K.sculpt(makeSculpt(B));
    S.ground({ r: [1, 1, 2] }, { rad: 4, res: 0.2 });
    S.bake();

    const tags = K.deform.tags(S);
    S.ball([0, 1, 0], [0.55, 1, 0.55], { r: [1, 2, 3, 4] }, { tag: 'body', res: 0.12 });
    S.ball([0, 2.25, 0], 0.4, { r: [5, 6, 7] }, { tag: 'head', res: 0.1 });
    S.bake();

    const W = B.finish({
      cam: { target: [0, 1.5, 0], dist: 12, pitch: 0.15, yaw: 0.4 },
      detail: 14,
      dither: 0.25
    });
    const clip = K.acts.clip('victory', { part: 'body', unit: 0.01 });
    K.puppet(W, {
      react: true,
      parts: {
        body: { ids: tags.body, pivot: [0, 0, 0], slices: 6 },
        head: { ids: tags.head, pivot: [0, 2, 0], parent: 'body' }
      },
      pose(t, dt, puppet) {
        clip.sample(t % 2, puppet.pose);
        puppet.look('head', [3, 2, 2], { limit: 45 });
      }
    });
    return W;
  }
});
