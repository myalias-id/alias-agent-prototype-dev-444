'use client';

import Link from 'next/link';

import AboutModal from '@/components/common/about-modal';
import { CancelSVG, MenuSVG } from '@/components/svg';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { IAgent } from '@/types/agent';

interface ChatHeaderProps {
  agent: IAgent | null | undefined;
  isDark: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isMapOpen: boolean;
  setIsMapOpen: (open: boolean) => void;
  containerWidth: number | undefined;
  isInIframe: boolean;
  isMobileDevice: boolean;
  onCopyURL: () => void;
  onCloseEmbeddedChat: () => void;
}

/**
 * Top bar of the chat UI: logo on the left, about modal + optional close button on the right.
 */
export function ChatHeader({
  agent,
  isDark,
  isOpen,
  setIsOpen,
  isMapOpen: _isMapOpen,
  setIsMapOpen: _setIsMapOpen,
  containerWidth,
  isInIframe,
  isMobileDevice,
  onCopyURL,
  onCloseEmbeddedChat,
}: ChatHeaderProps) {
  return (
    <div className="w-full flex items-center justify-between">
      <Link href="/" target="_blank" rel="noopener noreferrer">
        <img
          alt={agent?.defaults?.pageTitle || 'Logo'}
          src={
            isDark
              ? agent?.defaults?.logoTopLeftDarkModeURL ||
                '/alias_full_dark.png'
              : agent?.defaults?.logoTopLeftLightModeURL ||
                '/alias_full_light.png'
          }
          className="w-auto h-9"
        />
      </Link>

      <div className="flex items-center gap-x-2 pointer-events-auto">
        {isInIframe && isMobileDevice && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'bg-white/20 hover:bg-white/40 text-black hover:text-danger transition-all duration-300',
              isDark &&
                'text-white bg-white/10 hover:bg-white/20 border-white/10'
            )}
            onClick={onCloseEmbeddedChat}
            aria-label="Close chat">
            <CancelSVG height={20} width={20} className="text-inherit" />
          </Button>
        )}

        {/* Map button – opens the directions modal

        <MapModal
          isOpen={isMapOpen}
          setIsOpen={setIsMapOpen}
          containerWidth={containerWidth}>
          {(open) => (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'bg-white/20 hover:bg-white/40 text-black hover:text-alias transition-all duration-300',
                isDark &&
                  'text-white bg-white/10 hover:bg-white/20 border-white/10'
              )}
              onClick={() => {}}
              aria-label="Open map">
              {open ? (
                <CancelSVG
                  height={20}
                  width={20}
                  className={cn(
                    'text-black hover:text-danger',
                    isDark && 'text-white'
                  )}
                />
              ) : (
                <MapPinSVG height={20} width={20} className="text-inherit" />
              )}
            </Button>
          )}
        </MapModal>

    */}

        <AboutModal
          agent={agent}
          handleCopyURL={onCopyURL}
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          containerWidth={containerWidth}>
          {(open) => (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'bg-white/20 hover:bg-white/40 text-black hover:text-alias transition-all duration-300',
                isDark &&
                  'text-white bg-white/10 hover:bg-white/20 border-white/10'
              )}
              onClick={() => {}}
              aria-label="Open menu">
              {open ? (
                <CancelSVG
                  height={20}
                  width={20}
                  className={cn(
                    'text-black hover:text-danger',
                    isDark && 'text-white'
                  )}
                />
              ) : (
                <MenuSVG height={20} width={20} className="text-inherit" />
              )}
            </Button>
          )}
        </AboutModal>
      </div>
    </div>
  );
}
