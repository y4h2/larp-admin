import {
  forwardRef,
  useRef,
  useEffect,
  useCallback,
  useState,
  useImperativeHandle,
} from 'react';
import { Input } from 'antd';
import type { TextAreaProps, TextAreaRef } from 'antd/es/input/TextArea';
import * as Y from 'yjs';
import { throttle } from 'lodash-es';
import { SupabaseProvider, type AwarenessState } from '@/lib/y-supabase-provider';
import { useAuth } from '@/contexts/AuthContext';
import { getUserColor, cleanupMirror } from '@/utils/cursorPosition';
import CursorOverlay, { type RemoteCursor } from './CursorOverlay';

const { TextArea } = Input;

export interface CollaborativeTextAreaProps
  extends Omit<TextAreaProps, 'value' | 'onChange' | 'ref'> {
  /** Document identifier (e.g., 'clue_abc123') */
  docId: string;
  /** Field name (e.g., 'detail') */
  fieldName: string;
  /** Initial value for the text area */
  value?: string;
  /** Callback when value changes (for form integration) */
  onChange?: (value: string) => void;
  /** Whether to show remote cursors */
  showCursors?: boolean;
  /** Callback when sync status changes */
  onSyncStatusChange?: (status: 'connecting' | 'synced' | 'disconnected') => void;
}

export interface CollaborativeTextAreaRef {
  focus: () => void;
  blur: () => void;
  getValue: () => string;
}

const CURSOR_UPDATE_INTERVAL = 100; // ms

