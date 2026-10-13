// A surface for lists and panels. Uses the paper colour, so it works in light and dark themes.
export function Card({ as: Tag = 'div', className = '', children, ...props }) {
  return <Tag className={`rounded-md border border-sapphire/20 bg-paper p-4 ${className}`} {...props}>{children}</Tag>;
}
