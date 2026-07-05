import Image from 'next/image';

import { cn } from '@/lib/utils';

type AvatarButtonProps = {
  src: string;
  alt: string;
  onClick: (e) => void;
  selected?: boolean; // Optional prop; if provided, applies a brightness style when false
  height?: number;
  width?: number;
  className?: string;
};

export function AvatarButton({
  src,
  alt,
  onClick,
  selected,
  height = 40,
  width = 40,
  className,
}: AvatarButtonProps) {
  // Base styling shared by both agent and profile buttons
  const baseClasses =
    'object-cover rounded-lg overflow-hidden border border-white/20 transition-all duration-200 hover:brightness-110';
  // For agents, if "selected" is provided and false, we dim the button.
  const brightnessClass =
    selected !== undefined && !selected ? ' brightness-50' : '';

  return (
    <button
      onClick={onClick}
      type="button"
      className={cn(baseClasses, brightnessClass, className)}
      style={{ width: `${width}px`, height: `${height}px` }}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="object-cover"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          maxWidth: '100%',
          maxHeight: '100%',
        }}
      />
    </button>
  );
}