const CollaborativeTextArea = forwardRef<CollaborativeTextAreaRef, CollaborativeTextAreaProps>(
  (
    {
      docId,
      fieldName,
      value: initialValue,
      onChange,
      showCursors = true,
      onSyncStatusChange,
      ...textAreaProps
    },
    ref
  ) => {
    const { user } = useAuth();
    const textareaRef = useRef<TextAreaRef>(null);
    const internalTextareaRef = useRef<HTMLTextAreaElement | null>(null);

    const [provider, setProvider] = useState<SupabaseProvider | null>(null);
    const [yText, setYText] = useState<Y.Text | null>(null);
    const [localValue, setLocalValue] = useState(initialValue || '');
    const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
    const [isReady, setIsReady] = useState(false);

    // Track if we're currently applying remote changes
    const isApplyingRemote = useRef(false);
    // Track the initial sync
    const hasInitialized = useRef(false);
    // Track if we're applying external value changes
    const isApplyingExternal = useRef(false);
    // Track the latest initialValue for use in onSync callback
    const latestInitialValue = useRef(initialValue);

    // Expose ref methods
    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      blur: () => textareaRef.current?.blur(),
      getValue: () => localValue,
    }));

    // Get internal textarea element
    useEffect(() => {
      if (textareaRef.current) {
        // Access the internal textarea element from Ant Design's TextArea
        const textarea = textareaRef.current.resizableTextArea?.textArea;
        if (textarea) {
          internalTextareaRef.current = textarea;
        }
      }
    }, []);

    // Keep latestInitialValue ref updated
    useEffect(() => {
      latestInitialValue.current = initialValue;
    }, [initialValue]);

    // Handle external value changes (e.g., from form.setFieldValue or AI enhancement)
    useEffect(() => {
      // Only apply if value changed externally
      if (
        initialValue !== undefined &&
        initialValue !== localValue &&
        !isApplyingRemote.current &&
        !isApplyingExternal.current
      ) {
        isApplyingExternal.current = true;

        // Update local state immediately to show the value
        setLocalValue(initialValue);

        // Sync to yText if available and initialized
        if (yText && hasInitialized.current) {
          const oldValue = yText.toString();
          applyDiffToYText(yText, oldValue, initialValue);
        }

        isApplyingExternal.current = false;
      }
    }, [initialValue, yText]);

    // Initialize Yjs provider
    useEffect(() => {
      if (!user) return;

      const roomName = `${docId}:${fieldName}`;
      const doc = new Y.Doc();
      const text = doc.getText('content');

      const newProvider = new SupabaseProvider({
        roomName,
        doc,
      });

      // Set user info for awareness
      newProvider.setAwarenessState({
        user: {
          id: user.id,
          name: user.email?.split('@')[0] || 'Unknown',
          color: getUserColor(user.id),
        },
      });

      newProvider.onStatus(({ connected }) => {
        onSyncStatusChange?.(connected ? 'synced' : 'disconnected');
      });

      newProvider.onSync(() => {
        setIsReady(true);
        onSyncStatusChange?.('synced');

        // Initialize with server value if empty, or sync from server
        if (!hasInitialized.current) {
          hasInitialized.current = true;
          const currentYTextValue = text.toString();
          const currentInitialValue = latestInitialValue.current;

          if (currentYTextValue.length === 0 && currentInitialValue) {
            // No remote content, use initial value
            text.insert(0, currentInitialValue);
          } else if (currentYTextValue.length > 0) {
            // Remote content exists, use it
            setLocalValue(currentYTextValue);
            onChange?.(currentYTextValue);
          }
        }
      });

      setProvider(newProvider);
      setYText(text);

      // Listen for Y.Text changes
      const observer = () => {
        if (isApplyingRemote.current) return;

        isApplyingRemote.current = true;
        const newValue = text.toString();
        setLocalValue(newValue);
        onChange?.(newValue);
        isApplyingRemote.current = false;
      };

      text.observe(observer);

      // Listen for awareness changes
      const awarenessObserver = () => {
        const states = newProvider.getAwarenessStates();
        const cursors: RemoteCursor[] = [];

        states.forEach((state, clientId) => {
          // Skip self
          if (clientId === newProvider.awareness.clientID) return;
          if (!state.user) return;

          cursors.push({
            odystyleId: clientId.toString(),
            userId: state.user.id,
            userName: state.user.name,
            color: state.user.color,
            cursor: state.cursor || null,
          });
        });

        setRemoteCursors(cursors);
      };

      newProvider.awareness.on('change', awarenessObserver);

      return () => {
        text.unobserve(observer);
        newProvider.awareness.off('change', awarenessObserver);
        newProvider.destroy();

        if (internalTextareaRef.current) {
          cleanupMirror(internalTextareaRef.current);
        }
      };
    }, [user, docId, fieldName]);

    // Handle local text changes
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (!yText || isApplyingRemote.current) return;

        const newValue = e.target.value;
        const oldValue = localValue;

        // Calculate diff and apply to Y.Text
        applyDiffToYText(yText, oldValue, newValue);

        setLocalValue(newValue);
        onChange?.(newValue);
      },
      [yText, localValue, onChange]
    );

    // Throttled cursor position update
    const throttledUpdateCursor = useCallback(
      throttle((index: number, length: number) => {
        if (!provider) return;

        provider.setAwarenessState({
          user: provider.getAwarenessStates().get(provider.awareness.clientID)?.user,
          cursor: { index, length },
        });
      }, CURSOR_UPDATE_INTERVAL),
      [provider]
    );

    // Handle cursor/selection changes
    const handleCursorChange = useCallback(() => {
      const textarea = internalTextareaRef.current;
      if (!textarea || !provider) return;

      const { selectionStart, selectionEnd } = textarea;
      throttledUpdateCursor(selectionStart, selectionEnd - selectionStart);
    }, [provider, throttledUpdateCursor]);

    // Handle focus - start tracking cursor
    const handleFocus = useCallback(
      (e: React.FocusEvent<HTMLTextAreaElement>) => {
        handleCursorChange();
        textAreaProps.onFocus?.(e);
      },
      [handleCursorChange, textAreaProps]
    );

    // Handle blur - clear cursor
    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLTextAreaElement>) => {
        provider?.clearAwarenessCursor();
        textAreaProps.onBlur?.(e);
      },
      [provider, textAreaProps]
    );

    return (
      <div style={{ position: 'relative' }}>
        <TextArea
          ref={textareaRef}
          value={localValue}
          onChange={handleChange}
          onSelect={handleCursorChange}
          onKeyUp={handleCursorChange}
          onClick={handleCursorChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...textAreaProps}
        />
        {showCursors && isReady && internalTextareaRef.current && (
          <CursorOverlay
            textareaRef={internalTextareaRef as React.RefObject<HTMLTextAreaElement>}
            remoteCursors={remoteCursors}
            textValue={localValue}
          />
        )}
      </div>
    );
  }
);

CollaborativeTextArea.displayName = 'CollaborativeTextArea';

export default CollaborativeTextArea;

/**
 * Apply text diff to Y.Text using a simple diff algorithm
 */
function applyDiffToYText(yText: Y.Text, oldValue: string, newValue: string): void {
  // Find common prefix
  let start = 0;
  while (start < oldValue.length && start < newValue.length && oldValue[start] === newValue[start]) {
    start++;
  }

  // Find common suffix
  let oldEnd = oldValue.length;
  let newEnd = newValue.length;
  while (
    oldEnd > start &&
    newEnd > start &&
    oldValue[oldEnd - 1] === newValue[newEnd - 1]
  ) {
    oldEnd--;
    newEnd--;
  }

  // Apply changes
  const deleteCount = oldEnd - start;
  const insertText = newValue.slice(start, newEnd);

  yText.doc?.transact(() => {
    if (deleteCount > 0) {
      yText.delete(start, deleteCount);
    }
    if (insertText.length > 0) {
      yText.insert(start, insertText);
    }
  });
}
