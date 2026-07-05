'use client';

import React from 'react';
import { Toaster as Sonner, ToasterProps } from 'sonner';

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      style={{
        zIndex: 54,
      }}
      {...props}
    />
  );
};

export { Toaster };
