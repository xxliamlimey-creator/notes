# Notes

A local-first, Apple Notes–inspired notebook built as a single-page Windows PWA. It pairs a high-fidelity three-column interface with real rich-text editing, folders, pinned notes, checklists, trash, instant search, and fully offline use.

No account, no backend, no network calls. Every note lives in your browser's local storage.

![Notes on desktop in light mode](screenshots/desktop-light.png)

## Highlights

- **Faithful Apple Notes layout** — source-list sidebar, note list, and a paper-textured editor with translucent titlebar, SF-first typography, and a warm gold accent.
- **Light, dark, and automatic themes** — follows the system by default, with no flash of the wrong theme on launch.
- **Real rich text** — Title, Heading, Subheading, Body, and Monospaced paragraphs, plus bold, italic, underline, strikethrough, and bulleted, numbered, dashed, or checklist lists.
- **Interactive checklists** — click or press Space to check an item; completed items fade and strike through. Enter adds items, Enter on an empty item returns to a paragraph, and Tab indents.
- **Folders that behave like folders** — create, rename, delete, and move notes with the context menu, the Move dialog, or drag and drop.
- **Pinned notes** — pin from the list or editor; pinned notes stay in a dedicated section above the date groups.
- **Fast search** — `Ctrl K` searches titles and note body text instantly.
- **Recently Deleted** — soft-delete notes, restore them, delete permanently, or empty the trash.
- **Live note stats** — word count, character count, and a human-readable last-edited timestamp, with automatic saving.
- **Installable and offline** — web app manifest, PNG/maskable icons, custom install card, and a service worker that caches the complete app shell.
- **Responsive** — the sidebar becomes an overlay on tablets; below 720 px the list and editor become separate screens with a back button.
- **Accessible** — keyboard navigation, visible focus states, ARIA labels/live regions, reduced-motion support, and forced-colors support.

| Dark mode | Mobile list | Mobile editor |
| --- | --- | --- |
| ![Notes in dark mode](screenshots/desktop-dark.png) | ![Notes on a phone](screenshots/mobile-list.png) | ![The mobile editor](screenshots/mobile-editor.png) |

## Quick start

Requirements: Node.js 18 or newer, and a current version of Chrome or Edge.

```powershell
npm install
npm run serve
```

Open <http://127.0.0.1:4173/>. The compiled stylesheet is committed, so no build step is needed just to run the app.

To use another port:

```powershell
$env:PORT = "8080"; npm run serve
```

Any static file server works too, for example `python -m http.server 4173 --bind 127.0.0.1`.

### Install as a Windows app

1. Run the app from `http://127.0.0.1:4173/` (or any HTTPS origin).
2. Use the install icon in the Chrome/Edge address bar, or **⋮ → Cast, save, and share → Install Notes**.
3. You can also use the **Install Notes** card in the sidebar. When the browser exposes an install prompt, it opens the native dialog; otherwise it shows the exact browser steps.
4. Launch Notes from the Start menu. It opens in its own standalone window and keeps working offline.
5. Uninstall it from **Windows Settings → Apps → Installed apps**.

> Installation requires a secure context. `localhost` and `127.0.0.1` qualify; a plain-HTTP LAN address does not.

## Using Notes

- **New note** — the compose button, `Ctrl N`, or the browser shortcut `?new=1`.
- **Formatting** — select text and use the toolbar, the `Aa` format menu, or keyboard shortcuts. Paragraph styles apply to the current block.
- **Folders** — the `+` next to “Folders” creates one. Hover a folder for its `…` menu to rename or delete it. Deleting a folder moves its notes to **Recently Deleted**.
- **Move notes** — drag a note row onto a folder, or use the `…` menu → **Move**. On touch, use the menu.
- **Pin notes** — the pin button in the note list or editor. Pinned notes are grouped above the dated sections.
- **Trash** — deleted notes go to **Recently Deleted**, where they can be restored or removed permanently.
- **Search** — click the search field or press `Ctrl K`; `Esc` clears or closes it.
- **Appearance** — the sun/moon button toggles light and dark. Open **Appearance** in the sidebar footer to choose Light, Dark, or Automatic (system).
- **Share** — the share button uses the system share sheet when available and otherwise copies the note's plain text to the clipboard.

### Keyboard shortcuts

| Action | Shortcut |
| --- | --- |
| New note | `Ctrl N` |
| New folder | `Ctrl Shift N` |
| Search all notes | `Ctrl K` or `Ctrl F` |
| Save now | `Ctrl S` |
| Bold / Italic / Underline | `Ctrl B` / `Ctrl I` / `Ctrl U` |
| Strikethrough | `Ctrl Shift X` |
| Checklist | `Ctrl Shift L` |
| Title / Heading / Subheading | `Ctrl Alt 1` / `2` / `3` |
| Body / Monospaced | `Ctrl Alt 4` / `5` |
| Indent list item | `Tab` |
| Close menu, popover, or search | `Esc` |

