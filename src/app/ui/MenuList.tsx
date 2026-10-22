import type { ReactNode } from 'react';
import { useMenu, type MenuOptions } from '../useMenu';
import type { InputSource } from '../../input/InputRouter';

export interface MenuItem { label: ReactNode; onSelect: (source: InputSource) => void; testId?: string; disabled?: boolean }

/** Vertical menu operable by pad, keyboard and mouse. */
export function MenuList(props: { items: MenuItem[]; initial?: number; onCancel?: () => void; enabled?: boolean; className?: string } & Pick<MenuOptions, 'onLeft' | 'onRight'>) {
  const { items } = props;
  const { index, setIndex } = useMenu({
    count: items.length,
    initial: props.initial,
    enabled: props.enabled,
    onConfirm: (i, src) => { if (!items[i].disabled) items[i].onSelect(src); },
    onCancel: props.onCancel,
    onLeft: props.onLeft,
    onRight: props.onRight,
  });
  return (
    <ul className={`menu ${props.className ?? ''}`} role="menu">
      {items.map((it, i) => (
        <li key={i} role="menuitem" data-testid={it.testId} className={`menu-item ${i === index ? 'focused' : ''} ${it.disabled ? 'disabled' : ''}`}
          onMouseEnter={() => setIndex(i)} onClick={() => { if (!it.disabled) it.onSelect('keyboard'); }}>
          <span className="cursor">{i === index ? '▶' : ''}</span>
          {it.label}
        </li>
      ))}
    </ul>
  );
}
