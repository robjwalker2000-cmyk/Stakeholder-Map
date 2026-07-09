# Stakeholder Map AI App Map

## 1. What this app does
Stakeholder Map is a browser-based tool for creating stakeholder cards, mapping reporting relationships, assigning ownership/status values, and exporting the map for sharing. It is for people who need a lightweight visual stakeholder or organisation relationship map without a backend system.

## 2. Current status
Works now:
- Add, edit, drag, and delete stakeholder cards.
- Add photos from uploaded files, image URLs, or data URLs.
- Assign role, influence, view, contact, and owner codes.
- Manage owner codes and labels.
- Toggle whether LinkedIn URLs appear on cards.
- Create reporting relationships between top, right, bottom, or left card anchors.
- Delete existing relationships from endpoint/context controls.
- Import/export CSV, including stakeholder records, owner rows, card IDs, relationship rows, and anchor points.
- Export normal PowerPoint as a canvas image.
- Export beta PowerPoint as editable PowerPoint elements with relationship lines.
- Export a self-contained HTML snapshot of the map (static cards, embedded CSS/images, and a click-to-open info popup), downloadable via "Export Full HTML".
- Autosave the map to browser localStorage and restore it until reset.
- Generate/share a URL hash containing the map state.

Unfinished or fragile:
- The app is a single-file JavaScript implementation and is getting large.
- PowerPoint export behaviour can vary between browsers, PowerPoint versions, image sources, and zoom/display settings.
- Beta PowerPoint grouping depends on PptxGenJS internals and may not group on every library version.
- Uploaded image data can make localStorage or share links too large.

Broken or risky:
- There are duplicate owner toggle handlers near the top of `script.js`; avoid changing owner visibility without checking both paths.
- CSV parsing is intentionally simple and supports basic quoted values, not every CSV edge case.
- Remote images can fail export if CORS blocks them.

## 3. Tech stack
Frontend: Plain HTML, CSS, and vanilla JavaScript.

Backend: None.

Database: Browser localStorage for autosave, owner persistence, and visibility/toggle preferences.

Auth: None.

Hosting: Static hosting, currently suitable for GitHub Pages or opening `index.html` directly.

Key libraries:
- `html2canvas` for normal PowerPoint image capture.
- `PptxGenJS` for PowerPoint generation.
- `jsPDF` is loaded but PDF export is currently commented out in the UI.

## 4. Folder structure
- `index.html`: Main app markup, panels, header controls, SVG line layer, hover card, and external library script tags.
- `style.css`: Visual styling for the header, cards, relationship controls, CSV panels, owners panel, hover card, and responsive layout.
- `script.js`: All app state, interactions, CSV import/export, owner management, relationship drawing, autosave, share-link handling, and PowerPoint export logic.
- `AI_APP_MAP.md`: This AI-facing project map and working guide.

## 5. Main user flows
- Add stakeholder cards manually.
- Edit name, role/title, LinkedIn URL, status tiles, owner, and photo.
- Drag cards around the canvas.
- Turn on Reporting Mode, select a card anchor, then select another card anchor to create a relationship.
- Click a selected anchor again to deselect it.
- Repeat the same relationship to delete it.
- Click a relationship endpoint to open delete controls.
- Import stakeholders, owners, and relationships from CSV.
- Export stakeholders, owners, relationships, and anchors to CSV.
- Export the visual map to PowerPoint.
- Use beta PowerPoint export for editable card elements and relationship lines.
- Use autosave to recover work after refresh/browser interruption.
- Use Reset to intentionally clear the map and browser autosave.
- Generate a share link for passing map state to another browser/user.

## 6. Data model
Stakeholder card:
- `id`: Runtime card id stored in `data-id`.
- `csvId`: Stable CSV/share reference stored in `data-csv-id`.
- `x`, `y`: Card position from `style.left` and `style.top`.
- `zIndex`: Card stacking order.
- `name`: Card name input.
- `title`: Role/title input.
- `linkedin`: Stored in `data-linkedin`; can be hidden from card display.
- `photoUrl`: Stored in `data-photo` or the current photo image `src`.
- `role`, `influence`, `view`, `contact`, `owner`: Status tile values.

Relationship:
- `id`: Runtime relationship id.
- `managerId`: Source stakeholder runtime id.
- `reportId`: Target stakeholder runtime id.
- `managerAnchor`: Source anchor, one of `top`, `right`, `bottom`, `left`.
- `reportAnchor`: Target anchor, one of `top`, `right`, `bottom`, `left`.
- `line`, `startHandle`, `endHandle`: Runtime SVG elements, not persisted.

