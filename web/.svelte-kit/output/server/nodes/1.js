

export const index = 1;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/fallbacks/error.svelte.js')).default;
export const imports = ["_app/immutable/nodes/1.BL1MwRG4.js","_app/immutable/chunks/CM6ZlorT.js","_app/immutable/chunks/wNy-qeCD.js","_app/immutable/chunks/BcuW2uiN.js"];
export const stylesheets = [];
export const fonts = [];
