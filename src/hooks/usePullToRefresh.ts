import { useEffect, useRef, useState, useCallback } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  enabled?: boolean;
}

export function usePullToRefresh({ 
  onRefresh, 
  threshold = 80,
  enabled = true 
}: UsePullToRefreshOptions) {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const onRefreshRef = useRef(onRefresh);

  // Keep onRefresh ref updated
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await onRefreshRef.current();
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger if at the top of the page and not already refreshing
      if (window.scrollY === 0 && !isRefreshing && !isDragging.current) {
        startY.current = e.touches[0].clientY;
        currentY.current = e.touches[0].clientY;
        isDragging.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || isRefreshing) return;

      currentY.current = e.touches[0].clientY;
      const distance = currentY.current - startY.current;

      // Only allow pull down when at top
      if (distance > 0 && window.scrollY === 0) {
        e.preventDefault();
        // Use requestAnimationFrame for smoother updates
        requestAnimationFrame(() => {
          setPullDistance(distance);
          setIsPulling(distance > 10);
        });
      } else if (distance <= 0 || window.scrollY > 0) {
        // Reset if scrolling up or page is scrolled
        requestAnimationFrame(() => {
          setPullDistance(0);
          setIsPulling(false);
          isDragging.current = false;
        });
      }
    };

    const handleTouchEnd = () => {
      if (!isDragging.current) return;

      const finalDistance = pullDistance;
      isDragging.current = false;

      if (finalDistance >= threshold && !isRefreshing) {
        setPullDistance(0);
        setIsPulling(false);
        handleRefresh();
      } else {
        // Smooth reset
        requestAnimationFrame(() => {
          setPullDistance(0);
          setIsPulling(false);
        });
      }
    };

    // Also support mouse events for desktop testing
    const handleMouseDown = (e: MouseEvent) => {
      if (window.scrollY === 0 && !isRefreshing && !isDragging.current) {
        startY.current = e.clientY;
        currentY.current = e.clientY;
        isDragging.current = true;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || isRefreshing) return;

      currentY.current = e.clientY;
      const distance = currentY.current - startY.current;

      if (distance > 0 && window.scrollY === 0) {
        e.preventDefault();
        requestAnimationFrame(() => {
          setPullDistance(distance);
          setIsPulling(distance > 10);
        });
      }
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;

      const finalDistance = pullDistance;
      isDragging.current = false;

      if (finalDistance >= threshold && !isRefreshing) {
        setPullDistance(0);
        setIsPulling(false);
        handleRefresh();
      } else {
        requestAnimationFrame(() => {
          setPullDistance(0);
          setIsPulling(false);
        });
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [enabled, threshold, isRefreshing, handleRefresh]);

  return {
    isPulling,
    isRefreshing,
    pullDistance,
    pullProgress: Math.min(pullDistance / threshold, 1),
  };
}

