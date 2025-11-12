<script lang="ts">
    let props = $props();
</script>

<h1 {...props} class={"font-bold text-3xl text-[#333] " + props.class}>
    {@render props.children?.()}
</h1>
