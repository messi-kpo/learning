# CLAUDE.md

Static site of interactive study pages (Spanish), served by GitHub Pages from the
repo root. `.nojekyll` is present, so files are served as-is with no Jekyll build.

## Structure

Every folder is a level of the browsable hierarchy, and **every folder has an
`index.html`**:

```
index.html                      root index -> subjects
electricidad/index.html         subject index -> topics
electricidad/tablero/index.html content page
fisica/index.html               subject index -> units
fisica/unidad5/index.html       content page
```

Folder indexes link to child folders with a trailing slash (`href="tablero/"`),
so GitHub Pages resolves the nested `index.html`. Content pages are the leaves.

## Rule: adding a page means updating the indexes

Whenever a page is added, moved, renamed, or removed, the navigation chain must
stay complete and walkable from the root. This is not optional cleanup — an
orphan page is unreachable, because there is no directory listing and no site
search.

When adding a new page at `<subject>/<topic>/index.html`:

1. **Create the page** as `<topic>/index.html` inside its folder — never
   `<topic>.html`. The folder-per-page convention is what makes the URLs clean
   and the indexes uniform.
2. **Add a card to the parent index** (`<subject>/index.html`): `<h2>` title,
   one-sentence `<p>` description, `.peek` chips naming a few real sections from
   the page, and a `.meta` row with a `.count` badge.
3. **Update the root index** (`index.html`): if the subject is new, add a card
   for it; if it already exists, add the page to that card's `.peek` list and
   correct the `.count` badge (e.g. `1 tema` -> `2 temas`).
4. **Give the new page a breadcrumb** back up the chain, matching the existing
   ones: `<a href="../">Apuntes</a><span>/</span><Subject>`.

Removing or renaming a page reverses the same steps — delete or fix every card,
chip, count and breadcrumb that referenced it.

### Check before finishing

Every `href` in every index must resolve to a real file or folder, and every
content page must be reachable by clicking down from the root `index.html`:

```sh
for f in $(find . -path ./.git -prune -o -name index.html -print); do
  d=$(dirname "$f")
  grep -o 'href="[^"h][^"]*"' "$f" | sed 's/href="//;s/"$//' | while read -r h; do
    [ -e "$d/$h" ] || [ -f "$d/$h/index.html" ] || echo "DEAD $f -> $h"
  done
done
```

## Page conventions

- Self-contained single files: inline `<style>` and `<script>`, no build step,
  no local dependencies. Only Google Fonts is loaded externally.
- Copy is in Spanish (Rioplatense: *elegí*, *cambiá*, *mirá*). UTF-8, no escapes
  for accented characters.
- Theme-aware in all three states: define the light palette as CSS custom
  properties on bare `:root`, then redefine them under
  `@media (prefers-color-scheme:dark){ :root:not([data-theme="light"]) }` and
  again under `:root[data-theme="dark"]`. Never give a color its only definition
  inside a media query.
- Responsive to ~400px: side padding on one wrapper, grids that collapse to one
  column, no horizontal scroll on the body.
- Index pages share one stylesheet block, copied into each file (there is no
  shared CSS file by design — keeping pages standalone). Changing the index look
  means changing all three.
