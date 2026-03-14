import { useState, useEffect, useRef, RefObject } from "react";

interface UseScrollDirectionOptions {
  threshold?: number;
  hysteresis?: number;
  initialDirection?: "up" | "down";
  elementRef?: RefObject<HTMLElement>;
}

export function useScrollDirection({
  threshold = 10,
  hysteresis = 40,
  initialDirection = "up",
  elementRef,
}: UseScrollDirectionOptions = {}) {
  const [scrollDirection, setScrollDirection] = useState<"up" | "down">(initialDirection);
  const lastScrollYRef = useRef(0);
  const accumulatedScrollRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const element = elementRef?.current || window;
    let ticking = false;

    const updateScrollDirection = () => {
      const scrollY = elementRef?.current ? elementRef.current.scrollTop : window.scrollY;
      const delta = scrollY - lastScrollYRef.current;
      
      if (Math.abs(delta) < threshold) {
        ticking = false;
        return;
      }

      accumulatedScrollRef.current += delta;
      const newDirection = delta > 0 ? "down" : "up";
      
      // Immediate update if direction changed and accumulated scroll exceeds hysteresis
      if (newDirection !== scrollDirection && Math.abs(accumulatedScrollRef.current) >= hysteresis) {
        setScrollDirection(newDirection);
        accumulatedScrollRef.current = 0;
      } else if (newDirection === scrollDirection) {
        accumulatedScrollRef.current = 0;
      }
      
      lastScrollYRef.current = scrollY;
      ticking = false;
      
      // Clear any pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Set trailing timeout for final update
      timeoutRef.current = setTimeout(() => {
        const finalScrollY = elementRef?.current ? elementRef.current.scrollTop : window.scrollY;
        const finalDelta = finalScrollY - lastScrollYRef.current;
        if (Math.abs(finalDelta) >= threshold) {
          const finalDirection = finalDelta > 0 ? "down" : "up";
          if (finalDirection !== scrollDirection) {
            setScrollDirection(finalDirection);
          }
          lastScrollYRef.current = finalScrollY;
        }
      }, 100);
    };

    const handleScroll = () => {
      if (!ticking) {
        animationFrameRef.current = requestAnimationFrame(() => {
          updateScrollDirection();
        });
        ticking = true;
      }
    };

    element.addEventListener("scroll", handleScroll, { passive: true } as any);

    return () => {
      element.removeEventListener("scroll", handleScroll);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [scrollDirection, threshold, hysteresis, elementRef]);

  return scrollDirection;
}
