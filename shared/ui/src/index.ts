/**
 * @doc-platform/ui
 * Shared Preact UI components with element-based styling.
 *
 * Import CSS files:
 * - `@doc-platform/ui/tokens.css` - Design tokens (colors, spacing, etc.)
 * - `@doc-platform/ui/elements.css` - Base element styles (button, input, textarea)
 *
 * Components use typed props for variants and sizes:
 * - <Button variant="secondary" size="sm">
 * - <Text size="lg" error>
 * - <Textarea error>
 *
 * Native HTML elements are styled automatically by elements.css,
 * enabling SSR pages to use the same styles without JavaScript.
 */

// Button
export { Button } from './Button/Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button/Button';

// Dialog
export { Dialog } from './Dialog/Dialog';
export type { DialogProps } from './Dialog/Dialog';

// Text (text input)
export { Text } from './Text/Text';
export type { TextProps, TextSize } from './Text/Text';

// Textarea
export { Textarea } from './Textarea/Textarea';
export type { TextareaProps, TextareaSize } from './Textarea/Textarea';

// Select
export { Select } from './Select/Select';
export type { SelectProps, SelectOption, SelectSize } from './Select/Select';

// Card
export { Card } from './Card/Card';
export type { CardProps } from './Card/Card';

// Badge
export { Badge } from './Badge/Badge';
export type { BadgeProps } from './Badge/Badge';

// StatusDot
export { StatusDot } from './StatusDot/StatusDot';
export type { StatusDotProps, StatusType } from './StatusDot/StatusDot';

// UserMenu
export { UserMenu } from './UserMenu/UserMenu';
export type { UserMenuProps } from './UserMenu/UserMenu';

// AppHeader
export { AppHeader } from './AppHeader/AppHeader';
export type { AppHeaderProps, NavTab } from './AppHeader/AppHeader';
