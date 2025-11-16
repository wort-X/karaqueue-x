<script lang="ts">
    import type { TSong } from "$lib/server/data.svelte";

    const { song, cover = false }: { song: TSong; cover?: boolean } = $props();
</script>

<div>
    {#if cover}
        <img
            class="w-40 aspect-square mx-auto border-4 border-solid border-[#ddbd5c] rounded-2xl"
            src={`/api/songs/cover/${song.cover_image}`}
            alt={`Cover Image of ${song.title} by ${song.artist}`}
        />
    {/if}
    <p class="w-full text-center my-1 leading-tight">
        <span class="font-bold">{song.title}</span>
        <br />
        <span class="text-gray-600">by&NonBreakingSpace;</span><span
            class="text-[#e39077]">{song.artist}</span
        ><br />
    </p>
</div>
