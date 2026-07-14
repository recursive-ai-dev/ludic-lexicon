# AUDIT.md

## 1. Data Loss: Overwriting Historical Casts (Real Bug)
- **File(s):** `src/engine/renderer.ts` (Lines 45-47), `src/storage/db.ts`
- **Problem:** `LexiconRenderer` initializes `this.castCount` to 0 on every app load. Since IndexedDB uses `castNumber` as the primary key path, new casts start at 1 and silently overwrite previous sessions' saved readings.
- **Why it matters:** Users permanently lose their historical reading data whenever they refresh or reopen the app.
- **Proposed Fix:** Replace the incremental `this.castCount` with a unique identifier, such as `const N = Date.now();`, or query the database on initialization to find the maximum existing `castNumber` and pass it to the renderer.
- **Overlap:** None.

## 2. Logic Bug: Cumulative Text Re-processing (Correctness Risk)
- **File(s):** `src/ui/app.ts` (Lines 60-65), `src/engine/nlp.ts`
- **Problem:** `handleInput` passes the entire textarea contents (`input.value`) to `this.engine.addText(text)` on every word boundary trigger. Because `addText` does not clear previous state, early words have their frequencies multiplied with every single keystroke.
- **Why it matters:** Word frequencies and graph node counts become wildly inflated, completely destroying the mathematical validity of the tf-idf and PageRank calculations.
- **Proposed Fix:** Instantiate a fresh engine before adding the text in `handleInput`: `this.engine = new SemanticEngine(this.config); this.engine.addText(text);`.
- **Overlap:** None.

## 3. Math Bug: Incorrect HITS Algorithm Implementation (Real Bug)
- **File(s):** `src/engine/nlp.ts` (Lines 97-106)
- **Problem:** The `_hits` method calculates and updates `node.hitsAuthority` in place, then immediately uses that newly normalized value in the very same iteration to calculate `node.hitsHub`.
- **Why it matters:** HITS mathematically requires computing both authority and hub scores based entirely on the previous generation's values. Updating in-place breaks the algorithm, skewing the centrality results for the dense NLP level.
- **Proposed Fix:** Create temporary maps (e.g., `nextAuth` and `nextHub`) inside the iteration loop. Calculate all new values into these maps, and only apply them back to `this.graph` nodes after the loop finishes.
- **Overlap:** Touches `src/engine/nlp.ts`, but in the `_hits` method (isolated).

## 4. Unbounded Memory: WebGL Buffer Reallocation (Resilience)
- **File(s):** `src/viz/sigil.ts` (Lines 74-78)
- **Problem:** `LexiconViz.update` creates brand new `Float32Array` objects and instantiates new `THREE.BufferAttribute`s on every keystroke, replacing the old attributes without disposing of them.
- **Why it matters:** WebGL buffers associated with the replaced attributes are orphaned in GPU memory, leading to memory bloat and garbage collection stuttering during active typing.
- **Proposed Fix:** If the geometry size doesn't change, update `geometry.attributes.position.array` directly and set `needsUpdate = true`. If size changes, call `.dispose()` on the old attributes or geometry before recreating them, or pre-allocate a large static buffer and use `geometry.setDrawRange`.
- **Overlap:** Touches `LexiconViz.update`. Overlaps with items #5 and #10. Care must be taken to apply all `update()` method changes harmoniously.

## 5. UI Desync: Orphaned Canvas State on Clear (Real Bug)
- **File(s):** `src/viz/sigil.ts` (Line 52)
- **Problem:** When the user clears the session, `LexiconViz.update` is called with an empty engine, but immediately halts execution via `if (count === 0) return;` without updating the Three.js geometry.
- **Why it matters:** The visual sigil from the cleared text remains frozen on the canvas indefinitely, desyncing the UI and confusing the user.
- **Proposed Fix:** Before returning when `count === 0`, explicitly empty the geometry by setting `this.nodeGeometry.setDrawRange(0, 0);` or providing empty position/color arrays.
- **Overlap:** Touches `LexiconViz.update` (top of function). Overlaps with items #4 and #10.

## 6. O(N^3) CPU Lag: Inefficient TextRank Edge Summation (Redundant Work)
- **File(s):** `src/engine/nlp.ts` (Lines 72-76)
- **Problem:** Inside the 30-iteration `_textRank` loop, the code calculates `neighborEdgeSum` by iterating over `neighborNode.neighbors` for every edge, on every node, every single pass.
- **Why it matters:** This static graph property is recalculated thousands of times unnecessarily, causing severe main-thread blocking and UI lag when analyzing larger text inputs.
- **Proposed Fix:** Pre-calculate the total outgoing edge weight for each node once, *before* the `iters` loop begins, store it in a `Map<string, number>`, and retrieve that sum directly inside the inner iteration.
- **Overlap:** Touches `src/engine/nlp.ts`, but in the `_textRank` method (isolated).

