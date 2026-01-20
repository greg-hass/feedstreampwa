import { onDestroy } from "svelte";
import { MAX_SWIPE, INTENT_THRESHOLD } from "$lib/constants/gestures";

export interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeProgress?: (progress: number, direction: 'left' | 'right') => void;
  onSwipeEnd?: () => void;
  element: HTMLElement;
  swipeThreshold?: number;
}

export function createSwipeGesture(options: SwipeGestureOptions) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeProgress,
    onSwipeEnd,
    element,
    swipeThreshold = 120,
  } = options;

  let startX = 0;
  let currentX = 0;
  let isSwiping = false;
  let swipeDirection: "left" | "right" | null = null;
  let startY = 0;
  let isScrolling = false;
  let touchStarted = false;

  function handleTouchStart(e: TouchEvent) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    touchStarted = true;
    isScrolling = false;
    isSwiping = false;
    swipeDirection = null;
    currentX = startX;
  }

  function handleTouchMove(e: TouchEvent) {
    if (!touchStarted || isScrolling) return;

    const newX = e.touches[0].clientX;
    const newY = e.touches[0].clientY;

    const diffX = newX - startX;
    const diffY = newY - startY;

    if (
      !swipeDirection &&
      (Math.abs(diffX) > INTENT_THRESHOLD || Math.abs(diffY) > INTENT_THRESHOLD)
    ) {
      if (Math.abs(diffY) > Math.abs(diffX) * 1.5) {
        isScrolling = true;
        touchStarted = false;
        return;
      }

      swipeDirection = diffX > 0 ? "right" : "left";
      isSwiping = true;
    }

    if (isSwiping && swipeDirection) {
      currentX = newX;
      if (e.cancelable) e.preventDefault();

      const distance = currentX - startX;
      const clampedDistance = Math.max(Math.min(distance, MAX_SWIPE), -MAX_SWIPE);
      const progress = Math.abs(clampedDistance) / swipeThreshold;

      onSwipeProgress?.(Math.min(progress, 1), swipeDirection);
    }
  }

  function handleTouchEnd() {
    if (!touchStarted) return;

    if (isSwiping && Math.abs(currentX - startX) >= swipeThreshold) {
      if (currentX - startX > 0) {
        onSwipeRight?.();
      } else {
        onSwipeLeft?.();
      }
    }

    onSwipeEnd?.();

    touchStarted = false;
    isSwiping = false;
    isScrolling = false;
    startX = 0;
    startY = 0;
    currentX = 0;
    swipeDirection = null;
    onSwipeProgress?.(0, 'right');
  }

  element.addEventListener("touchstart", handleTouchStart, { passive: false });
  element.addEventListener("touchmove", handleTouchMove, { passive: false });
  element.addEventListener("touchend", handleTouchEnd);

  return () => {
    element.removeEventListener("touchstart", handleTouchStart);
    element.removeEventListener("touchmove", handleTouchMove);
    element.removeEventListener("touchend", handleTouchEnd);
  };
}
