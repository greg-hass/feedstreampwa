<script lang="ts">
  import { Sparkles, Loader2, AlertCircle, Trash2 } from "lucide-svelte";
  import { onMount } from "svelte";

  interface Rule {
    id: string;
    name?: string;
    keyword: string;
    field: string;
    action: string;
    feed_url?: string;
  }

  export let rules: Rule[] = [];
  export let rulesLoading = false;
  export let rulesError: string | null = null;
  export let loadRules: () => Promise<void>;
  export let handleCreateRule: () => Promise<void>;
  export let handleDeleteRule: (id: string) => Promise<void>;
  export let newRule = { keyword: "", field: "title", action: "mark_read", name: "" };

  onMount(() => {
    loadRules();
  });
</script>

<div class="space-y-6">
  {#if rulesLoading}
    <div class="flex items-center justify-center py-12">
      <div class="flex items-center gap-3 text-white/60">
        <Loader2 size={24} class="animate-spin" />
        <span>Loading rules...</span>
      </div>
    </div>
  {:else if rulesError}
    <div class="flex flex-col items-center justify-center py-12 text-center">
      <div class="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
        <AlertCircle size={32} class="text-red-400" />
      </div>
      <h3 class="text-lg font-semibold text-white mb-2">Failed to Load</h3>
      <p class="text-white/50 mb-4 max-w-md">{rulesError}</p>
      <button
        on:click={loadRules}
        class="px-4 py-2 rounded-xl bg-accent hover:bg-accent/80 text-white font-medium transition-colors"
      >
        Retry
      </button>
    </div>
  {:else}
    <!-- Create Rule Form -->
    <div class="bg-white/5 p-4 rounded-xl space-y-4 border border-white/5">
      <h3 class="text-sm font-medium text-white flex items-center gap-2">
        <Sparkles size={14} /> Create New Rule
      </h3>
      <div class="grid grid-cols-2 gap-4">
        <input
          bind:value={newRule.keyword}
          placeholder="Keyword (e.g. 'Sponsor')"
          class="bg-black/20 border border-white/10 rounded-lg p-2 text-white text-sm focus:border-accent outline-none"
        />
        <input
          bind:value={newRule.name}
          placeholder="Rule Name (Optional)"
          class="bg-black/20 border border-white/10 rounded-lg p-2 text-white text-sm focus:border-accent outline-none"
        />
      </div>
      <div class="grid grid-cols-3 gap-4">
        <select
          bind:value={newRule.field}
          class="bg-black/20 border border-white/10 rounded-lg p-2 text-white text-sm focus:border-accent outline-none"
        >
          <option value="title">Title</option>
          <option value="content">Content</option>
          <option value="author">Author</option>
          <option value="any">Anywhere</option>
        </select>
        <select
          bind:value={newRule.action}
          class="bg-black/20 border border-white/10 rounded-lg p-2 text-white text-sm focus:border-accent outline-none"
        >
          <option value="mark_read">Mark Read</option>
          <option value="star">Star</option>
          <option value="delete">Skip/Delete</option>
        </select>
        <button
          on:click={handleCreateRule}
          class="bg-accent text-white rounded-lg p-2 text-sm font-medium hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20"
          >Add Rule</button
        >
      </div>
    </div>

    <!-- Rules List -->
    <div class="space-y-3">
      <h3 class="text-xs font-medium text-white/40 uppercase tracking-wider">Active Rules</h3>
      {#if rules.length === 0}
        <div class="text-white/30 text-center py-8 text-sm italic border border-white/5 rounded-xl border-dashed">
          No rules defined. Add one above!
        </div>
      {:else}
        {#each rules as rule}
          <div
            class="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 group hover:border-white/10 transition-colors"
          >
            <div class="flex flex-col">
              <span class="text-white text-sm font-medium">{rule.name || rule.keyword}</span>
              <span class="text-white/40 text-xs mt-0.5">
                If <span class="text-white/60">{rule.field}</span>
                contains "<span class="text-white/60">{rule.keyword}</span>" →
                <span class="text-accent/80 font-medium uppercase text-[10px]">{rule.action.replace("_", " ")}</span>
              </span>
            </div>
            <button
              on:click={() => handleDeleteRule(rule.id)}
              class="text-white/20 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-lg transition-colors"
              ><Trash2 size={16} /></button
            >
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>
