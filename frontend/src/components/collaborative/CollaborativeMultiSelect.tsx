import { forwardRef, useEffect, useState, useCallback, useRef } from 'react';
import { Select, Tooltip } from 'antd';
import type { SelectProps, RefSelectProps } from 'antd/es/select';
import { LockOutlined } from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getUserColor } from '@/utils/cursorPosition';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface CollaborativeMultiSelectProps extends Omit<SelectProps, 'ref' | 'mode'> {
  /** Document identifier (e.g., 'clue_abc123') */
  docId: string;
  /** Field name (e.g., 'tags') */
  fieldName: string;
  /** Select mode: 'multiple' or 'tags' */
  mode?: 'multiple' | 'tags';
}

interface LockState {
  lockedBy: {
    id: string;
    name: string;
    color: string;
  } | null;
}

interface PresenceState {
  id: string;
  name: string;
  color: string;
  isEditing: boolean;
}

const CollaborativeMultiSelect = forwardRef<RefSelectProps, CollaborativeMultiSelectProps>(
  ({ docId, fieldName, mode = 'multiple', disabled, value, onChange, ...selectProps }, ref) => {
    const { user } = useAuth();
    const [lockState, setLockState] = useState<LockState>({ lockedBy: null });
    const [isEditing, setIsEditing] = useState(false);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const currentValueRef = useRef<unknown[] | null>(null);
    const onChangeRef = useRef(onChange);

    // Keep onChangeRef up to date
    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    const isLockedByOther = lockState.lockedBy && lockState.lockedBy.id !== user?.id;
    const isLockedBySelf = lockState.lockedBy?.id === user?.id;

    // Initialize presence channel for field locking
    useEffect(() => {
      if (!user) return;

      const roomName = `multiselect:${docId}:${fieldName}`;
      const channel = supabase.channel(roomName, {
        config: {
          presence: { key: user.id },
          broadcast: { self: true },
        },
      });

      // Track presence state for locking (only care about OTHER users)
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const presences: PresenceState[] = [];

        Object.values(state).forEach((arr) => {
          (arr as PresenceState[]).forEach((p) => {
            if (p.id && p.name) {
              presences.push(p);
            }
          });
        });

        // Find if someone else is editing (ignore our own state from presence)
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
            newValue: unknown[];
            senderId: string;
          };

          // Ignore our own changes
          if (senderId === user.id) return;

          // Update the form value using ref to avoid stale closure
          onChangeRef.current?.(newValue, []);
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

    // Sync editing state to presence with debounce to avoid rapid updates
    useEffect(() => {
      if (!user || !channelRef.current) return;

      // Debounce the track call to avoid rapid presence updates during selection
      const timeoutId = setTimeout(() => {
        channelRef.current?.track({
          id: user.id,
          name: user.email?.split('@')[0] || 'Unknown',
          color: getUserColor(user.id),
          isEditing,
        });
      }, 100);

      return () => clearTimeout(timeoutId);
    }, [user, isEditing]);

    // Handle focus - acquire lock immediately and store current value
    const handleFocus = useCallback(
      (e: React.FocusEvent<HTMLElement>) => {
        if (isLockedByOther) return;
        // Store current value when starting to edit
        currentValueRef.current = Array.isArray(value) ? [...value] : [];
        setIsEditing(true);
        selectProps.onFocus?.(e);
      },
      [isLockedByOther, selectProps, value]
    );

    // Handle blur - release lock and sync data only when truly leaving
    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLElement>) => {
        // Use relatedTarget to check where focus is going
        // If focus stays within container (e.g., clicking dropdown options), don't release
        const relatedTarget = e.relatedTarget as HTMLElement | null;

        // Check immediately with relatedTarget
        if (relatedTarget && containerRef.current?.contains(relatedTarget)) {
          selectProps.onBlur?.(e);
          return;
        }

        // Also check after a short delay for cases where relatedTarget is null
        setTimeout(() => {
          if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
            // Sync value to other users before releasing lock
            if (currentValueRef.current !== null && channelRef.current && user) {
              channelRef.current.send({
                type: 'broadcast',
                event: 'value-sync',
                payload: { newValue: currentValueRef.current, senderId: user.id },
              });
            }
            setIsEditing(false);
          }
        }, 50);

        selectProps.onBlur?.(e);
      },
      [user, selectProps]
    );

    // Handle dropdown visibility - only prevent opening if locked by other
    const handleOpenChange = useCallback(
      (open: boolean) => {
        if (open && isLockedByOther) {
          return;
        }
        selectProps.onOpenChange?.(open);
      },
      [isLockedByOther, selectProps]
    );

    // Handle selection change - store value for later sync on blur
    const handleChange = useCallback<NonNullable<SelectProps['onChange']>>(
      (newValue, option) => {
        // Store the current value for syncing on blur
        currentValueRef.current = Array.isArray(newValue) ? newValue : [];
        onChange?.(newValue, option);
      },
      [onChange]
    );

    // Build style based on lock state or editing state
    const lockStyle = isLockedByOther
      ? {
          borderColor: lockState.lockedBy!.color,
          boxShadow: `0 0 0 1px ${lockState.lockedBy!.color}40`,
        }
      : (isLockedBySelf || isEditing)
      ? {
          borderColor: getUserColor(user?.id || ''),
          boxShadow: `0 0 0 1px ${getUserColor(user?.id || '')}40`,
        }
      : {};

    const selectElement = (
      <div ref={containerRef}>
        <Select
          ref={ref}
          mode={mode}
          value={value}
          {...selectProps}
          disabled={disabled || !!isLockedByOther}
          onOpenChange={handleOpenChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
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
      </div>
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

CollaborativeMultiSelect.displayName = 'CollaborativeMultiSelect';

export default CollaborativeMultiSelect;
