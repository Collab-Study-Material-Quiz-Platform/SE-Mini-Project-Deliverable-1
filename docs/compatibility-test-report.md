# Browser and Responsive Compatibility Report — CSQ-NF-005

**Target:** Latest two versions of Chrome, Firefox, Edge and Safari, at widths from 360 px to 1920 px.  
**Last updated:** 28 October 2026  
**Acceptance status:** Manual layout checks reported passing on one tested version of each browser family. Exact browser versions and second-latest-version coverage are not recorded; full requirement verification remains open.

## Scope

The integrated frontend provides Home (`#/`), account registration (`#/register`) and System Status (`#/status`). The registration form and its API integration are preserved. Responsive styles apply to the shared navigation, Home and System Status pages.

## Manual checks reported after the integration

The project tester reported that all three pages were working at the required viewport widths in Chrome, Firefox, Edge and Safari on a Mac. Horizontal-overflow checks in Chrome returned `false` on each of the three pages at 360 px, 768 px and 1920 px. Firefox and Edge were also reported to work correctly across the three pages and widths; Safari on Mac was reported working correctly throughout.

| Browser | Environment/version | Viewports | Pages checked | Outcome reported |
|---|---|---|---|---|
| Chrome | Version not recorded | 360, 768, 1920 px | Home, Registration, System Status | No horizontal overflow reported at all three widths; pages working |
| Firefox | Version not recorded | 360, 768, 1920 px | Home, Registration, System Status | Pages reported working correctly |
| Edge | Version not recorded | 360, 768, 1920 px | Home, Registration, System Status | No horizontal overflow reported at 360, 768 and 1920 px; pages working |
| Safari | Mac; version not recorded | 360, 768, 1920 px | Home, Registration, System Status | Pages reported working correctly |

These results are tester-reported manual observations. Browser version numbers, screenshots for every combination, keyboard/focus checks and a second browser version from each family have not been captured in this report.

## Backend failure and recovery

The System Status page was manually checked by stopping the backend; it displayed “Service unavailable” with the failure indicator. After restarting the backend, the page returned to “Operational” and the database showed connected.

## Remaining verification for full acceptance

- Record the exact browser and version used for each tested family.
- Verify coverage of the latest two versions of Chrome, Firefox, Edge and Safari as required by CSQ-NF-005.
- Record keyboard navigation, visible focus indicators, readable text, working navigation and form usability, in addition to overflow checks.
- Retain the actual observations for the tested matrix as evidence for TC-Comp-01.

## Manual procedure

1. Start MongoDB and the backend with `MONGO_URI` configured; run `npm start` in `backend`.
2. In a separate terminal, run `npm run dev` in `frontend`.
3. In each browser, open the app and inspect widths 360, 768 and 1920 px.
4. Check Home, Registration and System Status for horizontal overflow, clipped text, overlap, navigation usability, visible focus indicators and usable form controls.
5. Stop the backend and verify the System Status failure state; restart it and confirm recovery.
6. Record actual browser versions and any defects; do not claim untested browser versions as passed.

## Limitations

Browserslist documents target browsers; it does not run browser tests. CI validates the frontend production build and backend tests, not real cross-browser rendering. Keep Issue #23 open until exact browser-version coverage and TC-Comp-01 evidence are complete.
