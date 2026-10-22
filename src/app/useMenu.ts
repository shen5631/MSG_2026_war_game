import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Services } from './bridge';
import type { InputSource } from '../input/InputRouter';

export const ServicesContext = createContext<Services | null>(null);
export function useServices(): Services {
  const s = useContext(ServicesContext);
  if (!s) throw new Error('ServicesContext missing');
  return s;
}

// Only the most recently mounted enabled menu receives navigation (dialogs over menus).
const stack: number[] = [];
let counter = 0;

export interface MenuOptions {
  count: number;
  initial?: number;
  horizontal?: boolean;
  enabled?: boolean;
  onConfirm?: (index: number, source: InputSource) => void;
  onCancel?: () => void;
  onLeft?: (index: number) => void;
  onRight?: (index: number) => void;
}

export function useMenu(opts: MenuOptions): { index: number; setIndex: (i: number) => void } {
  const { router, audio } = useServices();
  const [index, setIndex] = useState(opts.initial ?? 0);
  const latest = useRef({ opts, index });
  latest.current = { opts, index };
  const enabled = opts.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;
    const id = ++counter;
    stack.push(id);
    const off = router.onMenu((e) => {
      if (stack[stack.length - 1] !== id) return;
      const { opts: o, index: i } = latest.current;
      const prev = o.horizontal ? 'left' : 'up';
      const next = o.horizontal ? 'right' : 'down';
      if (e.action === prev || e.action === next) {
        if (o.count <= 0) return;
        const ni = (i + (e.action === next ? 1 : -1) + o.count) % o.count;
        setIndex(ni);
        latest.current.index = ni;
        audio.playSfx('menuMove');
      } else if (e.action === 'left' && o.onLeft) o.onLeft(i);
      else if (e.action === 'right' && o.onRight) o.onRight(i);
      else if (e.action === 'confirm' && !e.repeat) {
        audio.playSfx('menuConfirm');
        o.onConfirm?.(i, e.source);
      } else if (e.action === 'cancel' && !e.repeat) o.onCancel?.();
    });
    return () => {
      off();
      const k = stack.indexOf(id);
      if (k >= 0) stack.splice(k, 1);
    };
  }, [enabled, router, audio]);

  return { index, setIndex };
}
