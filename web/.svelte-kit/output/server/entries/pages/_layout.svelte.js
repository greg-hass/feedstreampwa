import { c as create_ssr_component } from "../../chunks/ssr.js";
const css = {
  code: "body{margin:0;padding:0;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;background:linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);color:#e4e4e4;min-height:100vh}*{box-sizing:border-box}",
  map: `{"version":3,"file":"+layout.svelte","sources":["+layout.svelte"],"sourcesContent":["<script lang=\\"ts\\">import { onMount } from \\"svelte\\";\\nimport { browser } from \\"$app/environment\\";\\nonMount(() => {\\n  if (browser && \\"serviceWorker\\" in navigator && import.meta.env.PROD) {\\n    navigator.serviceWorker.register(\\"/sw.js\\").catch((err) => {\\n      console.error(\\"Service worker registration failed:\\", err);\\n    });\\n  }\\n});\\n<\/script>\\n\\n<slot />\\n\\n<style>\\n\\t:global(body) {\\n\\t\\tmargin: 0;\\n\\t\\tpadding: 0;\\n\\t\\tfont-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;\\n\\t\\tbackground: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);\\n\\t\\tcolor: #e4e4e4;\\n\\t\\tmin-height: 100vh;\\n\\t}\\n\\n\\t:global(*) {\\n\\t\\tbox-sizing: border-box;\\n\\t}\\n</style>\\n"],"names":[],"mappings":"AAcS,IAAM,CACb,MAAM,CAAE,CAAC,CACT,OAAO,CAAE,CAAC,CACV,WAAW,CAAE,aAAa,CAAC,CAAC,kBAAkB,CAAC,CAAC,UAAU,CAAC,CAAC,MAAM,CAAC,CAAC,MAAM,CAAC,CAAC,MAAM,CAAC,CAAC,SAAS,CAAC,CAAC,UAAU,CACzG,UAAU,CAAE,gBAAgB,MAAM,CAAC,CAAC,OAAO,CAAC,EAAE,CAAC,CAAC,OAAO,CAAC,IAAI,CAAC,CAC7D,KAAK,CAAE,OAAO,CACd,UAAU,CAAE,KACb,CAEQ,CAAG,CACV,UAAU,CAAE,UACb"}`
};
const Layout = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  $$result.css.add(css);
  return `${slots.default ? slots.default({}) : ``}`;
});
export {
  Layout as default
};
