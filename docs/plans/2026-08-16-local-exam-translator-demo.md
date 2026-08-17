# Local Exam Translator Demo Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a locally runnable, tablet-responsive web demo for uploading exam papers, handwriting over them, and looking up selected English words without leaving the page.

**Architecture:** Use a lightweight Vite application with PDF.js for selectable PDF rendering and docx-preview for local DOCX rendering. Keep handwritten strokes in a normalized coordinate system so the same ink remains aligned when the viewport changes size, and keep translation behind a provider boundary with a small offline demo dictionary.

**Tech Stack:** Vite, vanilla JavaScript modules, PDF.js, docx-preview, CSS container/media queries, Node test runner

---

### Task 1: Scaffold the local application

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `src/main.js`
- Create: `src/styles.css`

**Steps:**
1. Add Vite scripts and the PDF/DOCX rendering dependencies.
2. Add the semantic application shell and mobile viewport metadata.
3. Add the initial responsive workspace layout.
4. Run `npm install` and `npm run build`; expect a successful production bundle.

### Task 2: Implement normalized responsive handwriting

**Files:**
- Create: `src/ink.js`
- Create: `tests/ink.test.js`

**Steps:**
1. Write tests for normalized pointer coordinates and denormalized stroke rendering.
2. Run `npm test`; expect the tests to fail before the module exists.
3. Implement coordinate normalization helpers and the responsive ink canvas controller.
4. Persist strokes to localStorage and redraw them after a ResizeObserver event.
5. Run `npm test`; expect all coordinate tests to pass.

### Task 3: Implement document adapters

**Files:**
- Create: `src/documents.js`
- Modify: `src/main.js`

**Steps:**
1. Add a built-in sample exam with real selectable text.
2. Add PDF rendering with a selectable text overlay.
3. Add DOCX rendering through docx-preview.
4. Add image rendering and a clear OCR-not-yet-connected status.
5. Ensure each rendered page receives an independent normalized ink layer.

### Task 4: Implement lookup interactions

**Files:**
- Create: `src/dictionary.js`
- Create: `src/selection.js`
- Create: `tests/dictionary.test.js`
- Modify: `src/main.js`

**Steps:**
1. Write tests for case-folding, punctuation removal, and inflection fallback.
2. Add a compact offline English-Chinese demo dictionary.
3. Support tap-to-look-up and selection-to-translate from rendered text.
4. Present results as a side card on wide screens and a bottom sheet on tablets.
5. Run `npm test`; expect all dictionary tests to pass.

### Task 5: Verify responsive behavior and handoff

**Files:**
- Modify: `src/styles.css`
- Modify: `README.md`

**Steps:**
1. Build the application with `npm run build`.
2. Start the local Vite server and inspect desktop and tablet viewport screenshots.
3. Confirm tool placement, safe-area spacing, readable page scaling, and ink alignment.
4. Document `npm install` and `npm run dev` startup steps plus current demo limitations.

