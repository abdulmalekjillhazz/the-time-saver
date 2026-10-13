// Primary (filled) or secondary (outlined) button. Minimum 44px tap target.
export function Button({ variant = 'primary', className = '', children, ...props }) {
  const styles =
    variant === 'primary'
      ? 'primary-button bg-sapphire text-on-sapphire'
      : 'secondary-button border border-sapphire bg-transparent text-sapphire';
  return (
    <button
      type="button"
      className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl px-4 py-2.5 font-semibold ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
