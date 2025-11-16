<script lang="ts">
    import { onMount } from "svelte";
    import H2 from "./H2.svelte";
    import type { SongQueue } from "$lib/server/data.svelte";
    import SongDisplay from "./SongDisplay.svelte";

    let queue: SongQueue = $state([]);

    onMount(async () => {
        queue = await (await fetch("/api/queue")).json();

        setInterval(async () => {
            queue = await (await fetch("/api/queue")).json();
        }, 500);
    });

    const currently = $derived(queue.length == 0 ? null : queue[0]);
    const rest = $derived(queue.slice(1));
</script>

<div class="mx-auto bg-white rounded-3xl p-5">
    <H2 class="text-center">Curently playing</H2>

    {#if currently == null}
        <p class="text-center">Currently no song is queued</p>
    {:else}
        <SongDisplay song={currently.song} cover={true} />
        <p class="italic text-right text-gray-500">({currently.requestor})</p>
    {/if}

    <div class="w-4/5 bg-gray-500 h-0.5 mx-auto"></div>

    <div class="max-h-[50vh] overflow-x-auto">
        {#each rest as r}
            <SongDisplay song={r.song} />
            <p class="italic text-right text-gray-500">({r.requestor})</p>
        {/each}
    </div>
</div>
