'use client';

import { LoadingIndicator } from '@/components/common';

export default function Loading() {
  return (
    <div className="flex-1 relative flex flex-col justify-center items-center w-full h-full bg-[url('/background.png')] bg-cover bg-center ">
      <LoadingIndicator />
    </div>
  );
}
