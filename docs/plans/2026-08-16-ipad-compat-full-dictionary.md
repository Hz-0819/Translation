# iPad Compatibility and Full Dictionary Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix PDF uploads on iPad Safari and replace the small demo dictionary with the complete ECDICT English-Chinese dataset.

**Architecture:** Load PDF.js's legacy browser build on demand so older Safari receives the required language polyfills while retaining the patched PDF.js release. Convert ECDICT's CSV distribution into an indexed SQLite database that stays on the local computer; expose an exact-word JSON endpoint through the Vite development server so tablets transfer only one dictionary entry per lookup.

**Tech Stack:** Vite plugin middleware, Node.js SQLite, Python CSV importer, PDF.js legacy build, ECDICT

---

### Task 1: Reproduce and fix the iPad Iterator failure

**Files:**
- Modify: `src/documents.js`
- Create: `tests/pdf-compat.test.js`

**Steps:**
1. Add a source-level compatibility assertion that rejects the modern PDF.js entrypoint.
2. Run `npm test` and confirm it fails with the current modern import.
3. Switch both the PDF module and worker to `pdfjs-dist/legacy` entrypoints.
4. Run the tests and production build; expect both to pass.

### Task 2: Build the complete ECDICT database

**Files:**
- Create: `scripts/build_dictionary.py`
- Create: `data/ECDICT-LICENSE`
- Create: `data/ecdict.sqlite`

**Steps:**
1. Download the official 65 MB ECDICT CSV and license from the upstream repository.
2. Stream rows into SQLite rather than holding the source in memory.
3. Create a case-insensitive unique index on the `word` column.
4. Validate entry count and representative words including `evidence`, `iterator`, and `zyzzyva`.

### Task 3: Add a local dictionary API

**Files:**
- Create: `server/dictionary.js`
- Create: `vite.config.js`
- Create: `tests/dictionary-server.test.js`

**Steps:**
1. Implement validated exact-word lookup with a prepared SQLite statement.
2. Expose `GET /api/dictionary?q=<word>` from Vite middleware.
3. Return structured phonetic, part-of-speech, translation, definition, exam tags, frequency, and word-form data.
4. Add tests for success, misses, punctuation rejection, and SQL-injection-shaped input.

### Task 4: Connect asynchronous full-dictionary lookup

**Files:**
- Modify: `src/dictionary.js`
- Modify: `src/main.js`
- Modify: `src/styles.css`

**Steps:**
1. Keep the small bundled dictionary as an instant cache and offline fallback.
2. Request the local API when a word is not cached, with abort and timeout handling.
3. Render all available Chinese senses, English definitions, examination tags, and inflections.
4. Show explicit loading, unavailable, and not-found states without blocking handwriting.

### Task 5: Verify desktop and tablet behavior

**Files:**
- Modify: `README.md`

**Steps:**
1. Run the complete test suite, production build, dependency audit, and dictionary integrity checks.
2. Reload the local app and query words outside the former demo vocabulary.
3. Test responsive lookup on desktop and tablet viewports.
4. Confirm the browser console contains no `Iterator` or API errors.

