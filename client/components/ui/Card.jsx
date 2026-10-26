// A surface for lists and panels. Uses the paper colour, so it works in light and dark themes.
export function Card({ as: Tag = 'div', className = '', children, ...props }) {
  return <Tag className={`duo-card surface-card rounded-2xl border border-gold/25 bg-paper/90 p-4 sm:p-5 shadow-md transition-all ${className}`} {...props}>{children}</Tag>;
}
