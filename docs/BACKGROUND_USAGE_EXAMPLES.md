# Background Animation - Usage Examples

Quick reference for using the customizable background animation system.

## Basic Usage (Default Settings)

```tsx
import { BackgroundGradientAnimation } from '@/components/common/background-gradient-animation';

function App() {
  return (
    <BackgroundGradientAnimation>
      <YourContent />
    </BackgroundGradientAnimation>
  );
}
```

## Using Presets

The easiest way to customize is using presets:

```tsx
import { BackgroundGradientAnimation } from '@/components/common/background-gradient-animation';
import { vibrantNeon } from '@/components/common/background-presets';

function App() {
  return (
    <BackgroundGradientAnimation {...vibrantNeon}>
      <YourContent />
    </BackgroundGradientAnimation>
  );
}
```

### Available Presets

```tsx
import {
  defaultPreset,        // Standard balanced look
  vibrantNeon,          // High energy, bright colors, fast
  subtleCalm,           // Muted colors, slow, peaceful
  oceanWaves,           // Blue and teal, flowing
  sunsetGlow,           // Warm orange/pink, gentle
  forestDream,          // Green and earthy, organic
  cyberpunk,            // High contrast neon, fast chaotic
  minimalMonochrome,    // Black and white, subtle
  auroraBorealis,       // Purple and green northern lights
} from '@/components/common/background-presets';
```

## Custom Colors Only

```tsx
<BackgroundGradientAnimation
  firstColor="255, 100, 150"
  secondColor="100, 200, 255"
  thirdColor="255, 200, 100"
>
  <YourContent />
</BackgroundGradientAnimation>
```

## Custom Speed Only

```tsx
<BackgroundGradientAnimation
  animationSpeeds={{
    first: 60,   // Slow
    second: 10,  // Fast
    third: 40,
    fourth: 40,
    fifth: 20,
  }}
>
  <YourContent />
</BackgroundGradientAnimation>
```

## Custom Blur Only

```tsx
<BackgroundGradientAnimation
  blurAmount="blur-3xl"        // More blur
  filterBlurAmount={60}        // Higher blur in pixels
>
  <YourContent />
</BackgroundGradientAnimation>
```

## Minimal/Subtle Background

```tsx
<BackgroundGradientAnimation
  opacities={{
    first: 0.2,
    second: 0.2,
    third: 0.2,
    fourth: 0.2,
    fifth: 0.2,
    pointer: 0.1,
  }}
  gradientIntensities={{
    first: 0.2,
    second: 0.2,
    third: 0.2,
    fourth: 0.2,
    fifth: 0.2,
    pointer: 0.1,
  }}
  blurAmount="blur-3xl"
>
  <YourContent />
</BackgroundGradientAnimation>
```

## Full Customization

```tsx
<BackgroundGradientAnimation
  // Colors
  firstColor="255, 0, 0"
  secondColor="0, 255, 0"
  thirdColor="0, 0, 255"
  fourthColor="255, 255, 0"
  fifthColor="255, 0, 255"
  pointerColor="0, 255, 255"
  
  // Animation speeds
  animationSpeeds={{
    first: 25,
    second: 15,
    third: 35,
    fourth: 30,
    fifth: 20,
  }}
  
  // Blur
  blurAmount="blur-xl"
  safariBlurAmount="blur-2xl"
  filterBlurAmount={50}
  
  // Opacity
  opacities={{
    first: 0.9,
    second: 0.8,
    third: 0.9,
    fourth: 0.7,
    fifth: 0.8,
    pointer: 0.6,
  }}
  
  // Gradient intensity
  gradientIntensities={{
    first: 0.7,
    second: 0.6,
    third: 0.7,
    fourth: 0.5,
    fifth: 0.6,
    pointer: 0.4,
  }}
  
  // Other options
  size="70%"
  blendingValue="screen"
  interactive={true}
>
  <YourContent />
</BackgroundGradientAnimation>
```

## Mixing Presets with Custom Props

You can override specific properties from a preset:

```tsx
import { oceanWaves } from '@/components/common/background-presets';

<BackgroundGradientAnimation
  {...oceanWaves}
  // Override just the speed
  animationSpeeds={{
    first: 10,   // Much faster than preset
    second: 8,
    third: 12,
    fourth: 15,
    fifth: 9,
  }}
>
  <YourContent />
</BackgroundGradientAnimation>
```

## Conditional Theming

```tsx
import { useTheme } from '@/hooks/useTheme';
import { vibrantNeon, subtleCalm } from '@/components/common/background-presets';

function App() {
  const { isDark } = useTheme();
  
  return (
    <BackgroundGradientAnimation {...(isDark ? vibrantNeon : subtleCalm)}>
      <YourContent />
    </BackgroundGradientAnimation>
  );
}
```

## Dynamic Selection with State

```tsx
import { useState } from 'react';
import { presets, PresetName } from '@/components/common/background-presets';

function App() {
  const [selectedPreset, setSelectedPreset] = useState<PresetName>('vibrantNeon');
  
  return (
    <>
      <select onChange={(e) => setSelectedPreset(e.target.value as PresetName)}>
        <option value="vibrantNeon">Vibrant Neon</option>
        <option value="subtleCalm">Subtle Calm</option>
        <option value="oceanWaves">Ocean Waves</option>
        {/* ... more options */}
      </select>
      
      <BackgroundGradientAnimation {...presets[selectedPreset]}>
        <YourContent />
      </BackgroundGradientAnimation>
    </>
  );
}
```

## Disable Interactive Blob

```tsx
<BackgroundGradientAnimation
  interactive={false}  // No mouse-following blob
>
  <YourContent />
</BackgroundGradientAnimation>
```

## Performance Mode (Mobile-Friendly)

```tsx
import { useIsMobile } from '@/components/utility/useIsMobile';

function App() {
  const { isMobile } = useIsMobile();
  
  return (
    <BackgroundGradientAnimation
      blurAmount={isMobile ? 'blur-md' : 'blur-xl'}
      opacities={isMobile ? {
        first: 0.5,
        second: 0.4,
        third: 0.5,
        fourth: 0.4,
        fifth: 0.4,
        pointer: 0.3,
      } : undefined}
      animationSpeeds={isMobile ? {
        first: 50,
        second: 40,
        third: 60,
        fourth: 55,
        fifth: 45,
      } : undefined}
      interactive={!isMobile}
    >
      <YourContent />
    </BackgroundGradientAnimation>
  );
}
```

## Integration in Layout

In `src/app/layout.tsx`:

```tsx
import { BackgroundGradientAnimation } from '@/components/common/background-gradient-animation';
import { oceanWaves } from '@/components/common/background-presets';

function RootInner({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex w-full h-dvh overflow-hidden bg-primary">
      <LoadingWrapper>
        <BackgroundGradientAnimation {...oceanWaves}>
          {children}
        </BackgroundGradientAnimation>
      </LoadingWrapper>
    </main>
  );
}
```

## RGB Color Format Helper

Need to convert hex to RGB? Use this quick reference:

```tsx
// Hex: #FF5733
// RGB: "255, 87, 51"

// Hex: #3498DB
// RGB: "52, 152, 219"

// You can use online tools or this JS function:
function hexToRgbString(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "0, 0, 0";
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}
```

## Tips

1. **Start with a preset** - It's easier to modify a preset than start from scratch
2. **Test on real content** - What looks good on a blank screen might not work with actual UI
3. **Consider readability** - Lower opacity/intensity if you have text overlays
4. **Match the mood** - Slow animations for professional/calm, fast for energetic/playful
5. **Mobile matters** - Test on mobile devices and adjust blur/opacity as needed


