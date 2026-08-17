# Design QA

- source visual truth paths:
  - `C:/Users/86184/AppData/Local/Temp/codex-clipboard-f8fcd9e5-6542-4514-9bf5-2b546d11e315.jpg`（图层）
  - `C:/Users/86184/AppData/Local/Temp/codex-clipboard-c7d98b66-340c-4236-9a43-02614ed5f89b.jpg`（页面/错题工作流）
  - `C:/Users/86184/AppData/Local/Temp/codex-clipboard-3ad58dbe-96fc-44a3-b30f-c9a92b81e672.jpg`（加页）
- implementation screenshots:
  - `C:/Users/86184/Desktop/翻译/artifacts/layers-panel.png`
  - `C:/Users/86184/Desktop/翻译/artifacts/mistake-book.png`
  - `C:/Users/86184/Desktop/翻译/artifacts/blank-note-page.png`
  - `C:/Users/86184/Desktop/翻译/artifacts/narrow-panel.png`
- viewport: 1024 × 768 primary tablet; 700 × 900 and 390 × 844 responsive checks
- pixels/CSS/density: implementation captures at CSS viewport with deviceScaleFactor 1; references are 1644 × 1080 screenshots. No pixel-density normalization was applied because the references are product-pattern sources rather than an exact visual clone target.
- state: sample exam loaded; layer manager open; blank note page; lasso-created mistake book entry; narrow-screen layer drawer.

## Full-view comparison evidence

The implementation retains the reference hierarchy—document canvas as the dominant surface, persistent tool strip, and a secondary management drawer—while intentionally using PaperLingo's cream, ink-green and lime token system. The added controls do not obscure the document at 1024 px and collapse into a bottom toolbar/drawer at smaller widths.

## Focused region comparison evidence

Focused comparison was required for layers, add-page and mistake-book states. Layer rows expose selection, editable names, visibility and deletion without automatic categorization. Add-page produces a real ruled page in the document stack. Lasso produces an actual cropped image card with page provenance and a return action.

## Required fidelity surfaces

- Fonts/typography: existing Noto Serif SC + DM Mono hierarchy is retained; panel labels and control text remain legible at tablet and phone widths.
- Spacing/layout: panel rows, controls and page canvas preserve clear grouping. Page frames now use scroll margin so page badges do not sit beneath the toolbar.
- Colors/tokens: all new states use existing `--ink`, `--ink-soft`, `--accent`, `--line` and `--danger` tokens.
- Image quality: mistake screenshots are real cropped page captures, constrained to 520 px and JPEG quality 0.76 for local-storage safety; no placeholder imagery or handcrafted SVG assets were introduced.
- Copy/content: labels state manual ownership clearly; no copy implies automatic question/answer classification.
- Icons/accessibility: Phosphor icons are used consistently; core controls have labels, active states and practical touch targets.

## Comparison history

- Pass 1 found a P2 narrow-screen toolbar issue at 390 px: later utility controls extended beyond the visible toolbar without a clear scroll affordance.
- Fix: enabled horizontal scrolling below 480 px, widened edge padding and added a subtle edge fade; the layer drawer remained fully usable at 390 × 844.
- Post-fix evidence: `C:/Users/86184/Desktop/翻译/artifacts/narrow-panel.png` and CSS responsive rule in `src/styles.css`.

## Findings

No actionable P0/P1/P2 findings remain. Reordering layers and choosing among multiple page templates are P3/future-scope enhancements, not blockers for the requested baseline.

## Primary interactions tested

- Add and rename a layer; switch active layer; visibility control rendered.
- Add a blank note page and verify page count becomes 2/2.
- Draw a lasso selection and verify a stored mistake-card entry appears.
- Open the layer drawer at 390 px.
- Checked browser console: no warnings or errors.

final result: passed
