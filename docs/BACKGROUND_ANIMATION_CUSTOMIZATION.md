# Background Animation Customization Guide

The `BackgroundGradientAnimation` component now supports extensive customization of colors, blur effects, animation speeds, and more!

## Overview

The animated background consists of 5 gradient blobs that move in different patterns:
1. **First blob**: Vertical movement
2. **Second blob**: Circular movement (reverse)
3. **Third blob**: Circular movement
4. **Fourth blob**: Horizontal movement
5. **Fifth blob**: Circular movement
6. **Pointer blob** (optional): Interactive blob that follows the mouse

## Available Customization Props

### Color Customization

Control the color of each gradient blob. Colors must be in RGB format as a string: `"r, g, b"` (values 0-255).

```tsx
<BackgroundGradientAnimation
  firstColor="255, 0, 0"      // Red
  secondColor="0, 255, 0"     // Green
  thirdColor="0, 0, 255"      // Blue
  fourthColor="255, 255, 0"   // Yellow
  fifthColor="255, 0, 255"    // Magenta
  pointerColor="0, 255, 255"  // Cyan
>
  {children}
</BackgroundGradientAnimation>
```

**Default colors (both light and dark mode):**
- First: `59, 130, 246` (Blue)
- Second: `168, 85, 247` (Purple)
- Third: `34, 197, 94` (Green)
- Fourth: `251, 146, 60` (Orange)
- Fifth: `236, 72, 153` (Pink)
- Pointer: `99, 102, 241` (Indigo)

### Animation Speed Customization

Control how fast each blob moves (in seconds). Higher values = slower movement.

```tsx
<BackgroundGradientAnimation
  animationSpeeds={{
    first: 60,   // Very slow vertical movement
    second: 10,  // Fast circular movement
    third: 40,   // Default
    fourth: 25,  // Medium-fast horizontal
    fifth: 15,   // Fast circular
  }}
>
  {children}
</BackgroundGradientAnimation>
```

**Default speeds:**
- First: 30s
- Second: 20s
- Third: 40s
- Fourth: 40s
- Fifth: 20s

### Blur Customization

Control the blur amount applied to the gradients.

```tsx
<BackgroundGradientAnimation
  blurAmount="blur-xl"           // Tailwind blur class (non-Safari)
  safariBlurAmount="blur-3xl"    // Tailwind blur class (Safari only)
  filterBlurAmount={60}          // Pixel value for CSS filter blur
>
  {children}
</BackgroundGradientAnimation>
```

**Default blur values:**
- `blurAmount`: `"blur-lg"`
- `safariBlurAmount`: `"blur-2xl"`
- `filterBlurAmount`: `40` (px)

**Available Tailwind blur classes:**
- `blur-none` - 0px
- `blur-sm` - 4px
- `blur` - 8px
- `blur-md` - 12px
- `blur-lg` - 16px
- `blur-xl` - 24px
- `blur-2xl` - 40px
- `blur-3xl` - 64px

### Opacity Customization

Control the overall opacity of each blob (0 = transparent, 1 = fully opaque).

```tsx
<BackgroundGradientAnimation
  opacities={{
    first: 1.0,    // Fully opaque
    second: 0.5,   // Half transparent
    third: 0.8,    // Mostly opaque
    fourth: 0.3,   // Very transparent
    fifth: 0.6,    // Semi-transparent
    pointer: 0.4,  // Interactive blob
  }}
>
  {children}
</BackgroundGradientAnimation>
```

**Default opacities:**
- First: 0.8
- Second: 0.7
- Third: 0.7
- Fourth: 0.6
- Fifth: 0.7
- Pointer: 0.6

### Gradient Intensity Customization

Control the color intensity at the center of each gradient (0-1). This is different from opacity - it affects how "bright" the color appears.

```tsx
<BackgroundGradientAnimation
  gradientIntensities={{
    first: 0.8,    // Very bright center
    second: 0.4,   // Subtle center
    third: 0.6,    // Medium intensity
    fourth: 0.2,   // Very subtle
    fifth: 0.7,    // Fairly bright
    pointer: 0.5,  // Interactive blob
  }}
>
  {children}
</BackgroundGradientAnimation>
```

**Default intensities:**
- First: 0.6
- Second: 0.5
- Third: 0.5
- Fourth: 0.4
- Fifth: 0.5
- Pointer: 0.3

### Other Existing Props

```tsx
<BackgroundGradientAnimation
  size="80%"                  // Size of gradient blobs (default: "60%")
  blendingValue="hard-light"  // CSS blend mode (default: "soft-light")
  interactive={false}         // Disable mouse-follow blob (default: true)
  className="custom-class"    // Custom class for inner content
  containerClassName="bg-red" // Custom class for container
>
  {children}
</BackgroundGradientAnimation>
```

## Example Presets

