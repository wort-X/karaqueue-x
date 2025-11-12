<script lang="ts">
    import type { TSong, TSongs } from "$lib/data.svelte";
    import { onMount } from "svelte";

    function make_duration_format(seconds: number): string {
        let minutes = 0;
        while (seconds >= 60) {
            minutes++;
            seconds -= 60;
        }

        return `${minutes}:${seconds}`;
    }

    let { filter }: { filter: string } = $props();
    let page = $state(0);

    let songObj: { songs: TSongs; pages: number } = $state({
        pages: 0,
        songs: [],
    });

    onMount(async () => {
        songObj = await (
            await fetch(
                `/api/songs?page_index=${page}&page_size=20&filter=${filter}`,
            )
        ).json();
    });

    $effect(() => {
        async function doStuff() {
            songObj = await (
                await fetch(
                    `/api/songs?page_index=${page}&page_size=20&filter=${filter}`,
                )
            ).json();
        }

        doStuff();
    });

    // let gSongs = getSongs({
    //     filter: filter,
    //     page_index: 0,
    //     page_size: 20,
    // });

    // $effect(() => {
    //     getSongs({
    //         filter: filter,
    //         page_index: page,
    //         page_size: 20,
    //     }).refresh();
    // });

    $effect(() => {
        if (page >= songObj.pages || page < 0) {
            page = 0;
        }
    });

    const addToQueue = async (song: TSong) => {
        console.log("Added to queue");
        fetch("/api/queue", {
            method: "POST",
            body: JSON.stringify({
                song: song,
                requestor: "dummy",
            }),
        });
    };
</script>

<table class="rounded-[1.4rem] bg-white border-collapse max-w-2/3 mx-auto">
    <thead class="bg-[#fda085] text-white text-2xl text-left p-2">
        <tr>
            <th class="pl-2">Title</th>
            <th class="pl-2">Artist</th>
            <th class="pl-2">Duration</th>
            <th class="pl-2"></th>
        </tr>
    </thead>
    <tbody>
        {#each songObj.songs as song}
            <tr class="text-lg h-12">
                <td class="pl-2">{song.title}</td>
                <td class="pl-2">{song.artist}</td>
                <td class="pl-2">{make_duration_format(song.duration)}</td>
                <td
                    ><button onclick={async () => await addToQueue(song)}
                        >Add to queue</button
                    ></td
                >
            </tr>
        {/each}
    </tbody>
    <tfoot>
        <tr>
            <td><button onclick={() => page--}>Previous</button></td><td
                >{page + 1}/{songObj.pages}</td
            ><td><button onclick={() => page++}>Next</button></td></tr
        ></tfoot
    >
</table>

<style>
    tr:nth-child(2n) {
        background-color: #fdf6e0;
    }
</style>
