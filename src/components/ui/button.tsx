import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import Link from 'next/link';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm qhd:text-lg font-geist font-extrabold ring-offset-background transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50  ',
  {
    variants: {
      variant: {
        primary:
          'bg-primary border border-primary hover:bg-transparent text-primaryForeground hover:text-primary',
        glass:
          'bg-background/60 hover:text-foreground/95 hover:bg-background/40 text-foreground backdrop-blur-md duration-500 transition-colors',
        default:
          ' border border-white/10 text-black  text-sm leading-[84%] font-semibold hover:[background:color-mix(in_srgb,var(--color-alias)_50%,transparent)] hover:text-white hover:border-[var(--color-alias)] hover:backdrop-blur-xl  w-full transition-all duration-300 ',
        destructive:
          'bg-destructive text-destructiveForeground hover:bg-destructive/90',
        outline:
          'border border-primary hover:bg-primary hover:text-primaryForeground text-primary',
        secondary:
          'bg-backgroundSecondary text-foreground hover:bg-backgroundSecondary/80',
        ghost: 'hover:bg-backgroundSecondary',
        link: 'text-foreground underline-offset-4 hover:underline',
        reversePrimary: 'bg-foreground text-primary',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'h-[36px]  w-[36px] rounded-md',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  href?: string;
  target?: '_blank' | '_self' | '_parent' | '_top'; // Added the target attribute for link behavior
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, href, target, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';
    return href ? (
      <Link href={href} target={target ? '_blank' : '_self'} className="w-max">
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        />
      </Link>
    ) : (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
