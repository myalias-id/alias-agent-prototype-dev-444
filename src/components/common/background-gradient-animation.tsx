'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import useAgentStore from '@/store/useAgentStore';

export const BackgroundGradientAnimation = ({
  size = '60%',
  blendingValue = 'soft-light',
  children,
  className,
  interactive = true,
  containerClassName,
  // Color customization (RGB format: "r, g, b")
  firstColor,
  secondColor,
  thirdColor,
  fourthColor,
  fifthColor,
  pointerColor,
  // Blur customization
  blurAmount = 'blur-lg',
  safariBlurAmount = 'blur-2xl',
  filterBlurAmount = 40,
  // Animation speed customization (in seconds)
  animationSpeeds = {
    first: 30,
    second: 20,
    third: 40,
    fourth: 40,
    fifth: 20,
  },
  // Opacity customization (0-1)
  opacities = {
    first: 0.8,
    second: 0.7,
    third: 0.7,
    fourth: 0.6,
    fifth: 0.7,
    pointer: 0.6,
  },
  // Gradient intensity (0-1, multiplied with base opacity)
  gradientIntensities = {
    first: 0.6,
    second: 0.5,
    third: 0.5,
    fourth: 0.4,
    fifth: 0.5,
    pointer: 0.3,
  },
}: {
  size?: string;
  blendingValue?: string;
  children?: React.ReactNode;
  className?: string;
  interactive?: boolean;
  containerClassName?: string;
  firstColor?: string;
  secondColor?: string;
  thirdColor?: string;
  fourthColor?: string;
  fifthColor?: string;
  pointerColor?: string;
  blurAmount?: string;
  safariBlurAmount?: string;
  filterBlurAmount?: number;
  animationSpeeds?: {
    first: number;
    second: number;
    third: number;
    fourth: number;
    fifth: number;
  };
  opacities?: {
    first: number;
    second: number;
    third: number;
    fourth: number;
    fifth: number;
    pointer: number;
  };
  gradientIntensities?: {
    first: number;
    second: number;
    third: number;
    fourth: number;
    fifth: number;
    pointer: number;
  };
}) => {
  const { isDark } = useTheme();
  const interactiveRef = useRef<HTMLDivElement>(null);
  const agent = useAgentStore((state) => state.agent);
  const [backgroundImage, setBackgroundImage] = useState<string>('');

  // Update background when theme changes
  useEffect(() => {
    const newBackground = isDark
      ? agent?.defaults?.backgroundDarkModeURL
      : agent?.defaults?.backgroundLightModeURL;

    setBackgroundImage(newBackground || '');
  }, [isDark]);

  // Theme-based colors with custom overrides
  const defaultColors = isDark
    ? {
        gradientBackgroundStart: 'rgb(5, 5, 15)',
        gradientBackgroundEnd: 'rgb(15, 15, 25)',
        firstColor: '59, 130, 246', // Blue
        secondColor: '168, 85, 247', // Purple
        thirdColor: '34, 197, 94', // Green
        fourthColor: '251, 146, 60', // Orange
        fifthColor: '236, 72, 153', // Pink
        pointerColor: '99, 102, 241', // Indigo
      }
    : {
        gradientBackgroundStart: 'rgb(250, 250, 250)',
        gradientBackgroundEnd: 'rgb(240, 242, 245)',
        firstColor: '59, 130, 246', // Blue
        secondColor: '168, 85, 247', // Purple
        thirdColor: '34, 197, 94', // Green
        fourthColor: '251, 146, 60', // Orange
        fifthColor: '236, 72, 153', // Pink
        pointerColor: '99, 102, 241', // Indigo
      };

  const colors = {
    ...defaultColors,
    ...(firstColor && { firstColor }),
    ...(secondColor && { secondColor }),
    ...(thirdColor && { thirdColor }),
    ...(fourthColor && { fourthColor }),
    ...(fifthColor && { fifthColor }),
    ...(pointerColor && { pointerColor }),
  };

  const [curX, setCurX] = useState(0);
  const [curY, setCurY] = useState(0);
  const [tgX, setTgX] = useState(0);
  const [tgY, setTgY] = useState(0);
  useEffect(() => {
    document.body.style.setProperty(
      '--gradient-background-start',
      colors.gradientBackgroundStart
    );
    document.body.style.setProperty(
      '--gradient-background-end',
      colors.gradientBackgroundEnd
    );
    document.body.style.setProperty('--first-color', colors.firstColor);
    document.body.style.setProperty('--second-color', colors.secondColor);
    document.body.style.setProperty('--third-color', colors.thirdColor);
    document.body.style.setProperty('--fourth-color', colors.fourthColor);
    document.body.style.setProperty('--fifth-color', colors.fifthColor);
    document.body.style.setProperty('--pointer-color', colors.pointerColor);
    document.body.style.setProperty('--size', size);
    document.body.style.setProperty('--blending-value', blendingValue);
  }, [colors, size, blendingValue]);

  useEffect(() => {
    function move() {
      if (!interactiveRef.current) {
        return;
      }
      setCurX(curX + (tgX - curX) / 20);
      setCurY(curY + (tgY - curY) / 20);
      interactiveRef.current.style.transform = `translate(${Math.round(
        curX
      )}px, ${Math.round(curY)}px)`;
    }

    move();
  }, [tgX, tgY]);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (interactiveRef.current) {
      const rect = interactiveRef.current.getBoundingClientRect();
      setTgX(event.clientX - rect.left);
      setTgY(event.clientY - rect.top);
    }
  };

  const [isSafari, setIsSafari] = useState(false);
  useEffect(() => {
    setIsSafari(/^((?!chrome|android).)*safari/i.test(navigator.userAgent));
  }, []);

  if (backgroundImage) {
    return (
      <div
        className={cn(
          'h-screen w-screen relative overflow-hidden top-0 left-0 ',
          containerClassName
        )}>
        {/* Blurred background layer for black bar areas */}
        <Image
          priority
          quality={100}
          src={backgroundImage}
          alt="Background blur"
          fill
          className="object-cover blur-2xl scale-105 opacity-75"
          draggable={false}
          style={{ zIndex: 0 }}
        />
        {/* Main image with proper aspect ratio */}
        <Image
          priority
          quality={100}
          src={backgroundImage}
          alt="Background"
          fill
          className="object-cover"
          draggable={false}
          style={{ zIndex: 1 }}
        />
        <div className={cn('', className)}>{children}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'h-screen w-screen relative overflow-hidden top-0 left-0 bg-[linear-gradient(40deg,var(--gradient-background-start),var(--gradient-background-end))]',
        containerClassName
      )}>
      <svg className="hidden">
        <defs>
          <filter id="blurMe">
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="10"
              result="blur"
            />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>
      <div className={cn('', className)}>{children}</div>
      <div
        className={cn(
          'gradients-container h-full w-full',
          blurAmount,
          isSafari ? safariBlurAmount : ''
        )}
        style={
          !isSafari
            ? { filter: `url(#blurMe) blur(${filterBlurAmount}px)` }
            : undefined
        }>
        <div
          className={cn(
            `absolute w-[var(--size)] h-[var(--size)] top-[calc(50%-var(--size)/2)] left-[calc(50%-var(--size)/2)]`,
            `[mix-blend-mode:var(--blending-value)]`,
            `[transform-origin:center_center]`
          )}
          style={{
            background: `radial-gradient(circle at center, rgba(var(--first-color), ${gradientIntensities.first}) 0, rgba(var(--first-color), 0) 50%)`,
            animation: `moveVertical ${animationSpeeds.first}s ease infinite`,
            opacity: opacities.first,
          }}></div>
        <div
          className={cn(
            `absolute w-[var(--size)] h-[var(--size)] top-[calc(50%-var(--size)/2)] left-[calc(50%-var(--size)/2)]`,
            `[mix-blend-mode:var(--blending-value)]`,
            `[transform-origin:calc(50%-400px)]`
          )}
          style={{
            background: `radial-gradient(circle at center, rgba(var(--second-color), ${gradientIntensities.second}) 0, rgba(var(--second-color), 0) 50%)`,
            animation: `moveInCircle ${animationSpeeds.second}s reverse infinite`,
            opacity: opacities.second,
          }}></div>
        <div
          className={cn(
            `absolute w-[var(--size)] h-[var(--size)] top-[calc(50%-var(--size)/2)] left-[calc(50%-var(--size)/2)]`,
            `[mix-blend-mode:var(--blending-value)]`,
            `[transform-origin:calc(50%+400px)]`
          )}
          style={{
            background: `radial-gradient(circle at center, rgba(var(--third-color), ${gradientIntensities.third}) 0, rgba(var(--third-color), 0) 50%)`,
            animation: `moveInCircle ${animationSpeeds.third}s linear infinite`,
            opacity: opacities.third,
          }}></div>
        <div
          className={cn(
            `absolute w-[var(--size)] h-[var(--size)] top-[calc(50%-var(--size)/2)] left-[calc(50%-var(--size)/2)]`,
            `[mix-blend-mode:var(--blending-value)]`,
            `[transform-origin:calc(50%-200px)]`
          )}
          style={{
            background: `radial-gradient(circle at center, rgba(var(--fourth-color), ${gradientIntensities.fourth}) 0, rgba(var(--fourth-color), 0) 50%)`,
            animation: `moveHorizontal ${animationSpeeds.fourth}s ease infinite`,
            opacity: opacities.fourth,
          }}></div>
        <div
          className={cn(
            `absolute w-[var(--size)] h-[var(--size)] top-[calc(50%-var(--size)/2)] left-[calc(50%-var(--size)/2)]`,
            `[mix-blend-mode:var(--blending-value)]`,
            `[transform-origin:calc(50%-800px)_calc(50%+800px)]`
          )}
          style={{
            background: `radial-gradient(circle at center, rgba(var(--fifth-color), ${gradientIntensities.fifth}) 0, rgba(var(--fifth-color), 0) 50%)`,
            animation: `moveInCircle ${animationSpeeds.fifth}s ease infinite`,
            opacity: opacities.fifth,
          }}></div>

        {interactive && (
          <div
            ref={interactiveRef}
            onMouseMove={handleMouseMove}
            className={cn(
              `absolute w-full h-full -top-1/2 -left-1/2`,
              `[mix-blend-mode:var(--blending-value)]`
            )}
            style={{
              background: `radial-gradient(circle at center, rgba(var(--pointer-color), ${gradientIntensities.pointer}) 0, rgba(var(--pointer-color), 0) 50%)`,
              opacity: opacities.pointer,
            }}></div>
        )}
      </div>
    </div>
  );
};
