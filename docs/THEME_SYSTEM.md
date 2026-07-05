# Theme System Documentation

This document describes the dark/light mode theme system implemented in the Alias Agent Prototype.

## Overview

The theme system provides a comprehensive dark/light mode implementation with the following features:

- **Three theme modes**: Light, Dark, and System (follows OS preference)
- **Persistent storage**: Theme preference is saved in localStorage
- **System theme detection**: Automatically detects and responds to OS theme changes
- **CSS Custom Properties**: Uses CSS variables for dynamic theming
- **Tailwind Integration**: Seamlessly integrates with Tailwind CSS
- **TypeScript Support**: Fully typed theme system

## Architecture

### Core Files

1. **`src/types/theme.ts`** - TypeScript interfaces and types
2. **`src/lib/theme.ts`** - Theme utilities and color definitions
3. **`src/context/theme-context.tsx`** - React context provider
4. **`src/components/ui/theme-toggle.tsx`** - Theme toggle components
5. **`src/app/globals.css`** - CSS custom properties
6. **`tailwind.config.js`** - Tailwind theme configuration

### Theme Colors

The system defines comprehensive color palettes for both light and dark modes:

#### Background Colors
- `background` - Main background color
- `backgroundSecondary` - Secondary background color
- `backgroundTertiary` - Tertiary background color

#### Foreground Colors
- `foreground` - Main text color
- `foregroundSecondary` - Secondary text color
- `foregroundTertiary` - Tertiary text color

#### Primary Colors
- `primary` - Brand color (#3BE2BE)
- `primaryForeground` - Text on primary background
- `primaryMuted` - Muted primary color

#### Border Colors
- `border` - Main border color
- `borderSecondary` - Secondary border color

#### Semantic Colors
- `destructive` - Error/delete actions
- `success` - Success states
- `warning` - Warning states
- `info` - Information states
- `accent` - Accent color

## Usage

### Basic Theme Toggle

```tsx
import { ThemeToggle } from '@/components/ui/theme-toggle';

function MyComponent() {
  return <ThemeToggle />;
}
```

### Theme Toggle Variants

```tsx
import { ThemeToggle, ThemeToggleIcon, ThemeToggleDropdown } from '@/components/ui/theme-toggle';

// Simple icon toggle
<ThemeToggleIcon />

// Dropdown with all options
<ThemeToggleDropdown />

// Custom variant
<ThemeToggle variant="default" showLabels={false} />
```

### Using Theme Context

```tsx
import { useTheme } from '@/hooks/useTheme';

function MyComponent() {
  const { theme, isDark, setTheme, toggleTheme } = useTheme();
  
  return (
    <div>
      <p>Current theme: {theme}</p>
      <p>Is dark mode: {isDark ? 'Yes' : 'No'}</p>
      <button onClick={() => setTheme('light')}>Light</button>
      <button onClick={() => setTheme('dark')}>Dark</button>
      <button onClick={() => setTheme('system')}>System</button>
      <button onClick={toggleTheme}>Toggle</button>
    </div>
  );
}
```

### Theme-Aware Styling

Use the theme-aware Tailwind classes:

```tsx
// Background colors
<div className="bg-background">Main background</div>
<div className="bg-backgroundSecondary">Secondary background</div>

// Text colors
<p className="text-foreground">Main text</p>
<p className="text-foregroundSecondary">Secondary text</p>
<p className="text-mutedForeground">Muted text</p>

// Border colors
<div className="border border-border">Bordered element</div>

// Semantic colors
<button className="bg-destructive text-destructiveForeground">Delete</button>
<button className="bg-success text-successForeground">Save</button>
```

## CSS Custom Properties

The theme system automatically sets CSS custom properties on the `:root` element:

```css
:root {
  --color-background: #ffffff;
  --color-foreground: #0c0c0c;
  --color-primary: #3BE2BE;
  /* ... more colors */
}

.dark {
  --color-background: #0c0c0c;
  --color-foreground: #ffffff;
  /* ... dark mode overrides */
}
```

## Migration Guide

### From Hardcoded Colors

**Before:**
```tsx
<div className="bg-black text-white border border-white">
  Content
</div>
```

**After:**
```tsx
<div className="bg-background text-foreground border border-border">
  Content
</div>
```

### Common Replacements

| Old | New |
|-----|-----|
| `bg-black` | `bg-background` |
| `text-white` | `text-foreground` |
| `border-white` | `border-border` |
| `bg-white` | `bg-background` |
| `text-black` | `text-foreground` |

## Best Practices

1. **Use semantic color names**: Prefer `text-foreground` over `text-white`
2. **Leverage opacity modifiers**: Use `bg-background/10` for subtle backgrounds
3. **Test both themes**: Always test your components in both light and dark modes
4. **Use the demo component**: Check `src/components/ui/theme-demo.tsx` for examples
5. **Avoid hardcoded colors**: Use theme-aware classes whenever possible

## Troubleshooting

### Theme Not Persisting
- Check if localStorage is available
- Verify the theme is being saved correctly

### Hydration Mismatch
- The theme provider handles hydration automatically
- Ensure the ThemeProvider wraps your app

### Colors Not Updating
- Check that CSS custom properties are being set
- Verify Tailwind classes are using theme variables
- Ensure the theme class is applied to the document

## Future Enhancements

- High contrast mode support
- Custom theme creation
- Animation transitions between themes
- Theme-aware images and icons
