<script lang="ts">
  export let size = 24;
  export let color = "currentColor";
  export let strokeWidth = 2;
  let className: string = "";
  export { className as class }; // Export 'class' prop
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke={color}
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  class={className}
  {...$$restProps}
>
  <!-- Head -->
  <circle cx="12" cy="13" r="8" />

  <!-- Antenna -->
  <path d="M12 5V3l3-2" />
  <circle cx="16" cy="1" r="1" />

  <!-- Face -->
  <path d="M9.5 16a2.5 2.5 0 0 0 5 0" />
  <!-- Smile -->
  <circle cx="9" cy="13" r="1" fill="currentColor" stroke="none" />
  <circle cx="15" cy="13" r="1" fill="currentColor" stroke="none" />

  <!-- Ears -->
  <path d="M3.5 10a1.5 1.5 0 1 1 0 3" />
  <path d="M20.5 13a1.5 1.5 0 1 1 0-3" />
</svg>
