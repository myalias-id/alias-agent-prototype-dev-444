'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as React from 'react';

import { cn } from '@/lib/utils';

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

type PopoverContentProps = React.ComponentPropsWithoutRef<
  typeof PopoverPrimitive.Content
> & {
  className?: string;
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  containerWidth?: number;
};

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  PopoverContentProps
>(
  (
    { className, align = 'center', sideOffset = 4, containerWidth, ...props },
    ref
  ) => {
    const maxWidthStyle = containerWidth
      ? ({
          '--popover-max-width': `${containerWidth}px`,
        } as React.CSSProperties)
      : {};

    return (
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          ref={ref}
          align={align}
          sideOffset={sideOffset}
          style={maxWidthStyle}
          className={cn(
            'z-50',
            'bg-background gap-4 rounded-lg border p-6 shadow-lg duration-200',
            'max-w-[var(--popover-max-width,384px)]',
            className
          )}
          {...props}
        />
      </PopoverPrimitive.Portal>
    );
  }
);
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverContent, PopoverTrigger };
