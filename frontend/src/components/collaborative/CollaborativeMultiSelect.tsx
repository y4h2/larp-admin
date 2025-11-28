import { forwardRef, useEffect, useState, useCallback, useRef } from 'react';
import { Select, Tooltip } from 'antd';
import type { SelectProps, RefSelectProps, DefaultOptionType } from 'antd/es/select';
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
    const localValueRef = useRef<unknown[]>(Array.isArray(value) ? value : []);
    const dropdownOpenRef = useRef(false);

    const isLockedByOther = lockState.lockedBy && lockState.lockedBy.id !== user?.id;
    const isLockedBySelf = lockState.lockedBy?.id === user?.id;

    // Keep localValueRef in sync with value prop
    useEffect(() => {
      localValueRef.current = Array.isArray(value) ? value : [];
    }, [value]);

    // Initialize presence channel for field locking and value sync
    useEffect(() => {
      if (!user) return;

      const roomName = `multiselect:${docId}:${fieldName}`;
      const channel = supabase.channel(roomName, {
        config: {
          presence: { key: user.id },
          broadcast: { self: false },
        },
      });

      // Track presence state for locking
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

      // Handle value sync from other users
      channel.on('broadcast', { event: 'value-sync' }, (payload) => {
        const { newValue, senderId } = payload.payload as {
          newValue: unknown[];
          senderId: string;
        };

        // Ignore our own changes
        if (senderId === user.id) return;

        localValueRef.current = newValue;
        onChange?.(newValue, []);
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
    }, [user, docId, fieldName, onChange]);

    // Sync editing state to presence
    useEffect(() => {
      if (!user || !channelRef.current) return;

      channelRef.current.track({
        id: user.id,
        name: user.email?.split('@')[0] || 'Unknown',
        color: getUserColor(user.id),
        isEditing,
      });
    }, [user, isEditing]);

    // Handle dropdown open
    const handleDropdownVisibleChange = useCallback(
      (open: boolean) => {
        // If trying to open but locked by someone else, prevent
        if (open && isLockedByOther) {
          return;
        }

        dropdownOpenRef.current = open;
        selectProps.onDropdownVisibleChange?.(open);
      },
      [isLockedByOther, selectProps]
    );

    // Handle focus - acquire lock
    const handleFocus = useCallback(
      (e: React.FocusEvent<HTMLElement>) => {
        if (isLockedByOther) return;
        setIsEditing(true);
        selectProps.onFocus?.(e);
      },
      [isLockedByOther, selectProps]
    );

    // Handle blur - release lock
    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLElement>) => {
        setIsEditing(false);
        selectProps.onBlur?.(e);
      },
      [selectProps]
    );

    // Handle selection change - broadcast to others
    const handleChange = useCallback(
      (newValue: unknown, option?: DefaultOptionType | DefaultOptionType[]) => {
        if (!channelRef.current || !user) {
          onChange?.(newValue, option);
          return;
        }

        const newValueArray = Array.isArray(newValue) ? newValue : [];

        // Broadcast the new value to other users
        channelRef.current.send({
          type: 'broadcast',
          event: 'value-sync',
          payload: { newValue: newValueArray, senderId: user.id },
        });

        localValueRef.current = newValueArray;
        onChange?.(newValue, option);
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
        ref={ref}
        mode={mode}
        value={value}
        {...selectProps}
        disabled={disabled || !!isLockedByOther}
        onDropdownVisibleChange={handleDropdownVisibleChange}
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
