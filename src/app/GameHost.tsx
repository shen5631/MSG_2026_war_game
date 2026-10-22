import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type Phaser from 'phaser';
import { STORY, VIEW_H, VIEW_W } from '../config/spec';
import { createGame } from '../game/createGame';
import { useServices } from './useMenu';

/** scale = floor(min(w/640, h/360)); canvas and React HUD share the same integer factor. */
export function integerScale(w: number, h: number): number {
  return Math.floor(Math.min(w / VIEW_W, h / VIEW_H));
}

export function GameHost({ children }: { children: ReactNode }) {
  const s = useServices();
  const canvasParent = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [scale, setScale] = useState(1);
  const [tooSmall, setTooSmall] = useState(false);
  const scaleRef = useRef(1);

  // One Phaser instance per mount; StrictMode remounts destroy the previous one first.
  useEffect(() => {
    const game = createGame(canvasParent.current!, s);
    gameRef.current = game;
    const applyZoom = () => { try { game.scale.setZoom(scaleRef.current); } catch { /* not booted yet */ } };
    game.events.once('ready', applyZoom);
    return () => {
      gameRef.current = null;
      game.destroy(true);
    };
  }, [s]);

  useEffect(() => s.router.attach(window), [s]);

  useLayoutEffect(() => {
    const measure = () => {
      const root = document.querySelector('.app-root') as HTMLElement | null;
      const w = root?.clientWidth ?? window.innerWidth;
      const h = root?.clientHeight ?? window.innerHeight;
      const sc = integerScale(w, h);
      const small = sc < 1;
      const eff = Math.max(1, sc);
      scaleRef.current = eff;
      setScale(eff);
      setTooSmall(small);
      try { gameRef.current?.scale.setZoom(eff); } catch { /* not booted yet */ }
      if (small) s.controller.addAutoPause('viewport-small', STORY.ui.smallViewport);
      else s.controller.clearAutoPause('viewport-small');
    };
    measure();
    window.addEventListener('resize', measure);
    document.addEventListener('fullscreenchange', measure);
    return () => {
      window.removeEventListener('resize', measure);
      document.removeEventListener('fullscreenchange', measure);
    };
  }, [s]);

  // Tab hidden / focus loss → safe pause; returning never auto-resumes.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) s.controller.addAutoPause('hidden');
      else s.controller.clearAutoPause('hidden');
    };
    const onBlur = () => {
      s.router.releaseAll();
      s.controller.addAutoPause('focus-lost');
    };
    const onFocus = () => s.controller.clearAutoPause('focus-lost');
    // Audio may only start from trusted input (click / key); gamepad presses do not count.
    const unlock = () => s.audio.unlock();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [s]);

  // Gamepad disconnect pauses only sessions that were using the pad.
  useEffect(() => {
    let lastDevice = s.router.combatDevice;
    const offPad = s.router.onPadStatus((st) => {
      if (st.disconnected && !st.active && lastDevice === 'pad') s.controller.addAutoPause('pad-disconnected');
      lastDevice = s.router.combatDevice;
    });
    const offPause = s.router.onPause(() => s.controller.pauseManual());
    return () => { offPad(); offPause(); };
  }, [s]);

  return (
    <div className="stage-wrap">
      <div className="stage" data-testid="stage" data-scale={scale} style={{ width: VIEW_W * scale, height: VIEW_H * scale }}>
        <div ref={canvasParent} className="canvas-parent" />
        <div className="ui-layer" style={{ transform: `scale(${scale})` }}>{children}</div>
      </div>
      {tooSmall && <div className="too-small" data-testid="too-small">{STORY.ui.smallViewport}</div>}
    </div>
  );
}
