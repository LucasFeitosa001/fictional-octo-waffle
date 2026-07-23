import type { MouseEventHandler, ReactNode } from 'react';

type AnimatedSelectionCellProps = {
  active: boolean;
  children: ReactNode;
  className?: string;
  header?: boolean;
  onClick?: MouseEventHandler<HTMLTableCellElement>;
};

export function AnimatedSelectionCell({
  active,
  children,
  className = '',
  header = false,
  onClick,
}: AnimatedSelectionCellProps) {
  const cellClassName = [
    'overflow-hidden transition-[width,max-width,padding,opacity] duration-200 ease-out',
    active
      ? `w-10 max-w-10 opacity-100 ${className}`
      : 'pointer-events-none w-0 max-w-0 px-0 opacity-0',
  ].join(' ');
  const content = (
    <span
      className={[
        'grid place-items-center transition-[opacity,transform] duration-200 ease-out',
        active ? 'scale-100 opacity-100 delay-75' : 'scale-75 opacity-0',
      ].join(' ')}
    >
      {children}
    </span>
  );

  if (header) {
    return (
      <th className={cellClassName} aria-hidden={!active} inert={!active}>
        {content}
      </th>
    );
  }

  return (
    <td className={cellClassName} aria-hidden={!active} inert={!active} onClick={onClick}>
      {content}
    </td>
  );
}