## 7. Math Flaw: Incorrect TF-IDF Document Frequency (Correctness Risk)
- **File(s):** `src/engine/nlp.ts` (Line 49)
- **Problem:** `_updateIDF` calculates the denominator using `node.frequency` (the total count of the word across all inputs) rather than the number of documents/inputs containing the term.
- **Why it matters:** Standard IDF scores require the document frequency. Using total term frequency mathematically penalizes words that appear repeatedly in a single document, breaking the term-weighting logic.
- **Proposed Fix:** Add a `documentFrequency` property to the `Node` interface. Increment it (at most once per document/cast) in `addText`, and replace `node.frequency` with `node.documentFrequency` in the IDF formula.
- **Overlap:** Touches `src/engine/nlp.ts`, but in `_updateIDF` and `addText` (isolated).

## 8. Filter Failure: Case-Sensitive Blacklist (Correctness Risk)
- **File(s):** `src/ui/app.ts` (Line 90)
- **Problem:** Words parsed from the user's blacklist textarea are added to the config Set preserving their exact casing, but the NLP engine checks tokens after converting them to lowercase.
- **Why it matters:** If a user types capitalized words (e.g., "The, And") into the settings, the engine will fail to filter them out from the text analysis.
- **Proposed Fix:** Chain `.toLowerCase()` during the blacklist string parsing: `.map(s => s.trim().toLowerCase())`.
- **Overlap:** Touches `src/ui/app.ts`, in `saveSettings` (isolated).

## 9. Permanent UI Lock: Copy Button Stuck State (Resilience)
- **File(s):** `src/ui/app.ts` (Lines 164-169)
- **Problem:** `copyLastReading` stores the current button text in `orig`, updates it to 'COPIED', and uses a timeout to restore `orig`. If clicked twice quickly, `orig` is evaluated as 'COPIED'.
- **Why it matters:** The button becomes permanently locked displaying "COPIED", providing false feedback to the user until the page is refreshed.
- **Proposed Fix:** Hardcode the restoration text (e.g., `btn.textContent = 'Copy'`) inside the timeout, or track the default state outside the method scope.
- **Overlap:** Touches `src/ui/app.ts`, in `copyLastReading` (isolated).

## 10. Frame Drops: Repeated String Hashing on Render (Redundant Work)
- **File(s):** `src/viz/sigil.ts` (Lines 60-61, 82)
- **Problem:** `LexiconViz.update` continuously recalculates `this.stableHash(word + 'x')` and `y` using per-character loops for every vocabulary word, on every valid keystroke.
- **Why it matters:** Heavy string concatenation and manual hashing inside a render-prep loop wastes CPU cycles, limits frame rate, and triggers unnecessary garbage collection.
- **Proposed Fix:** Calculate the `[hx, hy]` coordinates precisely once when a word is added to the `SemanticEngine` (storing it on the `Node` object), and simply read these cached coordinates in the render loop.
- **Overlap:** Touches `LexiconViz.update`. Overlaps with items #4 and #5.

## 11. Silent Failure: Unhandled Promise Rejection in DB Upgrade (Resilience)
- **File(s):** `src/storage/db.ts` (Lines 14-20)
- **Problem:** The IndexedDB `init()` method has no error or blocked handlers on the `request.onupgradeneeded` transaction, nor on the open request for the blocked event.
- **Why it matters:** If the browser denies the schema migration or the database is locked, the initialization promise will hang forever, leaving the app in a permanently non-functional state with no error logs.
- **Proposed Fix:** Attach an `onerror` listener to the transaction (during upgradeneeded) and an `onblocked` listener to `request` that explicitly call `reject()`.
- **Overlap:** None.

## 12. Logic Gap: Incomplete Louvain Clustering (Dead Code / Correctness Risk)
- **File(s):** `src/engine/nlp.ts` (Lines 156-179)
- **Problem:** The `_louvainClustering` function iterates to move nodes to neighboring communities for local optimization, but completely skips the mandatory second phase of aggregating those communities into a new structural graph.
- **Why it matters:** The algorithm acts strictly as a flat Label Propagation Algorithm. Without the aggregation phase, it is mathematically incapable of finding macro-communities in larger text sets.
- **Proposed Fix:** Implement the graph-aggregation step (where communities become nodes in a new graph and the process repeats), or rename the function/docs to "Label Propagation" to accurately reflect the provided logic.
- **Overlap:** Touches `src/engine/nlp.ts`, but in `_louvainClustering` (isolated).

## 13. Wasted GPU Cycles: Unnecessary WebGL Alpha Channel (Redundant Work)
- **File(s):** `src/viz/sigil.ts` (Line 17, 23)
- **Problem:** The WebGLRenderer is initialized with `{ alpha: true }`, but the scene is explicitly given an opaque background color (`new THREE.Color(0x060608)`).
- **Why it matters:** Forcing WebGL to compute and output an alpha channel when the scene is fully opaque disables browser-level compositing optimizations and causes a small but consistent performance penalty.
- **Proposed Fix:** Remove `alpha: true` from the `WebGLRenderer` constructor options.
- **Overlap:** Touches `src/viz/sigil.ts`, in the constructor (isolated).
