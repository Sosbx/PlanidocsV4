import { useState, useEffect } from 'react';

interface UseBottomNavPaddingOptions {
  extraPadding?: boolean;
}

export const useBottomNavPadding = (options?: UseBottomNavPaddingOptions) => {
  const [hasBottomNav, setHasBottomNav] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const { extraPadding = false } = options || {};

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // On mobile, we always need padding for the bottom nav
      if (mobile) {
        setHasBottomNav(true);
      } else {
        setHasBottomNav(false);
      }
    };

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Update scroll position
      setLastScrollY(currentScrollY);
    };

    const handleResize = () => {
      checkMobile();
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);
    
    // Initial check
    checkMobile();
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Return padding class for bottom navigation
  // Extra padding for UserPage to ensure table rows are clickable above bottom nav
  if (hasBottomNav && isMobile) {
    return extraPadding ? 'pb-40' : 'pb-16';
  }
  return '';
};