<script lang="ts">
  import {
    X,
    Copy,
    Trash2,
    CheckCircle2,
    AlertCircle,
    Eye,
    EyeOff,
    Settings2,
    RefreshCw,
  } from "lucide-svelte";
  import {
    duplicates,
    duplicateSettings,
    duplicateCount,
    duplicateGroupCount,
    getPreferredItem,
    type DuplicateSettings,
  } from "$lib/stores/duplicates";
  import { items } from "$lib/stores/items";
  import { toggleRead } from "$lib/stores/items";
  import { toast } from "$lib/stores/toast";

  export let isOpen = false;

  let showSettings = false;
  let scanning = false;

  function closeModal() {
    isOpen = false;
  }

  async function scanForDuplicates() {
    scanning = true;
    try {
      // Small delay for UI feedback
      await new Promise((resolve) => setTimeout(resolve, 300));
      duplicates.scan($items);
    } catch (e) {
      console.error("Error scanning for duplicates:", e);
      toast.error("Failed to scan for duplicates");
    } finally {
      scanning = false;
    }
  }

  function getDeduplicationCount(): number {
    const total = $duplicateCount;
    const groups = $duplicateGroupCount;
    return total - groups; // Items that could be removed
  }

  function markAllAsRead(group: any) {
    for (const item of group.items) {
      if (!item.is_read) {
        toggleRead(item);
      }
    }
    toast.success(`Marked ${group.items.length} items as read`);
  }

  async function removeDuplicates(group: any) {
    const preferred = getPreferredItem(group, $duplicateSettings.keepInFeed);
    let removed = 0;

    for (const item of group.items) {
      if (item.id !== preferred.id) {
        // Mark as read and optionally hide
        if (!item.is_read) {
          await toggleRead(item);
        }
        removed++;
      }
    }

    toast.success(`Removed ${removed} duplicate${removed !== 1 ? "s" : ""}`);

    // Refresh the scan
    scanForDuplicates();
  }

  function openItem(item: any) {
    window.open(item.url, "_blank");
  }

  function setMethod(method: string) {
    duplicateSettings.setMethod(method as any);
  }

  function setAutoAction(action: string) {
    duplicateSettings.setAutoAction(action as any);
  }

  function setKeepInFeed(keepInFeed: string) {
    duplicateSettings.setKeepInFeed(keepInFeed as any);
  }

  function handleKeepInFeedChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    setKeepInFeed(value);
  }

  function handleSensitivityInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    duplicateSettings.setSensitivity(parseInt(value));
  }
</script>

