# Svelte 4 Dependency Notes

This project uses **Svelte 4**, which requires specific compatible versions of SvelteKit and related packages.

## Important Version Constraints

- **Svelte 4.x** requires `@sveltejs/vite-plugin-svelte` **v3.x** (NOT v6.x)
- `@sveltejs/vite-plugin-svelte` v6.x is for **Svelte 5** only
- Compatible versions:
  - `svelte`: ^4.2.7
  - `@sveltejs/vite-plugin-svelte`: ^3.0.0
  - `@sveltejs/kit`: ^2.0.0
  - `@sveltejs/adapter-static`: ^3.0.1
  - `vite`: ^5.0.3

## Upgrading to Svelte 5

When ready to upgrade to Svelte 5:
1. Update `svelte` to ^5.0.0
2. Update `@sveltejs/vite-plugin-svelte` to ^6.0.0
3. Update `vite` to ^7.0.0
4. Review Svelte 5 migration guide for breaking changes

## Build Warnings

The build may show warnings about missing exports (`untrack`, `fork`, `settled`) from Svelte. These are expected with Svelte 4 + SvelteKit 2 and do not affect functionality.
