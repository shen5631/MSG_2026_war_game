// Minimal typing of the dev-only test hooks (see src/debug/testHooks.ts).
export {};
declare global {
  interface Window {
    __GGC__?: {
      state: () => Record<string, unknown>;
      canvasCount: () => number;
      atlasFrameCount: () => number;
      playerSpriteFrame: () => string | null;
    };
  }
}
