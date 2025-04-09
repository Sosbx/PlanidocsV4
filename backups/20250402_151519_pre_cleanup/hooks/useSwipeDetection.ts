import { useEffect, useRef, RefObject } from 'react';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down' | null;

interface SwipeDetectionOptions {
  threshold?: number;  // Minimum distance in px to trigger swipe
  restraint?: number;  // Maximum perpendicular movement allowed
  allowedTime?: number;  // Maximum time allowed for swipe
}

/**
 * Hook for detecting swipe gestures on touch devices
 * 
 * @param elementRef Reference to the element to detect swipes on
 * @param onSwipe Callback function called when swipe is detected
 * @param options Configuration options
 */
export function useSwipeDetection(
  elementRef: RefObject<HTMLElement>,
  onSwipe: (direction: SwipeDirection) => void,
  options: SwipeDetectionOptions = {}
) {
  // Default values
  const threshold = options.threshold || 75;  // Min distance traveled
  const restraint = options.restraint || 100;  // Max perpendicular movement
  const allowedTime = options.allowedTime || 300;  // Max time allowed
  
  // Refs to store touch data
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches?.length !== 1) return;
      
      // Store initial touch data
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      touchStartTime.current = Date.now();
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      // Skip if no touches or more than one
      if (!e.changedTouches?.[0]) return;
      
      // Calculate time elapsed
      const elapsedTime = Date.now() - touchStartTime.current;
      
      // Skip if too slow
      if (elapsedTime > allowedTime) return;
      
      // Get end coordinates
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      
      // Calculate distances
      const distX = touchEndX - touchStartX.current;
      const distY = touchEndY - touchStartY.current;
      
      // Determine swipe direction
      let swipeDirection: SwipeDirection = null;
      
      if (Math.abs(distX) >= threshold && Math.abs(distY) <= restraint) {
        // Horizontal swipe
        swipeDirection = distX < 0 ? 'left' : 'right';
      } else if (Math.abs(distY) >= threshold && Math.abs(distX) <= restraint) {
        // Vertical swipe
        swipeDirection = distY < 0 ? 'up' : 'down';
      }
      
      // Call callback if we have a swipe direction
      if (swipeDirection) {
        onSwipe(swipeDirection);
      }
    };
    
    // Add event listeners
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // Cleanup
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [elementRef, onSwipe, threshold, restraint, allowedTime]);
}

export default useSwipeDetection;