{#if isOpen}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
  >
    <div
      class="w-full max-w-4xl bg-[#18181b] rounded-2xl shadow-2xl border border-white/10 flex flex-col max-h-[90vh]"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between px-6 py-5 border-b border-white/10"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg"
          >
            <Copy size={20} class="text-white" />
          </div>
          <div>
            <h2 class="text-xl font-bold text-white">Duplicate Articles</h2>
            <p class="text-sm text-white/50">
              {$duplicateGroupCount} group{$duplicateGroupCount !== 1
                ? "s"
                : ""} ·
              {getDeduplicationCount()} could be removed
            </p>
          </div>
        </div>
        <button
          on:click={closeModal}
          class="p-2 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto">
        {#if showSettings}
          <!-- Settings Panel -->
          <div class="p-6 space-y-6">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-white">
                Duplicate Detection Settings
              </h3>
              <button
                on:click={() => (showSettings = false)}
                class="text-sm text-accent hover:text-accent/80"
              >
                Back to results
              </button>
            </div>

            <!-- Enabled Toggle -->
            <div
              class="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5"
            >
              <div>
                <div class="font-medium text-white">
                  Enable Duplicate Detection
                </div>
                <div class="text-sm text-white/50">
                  Automatically find duplicate articles
                </div>
              </div>
              <button
                class="w-12 h-6 rounded-full transition-colors {$duplicateSettings.enabled
                  ? 'bg-accent'
                  : 'bg-white/10'}"
                on:click={() => duplicateSettings.toggle()}
              >
                <div
                  class="w-5 h-5 bg-white rounded-full shadow-md transition-transform {$duplicateSettings.enabled
                    ? 'translate-x-6'
                    : 'translate-x-0.5'}"
                ></div>
              </button>
            </div>

            <!-- Detection Method -->
            <div class="space-y-3">
              <label class="text-sm font-semibold text-white"
                >Detection Method</label
              >
              <div class="grid grid-cols-3 gap-3">
                {#each ["url", "title", "fuzzy"] as method}
                  <button
                    class="p-4 rounded-xl border-2 transition-all {$duplicateSettings.method ===
                    method
                      ? 'border-accent bg-accent/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'}"
                    on:click={() => setMethod(method)}
                  >
                    <div class="text-sm font-medium text-white capitalize">
                      {method}
                    </div>
                    <div class="text-xs text-white/50 mt-1">
                      {method === "url"
                        ? "Exact URL match"
                        : method === "title"
                          ? "Exact title match"
                          : "Similar titles"}
                    </div>
                  </button>
                {/each}
              </div>
            </div>

            <!-- Sensitivity (for fuzzy) -->
            {#if $duplicateSettings.method === "fuzzy"}
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <label class="text-sm font-semibold text-white"
                    >Sensitivity</label
                  >
                  <span class="text-sm text-accent"
                    >{$duplicateSettings.sensitivity}%</span
                  >
                </div>
                <input
                  type="range"
                  min="50"
                  max="100"
                  bind:value={$duplicateSettings.sensitivity}
                  on:input={handleSensitivityInput}
                  class="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent"
                />
                <div class="flex justify-between text-xs text-white/40">
                  <span>More matches</span>
                  <span>Fewer matches</span>
                </div>
              </div>
            {/if}

            <!-- Keep Preference -->
            <div class="space-y-3">
              <label class="text-sm font-semibold text-white"
                >Which duplicate to keep?</label
              >
              <select
                value={$duplicateSettings.keepInFeed}
                on:change={handleKeepInFeedChange}
                class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-accent/50"
              >
                <option value="first_subscribed"
                  >From first subscribed feed</option
                >
                <option value="oldest">Oldest published</option>
                <option value="newest">Newest published</option>
              </select>
            </div>

            <!-- Auto Action -->
            <div class="space-y-3">
              <label class="text-sm font-semibold text-white"
                >Auto-action for duplicates</label
              >
              <div class="grid grid-cols-3 gap-3">
                {#each ["none", "mark_read", "hide"] as action}
                  <button
                    class="p-4 rounded-xl border-2 transition-all {$duplicateSettings.autoAction ===
                    action
                      ? 'border-accent bg-accent/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'}"
                    on:click={() => setAutoAction(action)}
                  >
                    <div class="text-sm font-medium text-white capitalize">
                      {action === "none" ? "None" : action.replace("_", " ")}
                    </div>
                    <div class="text-xs text-white/50 mt-1">
                      {action === "none"
                        ? "Show all"
                        : action === "mark_read"
                          ? "Mark as read"
                          : "Hide from view"}
                    </div>
                  </button>
                {/each}
              </div>
            </div>
          </div>
        {:else}
          <!-- Duplicate Groups -->
          <div class="p-6 space-y-6">
            <!-- Actions Bar -->
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                <button
                  on:click={scanForDuplicates}
                  disabled={scanning}
                  class="px-4 py-2 rounded-xl bg-accent hover:bg-accent/80 text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {#if scanning}
                    <RefreshCw size={18} class="animate-spin" />
                  {:else}
                    <RefreshCw size={18} />
                  {/if}
                  Scan
                </button>
                <button
                  on:click={() => (showSettings = true)}
                  class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors flex items-center gap-2"
                >
                  <Settings2 size={18} />
                  Settings
                </button>
              </div>
              <div class="text-sm text-white/50">
                {$duplicateCount} duplicates in {$duplicateGroupCount} groups
              </div>
            </div>

            {#if $duplicates.length === 0}
              <!-- Empty State -->
              <div class="text-center py-12">
                <div
                  class="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4"
                >
                  <CheckCircle2 size={32} class="text-emerald-400" />
                </div>
                <h3 class="text-lg font-semibold text-white mb-2">
                  No duplicates found
                </h3>
                <p class="text-white/50">
                  Click "Scan" to check for duplicate articles based on your
                  settings.
                </p>
              </div>
            {:else}
              <!-- Duplicate Groups List -->
              <div class="space-y-4">
                {#each $duplicates as group (group.id)}
                  <div
                    class="bg-white/5 rounded-xl border border-white/10 overflow-hidden"
                  >
                    <!-- Group Header -->
                    <div
                      class="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between"
                    >
                      <div class="flex items-center gap-3">
                        <AlertCircle size={18} class="text-orange-400" />
                        <span class="font-medium text-white"
                          >{group.representativeTitle}</span
                        >
                        <span
                          class="px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-xs font-medium text-orange-400"
                        >
                          {group.items.length} duplicates
                        </span>
                        <span
                          class="px-2 py-0.5 rounded-full bg-white/10 text-xs text-white/60"
                        >
                          {group.matchType} · {group.similarity}% match
                        </span>
                      </div>
                      <div class="flex items-center gap-2">
                        <button
                          on:click={() => markAllAsRead(group)}
                          class="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                          title="Mark all as read"
                        >
                          <EyeOff size={16} />
                        </button>
                        <button
                          on:click={() => removeDuplicates(group)}
                          class="p-2 rounded-lg hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors"
                          title="Remove duplicates"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <!-- Group Items -->
                    <div class="divide-y divide-white/5">
                      {#each group.items as item}
                        <div
                          class="px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition-colors group/item"
                        >
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-1">
                              <span
                                class="text-xs font-medium text-accent truncate"
                              >
                                {item.feed_title}
                              </span>
                              <span class="text-white/30">·</span>
                              <span class="text-xs text-white/40">
                                {new Date(
                                  item.published ||
                                    item.created_at
                                ).toLocaleDateString()}
                              </span>
                              {#if item.is_read}
                                <CheckCircle2
                                  size={12}
                                  class="text-emerald-400"
                                />
                              {/if}
                            </div>
                            <p class="text-sm text-white/80 line-clamp-2">
                              {item.title}
                            </p>
                            <p class="text-xs text-white/40 mt-1 truncate">
                              {item.url}
                            </p>
                          </div>
                          <button
                            on:click={() => openItem(item)}
                            class="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white opacity-0 group-hover/item:opacity-100 transition-all"
                          >
                            <Eye size={16} />
                          </button>
                        </div>
                      {/each}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}