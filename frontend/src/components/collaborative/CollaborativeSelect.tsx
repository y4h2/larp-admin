import { forwardRef, useEffect, useState, useCallback, useRef } from 'react';
import { Select, Tooltip } from 'antd';
import type { SelectProps, RefSelectProps } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { getUserColor } from '@/utils/cursorPosition';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface CollaborativeSelectProps extends Omit<SelectProps, 'ref'> {
  /** Document identifier (e.g., 'clue_abc123') */
  docId: string;
  /** Field name (e.g., 'type') */
  fieldName: string;
}

interface LockState {
  lockedBy: {
    id: string;
    name: string;
    color: string;
  } | null;
}

const CollaborativeSelect = forwardRef<RefSelectProps, CollaborativeSelectProps>(
  ({ docId, fieldName, disabled, onChange, ...selectProps }, ref) => {
    const { user } = useAuth();
    const [lockState, setLockState] = useState<LockState>({ lockedBy: null });
    const [isOpen, setIsOpen] = useState(false);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const onChangeRef = useRef(onChange);
    const selectRef = useRef<RefSelectProps>(null);

    // Combine external ref with internal ref
    const setRefs = useCallback((node: RefSelectProps | null) => {
      selectRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    }, [ref]);

    // Keep onChangeRef up to date
    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    const isLockedByOther = lockState.lockedBy && lockState.lockedBy.id !== user?.id;
    const isLockedBySelf = lockState.lockedBy?.id === user?.id;

    // Idle timeout callback: close dropdown and release lock
    const handleIdleTimeout = useCallback(() => {
      selectRef.current?.blur();
      setIsOpen(false);
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

    // Use idle timeout hook - active when dropdown is open
    useIdleTimeout(isOpen, handleIdleTimeout);

    // Initialize presence channel for field locking
    useEffect(() => {
      if (!user) return;

      const roomName = `select:${docId}:${fieldName}`;
      const channel = supabase.channel(roomName, {
        config: {
          presence: { key: user.id },
          broadcast: { self: true },
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
          // Only clear lock if it was set by someone else
          setLockState((prev) => {
            if (prev.lockedBy && prev.lockedBy.id !== user.id) {
              return { lockedBy: null };
            }
            return prev;
          });
        }
      });

      // Handle value sync from other users via broadcast
      channel
        .on('broadcast', { event: 'value-sync' }, (payload) => {
          const { newValue, senderId } = payload.payload as {
            newValue: unknown;
            senderId: string;
          };

          // Ignore our own changes
          if (senderId === user.id) return;

          // Update the form value using ref to avoid stale closure
          onChangeRef.current?.(newValue, {});
        })
        .subscribe(async (status) => {
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

    // Handle dropdown open - acquire lock
    const handleOpenChange = useCallback(
      async (open: boolean) => {
        if (!user || !channelRef.current) return;

        // If trying to open but locked by someone else, prevent
        if (open && isLockedByOther) {
          return;
        }

        setIsOpen(open);

        // Update presence to show editing state
        await channelRef.current.track({
          id: user.id,
          name: user.email?.split('@')[0] || 'Unknown',
          color: getUserColor(user.id),
          isEditing: open,
        });

        selectProps.onOpenChange?.(open);
      },
      [user, isLockedByOther, selectProps]
    );

    // Handle selection change
    const handleChange = useCallback(
      (value: unknown, option: unknown) => {
        if (channelRef.current && user) {
          // Sync value to other users
          channelRef.current.send({
            type: 'broadcast',
            event: 'value-sync',
            payload: { newValue: value, senderId: user.id },
          });

          // Release lock after selection
          channelRef.current.track({
            id: user.id,
            name: user.email?.split('@')[0] || 'Unknown',
            color: getUserColor(user.id),
            isEditing: false,
          });
        }
        setIsOpen(false);
        onChange?.(value, option);
      },
      [user, onChange]
    );

    // Build style based on lock state
    const lockStyle = isLockedByOther
      ? {
          borderColor: lockState.lockedBy!.color,
          boxShadow: `0 0 0 1px ${lockState.lockedBy!.color}40`,
        }
      : isLockedBySelf
      ? {
          borderColor: getUserColor(user?.id || ''),
          boxShadow: `0 0 0 1px ${getUserColor(user?.id || '')}40`,
        }
      : {};

    const selectElement = (
      <Select
        ref={setRefs}
        {...selectProps}
        open={isOpen}
        disabled={disabled || isLockedByOther}
        onOpenChange={handleOpenChange}
        onChange={handleChange}
        style={{ ...selectProps.style, ...lockStyle }}
        suffixIcon={
          isLockedByOther ? (
            <LockOutlined style={{ color: lockState.lockedBy!.color }} />
          ) : (
            selectProps.suffixIcon
          )
        }
      />
    );

    if (isLockedByOther) {
      return (
        <div style={{ position: 'relative' }}>
          <Tooltip title={`${lockState.lockedBy!.name} 正在编辑`} placement="top">
            {selectElement}
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

    return selectElement;
  }
);

CollaborativeSelect.displayName = 'CollaborativeSelect';

export default CollaborativeSelect;
