# Product Guidelines: FeedStream PWA

## User Experience (UX) Philosophy
FeedStream PWA prioritizes a "content-first" approach, blending a professional, clean aesthetic with a friendly and approachable tone. The goal is to make a powerful technical tool feel natural and effortless to use.

## Visual Identity
- **Aesthetic:** Modern Glassmorphism. Interfaces should utilize translucent backgrounds, background blurs, and subtle, light borders to create a sense of depth and hierarchy.
- **Theming:** Clean typography with high legibility. The UI should feel airy and minimalist, avoiding unnecessary clutter.

## Interaction Design
- **Gestural Control:** Navigation should feel native on mobile, with heavy reliance on horizontal swipes for quick actions (e.g., mark as read, save to starred).
- **Feedback Loops:** Use subtle visual animations and haptic feedback (for PWA/mobile) to confirm user actions.
- **Non-Intrusive Communication:** Use toasts or snackbars for status updates (like "Feed Refreshed") to avoid breaking the user's reading flow with modal dialogs.

## Privacy & Security
- **Zero-Telemetry Policy:** The application must not include any tracking, analytics, or external reporting. All user data, reading habits, and configurations must remain strictly within the user's self-hosted environment.
- **Local Control:** Users should have full visibility into how their data is processed.

## Content Presentation (Reader View)
- **Distraction-Free Reading:** The primary reader view should strip away website clutter, focusing on a clean, formatted representation of the article text.
- **Source Context:** While minimalist, the UI should retain the context of the source through the use of favicons and source-specific accent colors to help users quickly identify the origin of the content.
- **Rich Media Integration:** High-quality images and video embeds should be prioritized and displayed prominently to provide a rich consumption experience.