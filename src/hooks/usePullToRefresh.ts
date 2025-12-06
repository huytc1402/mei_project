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

    // Helper function to check if touch is inside a scrollable element that's actively scrollable
    const isInsideScrollableArea = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof Element)) return false;
      
      let current: Element | null = target;
      while (current && current !== document.body) {
        const style = window.getComputedStyle(current);
        const overflowY = style.overflowY;
        
        // Check if element has scrollable content
        if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight) {
          // Block pull-to-refresh if element is scrollable
          // This prevents conflict with scrolling in message box
          return true;
        }
        
        current = current.parentElement;
      }
      return false;
    };

    const handleTouchStart = (e: TouchEvent) => {
      // Don't trigger if touch is inside a scrollable element
      if (isInsideScrollableArea(e.target)) {
        return;
      }

      // Only trigger if at the top of the page and not already refreshing
      if (window.scrollY <= 5 && !isRefreshing && !isDragging.current) {
        startY.current = e.touches[0].clientY;
        isDragging.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Check if touch moved into a scrollable element
      if (isInsideScrollableArea(e.target)) {
        if (isDragging.current) {
          isDragging.current = false;
          setPullProgress(0);
        }
        return;
      }

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
      // Check if click is inside a scrollable element
      if (isInsideScrollableArea(e.target)) {
        return;
      }

      if (window.scrollY <= 5 && !isRefreshing && !isDragging.current) {
        startY.current = e.clientY;
        isDragging.current = true;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Check if mouse moved into a scrollable element
      if (isInsideScrollableArea(e.target)) {
        if (isDragging.current) {
          isDragging.current = false;
          setPullProgress(0);
        }
        return;
      }

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

