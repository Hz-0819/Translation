# Configurable Notebook Workspace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor PaperLingo into a configurable notebook workspace with first-class resources, mistake books, tool instances, reusable lasso actions, trace pages, excerpts, and user-authored outlines.

**Architecture:** Move persistent domain state out of `main.js` into small model modules with normalized localStorage records. Render the toolbar from a registry of tool definitions and instances. Keep document rendering adapters intact while adding app-level library/mistake-book views and selection operations to the ink controller.

**Tech Stack:** Vite, vanilla JavaScript modules, localStorage/IndexedDB, Canvas, Pointer Events, html2canvas, Node test runner

---

### Task 1: Domain models

**Files:**
- Create: `src/workspace-state.js`
- Create: `src/tool-registry.js`
- Test: `tests/workspace-state.test.js`
- Test: `tests/tool-registry.test.js`

**Steps:**
1. Write failing normalization and migration tests.
2. Implement document, mistake-book, excerpt, outline and tool-instance helpers.
3. Run focused tests and commit the domain layer.

### Task 2: App-level navigation

**Files:**
- Modify: `src/main.js`
- Modify: `src/styles.css`

**Steps:**
1. Add Resources and Mistake Books as equal primary tabs.
2. Add resource cards, upload entry, mistake-book creation and entry filters.
3. Preserve the current file workspace as the document-detail view.
4. Verify keyboard and tablet navigation, then commit.

### Task 3: Configurable tool instances

**Files:**
- Modify: `src/main.js`
- Modify: `src/ink.js`
- Modify: `src/styles.css`

**Steps:**
1. Replace fixed pen buttons with registry-driven tool instances.
2. Add an Add Tool flow and direct instance editor.
3. Add common-toolbar management and global/default persistence.
4. Verify switching versus second-tap editing, then commit.

### Task 4: General-purpose lasso

**Files:**
- Modify: `src/ink.js`
- Modify: `src/main.js`
- Modify: `src/styles.css`
- Test: `tests/ink-layer.test.js`

**Steps:**
1. Add stroke IDs, bounds selection, duplication, deletion and transforms.
2. Add rectangular/freeform lasso capture and a contextual action bar.
3. Route screenshot actions independently to excerpts or mistake books.
4. Test mouse and pointer flows, then commit.

### Task 5: File organization views

**Files:**
- Modify: `src/main.js`
- Modify: `src/styles.css`
- Test: `tests/workspace-state.test.js`

**Steps:**
1. Replace text-note navigation with automatic trace-page filtering.
2. Add excerpt cards with editable notes and source-page navigation.
3. Replace automatic headings with user-authored outline nodes.
4. Run all tests, build, responsive browser QA and commit.
