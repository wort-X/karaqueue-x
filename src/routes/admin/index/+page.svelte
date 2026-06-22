<script lang="ts">
    interface Song {
        title: string;
        artist: string[];
        duration: number;
        tags: string[];
        cover_image: string;
        bpm: number;
        gap: number;
    }

    // --- State ---
    let songDirs: FileSystemDirectoryHandle[] = $state([]);
    let outputDir: FileSystemDirectoryHandle | null = $state(null);
    let coverDir: FileSystemDirectoryHandle | null = $state(null);
    let library: Song[] = $state([]);
    let log: { type: "info" | "warn" | "error"; msg: string }[] = $state([]);
    let processing = $state(false);
    let done = $state(false);
    let uploadCovers = $state(false);
    let pendingUploads: Array<{ name: string; file: File }> = [];
    let batchSize = $state(10);
    let adminPWD = $state("");

    // --- Logging helper ---
    function addLog(type: "info" | "warn" | "error", msg: string) {
        log = [{ type, msg }, ...log.slice(0, Math.min(log.length, 100))];
    }

    // --- Directory pickers ---
    async function pickSongDir() {
        try {
            const handle = await (window as any).showDirectoryPicker({
                id: "karaqueue-songs-dir",
                mode: "read",
            });
            songDirs = [...songDirs, handle];
        } catch (e: any) {
            if (e.name !== "AbortError")
                addLog("error", `Could not open directory: ${e.message}`);
        }
    }

    function removeSongDir(i: number) {
        songDirs = songDirs.filter((_, idx) => idx !== i);
    }

    async function pickOutputDir() {
        try {
            outputDir = await (window as any).showDirectoryPicker({
                id: "karaqueueu-out-dir",
                mode: "readwrite",
            });
        } catch (e: any) {
            if (e.name !== "AbortError")
                addLog(
                    "error",
                    `Could not open output directory: ${e.message}`,
                );
        }
    }

    async function pickCoverDir() {
        try {
            coverDir = await (window as any).showDirectoryPicker({
                id: "karaqueueu-cover-dir",
                mode: "readwrite",
            });
        } catch (e: any) {
            if (e.name !== "AbortError")
                addLog("error", `Could not open cover directory: ${e.message}`);
        }
    }

    // --- Core parsing (mirrors Rust logic) ---

    function tryFixDuration(song: Song, lines: string[]): number | null {
        if (song.duration !== 0 || song.bpm === 0) return null;
        const noteChars = [":", "*", "R", "F", "G"];
        for (let i = lines.length - 1; i >= 0; i--) {
            const l = lines[i];
            if (noteChars.some((c) => l.startsWith(c))) {
                const parts = l.split(" ");
                const start = parseInt(parts[1], 10);
                const dur = parseInt(parts[2], 10);
                if (isNaN(start) || isNaN(dur)) continue;
                const end = start + dur;
                const spb = 60.0 / song.bpm;
                const totalSeconds = Math.floor(end * spb);
                return (
                    Math.floor(totalSeconds / 4) + Math.floor(song.gap / 1000)
                );
            }
        }
        return null;
    }

    async function readTextFile(
        fileHandle: FileSystemFileHandle,
    ): Promise<string> {
        const file = await fileHandle.getFile();
        const buffer = await file.arrayBuffer();
        // Try UTF-8, fall back gracefully
        try {
            return new TextDecoder("utf-8").decode(buffer);
        } catch {
            return new TextDecoder("latin1").decode(buffer);
        }
    }

    async function copyFileToDir(
        srcHandle: FileSystemFileHandle,
        destDir: FileSystemDirectoryHandle | null,
        destName: string,
    ) {
        const file = await srcHandle.getFile();
        if (uploadCovers) {
            // Collect the file for batched upload later
            pendingUploads.push({ name: destName, file });
        } else {
            const destHandle = await destDir!.getFileHandle(destName, {
                create: true,
            });
            const writable = await (destHandle as any).createWritable();
            await writable.write(file);
            await writable.close();
        }
    }

    // Parse a single song directory (contains a .txt file)
    async function parseSongDir(
        dirHandle: FileSystemDirectoryHandle,
        coverIndex: { value: number },
    ): Promise<Song | null> {
        let song: Song | null = null;

        for await (const [name, handle] of (dirHandle as any).entries()) {
            if (handle.kind !== "file" || !name.endsWith(".txt")) continue;

            const text = await readTextFile(handle as FileSystemFileHandle);
            const lines = text.split(/\r?\n/);

            const s: Song = {
                title: "",
                artist: [],
                duration: 0,
                tags: [],
                cover_image: "",
                bpm: 0,
                gap: 0,
            };

            for (const line of lines) {
                if (!line.startsWith("#")) continue;
                const colonIdx = line.indexOf(":");
                if (colonIdx === -1) continue;
                const key = line.slice(1, colonIdx);
                const value = line.slice(colonIdx + 1);

                switch (key) {
                    case "TITLE":
                        s.title = value.trim();
                        break;
                    case "ARTIST":
                        s.artist.push(value.trim());
                        break;
                    case "GAP":
                        s.gap = Math.floor(
                            parseFloat(value.replace(",", ".").trim()) || 0,
                        );
                        break;
                    case "BPM":
                        s.bpm = Math.floor(
                            parseFloat(value.replace(",", ".").trim()) || 0,
                        );
                        break;
                    case "END":
                        s.duration = Math.floor(
                            (parseInt(value.trim(), 10) || 0) / 1000,
                        );
                        break;
                    case "COVER":
                        if (coverDir || uploadCovers) {
                            const coverName = value.trim();
                            const ext = coverName.split(".").pop() ?? "";
                            const destName = `cover-${coverIndex.value}.${ext}`;
                            try {
                                const coverHandle =
                                    await dirHandle.getFileHandle(coverName);
                                await copyFileToDir(
                                    coverHandle,
                                    coverDir,
                                    destName,
                                );
                                s.cover_image = destName;
                                coverIndex.value++;
                            } catch {
                                addLog(
                                    "warn",
                                    `Cover not found: ${coverName} in ${dirHandle.name}`,
                                );
                            }
                        }
                        break;
                }
            }

            const fixed = tryFixDuration(s, lines);
            if (fixed !== null) s.duration = fixed;

            if (!s.title) {
                s.title = dirHandle.name.split(".")[0];
                addLog("info", `Title empty, using folder name: "${s.title}"`);
            }
            if (s.artist.length === 0) s.artist.push("");

            song = s;
            break; // Only process first .txt file found
        }

        return song;
    }

    // Recursively scan a top-level directory for song subdirectories
    async function parseFolder(
        dirHandle: FileSystemDirectoryHandle,
        coverIndex: { value: number },
    ): Promise<Song[]> {
        const songs: Song[] = [];

        for await (const [name, handle] of (dirHandle as any).entries()) {
            if (handle.kind !== "directory") continue;

            // Try to parse as a single song dir first
            const song = await parseSongDir(
                handle as FileSystemDirectoryHandle,
                coverIndex,
            );
            if (song) {
                addLog("info", `Indexed: ${handle.name}`);
                songs.push(song);
            } else {
                // Recurse into subdirectory
                const sub = await parseFolder(
                    handle as FileSystemDirectoryHandle,
                    coverIndex,
                );
                songs.push(...sub);
            }
        }

        return songs;
    }

    // Deduplicate by title + joined artists (mirrors Rust HashSet logic)
    function deduplicate(songs: Song[]): Song[] {
        const seen = new Set<string>();
        return songs.filter((s) => {
            const key = `${s.title}|||${s.artist.join("|")}`;
            if (seen.has(key)) {
                addLog(
                    "warn",
                    `Duplicate removed: "${s.title}" — ${s.artist.join(", ")}`,
                );
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    // --- Remote function: add songs to existing library ---
    export async function addSongs() {
        if (!outputDir) {
            addLog("error", "No output directory selected.");
            return;
        }
        processing = true;
        done = false;
        log = [];
        try {
            // Load existing library if present
            let existing: Song[] = [];
            try {
                const fh = await outputDir.getFileHandle("library.json");
                const text = await readTextFile(fh);
                existing = JSON.parse(text);
                addLog(
                    "info",
                    `Loaded existing library with ${existing.length} songs.`,
                );
            } catch {
                addLog("info", "No existing library found — starting fresh.");
            }

            const coverIndex = { value: existing.length }; // Offset cover indices
            const newSongs: Song[] = [];
            for (const dir of songDirs) {
                const found = await parseFolder(dir, coverIndex);
                newSongs.push(...found);
            }

            const combined = deduplicate([...existing, ...newSongs]);
            await writeLibrary(combined);
            library = combined;
            addLog(
                "info",
                `Done. Library now has ${combined.length} songs (+${combined.length - existing.length} new).`,
            );
        } catch (e: any) {
            addLog("error", e.message);
        }
        processing = false;
        done = true;
    }

    // --- Remote function: overwrite the library entirely ---
    export async function overwriteLibrary() {
        if (!outputDir) {
            addLog("error", "No output directory selected.");
            return;
        }
        processing = true;
        done = false;
        log = [];
        try {
            const coverIndex = { value: 0 };
            const allSongs: Song[] = [];
            for (const dir of songDirs) {
                const found = await parseFolder(dir, coverIndex);
                allSongs.push(...found);
            }

            const deduped = deduplicate(allSongs);
            await writeLibrary(deduped);
            library = deduped;
            addLog(
                "info",
                `Done. Wrote ${deduped.length} songs to library.json.`,
            );
        } catch (e: any) {
            addLog("error", e.message);
        }
        processing = false;
        done = true;
    }

    async function upload() {
        processing = true;
        done = false;
        log = [];
        uploadCovers = true;
        pendingUploads = [];
        try {
            await fetch("/api/songs/cover/clear", {
                method: "DELETE",
                headers: { "QUEUE-AUTH": adminPWD },
            });

            const coverIndex = { value: 0 };
            const allSongs: Song[] = [];
            for (const dir of songDirs) {
                const found = await parseFolder(dir, coverIndex);
                allSongs.push(...found);
            }

            // Upload all collected covers in batches of 10
            await flushCoverUploads(batchSize);

            const deduped = deduplicate(allSongs);
            await uploadLibrary(deduped);
            library = deduped;
            addLog(
                "info",
                `Done. Wrote ${deduped.length} songs to library.json.`,
            );
        } catch (e: any) {
            addLog("error", e.message);
        }
        processing = false;
        done = true;
        uploadCovers = false;
    }

    function sleep(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function flushCoverUploads(chunkSize = 10) {
        const total = pendingUploads.length;
        if (total === 0) return;
        addLog(
            "info",
            `Uploading ${total} cover image(s) in chunks of ${chunkSize}…`,
        );

        for (let i = 0; i < total; i += chunkSize) {
            const chunk = pendingUploads.slice(i, i + chunkSize);
            await uploadChunkWithRetry(chunk, i, total);
            await sleep(200);
        }
        pendingUploads = [];
    }

    async function uploadChunkWithRetry(
        chunk: {
            name: string;
            file: File;
        }[],
        offset: number,
        total: number,
        minChunkSize = 1,
    ) {
        const encodeCovers = async (
            items: {
                name: string;
                file: File;
            }[],
        ) =>
            Promise.all(
                items.map(async ({ name, file }) => {
                    const bytes = new Uint8Array(await file.arrayBuffer());
                    let binary = "";
                    for (let j = 0; j < bytes.length; j++) {
                        binary += String.fromCharCode(bytes[j]);
                    }
                    return { name, data: btoa(binary) };
                }),
            );

        const uploadBatch = async (
            items: {
                name: string;
                file: File;
            }[],
            batchOffset: number,
        ) => {
            const covers = await encodeCovers(items);
            const response = await fetch("/api/songs/cover/batch", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "QUEUE-AUTH": adminPWD,
                },
                body: JSON.stringify({ covers }),
            });

            if (!response.ok) {
                const isTooLarge =
                    response.status === 413 ||
                    (response.status === 400 &&
                        (await response.text())
                            .toLowerCase()
                            .includes("too large"));

                if (isTooLarge && items.length > minChunkSize) {
                    const half = Math.ceil(items.length / 2);
                    const left = items.slice(0, half);
                    const right = items.slice(half);
                    addLog(
                        "warn",
                        `Chunk too large (${items.length} items) — retrying as two halves of ${left.length} + ${right.length}…`,
                    );
                    await uploadBatch(left, batchOffset);
                    await sleep(100);
                    await uploadBatch(right, batchOffset + left.length);
                    return;
                }

                addLog(
                    "error",
                    `Upload failed (HTTP ${response.status}) for items at offset ${batchOffset}`,
                );
            }

            const end = Math.min(batchOffset + items.length, total);
            addLog(
                "info",
                `Covers ${batchOffset + 1}–${end} of ${total} uploaded.`,
            );
        };

        await uploadBatch(chunk, offset);
    }

    async function writeLibrary(songs: Song[]) {
        if (!outputDir) throw new Error("No output directory");
        const fh = await outputDir.getFileHandle("library.json", {
            create: true,
        });
        const writable = await (fh as any).createWritable();
        await writable.write(JSON.stringify(songs, null, 2));
        await writable.close();
    }

    async function uploadLibrary(songs: Song[]) {
        await fetch("/api/songs", {
            body: JSON.stringify(songs),
            method: "POST",
            headers: { "QUEUE-AUTH": adminPWD },
        });
    }

    // --- Computed stats ---
    let totalDuration = $derived(
        library.reduce((acc, s) => acc + s.duration, 0),
    );
    let uniqueArtists = $derived(
        new Set(library.flatMap((s) => s.artist)).size,
    );

    function formatDuration(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
</script>

<div class="indexer overflow-y-auto">
    <header>
        <h1>Song library indexer</h1>
        <p class="subtitle">
            Index UltraStar-format songs and export a <code>library.json</code>
        </p>
    </header>

    <!-- Step 1: Directories -->
    <section class="card">
        <h2>1. Source directories</h2>
        <p class="hint">
            Add one or more folders containing song subdirectories.
        </p>

        <div class="dir-list">
            {#each songDirs as dir, i}
                <div class="dir-row">
                    <i class="ti ti-folder-music"></i>
                    <span>{dir.name}</span>
                    <button
                        class="ghost-sm"
                        title="Remove"
                        onclick={() => removeSongDir(i)}
                    >
                        <i class="ti ti-x"></i>
                    </button>
                </div>
            {/each}
            {#if songDirs.length === 0}
                <p class="empty">No source directories added yet.</p>
            {/if}
        </div>

        <button class="add-btn" onclick={pickSongDir}>
            <i class="ti ti-folder-plus"></i> Add source directory
        </button>
    </section>

    <!-- Step 2: Output -->
    <section class="card">
        <h2>2. Output</h2>
        <div class="output-row">
            <div class="output-item">
                <span class="label">Library output folder</span>
                <button class="pick-btn" onclick={pickOutputDir}>
                    <i class="ti ti-folder"></i>
                    {outputDir ? outputDir.name : "Choose folder…"}
                </button>
                <span class="hint-sm"
                    >Where <code>library.json</code> is written</span
                >
            </div>
            <div class="output-item">
                <span class="label"
                    >Cover image folder <span class="optional">(optional)</span
                    ></span
                >
                <button class="pick-btn" onclick={pickCoverDir}>
                    <i class="ti ti-photo"></i>
                    {coverDir ? coverDir.name : "Choose folder…"}
                </button>
                <span class="hint-sm"
                    >Covers are copied here as <code>cover-N.ext</code></span
                >
            </div>
        </div>
    </section>

    <!-- Step 3: Actions -->
    <section class="card actions-card">
        <h2>3. Run</h2>
        <div class="action-row">
            <div class="action-block">
                <button
                    class="action-btn primary"
                    onclick={overwriteLibrary}
                    disabled={processing || songDirs.length === 0 || !outputDir}
                >
                    {#if processing}
                        <i class="ti ti-loader-2 spin"></i> Processing…
                    {:else}
                        <i class="ti ti-replace"></i> Overwrite library
                    {/if}
                </button>
                <span class="action-hint"
                    >Scans all sources and writes a fresh <code
                        >library.json</code
                    ></span
                >
            </div>
            <div class="divider-v"></div>
            <div class="action-block">
                <button
                    class="action-btn"
                    onclick={addSongs}
                    disabled={processing || songDirs.length === 0 || !outputDir}
                >
                    {#if processing}
                        <i class="ti ti-loader-2 spin"></i> Processing…
                    {:else}
                        <i class="ti ti-plus"></i> Add songs
                    {/if}
                </button>
                <span class="action-hint"
                    >Merges new songs into the existing library without
                    duplicates</span
                >
            </div>
        </div>
        <div class="action-row mt-1">
            <div class="action-block">
                <button
                    class="action-btn primary"
                    onclick={upload}
                    disabled={processing || songDirs.length === 0}
                >
                    {#if processing}
                        <i class="ti ti-loader-2 spin"></i> Processing…
                    {:else}
                        <i class="ti ti-replace"></i> Upload library
                    {/if}
                </button>
                <span class="action-hint"
                    >Scans all sources and overwrites the servers<code
                        >library.json</code
                    > and cover images</span
                >
            </div>
            <div class="divider-v"></div>
            <div class="action-block">
                <input
                    type="number"
                    class="action-btn primary"
                    bind:value={batchSize}
                />
                <span class="action-hint"
                    >Batch Size (number of images to bundle while uploading)</span
                >
            </div>
        </div>
        <div class="action-row mt-1">
            <div class="action-block">
                <input
                    type="password"
                    class="action-btn primary"
                    bind:value={adminPWD}
                />
                <span class="action-hint"
                    >Admin Password. Needed when uploading to server. Will fail
                    if not correct.</span
                >
            </div>
        </div>
    </section>

    <!-- Results -->
    {#if library.length > 0}
        <section class="card">
            <h2>Library</h2>
            <div class="stats-row">
                <div class="stat">
                    <span class="stat-val">{library.length}</span>
                    <span class="stat-label">songs</span>
                </div>
                <div class="stat">
                    <span class="stat-val">{uniqueArtists}</span>
                    <span class="stat-label">artists</span>
                </div>
                <div class="stat">
                    <span class="stat-val">{formatDuration(totalDuration)}</span
                    >
                    <span class="stat-label">total</span>
                </div>
            </div>
            <div class="song-list">
                {#each library as song}
                    <div class="song-row">
                        {#if song.cover_image}
                            <img
                                src={song.cover_image.startsWith("data:")
                                    ? song.cover_image
                                    : ""}
                                alt=""
                                class="thumb"
                            />
                        {:else}
                            <div class="thumb placeholder">
                                <i class="ti ti-music"></i>
                            </div>
                        {/if}
                        <div class="song-info">
                            <span class="song-title">{song.title}</span>
                            <span class="song-artist"
                                >{song.artist.join(", ")}</span
                            >
                        </div>
                        <span class="song-dur"
                            >{formatDuration(song.duration)}</span
                        >
                    </div>
                {/each}
            </div>
        </section>
    {/if}

    <!-- Log -->
    {#if log.length > 0}
        <section class="log-section">
            <h2>Log</h2>
            <div class="log">
                {#each log as entry}
                    <div class="log-line {entry.type}">
                        <i
                            class="ti {entry.type === 'error'
                                ? 'ti-alert-circle'
                                : entry.type === 'warn'
                                  ? 'ti-alert-triangle'
                                  : 'ti-info-circle'}"
                        ></i>
                        {entry.msg}
                    </div>
                {/each}
            </div>
        </section>
    {/if}
</div>

<style>
    .indexer {
        max-width: 720px;
        margin: 0 auto;
        padding: 2rem 1rem;
        font-family: var(--font-sans, system-ui, sans-serif);
        color: var(--color-text-primary, #1a1a1a);
    }

    header {
        margin-bottom: 2rem;
    }
    header h1 {
        font-size: 1.5rem;
        font-weight: 600;
        margin: 0 0 0.25rem;
    }
    .subtitle {
        color: var(--color-text-secondary, #666);
        font-size: 0.9rem;
        margin: 0;
    }

    .card {
        background: var(--color-background-primary, #fff);
        border: 0.5px solid var(--color-border-tertiary, #e0e0e0);
        border-radius: 12px;
        padding: 1.25rem 1.5rem;
        margin-bottom: 1rem;
    }

    .card h2 {
        font-size: 0.85rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--color-text-secondary, #888);
        margin: 0 0 0.75rem;
    }

    .hint {
        font-size: 0.875rem;
        color: var(--color-text-secondary, #888);
        margin: 0 0 1rem;
    }
    .hint-sm {
        font-size: 0.78rem;
        color: var(--color-text-tertiary, #aaa);
    }
    .optional {
        font-weight: 400;
        opacity: 0.7;
    }

    code {
        font-family: var(--font-mono, monospace);
        font-size: 0.82em;
        background: var(--color-background-secondary, #f5f5f5);
        padding: 1px 4px;
        border-radius: 4px;
    }

    /* Directory list */
    .dir-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 0.75rem;
    }

    .dir-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        background: var(--color-background-secondary, #f9f9f9);
        border-radius: 8px;
        font-size: 0.875rem;
    }

    .dir-row span {
        flex: 1;
    }

    .empty {
        font-size: 0.875rem;
        color: var(--color-text-tertiary, #bbb);
        margin: 0;
    }

    .add-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        font-size: 0.875rem;
        border: 0.5px solid var(--color-border-secondary, #d0d0d0);
        border-radius: 8px;
        background: transparent;
        cursor: pointer;
        color: var(--color-text-primary, #1a1a1a);
        transition: background 0.12s;
    }
    .add-btn:hover {
        background: var(--color-background-secondary, #f5f5f5);
    }

    .ghost-sm {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--color-text-tertiary, #bbb);
        padding: 2px 4px;
        border-radius: 4px;
        display: flex;
        align-items: center;
    }
    .ghost-sm:hover {
        color: var(--color-text-primary, #1a1a1a);
    }

    /* Output */
    .output-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
    }
    @media (max-width: 520px) {
        .output-row {
            grid-template-columns: 1fr;
        }
    }

    .output-item {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .label {
        font-size: 0.82rem;
        font-weight: 500;
        color: var(--color-text-secondary, #666);
    }

    .pick-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        font-size: 0.875rem;
        border: 0.5px solid var(--color-border-secondary, #d0d0d0);
        border-radius: 8px;
        background: transparent;
        cursor: pointer;
        color: var(--color-text-primary, #1a1a1a);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
        transition: background 0.12s;
    }
    .pick-btn:hover {
        background: var(--color-background-secondary, #f5f5f5);
    }

    /* Actions */
    .action-row {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        gap: 1rem;
        align-items: start;
    }
    @media (max-width: 520px) {
        .action-row {
            grid-template-columns: 1fr;
        }
    }

    .action-block {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .action-hint {
        font-size: 0.8rem;
        color: var(--color-text-tertiary, #aaa);
    }

    .divider-v {
        width: 0.5px;
        background: var(--color-border-tertiary, #e0e0e0);
        align-self: stretch;
        margin-top: 4px;
    }

    .action-btn {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 10px 18px;
        font-size: 0.9rem;
        font-weight: 500;
        border: 0.5px solid var(--color-border-secondary, #d0d0d0);
        border-radius: 8px;
        background: transparent;
        cursor: pointer;
        color: var(--color-text-primary, #1a1a1a);
        transition:
            background 0.12s,
            opacity 0.12s;
    }
    .action-btn.primary {
        background: var(--color-text-primary, #1a1a1a);
        color: var(--color-background-primary, #fff);
        border-color: transparent;
    }
    .action-btn.primary:hover:not(:disabled) {
        opacity: 0.85;
    }
    .action-btn:hover:not(:disabled):not(.primary) {
        background: var(--color-background-secondary, #f5f5f5);
    }
    .action-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
    .spin {
        display: inline-block;
        animation: spin 0.8s linear infinite;
    }

    /* Stats */
    .stats-row {
        display: flex;
        gap: 1.5rem;
        margin-bottom: 1rem;
        padding-bottom: 1rem;
        border-bottom: 0.5px solid var(--color-border-tertiary, #e0e0e0);
    }
    .stat {
        display: flex;
        flex-direction: column;
    }
    .stat-val {
        font-size: 1.4rem;
        font-weight: 600;
    }
    .stat-label {
        font-size: 0.78rem;
        color: var(--color-text-secondary, #888);
    }

    /* Song list */
    .song-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
        max-height: 360px;
        overflow-y: auto;
    }

    .song-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 4px;
        border-radius: 6px;
        font-size: 0.875rem;
    }
    .song-row:hover {
        background: var(--color-background-secondary, #f9f9f9);
    }

    .thumb {
        width: 36px;
        height: 36px;
        border-radius: 4px;
        object-fit: cover;
        flex-shrink: 0;
        background: var(--color-background-secondary, #f0f0f0);
    }
    .thumb.placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-text-tertiary, #ccc);
        font-size: 16px;
    }

    .song-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
    }
    .song-title {
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .song-artist {
        font-size: 0.8rem;
        color: var(--color-text-secondary, #888);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .song-dur {
        font-size: 0.8rem;
        color: var(--color-text-tertiary, #aaa);
        flex-shrink: 0;
    }

    /* Log */
    .log-section {
        margin-top: 0.5rem;
    }
    .log-section h2 {
        font-size: 0.85rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--color-text-secondary, #888);
        margin: 0 0 0.5rem;
    }

    .log {
        background: var(--color-background-secondary, #f5f5f5);
        border-radius: 8px;
        padding: 0.75rem 1rem;
        max-height: 200px;
        overflow-y: auto;
        font-size: 0.8rem;
        font-family: var(--font-mono, monospace);
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .log-line {
        display: flex;
        align-items: center;
        gap: 7px;
    }
    .log-line.info {
        color: var(--color-text-secondary, #555);
    }
    .log-line.warn {
        color: #b07d00;
    }
    .log-line.error {
        color: #c0392b;
    }
</style>
