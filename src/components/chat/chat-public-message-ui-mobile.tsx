'use client';
import { useEffect, useRef, useState } from 'react';

import { AvatarButton } from '@/components/buttons/avatar-button';
import { cn } from '@/lib/utils';

interface ChatPublicMessageUIMobileProps {
  id: string | number;
  src: string;
  displayName: string;
  isUser: boolean;
  isAgent?: boolean;
  message: string;
  containerRef: React.RefObject<HTMLDivElement>;
}

export function ChatPublicMessageUIMobile({
  id,
  src,
  displayName,
  isUser,
  isAgent: _isAgent = false,
  message,
  containerRef,
}: ChatPublicMessageUIMobileProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [opacity, setOpacity] = useState<string>('opacity-0');

  const getOpacityClass = (): string => {
    if (!ref.current) return 'opacity-0';

    const messageRect = ref.current.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const messageBottom = messageRect.bottom;

    const messageDistanceFromBottom = windowHeight - messageBottom;

    // If message is below container top, show full opacity
    if (messageDistanceFromBottom >= 400) return 'opacity-0';
    if (messageDistanceFromBottom >= 300) return 'opacity-20';
    if (messageDistanceFromBottom >= 200) return 'opacity-50';
    if (messageDistanceFromBottom >= 100) return 'opacity-80';
    return 'opacity-100';
  };

  useEffect(() => {
    const updateOpacity = () => {
      setOpacity(getOpacityClass());
    };

    // Initial calculation
    updateOpacity();

    // Add scroll listener to container
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', updateOpacity);

      // Cleanup
      return () => {
        container.removeEventListener('scroll', updateOpacity);
      };
    }
  }, [containerRef]);

  return (
    <div
      ref={ref}
      key={id}
      className={cn(
        'my-1 flex w-full',
        isUser ? 'justify-end' : 'justify-start'
      )}>
      <div
        className={cn(
          'flex items-start gap-x-2.5',
          isUser ? 'justify-end' : 'justify-start'
        )}>
        {isUser && <div className={'mr-auto rounded-md h-[48px] w-[48px]'} />}
        {!isUser && (
          <AvatarButton
            src={src}
            alt={'Agent'}
            onClick={() => {}}
            height={36}
            width={36}
            className={cn(
              'rounded-md min-h-[36px] min-w-[36px] w-[36px] h-[36px] flex-shrink-0',
              'transition-opacity duration-300 ease-in-out',
              opacity
            )}
          />
        )}
        <div
          className={cn(
            'flex flex-col gap-y-2.5',
            isUser && 'items-end',
            'transition-opacity duration-300 ease-in-out',
            opacity
          )}>
          <h3>{isUser ? 'You' : displayName}</h3>
          <p
            className={cn(
              'body-2 text-wrap w-fit px-[22px] py-[20px] border border-lightWhite flex-wrap rounded-[10px] leading-[140%]  backdrop-blur-[120px]',
              isUser
                ? 'bg-primary/60  rounded-tr-none'
                : 'bg-black/40 rounded-tl-none '
            )}>
            {message}
          </p>
        </div>

        {!isUser && <div className={'ml-auto rounded-md h-[48px] w-[48px]'} />}
      </div>
    </div>
  );
}
