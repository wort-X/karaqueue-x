<script lang="ts">
    import { onMount } from "svelte";
    import H2 from "./H2.svelte";
    import type { SongQueue } from "$lib/data.svelte";

    let queue: SongQueue = $state([]);

    onMount(async () => {
        queue = await (await fetch("/api/queue")).json();

        setInterval(async () => {
            queue = await (await fetch("/api/queue")).json();
        }, 5000);
    });

    const currently = $derived(queue.length == 0 ? null : queue[0]);
    const rest = $derived(queue.slice(1));
</script>

<div class="mx-auto bg-white rounded-3xl p-5">
    <H2>Curently playing</H2>

    {#if currently == null}
        <p>Currently no song is queued</p>
    {:else}
        <div>
            <p>
                <span>{currently.song.title}</span><span
                    >by {currently.song.artist}</span
                ><br /><span>({currently.requestor})</span>
            </p>
        </div>
    {/if}

    <span class="w-4/5 bg-gray-500 h-px"></span>

    {#each rest as r}
        <div>
            <p>
                <span>{r.song.title}</span><span>by {r.song.artist}</span><br
                /><span>({r.requestor})</span>
            </p>
        </div>
    {/each}
</div>
