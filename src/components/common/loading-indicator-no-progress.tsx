'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

export default function LoadingIndicatorNoProgress({
  label: _label,
}: {
  label?: string;
}) {
  const [shapeIndices, setShapeIndices] = useState(
    () => Array(8).fill(0) // Start with all squares initially
  );
  const shapes = ['square', 'triangle', 'circle', 'plus'];
  const numShapes = 8;
  const intervalRefs = useRef<(number | null)[]>([]);

  const pathVariants = {
    square: 'M -3 -3 H 3 V 3 H -3 Z',
    triangle: 'M 0 -3.5 L 3.5 2.25 L -3.5 2.25 Z',
    circle: 'M 0 0 m -2.25 0 a 2.25 2.25 1 0 0 4.5 0 a 2.25 2.25 0 1 0 -4.5 0',
    plus: 'M 0 -3 V 3 M -3 0 H 3',
  };

  const getRandomInterval = () => Math.random() * 2500 + 500;

  useEffect(() => {
    intervalRefs.current = Array(numShapes).fill(null);

    const updateShapes = () => {
      setShapeIndices((prevIndices) =>
        prevIndices.map(() => Math.floor(Math.random() * shapes.length))
      );
    };

    for (let i = 0; i < numShapes; i++) {
      const interval = getRandomInterval() * 2;
      intervalRefs.current[i] = window.setInterval(updateShapes, interval);
    }

    return () => {
      intervalRefs.current.forEach((intervalId) => {
        if (intervalId) {
          clearInterval(intervalId);
        }
      });
    };
  }, []);

  return (
    <AnimatePresence>
      <div className="fixed top-0 left-0 w-[100vw] text-white h-[100vh] flex flex-col justify-center items-center pointer-events-none z-10">
        <div className="relative w-32 h-32">
          <motion.div
            className="w-full h-full"
            animate={{ rotate: 360 }}
            transition={{
              duration: 12,
              ease: 'linear',
              repeat: Number.POSITIVE_INFINITY,
            }}>
            {Array.from({ length: numShapes }).map((_, i) => {
              const angle = (i / numShapes) * Math.PI * 2;
              const x = Math.cos(angle) * 40;
              const y = Math.sin(angle) * 40;
              const currentShape = shapes[shapeIndices[i]];

              return (
                <motion.div
                  key={i}
                  className="absolute top-1/2 left-1/2 w-2 h-2 -mt-1 -ml-1"
                  style={{
                    x,
                    y,
                  }}>
                  <svg viewBox="-3 -3 6 6" className="w-full h-full">
                    <motion.path
                      d={
                        pathVariants[currentShape as keyof typeof pathVariants]
                      }
                      animate={{
                        d: pathVariants[
                          currentShape as keyof typeof pathVariants
                        ],
                      }}
                      initial={false}
                      transition={{
                        duration: 0.2,
                        ease: 'easeInOut',
                      }}
                      fill={currentShape === 'plus' ? 'none' : 'currentColor'}
                      stroke={currentShape === 'plus' ? 'currentColor' : 'none'}
                      strokeWidth={currentShape === 'plus' ? 0.5 : 0}
                      strokeLinecap="round"
                      className="text-alias"
                    />
                  </svg>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}
