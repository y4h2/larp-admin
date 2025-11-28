import { forwardRef, useEffect, useState, useCallback, useRef } from 'react';
import { Input, Tooltip } from 'antd';
import type { InputProps, InputRef } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { getUserColor } from '@/utils/cursorPosition';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface CollaborativeInputProps extends Omit<InputProps, 'ref'> {
  /** Document identifier (e.g., 'clue_abc123') */
  docId: string;
  /** Field name (e.g., 'name') */
  fieldName: string;
}

export interface CollaborativeInputRef {
  focus: () => void;
  blur: () => void;
}

interface LockState {
  lockedBy: {
    id: string;
    name: string;
    color: string;
  } | null;
}

const CollaborativeInput = forwardRef<InputRef, CollaborativeInputProps>(
  ({ docId, fieldName, disabled, onFocus, onBlur, ...inputProps }, ref) => {
    const { user } = useAuth();
    const [lockState, setLockState] = useState<LockState>({ lockedBy: null });
    const [isFocused, setIsFocused] = useState(false);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const inputRef = useRef<InputRef>(null);

    // Combine external ref with internal ref
    const setRefs = useCallback((node: InputRef | null) => {
      inputRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    }, [ref]);

    const isLockedByOther = lockState.lockedBy && lockState.lockedBy.id !== user?.id;
    const isLockedBySelf = lockState.lockedBy?.id === user?.id;

    // Idle timeout callback: blur and release lock
    const handleIdleTimeout = useCallback(() => {
      inputRef.current?.blur();
      setIsFocused(false);
      // Release lock
      if (channelRef.current && user) {
        channelRef.current.track({
          id: user.id,
          name: user.email?.split('@')[0] || 'Unknown',
          color: getUserColor(user.id),
          isEditing: false,
        });
      }
    }, [user]);

    // Use idle timeout hook - active when focused
    useIdleTimeout(isFocused, handleIdleTimeout);

    // Initialize presence channel for field locking
    useEffect(() => {
      if (!user) return;

      const roomName = `input:${docId}:${fieldName}`;
      const channel = supabase.channel(roomName, {
        config: {
          presence: { key: user.id },
        },
      });

      // Track presence state
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const presences = Object.values(state).flat() as Array<{
          id: string;
          name: string;
          color: string;
          isEditing: boolean;
        }>;

        // Find if someone else is editing
        const editingUser = presences.find((p) => p.isEditing && p.id !== user.id);

        if (editingUser) {
          setLockState({
            lockedBy: {
              id: editingUser.id,
              name: editingUser.name,
              color: editingUser.color,
            },
          });
        } else {
          setLockState({ lockedBy: null });
        }
      });

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track our presence (not editing initially)
          await channel.track({
            id: user.id,
            name: user.email?.split('@')[0] || 'Unknown',
            color: getUserColor(user.id),
            isEditing: false,
          });
        }
      });

      channelRef.current = channel;

      return () => {
        channel.unsubscribe();
        channelRef.current = null;
      };
    }, [user, docId, fieldName]);

    // Handle focus - acquire lock
    const handleFocus = useCallback(
      async (e: React.FocusEvent<HTMLInputElement>) => {
        if (!user || !channelRef.current) return;

        // If locked by someone else, blur immediately
        if (isLockedByOther) {
          e.target.blur();
          return;
        }

        setIsFocused(true);

        // Update presence to show editing state
        await channelRef.current.track({
          id: user.id,
          name: user.email?.split('@')[0] || 'Unknown',
          color: getUserColor(user.id),
          isEditing: true,
        });

        onFocus?.(e);
      },
      [user, isLockedByOther, onFocus]
    );

    // Handle blur - release lock
    const handleBlur = useCallback(
      async (e: React.FocusEvent<HTMLInputElement>) => {
        if (!user || !channelRef.current) return;

        setIsFocused(false);

        // Update presence to release lock
        await channelRef.current.track({
          id: user.id,
          name: user.email?.split('@')[0] || 'Unknown',
          color: getUserColor(user.id),
          isEditing: false,
        });

        onBlur?.(e);
      },
      [user, onBlur]
    );

    // Build style based on lock state
    const lockStyle = isLockedByOther
      ? {
          borderColor: lockState.lockedBy!.color,
          boxShadow: `0 0 0 1px ${lockState.lockedBy!.color}40`,
        }
      : isLockedBySelf || isFocused
      ? {
          borderColor: getUserColor(user?.id || ''),
          boxShadow: `0 0 0 1px ${getUserColor(user?.id || '')}40`,
        }
      : {};

    const inputElement = (
      <Input
        ref={setRefs}
        {...inputProps}
        disabled={disabled || isLockedByOther}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={{ ...inputProps.style, ...lockStyle }}
        suffix={
          isLockedByOther ? (
            <LockOutlined style={{ color: lockState.lockedBy!.color }} />
          ) : (
            inputProps.suffix
          )
        }
      />
    );

    if (isLockedByOther) {
      return (
        <div style={{ position: 'relative' }}>
          <Tooltip title={`${lockState.lockedBy!.name} 正在编辑`} placement="top">
            {inputElement}
          </Tooltip>
          <div
            style={{
              position: 'absolute',
              top: -8,
              right: 0,
            }}
          >
            <span
              style={{
                backgroundColor: lockState.lockedBy!.color,
                color: 'white',
                fontSize: 10,
                padding: '1px 4px',
                borderRadius: 2,
                whiteSpace: 'nowrap',
              }}
            >
              {lockState.lockedBy!.name}
            </span>
          </div>
        </div>
      );
    }

    return inputElement;
  }
);

CollaborativeInput.displayName = 'CollaborativeInput';

export default CollaborativeInput;
