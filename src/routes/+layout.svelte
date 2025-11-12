<script lang="ts">
    import "../app.css";
    import favicon from "$lib/assets/favicon.svg";

    let { children } = $props();
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
</svelte:head>

<main class="w-lvw h-lvh">
    {@render children()}
</main>

<style>
    main {
        background: linear-gradient(120deg, #f6d365 0%, #fda085 100%);
    }

    :global(*) {
        box-sizing: border-box;
    }
</style>
