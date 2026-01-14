<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let timeFilter = "all"; // all, today, 24h, week

  const dispatch = createEventDispatcher();

  function setFilter(filter: string) {
    dispatch("change", filter);
  }
</script>

<div class="filter-chips">
  <button
    class="chip"
    class:active={timeFilter === "all"}
    on:click={() => setFilter("all")}>All</button
  >
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
</div>

<style>
  .filter-chips {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    padding: 0;
    margin-bottom: 0;
  }

  .chip {
    padding: 10px 16px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
    text-align: center;
    white-space: nowrap;
  }

  .chip:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border-color: rgba(255, 255, 255, 0.3);
  }

  .chip.active {
    background: var(--accent-color);
    color: white;
    border-color: var(--accent-color);
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  /* Mobile Filter Chips */
  @media (max-width: 768px) {
    .filter-chips {
      gap: 6px;
      padding: 0 8px; /* Match reduced mobile padding */
      margin-bottom: 0; /* No bottom margin when sticky */
      overflow-x: auto;
      overflow-y: visible;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none; /* Hide scrollbar */
      position: relative;
      z-index: 1;
    }

    .chip {
      height: 36px;
      padding: 0 8px;
      font-size: 13px;
      font-weight: 600;
    }
  }
</style>
