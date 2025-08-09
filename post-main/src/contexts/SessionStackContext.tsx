import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface PageState {
  path: string;
  title: string;
  timestamp: number;
  scrollPosition?: number;
}

interface SessionStackState {
  stack: PageState[];
  currentIndex: number;
}

type SessionStackAction =
  | { type: 'PUSH'; payload: PageState }
  | { type: 'POP' }
  | { type: 'REPLACE'; payload: PageState }
  | { type: 'UPDATE_SCROLL'; payload: number }
  | { type: 'LOAD_FROM_STORAGE'; payload: SessionStackState };

interface SessionStackContextType {
  state: SessionStackState;
  pushPage: (path: string, title: string) => void;
  popPage: () => void;
  canGoBack: boolean;
  previousPage: PageState | null;
  updateScrollPosition: (position: number) => void;
}

const SessionStackContext = createContext<SessionStackContextType | undefined>(undefined);

const STORAGE_KEY = 'blog_session_stack';
const MAX_STACK_SIZE = 20;

function sessionStackReducer(state: SessionStackState, action: SessionStackAction): SessionStackState {
  switch (action.type) {
    case 'PUSH': {
      const newStack = [...state.stack.slice(0, state.currentIndex + 1), action.payload];
      
      // Limit stack size to prevent memory issues
      if (newStack.length > MAX_STACK_SIZE) {
        newStack.shift();
        return {
          stack: newStack,
          currentIndex: newStack.length - 1
        };
      }
      
      return {
        stack: newStack,
        currentIndex: newStack.length - 1
      };
    }
    
    case 'POP': {
      if (state.currentIndex > 0) {
        return {
          ...state,
          currentIndex: state.currentIndex - 1
        };
      }
      return state;
    }
    
    case 'REPLACE': {
      const newStack = [...state.stack];
      newStack[state.currentIndex] = action.payload;
      return {
        ...state,
        stack: newStack
      };
    }
    
    case 'UPDATE_SCROLL': {
      const newStack = [...state.stack];
      if (newStack[state.currentIndex]) {
        newStack[state.currentIndex] = {
          ...newStack[state.currentIndex],
          scrollPosition: action.payload
        };
      }
      return {
        ...state,
        stack: newStack
      };
    }
    
    case 'LOAD_FROM_STORAGE': {
      return action.payload;
    }
    
    default:
      return state;
  }
}

const initialState: SessionStackState = {
  stack: [],
  currentIndex: -1
};

export const SessionStackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(sessionStackReducer, initialState);
  const location = useLocation();

  // Load from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        dispatch({ type: 'LOAD_FROM_STORAGE', payload: parsed });
      }
    } catch (error) {
      console.warn('Failed to load session stack from storage:', error);
    }
  }, []);

  // Save to sessionStorage whenever state changes
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to save session stack to storage:', error);
    }
  }, [state]);

  // Track scroll position
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      dispatch({ type: 'UPDATE_SCROLL', payload: scrollPosition });
    };

    // Debounce scroll updates
    let timeoutId: NodeJS.Timeout;
    const debouncedHandleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleScroll, 100);
    };

    window.addEventListener('scroll', debouncedHandleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', debouncedHandleScroll);
      clearTimeout(timeoutId);
    };
  }, []);

  const pushPage = (path: string, title: string) => {
    // Don't push if it's the same page
    const currentPage = state.stack[state.currentIndex];
    if (currentPage && currentPage.path === path) {
      return;
    }

    const pageState: PageState = {
      path,
      title,
      timestamp: Date.now(),
      scrollPosition: 0
    };

    dispatch({ type: 'PUSH', payload: pageState });
  };

  const popPage = () => {
    dispatch({ type: 'POP' });
  };

  const updateScrollPosition = (position: number) => {
    dispatch({ type: 'UPDATE_SCROLL', payload: position });
  };

  const canGoBack = state.currentIndex > 0;
  const previousPage = canGoBack ? state.stack[state.currentIndex - 1] : null;

  return (
    <SessionStackContext.Provider 
      value={{
        state,
        pushPage,
        popPage,
        canGoBack,
        previousPage,
        updateScrollPosition
      }}
    >
      {children}
    </SessionStackContext.Provider>
  );
};

export const useSessionStack = (): SessionStackContextType => {
  const context = useContext(SessionStackContext);
  if (!context) {
    throw new Error('useSessionStack must be used within a SessionStackProvider');
  }
  return context;
};

// Hook to automatically track page visits
export const usePageTracking = (title?: string) => {
  const { pushPage } = useSessionStack();
  const location = useLocation();

  useEffect(() => {
    const pageTitle = title || document.title || 'Untitled Page';
    pushPage(location.pathname, pageTitle);
  }, [location.pathname, title, pushPage]);
};