<script lang="ts">
  import { Database, WifiOff } from "lucide-svelte";

  export let size: "sm" | "md" = "sm";
  export let showText = true;

  const sizeClasses = {
    sm: "text-[10px] px-1.5 py-0.5 gap-1",
    md: "text-xs px-2 py-1 gap-1.5",
  };

  const iconSize = {
    sm: 10,
    md: 12,
  };
</script>

<div
  class="inline-flex items-center rounded-full bg-accent/10 border border-accent/20 text-accent font-medium {sizeClasses[
    size
  ]}"
  title="Saved for offline reading"
>
  <Database size={iconSize[size]} />
  {#if showText}
    <span>Offline</span>
  {/if}
</div>
