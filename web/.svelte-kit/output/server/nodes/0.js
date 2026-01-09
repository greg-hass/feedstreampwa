

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const universal = {
  "prerender": true,
  "ssr": false
};
export const universal_id = "src/routes/+layout.ts";
export const imports = ["_app/immutable/nodes/0.9tKG-wfJ.js","_app/immutable/chunks/CM6ZlorT.js","_app/immutable/chunks/wNy-qeCD.js"];
export const stylesheets = ["_app/immutable/assets/0.BKplY9Of.css"];
export const fonts = [];
