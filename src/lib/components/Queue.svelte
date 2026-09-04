<script lang="ts">
    import { onMount } from "svelte";
    import H2 from "./H2.svelte";
    import type { SongQueue, TSong } from "$lib/server/data.svelte";
    import SongDisplay from "./SongDisplay.svelte";

    let queue: SongQueue = $state({song_requests: [], song_start: new Date().getTime()});

    onMount(async () => {
        queue = await (await fetch("/api/queue")).json();

        setInterval(async () => {
            queue = await (await fetch("/api/queue")).json();
        }, 1000);
    });

    const currently = $derived(queue.song_requests.length == 0 ? null : queue.song_requests[0]);
    const rest = $derived(queue.song_requests.slice(1));

    function deriveTimings(songs: {song: TSong}[]): number[] {
        let summed_durations: number[] = [];
        let summed_duration = 0;
        for (const song_request of songs) {
            const song = song_request.song;
            summed_duration += song.duration;
            summed_durations.push(summed_duration);
        }
        return summed_durations;
    }

    function renderStartTime(duration: number): string {
        const instantOfStart = queue.song_start + duration * 1000;
        const dateOfStart = new Date(instantOfStart);
        return `${dateOfStart.getHours().toString().padStart(2, '0')}:${dateOfStart.getMinutes().toString().padStart(2, '0')}`;
    }

    const summedDurations = $derived(deriveTimings(queue.song_requests));
</script>

<div class="mx-auto bg-white rounded-3xl p-5 max-h-full">
    <H2 class="text-center">Currently playing</H2>

    {#if currently == null}
        <p class="text-center">Currently no song is queued</p>
    {:else}
        <SongDisplay song={currently.song} cover={true} />
        <p class="italic text-right text-gray-500">({currently.requestor})</p>
    {/if}

    <div class="w-4/5 bg-gray-500 h-0.5 mx-auto"></div>

    <div class="max-h-[50vh] h-auto overflow-x-auto">
        {#each rest as r, i}
            <SongDisplay song={r.song} />
            <div class="columns-2">
                <div class="left-0 text-left text-gray-500">starts at {renderStartTime(summedDurations[i])}</div>
                <div class="right-0 text-right text-gray-500">({r.requestor})</div>
            </div>
        {/each}
    </div>
</div>
