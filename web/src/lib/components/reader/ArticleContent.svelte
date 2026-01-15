<script lang="ts">
  import { Sparkles, Database, ExternalLink } from "lucide-svelte";
  import type { Item } from "$lib/types";

  export let readerData: any;
  export let item: Item | null;
  export let summary: string | null;
  export let summaryLoading: boolean;
  export let fontSizeClass: string;
  export let fontFamilyClass: string;
  export let maxWidthClass: string;
  export let themeClass: string;

  let heroImageError = false;

  function handleHeroImageError() {
    heroImageError = true;
  }

  function formatDate(dateStr: string | null | undefined) {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(date);
    } catch (e) {
      return dateStr;
    }
  }

  function formatContent(html: string): string {
    if (!html) return "";
    let cleaned = html.trim();
    if (cleaned.toLowerCase().includes("<p>")) return cleaned;
    
    if (cleaned.includes("\n\n")) {
      return cleaned
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
        .map((p) => `<p>${p.replace(/\n/g, " ").replace(/\s+/g, " ").trim()}</p>`)
        .join("");
    }

    if (cleaned.toLowerCase().includes("<br")) {
      const withParas = cleaned.replace(/<br\s*\/?>(\s*<br\s*\/?>\s*)+/gi, "</p><p>");
      return withParas.toLowerCase().startsWith("<p>") ? withParas : `<p>${withParas}</p>`;
    }

    return `<p>${cleaned}</p>`;
  }

  function formatSummary(text: string) {
    if (!text) return "";
    let html = text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/^\s*-\s+(.*)/gm, "<li>$1</li>");

    html = html.replace(/((<li>.*<\/li>\n?)+)/g, '<ul class="list-disc pl-5 my-3 space-y-1 text-white/80">$1</ul>');

    return html
      .split("\n\n")
      .map((p) => {
        if (p.trim().startsWith("<ul") || p.trim().startsWith("<li>")) return p.trim();
        return `<p class="mb-3 text-white/90 leading-relaxed">${p.trim()}</p>`;
      })
      .join("");
  }

  $: isYouTube = readerData?.url && (readerData.url.includes("youtube.com/watch") || readerData.url.includes("youtu.be/"));
</script>

<article class="reader-content {themeClass}">
  <div class="article-header">
    <h1 class="reader-title-new" id="reader-title">
      {readerData.title || "Untitled"}
    </h1>

    <div class="article-meta-row">
      <span class="article-date">
        {formatDate(item?.published)}
      </span>
      <div class="article-actions-mini">
        {#if readerData.url}
          <a
            href={readerData.url}
            target="_blank"
            rel="noopener noreferrer"
            class="meta-action-btn"
            title="Open Original"
          >
            <ExternalLink size={18} />
          </a>
        {/if}
      </div>
    </div>
    <div class="article-divider"></div>
  </div>

  {#if summary}
    <div class="mb-10 p-6 bg-accent/10 border border-accent/20 rounded-xl relative overflow-hidden group">
      <div class="absolute top-0 left-0 w-1 h-full bg-accent"></div>
      <div class="flex items-center gap-2 mb-4 text-accent text-sm font-bold uppercase tracking-wider">
        <Sparkles size={14} />
        AI Summary
      </div>
      <div class="prose prose-invert prose-sm max-w-none font-sans">
        {@html formatSummary(summary)}
      </div>
    </div>
  {:else if summaryLoading}
    <div class="mb-10 p-6 bg-white/5 border border-white/10 rounded-xl animate-pulse">
      <div class="h-4 bg-white/10 rounded w-1/4 mb-4"></div>
      <div class="space-y-3">
        <div class="h-3 bg-white/10 rounded w-full"></div>
        <div class="h-3 bg-white/10 rounded w-5/6"></div>
        <div class="h-3 bg-white/10 rounded w-4/6"></div>
      </div>
    </div>
  {/if}

  {#if readerData.byline || readerData.siteName || readerData.fromCache}
    <div class="reader-meta">
      {#if readerData.byline}<span>{readerData.byline}</span>{/if}
      {#if readerData.byline && readerData.siteName}<span class="meta-sep">•</span>{/if}
      {#if readerData.siteName}<span>{readerData.siteName}</span>{/if}
      {#if (readerData.byline || readerData.siteName) && readerData.fromCache}<span class="meta-sep">•</span>{/if}
      {#if readerData.fromCache}
        <span class="flex items-center gap-1 text-accent">
          <Database size={12} />
          Offline
        </span>
      {/if}
    </div>
  {/if}

  {#if readerData.imageUrl && !heroImageError && !isYouTube}
    <img
      src={readerData.imageUrl}
      alt=""
      class="reader-hero"
      on:error={handleHeroImageError}
    />
  {/if}

  <div
    class="reader-body {fontSizeClass} {fontFamilyClass} {maxWidthClass} mx-auto"
    id="reader-body-content"
  >
    {#if !isYouTube}
      {@html formatContent(readerData.contentHtml)}
    {/if}
  </div>
</article>

<style>
  .article-header {
    margin-bottom: 40px;
  }

  .reader-title-new {
    font-size: 32px;
    font-weight: 800;
    line-height: 1.25;
    margin-bottom: 24px;
    letter-spacing: -0.02em;
    color: inherit;
  }

  .article-meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
  }

  .article-date {
    font-size: 15px;
    opacity: 0.6;
    font-weight: 500;
  }

  .article-actions-mini {
    display: flex;
    gap: 20px;
  }

  .meta-action-btn {
    background: none;
    border: none;
    color: inherit;
    padding: 4px;
    cursor: pointer;
    opacity: 0.6;
    transition: all 0.2s;
  }

  .meta-action-btn:hover {
    opacity: 1;
    transform: scale(1.1);
  }

  .article-divider {
    height: 1px;
    background: var(--divider, rgba(128, 128, 128, 0.1));
    width: 100%;
  }

  .reader-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    opacity: 0.6;
    margin-bottom: 32px;
  }

  .meta-sep {
    opacity: 0.3;
  }

  .reader-hero {
    width: 100%;
    max-height: 400px;
    object-fit: cover;
    border-radius: 12px;
    margin-bottom: 32px;
  }

  .reader-body {
    line-height: 1.8;
    letter-spacing: 0.01em;
    overflow-wrap: break-word;
    word-wrap: break-word;
    word-break: break-word;
    hyphens: auto;
  }

  .reader-body :global(p) {
    margin-bottom: 1.75em;
  }

  .reader-body :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 24px 0;
  }

  .reader-body :global(h2),
  .reader-body :global(h3) {
    margin-top: 2em;
    margin-bottom: 1em;
    font-weight: 700;
    line-height: 1.3;
  }

  .reader-body :global(blockquote) {
    border-left: 4px solid var(--accent-color);
    padding-left: 1.5em;
    margin: 2em 0;
    font-style: italic;
    opacity: 0.9;
  }

  .reader-body :global(pre) {
    background: rgba(128, 128, 128, 0.1);
    padding: 1.5em;
    border-radius: 12px;
    overflow-x: auto;
    margin: 2em 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.9em;
  }
</style>
