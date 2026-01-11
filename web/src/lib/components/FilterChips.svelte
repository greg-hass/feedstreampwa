<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let timeFilter = "today"; // today, 24h, week, all

  const dispatch = createEventDispatcher();

  function setFilter(filter: string) {
    dispatch("change", filter);
  }
</script>

<div class="filter-chips">
  <button
    class="chip"
    class:active={timeFilter === "today"}
    on:click={() => setFilter("today")}>Today</button
  >
  <button
    class="chip"
    class:active={timeFilter === "24h"}
    on:click={() => setFilter("24h")}>Last 24h</button
  >
  <button
    class="chip"
    class:active={timeFilter === "week"}
    on:click={() => setFilter("week")}>Week</button
  >
  <button
    class="chip"
    class:active={timeFilter === "all"}
    on:click={() => setFilter("all")}>All</button
  >
</div>

<style>
  .filter-chips {
    display: flex;
    gap: 8px;
    padding: 0;
    margin-bottom: 20px;
  }

  .chip {
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 999px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .chip:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border-color: rgba(255, 255, 255, 0.3);
  }

  .chip.active {
    background: white;
    color: black;
    border-color: white;
    font-weight: 600;
  }

  /* Mobile Filter Chips */
  @media (max-width: 768px) {
    .filter-chips {
      gap: 8px;
      padding: 0 16px; /* Match mobile padding var */
      margin-bottom: 16px;
      overflow-x: auto;
      overflow-y: visible;
      flex-wrap: nowrap;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none; /* Hide scrollbar */
      position: relative;
      z-index: 1;
      display: flex !important;
    }

    .chip {
      height: 36px;
      padding: 0 16px;
      font-size: 15px;
      font-weight: 600;
      min-width: auto;
      white-space: nowrap; /* Prevent text wrapping */
      flex-shrink: 0; /* Prevent pills from squashing */
    }
  }
</style>
