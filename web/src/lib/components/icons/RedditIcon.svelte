<script lang="ts">
  export let size = 24;
  export let color = "currentColor";
  let className: string = "";
  export { className as class };
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke={color === "currentColor" ? "currentColor" : color}
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  class={className}
  {...$$restProps}
>
  <path
    d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
    stroke="none"
    fill={color === "currentColor" ? "#FF4500" : color}
    fill-opacity="0.2"
  />
  <circle
    cx="12"
    cy="12"
    r="10"
    stroke={color === "currentColor" ? "#FF4500" : color}
  />
  <path
    d="M16 11.5c0 .828.672 1.5 1.5 1.5s1.5-.672 1.5-1.5-.672-1.5-1.5-1.5-1.5.672-1.5 1.5z"
    fill={color === "currentColor" ? "#FF4500" : color}
    stroke="none"
  />
  <path
    d="M6.5 11.5c0 .828.672 1.5 1.5 1.5s1.5-.672 1.5-1.5-.672-1.5-1.5-1.5-1.5.672-1.5 1.5z"
    fill={color === "currentColor" ? "#FF4500" : color}
    stroke="none"
  />
  <path
    d="M16 16c-1.105 1-2.66 1.5-4 1.5s-2.895-.5-4-1.5"
    stroke={color === "currentColor" ? "#FF4500" : color}
  />
  <path d="M12 2l0 5.5" stroke={color === "currentColor" ? "#FF4500" : color} />
  <path
    d="M12 6l2.5-1.5 1.5 1.5"
    stroke={color === "currentColor" ? "#FF4500" : color}
  />
</svg>
