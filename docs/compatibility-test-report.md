# Compatibility Test Report — CSQ-NF-005

**Requirement**: The system shall work correctly on the latest 2 versions of Chrome, Firefox, Edge and Safari, and on screen widths from 360 to 1920 pixels.

**Status**: Template — fill in results after manual testing (see How to test below).

---

## Test Matrix

| Browser | Version | 360 px | 768 px | 1920 px | Home page | Status page | Notes |
|---------|---------|--------|--------|---------|-----------|-------------|-------|
| Chrome  |         |        |        |         |           |             |       |
| Edge    |         |        |        |         |           |             |       |
| Firefox |         |        |        |         |           |             |       |
| Safari  |         |        |        |         |           |             |       |

**Result key**: ✅ Pass &nbsp;|&nbsp; ❌ Fail &nbsp;|&nbsp; ⚠️ Minor issue (describe in Notes)

---

## Checklist per browser / width

For each cell above, verify:

- [ ] No horizontal scrollbar at that width
- [ ] All text is readable (no invisible or clipped text)
- [ ] Header and product name are visible
- [ ] Nav links ("Home" and "System Status") are visible and clickable
- [ ] Home page shows the hero, three feature cards, and the status badge
- [ ] Status page shows the "System Status" heading, status banner, four metric cards, and the availability history row
- [ ] Status banner turns red / shows "Service unavailable" when the backend is stopped

---

## How to test

### Setup

1. Start the backend: `cd backend && node server.js` (requires a `.env` with `PORT=5000`; `MONGO_URI` is optional).
2. Start the frontend dev server: `cd frontend && npm run dev` (opens on `http://localhost:5173`).
3. Alternatively, build and preview: `npm run build && npm run preview` (serves on `http://localhost:4173`).

### Testing responsive widths

1. Open the app in the browser under test.
2. Open DevTools: **F12** (Windows/Linux) or **Cmd+Option+I** (Mac).
3. Enable the device / responsive toolbar: **Ctrl+Shift+M** (Windows/Linux) or **Cmd+Shift+M** (Mac).
4. Enter each width in the toolbar: **360**, **768**, **1920** (height 800 is fine for all).
5. Work through the checklist above for `#/` (Home) and `#/status` (Status page).

### Testing the failure state

1. With the app open on `#/status`, **stop the backend** (Ctrl+C in its terminal).
2. Wait up to 15 seconds (the page polls every 10 s with a 5 s timeout).
3. The banner must change to "✗ Service unavailable" and the home status badge must turn red.

### Browser version

Find the version in **Help → About** (Chrome/Edge/Firefox) or **Safari → About Safari**.
Record the version string in the table above (e.g. "Chrome 136.0.6998.88").

---

## Notes

- Safari on iOS and macOS share the same WebKit engine; testing on one covers the rendering engine for both, but interaction (touch events, scroll behaviour) should ideally be spot-checked on a real iPhone or Mac.
- Edge uses the same Blink engine as Chrome; issues found in Chrome are likely to reproduce in Edge and vice-versa.
- The responsive CSS uses `clamp()`, CSS Grid, and Flexbox — all fully supported in the latest 2 versions of every target browser.
