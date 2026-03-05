import { useRef, useEffect, useCallback } from 'react';

interface TiltOptions {
  max?: number;
  scale?: number;
  speed?: number;
  glare?: boolean;
  glareOpacity?: number;
}

const defaultOptions: Required<TiltOptions> = {
  max: 10,
  scale: 1.02,
  speed: 400,
  glare: false,
  glareOpacity: 0.2,
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function useTilt<T extends HTMLElement = HTMLDivElement>(
  options: TiltOptions = {}
) {
  const ref = useRef<T>(null);
  const glareRef = useRef<HTMLDivElement | null>(null);
  
  const opts = { ...defaultOptions, ...options };

  const reset = useCallback(() => {
    if (!ref.current) return;
    ref.current.style.transform = '';
    ref.current.style.transition = `transform ${opts.speed}ms ease-out`;
    if (glareRef.current) {
      glareRef.current.style.opacity = '0';
    }
  }, [opts.speed]);

  const handleMove = useCallback((e: MouseEvent) => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const tiltX = (opts.max * 2) * (0.5 - y);
    const tiltY = (opts.max * 2) * (x - 0.5);

    ref.current.style.transition = 'none';
    ref.current.style.transform = `
      perspective(1000px)
      rotateX(${tiltX}deg)
      rotateY(${tiltY}deg)
      scale(${opts.scale})
    `;

    if (glareRef.current && opts.glare) {
      const angle = Math.atan2(y - 0.5, x - 0.5) * (180 / Math.PI);
      glareRef.current.style.opacity = String(opts.glareOpacity);
      glareRef.current.style.background = `
        linear-gradient(${angle + 90}deg, 
          rgba(255,255,255,${opts.glareOpacity}) 0%, 
          rgba(255,255,255,0) 50%)
      `;
    }
  }, [opts.max, opts.scale, opts.glare, opts.glareOpacity]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (prefersReducedMotion() || isTouchDevice()) return;

    if (opts.glare) {
      const glareElement = document.createElement('div');
      glareElement.style.cssText = `
        position: absolute;
        inset: 0;
        pointer-events: none;
        opacity: 0;
        transition: opacity 200ms ease-out;
        border-radius: inherit;
      `;
      element.style.position = 'relative';
      element.appendChild(glareElement);
      glareRef.current = glareElement;
    }

    element.style.transformStyle = 'preserve-3d';
    element.style.willChange = 'transform';

    element.addEventListener('mousemove', handleMove);
    element.addEventListener('mouseleave', reset);

    return () => {
      element.removeEventListener('mousemove', handleMove);
      element.removeEventListener('mouseleave', reset);
      if (glareRef.current && element.contains(glareRef.current)) {
        element.removeChild(glareRef.current);
      }
      glareRef.current = null;
      element.style.transform = '';
      element.style.transformStyle = '';
      element.style.willChange = '';
    };
  }, [handleMove, reset, opts.glare]);

  return ref;
}

export default useTilt;
