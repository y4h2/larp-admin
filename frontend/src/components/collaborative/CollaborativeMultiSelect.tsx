import { forwardRef, useEffect, useState, useCallback, useRef } from 'react';
import { Select } from 'antd';
import type { SelectProps, RefSelectProps } from 'antd';
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

interface EditingUser {
  id: string;
  name: string;
  color: string;
}

const CollaborativeMultiSelect = forwardRef<RefSelectProps, CollaborativeMultiSelectProps>(
  ({ docId, fieldName, mode = 'multiple', value, onChange, ...selectProps }, ref) => {
    const { user } = useAuth();
    const [editingUsers, setEditingUsers] = useState<EditingUser[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const localValueRef = useRef<unknown[]>(Array.isArray(value) ? value : []);

    // Keep localValueRef in sync with value prop
    useEffect(() => {
      localValueRef.current = Array.isArray(value) ? value : [];
    }, [value]);

    // Initialize presence channel
    useEffect(() => {
      if (!user) return;

      const roomName = `multiselect:${docId}:${fieldName}`;
      const channel = supabase.channel(roomName, {
        config: {
          presence: { key: user.id },
          broadcast: { self: false },
        },
      });

      // Track presence state - show who is editing
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const presences = Object.values(state).flat() as Array<{
          id: string;
          name: string;
          color: string;
          isEditing: boolean;
        }>;

        // Show other users who are editing
        const others = presences.filter((p) => p.isEditing && p.id !== user.id);
        setEditingUsers(others.map(p => ({ id: p.id, name: p.name, color: p.color })));
      });

      // Handle value changes from other users
      channel.on('broadcast', { event: 'value-change' }, (payload) => {
        const { action, item, senderId } = payload.payload as {
          action: 'add' | 'remove';
          item: unknown;
          senderId: string;
        };

        // Ignore our own changes
        if (senderId === user.id) return;

        const currentValue = localValueRef.current;
        let newValue: unknown[];

        if (action === 'add') {
          // Add item if not already present
          if (!currentValue.includes(item)) {
            newValue = [...currentValue, item];
          } else {
            return;
          }
        } else {
          // Remove item
          newValue = currentValue.filter((v) => v !== item);
        }

        localValueRef.current = newValue;
        onChange?.(newValue, []);
      });

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
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

    // Handle dropdown visibility change
    const handleDropdownVisibleChange = useCallback(
      async (open: boolean) => {
        if (!user || !channelRef.current) return;

        setIsOpen(open);

        // Update presence to show editing state
        await channelRef.current.track({
          id: user.id,
          name: user.email?.split('@')[0] || 'Unknown',
          color: getUserColor(user.id),
          isEditing: open,
        });

        selectProps.onDropdownVisibleChange?.(open);
      },
      [user, selectProps]
    );

    // Handle value change - broadcast to others
    const handleChange = useCallback(
      (newValue: unknown, option: unknown) => {
        if (!channelRef.current || !user) {
          onChange?.(newValue, option);
          return;
        }

        const oldValue = localValueRef.current;
        const newValueArray = Array.isArray(newValue) ? newValue : [];

        // Find added items
        const added = newValueArray.filter((v) => !oldValue.includes(v));
        // Find removed items
        const removed = oldValue.filter((v) => !newValueArray.includes(v));

        // Broadcast changes
        added.forEach((item) => {
          channelRef.current?.send({
            type: 'broadcast',
            event: 'value-change',
            payload: { action: 'add', item, senderId: user.id },
          });
        });

        removed.forEach((item) => {
          channelRef.current?.send({
            type: 'broadcast',
            event: 'value-change',
            payload: { action: 'remove', item, senderId: user.id },
          });
        });

        localValueRef.current = newValueArray;
        onChange?.(newValue, option);
      },
      [user, onChange]
    );

    // Build border style based on editing users
    const hasOtherEditors = editingUsers.length > 0;
    const borderColor = isOpen
      ? getUserColor(user?.id || '')
      : hasOtherEditors
      ? editingUsers[0].color
      : undefined;

    const borderStyle = borderColor
      ? {
          borderColor,
          boxShadow: `0 0 0 1px ${borderColor}40`,
        }
      : {};

    return (
      <div style={{ position: 'relative' }}>
        <Select
          ref={ref}
          mode={mode}
          value={value}
          onChange={handleChange}
          onDropdownVisibleChange={handleDropdownVisibleChange}
          style={{ ...selectProps.style, ...borderStyle }}
          {...selectProps}
        />
        {editingUsers.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: -8,
              right: 0,
              display: 'flex',
              gap: 4,
            }}
          >
            {editingUsers.map((u) => (
              <span
                key={u.id}
                style={{
                  backgroundColor: u.color,
                  color: 'white',
                  fontSize: 10,
                  padding: '1px 4px',
                  borderRadius: 2,
                  whiteSpace: 'nowrap',
                }}
              >
                {u.name}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }
);

CollaborativeMultiSelect.displayName = 'CollaborativeMultiSelect';

export default CollaborativeMultiSelect;
