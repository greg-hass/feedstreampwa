<script lang="ts">
  import { Eye, EyeOff, Key, AlertTriangle } from "lucide-svelte";
  import { settings, updateGeminiApiKey, updateOpenAIApiKey } from "$lib/stores/settings";
  import { toast } from "$lib/stores/toast";

  let geminiKey = $settings.gemini_api_key || '';
  let openaiKey = $settings.openai_api_key || '';
  let showGeminiKey = false;
  let showOpenAIKey = false;
  let saving = false;

  async function handleSaveGemini() {
    if (saving) return;
    saving = true;
    try {
      await updateGeminiApiKey(geminiKey);
      toast.success("Gemini API key saved");
    } catch (err) {
      toast.error("Failed to save Gemini API key");
    } finally {
      saving = false;
    }
  }

  async function handleSaveOpenAI() {
    if (saving) return;
    saving = true;
    try {
      await updateOpenAIApiKey(openaiKey);
      toast.success("OpenAI API key saved");
    } catch (err) {
      toast.error("Failed to save OpenAI API key");
    } finally {
      saving = false;
    }
  }

  $: geminiKey = $settings.gemini_api_key || '';
  $: openaiKey = $settings.openai_api_key || '';
</script>

<div class="space-y-6">
  <div>
    <h3 class="text-base font-semibold text-white mb-1 flex items-center gap-2">
      <Key size={18} class="text-emerald-400" />
      AI Settings
    </h3>
    <p class="text-sm text-white/60 mb-4">
      Configure API keys for AI-powered features like summaries and recommendations.
    </p>

    <!-- Security Notice -->
    <div class="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
      <div class="flex gap-3">
        <AlertTriangle size={20} class="text-emerald-400 flex-shrink-0 mt-0.5" />
        <div class="text-sm">
          <p class="font-medium text-emerald-200 mb-1">Your keys are secure</p>
          <p class="text-emerald-300/70 text-xs">
            API keys are stored encrypted on the server and never committed to git. They're only used for backend API calls - never exposed to the frontend.
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- Gemini API Key -->
  <div class="space-y-3">
    <label class="block">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium text-white/90">Gemini 2.5 Flash API Key</span>
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          Get API Key →
        </a>
      </div>
      <div class="relative">
        {#if showGeminiKey}
          <input
            type="text"
            bind:value={geminiKey}
            placeholder="Enter your Gemini API key"
            class="w-full px-4 py-2.5 pr-24 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-mono text-sm"
          />
        {:else}
          <input
            type="password"
            bind:value={geminiKey}
            placeholder="Enter your Gemini API key"
            class="w-full px-4 py-2.5 pr-24 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-mono text-sm"
          />
        {/if}
        <div class="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
          <button
            type="button"
            on:click={() => showGeminiKey = !showGeminiKey}
            class="p-1.5 hover:bg-white/10 rounded transition-colors"
            aria-label={showGeminiKey ? "Hide key" : "Show key"}
          >
            {#if showGeminiKey}
              <EyeOff size={16} class="text-white/60" />
            {:else}
              <Eye size={16} class="text-white/60" />
            {/if}
          </button>
          <button
            type="button"
            on:click={handleSaveGemini}
            disabled={saving || !geminiKey || geminiKey === $settings.gemini_api_key}
            class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-white/40 text-white text-xs font-medium rounded transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
      <p class="mt-1.5 text-xs text-white/40">
        Used for AI summaries and content analysis (Free tier: 15 requests/min, 1500/day)
      </p>
    </label>
  </div>

  <!-- OpenAI API Key -->
  <div class="space-y-3">
    <label class="block">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium text-white/90">OpenAI GPT-4o Mini API Key</span>
        <a
          href="https://platform.openai.com/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          Get API Key →
        </a>
      </div>
      <div class="relative">
        {#if showOpenAIKey}
          <input
            type="text"
            bind:value={openaiKey}
            placeholder="Enter your OpenAI API key"
            class="w-full px-4 py-2.5 pr-24 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-mono text-sm"
          />
        {:else}
          <input
            type="password"
            bind:value={openaiKey}
            placeholder="Enter your OpenAI API key"
            class="w-full px-4 py-2.5 pr-24 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-mono text-sm"
          />
        {/if}
        <div class="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
          <button
            type="button"
            on:click={() => showOpenAIKey = !showOpenAIKey}
            class="p-1.5 hover:bg-white/10 rounded transition-colors"
            aria-label={showOpenAIKey ? "Hide key" : "Show key"}
          >
            {#if showOpenAIKey}
              <EyeOff size={16} class="text-white/60" />
            {:else}
              <Eye size={16} class="text-white/60" />
            {/if}
          </button>
          <button
            type="button"
            on:click={handleSaveOpenAI}
            disabled={saving || !openaiKey || openaiKey === $settings.openai_api_key}
            class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-white/40 text-white text-xs font-medium rounded transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
      <p class="mt-1.5 text-xs text-white/40">
        Alternative AI provider for summaries and recommendations (Pay-as-you-go pricing)
      </p>
    </label>
  </div>

  <!-- Features Info -->
  <div class="mt-6 p-4 bg-white/5 border border-white/10 rounded-lg">
    <h4 class="text-sm font-medium text-white/90 mb-2">AI Features</h4>
    <ul class="text-xs text-white/60 space-y-1.5">
      <li class="flex items-start gap-2">
        <span class="text-emerald-400 mt-0.5">•</span>
        <span><strong class="text-white/80">Article Summaries:</strong> Get concise summaries of long articles</span>
      </li>
      <li class="flex items-start gap-2">
        <span class="text-emerald-400 mt-0.5">•</span>
        <span><strong class="text-white/80">Smart Recommendations:</strong> Discover relevant content based on your interests</span>
      </li>
      <li class="flex items-start gap-2">
        <span class="text-emerald-400 mt-0.5">•</span>
        <span><strong class="text-white/80">Content Analysis:</strong> Automatically categorize and tag articles</span>
      </li>
    </ul>
  </div>
</div>
