

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/2.BHFOBw2y.js","_app/immutable/chunks/CM6ZlorT.js","_app/immutable/chunks/wNy-qeCD.js"];
export const stylesheets = ["_app/immutable/assets/2.DHrrhPP1.css"];
export const fonts = [];
