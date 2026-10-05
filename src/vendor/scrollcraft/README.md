# Scroll Craft engine (vendored, unmodified)

`scrollcraft.js` here and `src/vendor/scrollcraft/scrollcraft.css` are byte-for-byte
copies of the engine shipped with the `nateherk-design:scroll-craft` skill, v0.3.1.

**Do not edit either file.** Site-specific behavior lives in `src/motion/` and reads
the progress the engine publishes (`--sc-p` on every act).

| File | SHA-256 |
|---|---|
| scrollcraft.js | `91a8e57cec07b7b977584885741f07d93fd1cd08fdbea623d5432fcede66fd38` |
| scrollcraft.css | `519e254c1877a50eb724153d483ccff5b3b434fbaf3baf9c5bc1179ec28b075a` |

The JS is served from `public/` because it is a classic script that installs
`window.ScrollCraft`; the CSS is imported through the layout so Vite bundles it.
