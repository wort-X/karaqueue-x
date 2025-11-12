<script>
    import H1 from "$lib/components/H1.svelte";
    import Queue from "$lib/components/Queue.svelte";
    import SongList from "$lib/components/SongList.svelte";

    let filter = $state("");
</script>

<div class="p-3 overflow-scroll h-full">
    <H1 class="mx-auto w-fit pb-6">Karaoke Warteschlange</H1>

    <input
        type="text"
        bind:value={filter}
        placeholder="Songs filtern"
        class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-1/3 p-2.5 mx-auto"
    />

    <div class="my-6 flex flex-col lg:flex-row">
        <Queue />
        <SongList {filter} />
    </div>
</div>