### Vibrant Neon Theme
```tsx
<BackgroundGradientAnimation
  firstColor="255, 0, 255"      // Magenta
  secondColor="0, 255, 255"     // Cyan
  thirdColor="255, 255, 0"      // Yellow
  fourthColor="255, 0, 128"     // Hot pink
  fifthColor="0, 255, 128"      // Bright green
  animationSpeeds={{
    first: 15,
    second: 10,
    third: 20,
    fourth: 15,
    fifth: 10,
  }}
  opacities={{
    first: 0.9,
    second: 0.9,
    third: 0.9,
    fourth: 0.8,
    fifth: 0.9,
    pointer: 0.7,
  }}
  gradientIntensities={{
    first: 0.8,
    second: 0.8,
    third: 0.8,
    fourth: 0.7,
    fifth: 0.8,
    pointer: 0.6,
  }}
  blurAmount="blur-xl"
/>
```

### Subtle Calm Theme
```tsx
<BackgroundGradientAnimation
  firstColor="100, 150, 200"    // Soft blue
  secondColor="150, 100, 200"   // Soft purple
  thirdColor="100, 200, 150"    // Soft green
  fourthColor="200, 150, 100"   // Soft orange
  fifthColor="200, 100, 150"    // Soft pink
  animationSpeeds={{
    first: 60,
    second: 50,
    third: 70,
    fourth: 60,
    fifth: 50,
  }}
  opacities={{
    first: 0.4,
    second: 0.3,
    third: 0.4,
    fourth: 0.3,
    fifth: 0.3,
    pointer: 0.2,
  }}
  gradientIntensities={{
    first: 0.3,
    second: 0.2,
    third: 0.3,
    fourth: 0.2,
    fifth: 0.2,
    pointer: 0.15,
  }}
  blurAmount="blur-3xl"
/>
```

### High Contrast Fast Theme
```tsx
<BackgroundGradientAnimation
  firstColor="255, 0, 0"        // Pure red
  secondColor="0, 0, 255"       // Pure blue
  thirdColor="255, 255, 255"    // White
  fourthColor="0, 0, 0"         // Black
  fifthColor="255, 255, 0"      // Pure yellow
  animationSpeeds={{
    first: 8,
    second: 5,
    third: 10,
    fourth: 8,
    fifth: 6,
  }}
  opacities={{
    first: 1.0,
    second: 1.0,
    third: 0.8,
    fourth: 0.5,
    fifth: 1.0,
    pointer: 0.8,
  }}
  gradientIntensities={{
    first: 0.9,
    second: 0.9,
    third: 0.7,
    fourth: 0.6,
    fifth: 0.9,
    pointer: 0.7,
  }}
  blurAmount="blur-md"
  blendingValue="difference"
/>
```

## Tips & Best Practices

1. **Balance colors**: Use complementary colors for a harmonious look, or contrasting colors for a bold statement.

2. **Match speeds to mood**: 
   - Slow (40-70s): Calm, professional, elegant
   - Medium (20-40s): Balanced, engaging
   - Fast (5-20s): Energetic, dynamic, exciting

3. **Adjust opacity for readability**: If you have text over the background, reduce opacities to ensure good contrast.

4. **Blur affects performance**: Higher blur values can impact performance on lower-end devices. Use with caution.

5. **Test in both themes**: Remember that the component has different default background colors for light and dark modes.

6. **Combine with blend modes**: Experiment with different `blendingValue` options:
   - `normal`, `multiply`, `screen`, `overlay`, `darken`, `lighten`
   - `color-dodge`, `color-burn`, `hard-light`, `soft-light`, `difference`

## Integration Example

In `layout.tsx`:

```tsx
import { BackgroundGradientAnimation } from '@/components/common/background-gradient-animation';

function RootInner({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex w-full h-dvh overflow-hidden bg-primary">
      <LoadingWrapper>
        <BackgroundGradientAnimation
          // Customize here
          firstColor="59, 130, 246"
          animationSpeeds={{ first: 30, second: 20, third: 40, fourth: 40, fifth: 20 }}
          blurAmount="blur-lg"
        >
          {children}
        </BackgroundGradientAnimation>
      </LoadingWrapper>
    </main>
  );
}
```

## Component Architecture

The component uses:
- **CSS Custom Properties** (`--first-color`, etc.) for dynamic color injection
- **Inline styles** for dynamic animation speeds and opacities
- **Tailwind classes** for responsive blur effects
- **CSS Keyframe animations** defined in `tailwind.config.js`:
  - `moveVertical`: Moves up and down
  - `moveInCircle`: Rotates 360 degrees
  - `moveHorizontal`: Moves left and right

## Performance Considerations

- Each gradient blob is a separate DOM element with CSS transforms
- The blur effect can be GPU-intensive, especially on mobile
- Consider reducing blur, opacity, or number of visible blobs on mobile devices
- The interactive blob only renders when `interactive={true}`


