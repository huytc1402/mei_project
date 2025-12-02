import { useEffect, useRef, useState, useCallback } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  enabled?: boolean;
}

export function usePullToRefresh({ 
  onRefresh, 
  threshold = 60, // Reduced threshold for easier triggering
  enabled = true 
}: UsePullToRefreshOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const startY = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const onRefreshRef = useRef(onRefresh);

  // Keep onRefresh ref updated
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setPullProgress(0);
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
      if (window.scrollY <= 5 && !isRefreshing && !isDragging.current) {
        startY.current = e.touches[0].clientY;
        isDragging.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || isRefreshing || window.scrollY > 5) {
        if (isDragging.current) {
          isDragging.current = false;
          setPullProgress(0);
        }
        return;
      }

      const distance = e.touches[0].clientY - startY.current;

      if (distance > 0) {
        e.preventDefault();
        const progress = Math.min(distance / threshold, 1);
        setPullProgress(progress);
      } else {
        setPullProgress(0);
      }
    };

    const handleTouchEnd = () => {
      if (!isDragging.current) return;

      const shouldRefresh = pullProgress >= 1;
      isDragging.current = false;

      if (shouldRefresh && !isRefreshing) {
        handleRefresh();
      } else {
        setPullProgress(0);
      }
    };

    // Support mouse for desktop testing
    const handleMouseDown = (e: MouseEvent) => {
      if (window.scrollY <= 5 && !isRefreshing && !isDragging.current) {
        startY.current = e.clientY;
        isDragging.current = true;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || isRefreshing || window.scrollY > 5) {
        if (isDragging.current) {
          isDragging.current = false;
          setPullProgress(0);
        }
        return;
      }

      const distance = e.clientY - startY.current;

      if (distance > 0) {
        e.preventDefault();
        const progress = Math.min(distance / threshold, 1);
        setPullProgress(progress);
      } else {
        setPullProgress(0);
      }
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;

      const shouldRefresh = pullProgress >= 1;
      isDragging.current = false;

      if (shouldRefresh && !isRefreshing) {
        handleRefresh();
      } else {
        setPullProgress(0);
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
  }, [enabled, threshold, isRefreshing, pullProgress, handleRefresh]);

  return {
    isPulling: pullProgress > 0,
    isRefreshing,
    pullProgress,
  };
}

