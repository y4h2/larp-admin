import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { useLocation } from 'react-router-dom';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

// Debug flag - set to true to enable presence logs
const PRESENCE_DEBUG = false;
const logPresence = (...args: unknown[]) => {
  if (PRESENCE_DEBUG) {
    console.log('[Presence]', ...args);
  }
};

// Types
export interface EditingState {
  type: 'script' | 'npc' | 'clue';
  id: string;
}

export interface UserPresence {
  id: string;
  email: string;
  currentPage: string;
  editing: EditingState | null;
  lastSeen: string;
}

interface PresenceContextType {
  onlineUsers: UserPresence[];
  currentUser: UserPresence | null;
  trackEditing: (type: EditingState['type'], id: string) => void;
  stopEditing: () => void;
  getUsersOnPage: (page: string) => UserPresence[];
  getUsersEditing: (type: EditingState['type'], id: string) => UserPresence[];
  isConnected: boolean;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

const CHANNEL_NAME = 'online-users';
const PRESENCE_THROTTLE_MS = 1000;

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const [currentUser, setCurrentUser] = useState<UserPresence | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // Create presence state from current user
  const createPresenceState = useCallback(
    (editing: EditingState | null = null): UserPresence | null => {
      if (!user) return null;
      return {
        id: user.id,
        email: user.email || 'Unknown',
        currentPage: location.pathname,
        editing,
        lastSeen: new Date().toISOString(),
      };
    },
    [user, location.pathname]
  );

  // Throttled track function
  const throttledTrack = useCallback(
    async (channel: RealtimeChannel, state: UserPresence) => {
      const now = Date.now();
      if (now - lastUpdateRef.current < PRESENCE_THROTTLE_MS) {
        return;
      }
      lastUpdateRef.current = now;
      await channel.track(state);
    },
    []
  );

  // Initialize presence channel - only depends on user.id to prevent reconnections
  useEffect(() => {
    if (!user) {
      setOnlineUsers([]);
      setCurrentUser(null);
      setIsConnected(false);
      return;
    }

    logPresence('Initializing channel for user:', user.id);

    const channel = supabase.channel(CHANNEL_NAME, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channelRef.current = channel;

    // Handle presence sync
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<UserPresence>();
      logPresence('Sync event, state:', state);
      const users: UserPresence[] = [];

      Object.values(state).forEach((presences) => {
        // Each user may have multiple presences, take the most recent
        if (presences.length > 0) {
          const mostRecent = presences.reduce((latest, current) =>
            new Date(current.lastSeen) > new Date(latest.lastSeen)
              ? current
              : latest
          );
          users.push(mostRecent);
        }
      });

      logPresence('Parsed users:', users);
      // Include all users (including current user)
      setOnlineUsers(users);
      const self = users.find((u) => u.id === user.id);
      if (self) {
        setCurrentUser(self);
      }
    });

    // Handle user join
    channel.on('presence', { event: 'join' }, ({ newPresences }) => {
      logPresence('User joined:', newPresences);
    });

    // Handle user leave
    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      logPresence('User left:', leftPresences);
    });

    // Subscribe and track initial presence
    channel.subscribe(async (status) => {
      logPresence('Channel status:', status, typeof status);
      if (status === 'SUBSCRIBED') {
        logPresence('Successfully subscribed, tracking user...');
        setIsConnected(true);
        // Create initial state inline to avoid dependency issues
        const initialState: UserPresence = {
          id: user.id,
          email: user.email || 'Unknown',
          currentPage: window.location.pathname,
          editing: null,
          lastSeen: new Date().toISOString(),
        };
        logPresence('Tracking initial state:', initialState);
        try {
          await channel.track(initialState);
          setCurrentUser(initialState);
          // Immediately show current user in online users list
          setOnlineUsers((prev) => {
            const exists = prev.some((u) => u.id === initialState.id);
            if (exists) return prev;
            return [...prev, initialState];
          });
        } catch (trackError) {
          console.error('[Presence] Track error:', trackError);
        }
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        logPresence('Channel closed or error');
        setIsConnected(false);
      }
    });

    return () => {
      logPresence('Cleaning up channel');
      channel.unsubscribe();
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [user?.id, user?.email]); // Only reconnect when user changes, not on every path change

  // Update presence when page changes
  useEffect(() => {
    if (!channelRef.current || !user || !isConnected) return;

    const newState = createPresenceState(currentUser?.editing || null);
    if (newState) {
      throttledTrack(channelRef.current, newState);
      setCurrentUser(newState);
    }
  }, [location.pathname, user, isConnected, createPresenceState, throttledTrack, currentUser?.editing]);

  // Track editing state
  const trackEditing = useCallback(
    (type: EditingState['type'], id: string) => {
      if (!channelRef.current || !user || !isConnected) return;

      const editing: EditingState = { type, id };
      const newState = createPresenceState(editing);
      if (newState) {
        channelRef.current.track(newState);
        setCurrentUser(newState);
      }
    },
    [user, isConnected, createPresenceState]
  );

  // Stop editing
  const stopEditing = useCallback(() => {
    if (!channelRef.current || !user || !isConnected) return;

    const newState = createPresenceState(null);
    if (newState) {
      channelRef.current.track(newState);
      setCurrentUser(newState);
    }
  }, [user, isConnected, createPresenceState]);

  // Get users on a specific page
  const getUsersOnPage = useCallback(
    (page: string): UserPresence[] => {
      return onlineUsers.filter((u) => u.currentPage === page);
    },
    [onlineUsers]
  );

  // Get users editing a specific resource
  const getUsersEditing = useCallback(
    (type: EditingState['type'], id: string): UserPresence[] => {
      return onlineUsers.filter(
        (u) => u.editing?.type === type && u.editing?.id === id
      );
    },
    [onlineUsers]
  );

  const value: PresenceContextType = {
    onlineUsers,
    currentUser,
    trackEditing,
    stopEditing,
    getUsersOnPage,
    getUsersEditing,
    isConnected,
  };

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  const context = useContext(PresenceContext);
  if (context === undefined) {
    throw new Error('usePresence must be used within a PresenceProvider');
  }
  return context;
}
