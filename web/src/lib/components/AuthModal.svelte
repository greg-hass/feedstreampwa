<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { X, LogIn, UserPlus } from "lucide-svelte";
  import { register, login, logout, currentUser, authLoading, authError, isLoggedIn } from "$lib/stores/auth";
  import { toast } from "$lib/stores/toast";

  export let isOpen = false;

  let mode: "login" | "register" = "login";
  let email = "";
  let password = "";
  let confirmPassword = "";

  function switchMode() {
    mode = mode === "login" ? "register" : "login";
    email = "";
    password = "";
    confirmPassword = "";
    authError.set(null);
  }

  async function handleSubmit() {
    if (mode === "register") {
      if (password !== confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
      if (password.length < 8) {
        toast.error("Password must be at least 8 characters");
        return;
      }
      await register(email, password);
    } else {
      await login(email, password);
    }

    if ($isLoggedIn) {
      isOpen = false;
    }
  }

  function handleLogout() {
    logout();
    isOpen = false;
  }

  function handleOpenAuth() {
    isOpen = true;
  }

  function handleLogoutEvent() {
    logout();
    isOpen = false;
  }

  onMount(() => {
    // Reset form when modal opens
    if (isOpen) {
      mode = "login";
      email = "";
      password = "";
      confirmPassword = "";
      authError.set(null);
    }

    // Listen for custom auth events
    window.addEventListener('open-auth', handleOpenAuth);
    window.addEventListener('logout', handleLogoutEvent);
  });

  onDestroy(() => {
    window.removeEventListener('open-auth', handleOpenAuth);
    window.removeEventListener('logout', handleLogoutEvent);
  });

  $: if (isOpen) {
    mode = "login";
    email = "";
    password = "";
    confirmPassword = "";
    authError.set(null);
  }
</script>

{#if isOpen}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    on:click={() => (isOpen = false)}
    role="dialog"
    aria-modal="true"
  >
    <div
      class="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6 relative"
      on:click|stopPropagation
    >
      <!-- Close Button -->
      <button
        on:click={() => (isOpen = false)}
        class="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        aria-label="Close"
      >
        <X size={20} />
      </button>

      <!-- Header -->
      <div class="text-center mb-6">
        <h2 class="text-2xl font-bold text-white mb-2">
          {mode === "login" ? "Welcome Back" : "Create Account"}
        </h2>
        <p class="text-gray-400 text-sm">
          {mode === "login"
            ? "Sign in to access your feeds"
            : "Join FeedStream to manage your feeds"}
        </p>
      </div>

      <!-- Auth Form -->
      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        <!-- Email -->
        <div>
          <label for="email" class="block text-sm font-medium text-gray-300 mb-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            bind:value={email}
            placeholder="you@example.com"
            required
            class="w-full px-4 py-3 bg-[#121212] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          />
        </div>

        <!-- Password -->
        <div>
          <label for="password" class="block text-sm font-medium text-gray-300 mb-2">
            Password
          </label>
          <input
            id="password"
            type="password"
            bind:value={password}
            placeholder="••••••••••"
            required
            minlength={8}
            class="w-full px-4 py-3 bg-[#121212] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          />
        </div>

        <!-- Confirm Password (Register only) -->
        {#if mode === "register"}
          <div>
            <label for="confirmPassword" class="block text-sm font-medium text-gray-300 mb-2">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              bind:value={confirmPassword}
              placeholder="••••••••••"
              required
              minlength={8}
              class="w-full px-4 py-3 bg-[#121212] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
          </div>
        {/if}

        <!-- Error Message -->
        {#if $authError}
          <div class="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
            {$authError}
          </div>
        {/if}

        <!-- Submit Button -->
        <button
          type="submit"
          disabled={$authLoading}
          class="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold py-3 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {#if $authLoading}
            <div class="w-5 h-5 border-2 border-white/30 border-t-transparent rounded-full animate-spin"></div>
          {:else}
            {mode === "login" ? "Sign In" : "Create Account"}
          {/if}
        </button>
      </form>

      <!-- Switch Mode -->
      <div class="mt-6 text-center">
        <p class="text-gray-400 text-sm">
          {mode === "login"
            ? "Don't have an account? "
            : "Already have an account? "}
          <button
            on:click={switchMode}
            class="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
            type="button"
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>

      <!-- Logout (if logged in) -->
      {#if $isLoggedIn && $currentUser}
        <div class="mt-6 pt-6 border-t border-white/10">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-400">Logged in as</p>
              <p class="text-white font-medium">{$currentUser.email}</p>
            </div>
            <button
              on:click={handleLogout}
              class="text-red-400 hover:text-red-300 text-sm font-medium transition-colors flex items-center gap-1"
              type="button"
            >
              <LogIn size={16} />
              Sign Out
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  :global(body) {
    overflow: hidden;
  }
</style>
