import { useRef, useCallback, useEffect, useState } from 'react';
import { hapticLight } from '@/utils/haptics';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down' | null;

export interface SwipeConfig {
    /** Minimum distance (px) to trigger swipe. Default: 50 */
    threshold?: number;
    /** Callback when swipe is detected */
    onSwipe?: (direction: SwipeDirection) => void;
    /** Callback specifically for left swipe */
    onSwipeLeft?: () => void;
    /** Callback specifically for right swipe */
    onSwipeRight?: () => void;
    /** Enable haptic feedback on swipe. Default: true */
    hapticFeedback?: boolean;
    /** Prevent default touch behavior. Default: false */
    preventDefault?: boolean;
}

export interface SwipeState {
    /** Current swipe direction during gesture */
    swiping: SwipeDirection;
    /** Current X offset during swipe */
    deltaX: number;
    /** Current Y offset during swipe */
    deltaY: number;
}

export function useSwipe<T extends HTMLElement = HTMLDivElement>(
    config: SwipeConfig = {}
) {
    const {
        threshold = 50,
        onSwipe,
        onSwipeLeft,
        onSwipeRight,
        hapticFeedback = true,
        preventDefault = false,
    } = config;

    const ref = useRef<T>(null);
    const startX = useRef(0);
    const startY = useRef(0);
    const [state, setState] = useState<SwipeState>({
        swiping: null,
        deltaX: 0,
        deltaY: 0,
    });

    const handleTouchStart = useCallback((e: TouchEvent) => {
        const touch = e.touches[0];
        startX.current = touch.clientX;
        startY.current = touch.clientY;
        setState({ swiping: null, deltaX: 0, deltaY: 0 });
    }, []);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (preventDefault) {
            e.preventDefault();
        }

        const touch = e.touches[0];
        const deltaX = touch.clientX - startX.current;
        const deltaY = touch.clientY - startY.current;

        // Determine primary direction
        let direction: SwipeDirection = null;
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            direction = deltaX > 0 ? 'right' : 'left';
        } else if (Math.abs(deltaY) > threshold / 2) {
            direction = deltaY > 0 ? 'down' : 'up';
        }

        setState({ swiping: direction, deltaX, deltaY });
    }, [preventDefault, threshold]);

    const handleTouchEnd = useCallback(() => {
        const { deltaX, deltaY } = state;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        let direction: SwipeDirection = null;

        // Only trigger if exceeds threshold and horizontal movement is dominant
        if (absX > threshold && absX > absY) {
            direction = deltaX > 0 ? 'right' : 'left';

            if (hapticFeedback) {
                hapticLight();
            }

            onSwipe?.(direction);

            if (direction === 'left') {
                onSwipeLeft?.();
            } else if (direction === 'right') {
                onSwipeRight?.();
            }
        }

        setState({ swiping: null, deltaX: 0, deltaY: 0 });
    }, [state, threshold, hapticFeedback, onSwipe, onSwipeLeft, onSwipeRight]);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        element.addEventListener('touchstart', handleTouchStart, { passive: true });
        element.addEventListener('touchmove', handleTouchMove, { passive: !preventDefault });
        element.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchmove', handleTouchMove);
            element.removeEventListener('touchend', handleTouchEnd);
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd, preventDefault]);

    return {
        ref,
        ...state,
    };
}

export default useSwipe;