The same list is available in the app from the keyboard button in the sidebar footer.

## Data and privacy

- All notes, folders, and preferences are stored under the LocalStorage key **`notes.pwa.state.v1`**.
- There is no server, account, analytics, or third-party request at runtime. Fonts are system fonts; icons are inline SVG; CSS is local.
- Notes are scoped to the browser profile and origin. They do **not** sync between devices or browsers, despite the familiar Apple-like styling.
- Clearing site data, clearing browsing data, or uninstalling the browser profile removes the notes. There is currently no export/import feature, so treat this as a personal notebook rather than an archive.
- Any script running on the same origin could read LocalStorage. Only serve the app from a directory and origin you trust.

## PWA and offline behavior

- `manifest.json` defines the standalone window, start URL, theme colors, shortcuts, and 192/512 px icons plus a maskable icon.
- `sw.js` precaches the HTML, compiled CSS, JavaScript, manifest, and icons in a versioned cache.
- Navigations are network-first so updates arrive when online; cached shell assets are served cache-first for speed.
- On first install the worker activates immediately. On later updates it waits, and the app offers a **Reload** toast so an open note is never interrupted.
- After changing any shell asset, bump `CACHE_VERSION` in `sw.js` (currently `notes-shell-v1.1.0`) so clients pick up the new cache.

## Project structure

```text
apple-notes-pwa/
├─ index.html                 App shell, dialogs, inline SVG icon sprite
├─ app.js                     State, rich text, checklists, folders, search, PWA flow
├─ src/input.css              Tailwind import, design tokens, component styles
├─ assets/styles.css          Compiled, minified stylesheet (committed)
├─ manifest.json              PWA manifest
├─ sw.js                      Versioned offline shell service worker
├─ icons/                     Favicon and PWA icons (PNG + SVG)
├─ scripts/
│  ├─ serve.mjs               Zero-dependency local preview server
│  ├─ integration.mjs         38-check Playwright end-to-end suite
│  ├─ visual-check.mjs        Desktop/mobile screenshot generator
│  └─ generate-icons.ps1      Regenerates all PNG icons on Windows
├─ screenshots/               Reference screenshots
├─ package.json
└─ README.md
```

## Development

```powershell
npm run watch:css   # rebuild assets/styles.css on change
npm run build       # minified production stylesheet
npm run icons       # regenerate PNG icons (Windows / PowerShell)
```

- Design tokens (colors, spacing, typography, shadows) live at the top of `src/input.css`.
- Seed folders and notes are defined near the top of `app.js`; they are only inserted on a first launch with no saved state.
- The compiled CSS is generated by Tailwind CSS v4. Re-run the build after editing `src/input.css` or class names in `index.html` / `app.js`.

### Tests

Start the preview server in one terminal:

```powershell
npm run serve
```

Then, in another terminal:

```powershell
npm test            # Playwright end-to-end suite
npm run shots       # refresh screenshots/
```

The suite covers seeding, note creation and focus, title/paragraph entry, formatting, checklist ordering/exit/toggling, stats, persistence, folder create/rename/delete, pinning, moving notes by menu and drag-and-drop, search, the full trash lifecycle (delete, restore, permanent delete, empty), theme switching, mobile titlebar/sidebar/editor behavior, service worker activation, manifest fields, and an offline reload. It expects Chrome at the default Windows path; set `CHROME_PATH` to override it, and `NOTES_URL` if the app is not at `http://127.0.0.1:4173/`.

`playwright-core` uses your installed Chrome; it does not download a browser.

### Lighthouse

Latest local audit (desktop, Chrome headless):

| Performance | Accessibility | Best Practices | SEO |
| --- | --- | --- | --- |
| 97 | 100 | 100 | 100 |

Run it yourself with:

```powershell
npx lighthouse http://127.0.0.1:4173/ --chrome-path="C:\Program Files\Google\Chrome\Application\chrome.exe" --only-categories=performance,accessibility,best-practices,seo --view
```

## Browser support

Targeted at current Chromium browsers (Chrome/Edge 111+) because the interface uses modern CSS such as `:has()`, `color-mix()`, and `dvh` units. Recent Safari and Firefox should render the app, but the custom install flow and `beforeinstallprompt` are Chromium-specific.

---

Designed as a loving tribute to Apple Notes. Not affiliated with or endorsed by Apple Inc. “Apple” and “Notes” are trademarks of their respective owners.
