<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import {
    X,
    ChevronRight,
    ChevronLeft,
    Sparkles,
    Rss,
    Zap,
    Heart,
  } from "lucide-svelte";

  export let isOpen = false;

  const dispatch = createEventDispatcher();

  let currentStep = 0;

  const steps = [
    {
      icon: Sparkles,
      gradient: "from-purple-500 to-pink-500",
      title: "Welcome to FeedStream!",
      description:
        "Your beautiful, modern RSS reader that brings all your favorite content together in one place.",
      features: [
        "Subscribe to blogs, YouTube channels, podcasts, and Reddit",
        "Organize with smart folders and custom collections",
        "Read with beautiful typography and distraction-free mode",
      ],
    },
    {
      icon: Rss,
      gradient: "from-blue-500 to-cyan-500",
      title: "Add Your First Feeds",
      description:
        "Start by adding feeds from your favorite sources. We support RSS, Atom, YouTube, Reddit, and podcasts!",
      features: [
        'Click the "+" button to add feeds',
        "Search for feeds by name or URL",
        "Feeds are automatically organized by type",
      ],
    },
    {
      icon: Zap,
      gradient: "from-orange-500 to-red-500",
      title: "Powerful Features",
      description:
        "FeedStream is packed with features to enhance your reading experience.",
      features: [
        "AI-powered feed recommendations",
        "Pull-to-refresh and swipe gestures",
        "Text-to-speech and reading progress",
        "Customizable view density and themes",
      ],
    },
    {
      icon: Heart,
      gradient: "from-pink-500 to-rose-500",
      title: "You're All Set!",
      description:
        "Start exploring and enjoy your personalized feed experience. Happy reading!",
      features: [
        "Star articles to save them for later",
        "Use keyboard shortcuts for faster navigation",
        "Sync across devices with auto-refresh",
      ],
    },
  ];

  function nextStep() {
    if (currentStep < steps.length - 1) {
      currentStep++;
    } else {
      complete();
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      currentStep--;
    }
  }

  function complete() {
    // Mark onboarding as completed in localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("feedstream_onboarding_completed", "true");
    }
    dispatch("complete");
    isOpen = false;
  }

  function skip() {
    complete();
  }

  $: step = steps[currentStep];
  $: Icon = step.icon;
  $: isLastStep = currentStep === steps.length - 1;
</script>

{#if isOpen}
  <div
    class="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center p-4 animate-fade-in"
  >
    <!-- Close button -->
    <button
      class="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
      on:click={skip}
      aria-label="Skip onboarding"
    >
      <X size={24} />
    </button>

    <div class="max-w-2xl w-full">
      <!-- Progress dots -->
      <div class="flex justify-center gap-2 mb-8">
        {#each steps as _, i}
          <button
            class="w-2 h-2 rounded-full transition-all duration-300 {i ===
            currentStep
              ? 'bg-white w-8'
              : 'bg-white/30 hover:bg-white/50'}"
            on:click={() => (currentStep = i)}
            aria-label="Go to step {i + 1}"
          />
        {/each}
      </div>

      <!-- Content -->
      {#key currentStep}
        <div class="text-center animate-slide-up">
          <!-- Icon -->
          <div class="flex justify-center mb-6">
            <div class="relative">
              <!-- Glow -->
              <div
                class="absolute inset-0 bg-gradient-to-r {step.gradient} opacity-30 blur-3xl rounded-full animate-pulse"
              ></div>

              <!-- Icon container -->
              <div
                class="relative w-32 h-32 rounded-3xl bg-gradient-to-br {step.gradient} p-8 shadow-2xl"
              >
                <svelte:component this={Icon} size={64} class="text-white" />
              </div>
            </div>
          </div>

          <!-- Title -->
          <h2 class="text-4xl font-bold text-white mb-4">
            {step.title}
          </h2>

          <!-- Description -->
          <p class="text-xl text-white/70 mb-8 max-w-xl mx-auto">
            {step.description}
          </p>

          <!-- Features -->
          <div class="space-y-3 mb-12 max-w-lg mx-auto">
            {#each step.features as feature, i}
              <div
                class="flex items-start gap-3 text-left p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all animate-slide-up"
                style="animation-delay: {i * 0.1}s"
              >
                <div
                  class="w-6 h-6 rounded-full bg-gradient-to-r {step.gradient} flex items-center justify-center flex-shrink-0 mt-0.5"
                >
                  <div class="w-2 h-2 rounded-full bg-white"></div>
                </div>
                <p class="text-white/80">{feature}</p>
              </div>
            {/each}
          </div>

          <!-- Navigation -->
          <div class="flex items-center justify-between gap-4">
            <button
              class="px-6 py-3 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all disabled:opacity-0"
              on:click={prevStep}
              disabled={currentStep === 0}
            >
              <div class="flex items-center gap-2">
                <ChevronLeft size={20} />
                <span>Back</span>
              </div>
            </button>

            <button
              class="px-6 py-3 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all"
              on:click={skip}
            >
              Skip
            </button>

            <button
              class="px-8 py-3 rounded-xl bg-gradient-to-r {step.gradient} text-white font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200"
              on:click={nextStep}
            >
              <div class="flex items-center gap-2">
                <span>{isLastStep ? "Get Started" : "Next"}</span>
                {#if !isLastStep}
                  <ChevronRight size={20} />
                {/if}
              </div>
            </button>
          </div>
        </div>
      {/key}
    </div>
  </div>
{/if}

<style>
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in {
    animation: fade-in 0.3s ease-out;
  }

  .animate-slide-up {
    animation: slide-up 0.5s ease-out backwards;
  }
</style>
