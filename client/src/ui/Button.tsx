import type { ButtonHTMLAttributes } from 'react';
import { cls } from './cls.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: '',
  ghost: 'btn-ghost',
  danger: 'btn-win',
};

/**
 * Every button in the app. The short side is at least 44px.
 * `danger` is for win, exit, and kick. `primary` is the one next step.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  className,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={cls(
        'btn',
        'ui-btn',
        `ui-btn-${variant}`,
        `ui-btn-${size}`,
        VARIANT_CLASS[variant],
        fullWidth && 'ui-btn-block',
        className,
      )}
      {...rest}
    />
  );
}
