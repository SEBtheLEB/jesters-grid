# Jester's Grid Skin PNG Hooks

This folder is the default reskin layer. Replace `none` values in `skin.css` with PNG URLs to reskin the app without touching game logic.

Example:

```css
:root {
  --skin-title-frame: url("/assets/skins/default/title-frame.png");
  --skin-board-frame: url("/assets/skins/default/board-frame.png");
  --skin-tile-empty: url("/assets/skins/default/tile-empty.png");
  --skin-card-frame: url("/assets/skins/default/card-frame.png");
  --skin-card-art-6: url("/assets/skins/default/card-witch.png");
  --skin-token-bard: url("/assets/skins/default/token-bard.png");
}
```

Recommended PNG types:
- `phone/menu`: full-screen texture, 860x1864 or larger.
- `title/frame/panel/button`: transparent PNG frames with stretch-safe centers.
- `board/tile`: square transparent PNGs.
- `card-frame`: transparent card frame; card art PNGs should be transparent or centered art.
- `token-*`: transparent circular medallions.
- `avatar-*`: square portraits.
