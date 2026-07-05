'use client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu';
import { Ellipsis } from 'lucide-react';
import React, { useState } from 'react';

import { AvatarButton } from '@/components/buttons/avatar-button';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatPublicMessageUIProps {
  id: string | number;
  src: string;
  displayName: string;
  isUser: boolean;
  isAgent?: boolean;
  message: string;
}

export function ChatPublicMessageUI({
  id,
  src,
  displayName,
  isUser,
  isAgent = false,
  message,
}: ChatPublicMessageUIProps) {
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  const handleDropdownOpenChange = (open: boolean) => {
    setIsDropdownOpen(open);
    if (!open) {
      setIsHovered(false);
    }
  };

  return (
    <div
      key={id}
      className="relative w-full my-2 px-2"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => !isDropdownOpen && setIsHovered(false)}>
      <div className="flex items-start gap-x-2 pr-4">
        <AvatarButton
          src={src}
          alt={displayName}
          onClick={() => {}}
          height={18}
          width={18}
          className="rounded h-[18px] w-[18px] flex-shrink-0 mt-1"
        />

        <div className="flex flex-wrap text-sm font-geist">
          <span className={cn('mr-2')}>
            <span
              className={cn(
                'text-base font-semibold mr-3',
                isUser
                  ? 'text-[#AD3BE2]'
                  : isAgent
                    ? 'text-primary'
                    : 'text-[#4587F0]'
              )}>
              {displayName}:{' '}
            </span>

            <p className="text-wrap body-2">{message}</p>
          </span>
        </div>
      </div>

      <div
        className={`absolute -top-1 right-0 z-10 transition-opacity duration-200 ${
          isHovered || isDropdownOpen ? 'opacity-100' : 'opacity-0'
        }`}>
        <DropdownMenu onOpenChange={handleDropdownOpenChange}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 p-0 text-white hover:text-primary bg-transparent hover:bg-transparent">
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-black border-primary text-white w-48 py-3.5 px-3">
            <DropdownMenuItem className="flex items-center gap-x-3.5 py-2 focus:bg-lightWhite border-b border-lightWhite">
              <span className="text-sm font-geist font-medium">
                PIN message
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex items-center gap-x-3.5 py-2 focus:bg-lightWhite border-b border-lightWhite">
              <span className="text-sm font-geist font-medium">
                Delete message
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex items-center gap-x-3.5 py-2 focus:bg-lightWhite border-b border-lightWhite">
              <span className="text-sm font-geist font-medium">Ban user</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
