<script lang="ts">
    import { browser } from "$app/environment";
    import H1 from "$lib/components/H1.svelte";
    import H2 from "$lib/components/H2.svelte";
    import Queue from "$lib/components/Queue.svelte";

    const nextSong = async () => {
        fetch("/api/queue", { method: "DELETE" });
    };
    const clear = async () => {
        fetch("/api/queue", { method: "DELETE", body: "clear" });
    };

    let canIndex = () => browser && "showDirectoryPicker" in window;
</script>

<div class="p-3 md:w-1/2 mx-auto">
    <H1 class="mx-auto pb-6 w-full text-center">Warteschlangen Admin</H1>

    <div class="bg-white rounded-2xl w-fit mx-auto p-1">
        <button
            class="cursor-pointer bg-red-500 px-2 py-1 rounded-2xl text-white text-xl ml-1 my-1"
            onclick={async () => await clear()}>Clear</button
        >
        <button
            class="cursor-pointer bg-lime-500 px-2 py-1 rounded-2xl text-white text-xl mx-2 my-1"
            onclick={async () => await nextSong()}>NextSong</button
        >
    </div>
    <div class="h-4">&NonBreakingSpace;</div>
    <Queue />
    <div class="h-4">&NonBreakingSpace;</div>

    <div class="bg-white rounded-2xl w-fit mx-auto p-1">
        <H2>Update Song List</H2>
        {#if canIndex()}
            <a
                class="cursor-pointer bg-blue-500 px-2 py-1 rounded-2xl text-white text-xl ml-1 my-1"
                href="/admin/index">Index Songs</a
            >
        {:else}
            <p>Note: Only working on chromium based browsers</p>
        {/if}
    </div>
</div>
