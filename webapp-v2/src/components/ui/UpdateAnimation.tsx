import { useEffect, useState, useRef } from 'preact/hooks';
import { JSX } from 'preact';

interface UpdateAnimationProps {
  children: JSX.Element;
  hasUpdate?: boolean;
  type?: 'shimmer' | 'glow' | 'pulse' | 'slide';
  duration?: number;
  className?: string;
}

export function UpdateAnimation({ 
  children, 
  hasUpdate = false, 
  type = 'shimmer',
  duration = 500,
  className = ''
}: UpdateAnimationProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (hasUpdate) {
      setIsAnimating(true);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        setIsAnimating(false);
      }, duration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [hasUpdate, duration]);

  const getAnimationClasses = () => {
    if (!isAnimating) return '';

    switch (type) {
      case 'glow':
        return 'animate-pulse ring-2 ring-blue-300 ring-opacity-75';
      case 'pulse':
        return 'animate-pulse scale-105';
      case 'slide':
        return 'animate-bounce';
      default:
        return 'relative overflow-hidden';
    }
  };

  return (
    <div className={`
      ${className}
      ${getAnimationClasses()}
      transition-all duration-300
    `}>
      {children}
      
      {type === 'shimmer' && isAnimating && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="
            absolute inset-0 
            bg-gradient-to-r 
            from-transparent 
            via-white/20 
            to-transparent
            animate-shimmer
          " />
        </div>
      )}
    </div>
  );
}

interface BalanceUpdateAnimationProps {
  oldValue: number;
  newValue: number;
  currency?: string;
  duration?: number;
  onComplete?: () => void;
}

export function BalanceUpdateAnimation({
  oldValue,
  newValue,
  currency = '$',
  duration = 1000,
  onComplete
}: BalanceUpdateAnimationProps) {
  const [currentValue, setCurrentValue] = useState(oldValue);
  const [isAnimating, setIsAnimating] = useState(false);
  const startTimeRef = useRef<number>();
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    if (oldValue !== newValue) {
      startTimeRef.current = performance.now();
      setIsAnimating(true);
      animate();
    }
  }, [oldValue, newValue]);

  const animate = () => {
    const now = performance.now();
    const elapsed = now - (startTimeRef.current || now);
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function for smooth animation
    const easeOutCubic = 1 - Math.pow(1 - progress, 3);
    
    const interpolatedValue = oldValue + (newValue - oldValue) * easeOutCubic;
    setCurrentValue(interpolatedValue);
    
    if (progress < 1) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      setCurrentValue(newValue);
      setIsAnimating(false);
      onComplete?.();
    }
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const formatValue = (value: number) => {
    return `${currency}${Math.abs(value).toFixed(2)}`;
  };

  const getValueColor = (value: number) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <span className={`
      inline-block
      font-mono
      transition-colors duration-300
      ${getValueColor(currentValue)}
      ${isAnimating ? 'animate-pulse' : ''}
    `}>
      {currentValue < 0 ? '-' : ''}{formatValue(currentValue)}
    </span>
  );
}

interface ListItemAnimationProps {
  children: JSX.Element;
  isNew?: boolean;
  isUpdated?: boolean;
  isRemoving?: boolean;
  delay?: number;
}

export function ListItemAnimation({
  children,
  isNew = false,
  isUpdated = false,
  isRemoving = false,
  delay = 0
}: ListItemAnimationProps) {
  const [shouldRender, setShouldRender] = useState(!isNew);
  const [animationClass, setAnimationClass] = useState('');

  useEffect(() => {
    if (isNew) {
      const timer = setTimeout(() => {
        setShouldRender(true);
        setAnimationClass('animate-slideInDown');
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [isNew, delay]);

  useEffect(() => {
    if (isUpdated) {
      setAnimationClass('animate-flash bg-blue-50');
      const timer = setTimeout(() => {
        setAnimationClass('');
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isUpdated]);

  useEffect(() => {
    if (isRemoving) {
      setAnimationClass('animate-slideOutRight');
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [isRemoving]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div className={`
      transition-all duration-300
      ${animationClass}
    `}>
      {children}
    </div>
  );
}

interface StaggeredListAnimationProps {
  children: JSX.Element[];
  staggerDelay?: number;
  animationType?: 'slideUp' | 'slideDown' | 'fadeIn';
}

export function StaggeredListAnimation({
  children,
  staggerDelay = 100,
  animationType = 'slideUp'
}: StaggeredListAnimationProps) {
  const [visibleItems, setVisibleItems] = useState<boolean[]>(new Array(children.length).fill(false));

  useEffect(() => {
    children.forEach((_, index) => {
      const timer = setTimeout(() => {
        setVisibleItems(prev => {
          const newVisible = [...prev];
          newVisible[index] = true;
          return newVisible;
        });
      }, index * staggerDelay);

      return () => clearTimeout(timer);
    });
  }, [children, staggerDelay]);

  const getAnimationClass = (isVisible: boolean) => {
    if (!isVisible) return 'opacity-0 translate-y-4';

    switch (animationType) {
      case 'slideDown':
        return 'opacity-100 translate-y-0 animate-slideInDown';
      case 'fadeIn':
        return 'opacity-100 animate-fadeIn';
      default:
        return 'opacity-100 translate-y-0 animate-slideInUp';
    }
  };

  return (
    <div>
      {children.map((child, index) => (
        <div
          key={index}
          className={`
            transition-all duration-300 ease-out
            ${getAnimationClass(visibleItems[index])}
          `}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

// Toast notification system for updates
interface ToastProps {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  onClose?: () => void;
}

export function Toast({ 
  message, 
  type = 'info', 
  duration = 3000, 
  onClose 
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose?.(), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const typeClasses = {
    info: 'bg-blue-500 text-white',
    success: 'bg-green-500 text-white',
    warning: 'bg-yellow-500 text-white',
    error: 'bg-red-500 text-white'
  };

  return (
    <div className={`
      fixed bottom-4 right-4 z-50
      px-4 py-3 rounded-lg shadow-lg
      transform transition-all duration-300
      ${typeClasses[type]}
      ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}
    `}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{message}</span>
        <button 
          onClick={() => {
            setIsVisible(false);
            setTimeout(() => onClose?.(), 300);
          }}
          className="text-white/80 hover:text-white text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}