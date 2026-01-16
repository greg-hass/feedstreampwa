<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let timeFilter = "all"; // all, today, 24h, week

  const dispatch = createEventDispatcher();

  function setFilter(filter: string) {
    dispatch("change", filter);
  }
</script>

<div class="filter-segment" role="group" aria-label="Time filter">
  <button
    class="segment"
    class:active={timeFilter === "all"}
    aria-pressed={timeFilter === "all"}
    on:click={() => setFilter("all")}>All</button
  >
  <button
    class="segment"
    class:active={timeFilter === "today"}
    aria-pressed={timeFilter === "today"}
    on:click={() => setFilter("today")}>Today</button
  >
  <button
    class="segment"
    class:active={timeFilter === "24h"}
    aria-pressed={timeFilter === "24h"}
    on:click={() => setFilter("24h")}>24h</button
  >
  <button
    class="segment"
    class:active={timeFilter === "week"}
    aria-pressed={timeFilter === "week"}
    on:click={() => setFilter("week")}>Week</button
  >
</div>

<style>
  .filter-segment {
    display: flex;
    gap: 0;
    padding: 4px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    margin-bottom: 0;
  }

  .segment {
    flex: 1 1 0;
    min-width: 0;
    padding: 8px 10px;
    background: transparent;
    border: none;
    border-radius: 999px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: center;
    white-space: nowrap;
  }

  .segment:hover {
    color: white;
  }

  .segment.active {
    background: var(--accent-color);
    color: white;
    box-shadow: 0 6px 14px rgba(0, 0, 0, 0.25);
  }

  /* Mobile Filter Chips */
  @media (max-width: 768px) {
    .filter-segment {
      margin: 0 8px;
      padding: 3px;
    }

    .segment {
      height: 36px;
      font-size: 13px;
    }
  }
</style>
