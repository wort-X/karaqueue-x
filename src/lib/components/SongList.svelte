<script lang="ts">
    import type { TSong, TSongs } from "$lib/server/data.svelte";
    import { onMount } from "svelte";
    import H2 from "./H2.svelte";
    import SongDisplay from "./SongDisplay.svelte";

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

    $effect(() => {
        if (page >= songObj.pages || page < 0) {
            page = 0;
        }
    });

    const addToQueue = async (song: TSong, requestor: string) => {
        fetch("/api/queue", {
            method: "POST",
            body: JSON.stringify({
                song: song,
                requestor: requestor,
            }),
        });
        modal.close();
    };

    const openModal = (song: TSong) => {
        modalSong = song;
        modal.showModal();
    };

    let modal: HTMLDialogElement;
    let modalSong: TSong | undefined = $state(undefined);
    let nick: string = $state("Gustav");
</script>

<div>
    <table
        class="rounded-[1.4rem] bg-white border-collapse w-fit md:max-w-4/5 mx-auto"
    >
        <thead class="bg-[#fda085] text-white text-2xl text-left p-2">
            <tr>
                <th class="pl-2"></th>
                <th class="pl-2">Title</th>
                <th class="pl-2">Artist</th>
                <th class="pl-2">Duration</th>
                <th class="pl-2"></th>
            </tr>
        </thead>
        <tbody>
            {#each songObj.songs as song}
                <tr onclick={() => openModal(song)} class="text-lg">
                    <td
                        ><img
                            loading="lazy"
                            class="w-12 m-2 rounded-sm hidden md:inline"
                            src="/api/songs/cover/{song.cover_image}"
                            alt=" "
                        /></td
                    >
                    <td class="pl-2">{song.title}</td>
                    <td class="pl-2">{song.artist}</td>
                    <td class="pl-2 text-center"
                        >{make_duration_format(song.duration)}</td
                    >
                    <td class="hidden md:inline"
                        ><button
                            class="prim cursor-pointer px-1 py-2 rounded-2xl text-white text-xl mx-1 my-1"
                            onclick={() => openModal(song)}>Add to queue</button
                        ></td
                    >
                </tr>
            {/each}
        </tbody>
    </table>
    <div
        class="grid grid-cols-5 w-fit gap-2 mx-auto my-2 text-center bg-white p-4 rounded-2xl"
    >
        <button
            class="cursor-pointer hover:bg-gray-300 px-2 py-1 rounded-2xl transition-all"
            onclick={() => (page = 0)}>Start</button
        >
        <button
            class="cursor-pointer hover:bg-gray-300 px-2 py-1 rounded-2xl transition-all"
            onclick={() => page--}>Previous</button
        >
        <span class="my-auto">
            {page + 1}/{songObj.pages}
        </span>
        <button
            class="cursor-pointer hover:bg-gray-300 px-2 py-1 rounded-2xl transition-all"
            onclick={() => page++}>Next</button
        >
        <button
            class="cursor-pointer hover:bg-gray-300 px-2 py-1 rounded-2xl transition-all"
            onclick={() => (page = songObj.pages - 1)}>End</button
        >
    </div>

    <dialog bind:this={modal}>
        <button
            class="absolute right-1 top-1 bg-red-400 px-3 py-1 rounded-4xl text-white"
            onclick={() => modal.close()}>X</button
        >
        <H2 class="text-center">Add Song to Queue</H2>
        {#if modalSong != undefined}
            <SongDisplay song={modalSong!} cover={true} />
        {/if}
        <input
            type="text"
            class=" mt-4 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block min-w-2/3 p-2.5 mx-auto"
            bind:value={nick}
        />

        <button
            onclick={async () => await addToQueue(modalSong!, nick)}
            class="prim cursor-pointer px-1 py-2 rounded-2xl text-white text-xl min-w-20 mt-4"
            >Add</button
        >
    </dialog>
</div>

<style>
    tr:nth-child(2n) {
        background-color: #fdf6e0;
    }

    .prim {
        background: linear-gradient(90deg, #f6d365 0%, #fda085 100%);
    }

    dialog {
        border: 4px solid #fda085;
        border-radius: 1rem;
        padding: 1rem;
        position: absolute;
        width: 30rem;
        min-height: 20rem;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }
</style>