Owner:
- Owner code list is `OWNER_VALUES`.
- Owner labels live in `maps.owner`.
- Owners persist to `stakeholderMap.owners.v1`.

Persistence:
- Full autosave state is stored in localStorage key `stakeholderMapAutosave:v1`.
- LinkedIn visibility is stored in `showLinkedInUrl`.
- Owners panel visibility is stored in `ownersVisible`.
- Share links store encoded map state in `#map=...`.

CSV:
- Stakeholder rows use `Name,Title,Role,Influence,View,Contact,Owner,LinkedIn,X,Y,PhotoURL,CardID`.
- Owner rows use `OWNER:CODE=Label`.
- Relationship rows use `RELATIONSHIP,FromCardID,FromAnchor,ToCardID,ToAnchor`.

## 7. Important business rules
- Relationships should be tied to card IDs and named anchor points, not viewport coordinates.
- Valid anchors are `top`, `right`, `bottom`, and `left`.
- Repeating the same relationship from the same start anchor to the same end anchor toggles/deletes it in the UI.
- CSV import should skip duplicate relationships instead of toggling them off.
- Reset intentionally clears browser autosave.
- Hidden LinkedIn URLs should remain stored for hover/popup/export data but should not show the full URL on the card.
- CSV import should preserve source data as imported; user edits happen in the browser state, not in the CSV file.
- Owner values should remain constrained to the current owner code list.
- Photos from uploaded files are converted to data URLs; this improves portability but can make autosave/share state large.

## 8. Design/UI rules
- Preserve the existing compact dashboard/tool style.
- Header uses a dark slate background with white text and small version badge.
- Primary interaction buttons live in the header controls.
- Cards are white with black borders, rounded corners, and a green/yellow status strip at the bottom.
- Relationship anchors are circular handles shown only in Reporting Mode.
- Active selected anchors turn green.
- Relationship lines are black SVG lines with arrow markers.
- The canvas background is white and should remain export-friendly.
- Avoid large decorative hero sections, marketing panels, or unrelated visual redesigns.
- Keep controls compact and practical; this is a working mapping tool.

## 9. Known issues
- `script.js` is large and contains several responsibilities that could later be split into modules.
- Owner toggle setup appears duplicated near the top of `script.js`.
- CSV parser is custom and basic; it may not handle all quoted CSV edge cases.
- Normal PowerPoint export uses `html2canvas`, so browser zoom, CORS images, and rendering quirks can affect output.
- Beta PowerPoint export uses editable elements but has had issues around image clipping, grouping, and PowerPoint repair warnings.
- Browser localStorage has limited capacity; large uploaded images may exceed it.
- Share links can become too long for large maps or embedded images.
- There is no test suite.

## 10. Next planned work
1. Commit and push the current `v1.5` branch cleanly.
2. Add user-facing restore feedback when autosave restores a map.
3. Add a manual "Save local copy" / "Clear saved copy" control if autosave needs to be more visible.
4. Harden CSV parsing or use a small CSV parser library.
5. Split `script.js` into modules for state, cards, relationships, CSV, persistence, and exports.
6. Improve PowerPoint export reliability, especially photo clipping and remote image handling.
7. Add lightweight smoke tests for CSV round-trip and relationship anchor persistence.

## 11. How to run the app
Install:
- No package install is required.

Run locally:
- Open `index.html` directly in a browser, or run a static server:
  `python3 -m http.server 8000`
- Then open `http://localhost:8000`.

Build:
- No build step.

Deploy:
- Commit changes and push to GitHub.
- Deploy as static files, for example through GitHub Pages.

## 12. AI working instructions
- Read this file first.
- Read `index.html`, `style.css`, and the relevant sections of `script.js` before editing.
- Do not rewrite working code unnecessarily.
- Preserve the existing UI style and compact app layout.
- Ask before changing persisted data structures, CSV formats, or share-link formats.
- Explain any assumptions.
- Explain key code helpers and structure when making changes.
- Keep changes scoped to the requested behaviour.
- Do not remove existing export paths unless explicitly asked.
- Be careful with localStorage keys and CSV backward compatibility.
- Use `node --check script.js` after JavaScript edits.
- Do not overwrite user work or reset branches without confirmation.
