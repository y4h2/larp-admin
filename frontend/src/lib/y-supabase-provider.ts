import * as Y from 'yjs';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface AwarenessState {
  user?: {
    id: string;
    name: string;
    color: string;
  };
  cursor?: {
    index: number;
    length: number;
  };
}

export interface SupabaseProviderOptions {
  roomName: string;
  doc?: Y.Doc;
  awareness?: Awareness;
}

export class SupabaseProvider {
  doc: Y.Doc;
  awareness: Awareness;
  roomName: string;

  private channel: RealtimeChannel | null = null;
  private connected = false;
  private synced = false;
  private destroyed = false;

  private onStatusChange: ((status: { connected: boolean }) => void)[] = [];
  private onSynced: (() => void)[] = [];

  constructor(options: SupabaseProviderOptions) {
    this.roomName = options.roomName;
    this.doc = options.doc || new Y.Doc();
    this.awareness = options.awareness || new Awareness(this.doc);

    this.setupDocListener();
    this.setupAwarenessListener();
    this.connect();
  }

  private setupDocListener() {
    // Listen for local document updates and broadcast to others
    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote' || !this.connected) return;

      // Encode update as base64 for transmission
      const encodedUpdate = this.encodeUpdate(update);
      this.broadcastUpdate(encodedUpdate);
    });
  }

  private setupAwarenessListener() {
    // Listen for local awareness changes
    this.awareness.on('update', ({ added, updated, removed }: {
      added: number[];
      updated: number[];
      removed: number[]
    }) => {
      const changedClients = added.concat(updated).concat(removed);
      const encodedAwareness = this.encodeAwareness(changedClients);
      this.broadcastAwareness(encodedAwareness);
    });
  }

  private async connect() {
    if (this.destroyed) return;

    this.channel = supabase.channel(this.roomName, {
      config: {
        broadcast: { self: false },
        presence: { key: this.awareness.clientID.toString() },
      },
    });

    // Handle document updates from other users
    this.channel.on('broadcast', { event: 'yjs-update' }, (payload) => {
      if (this.destroyed) return;
      const update = this.decodeUpdate(payload.payload.update);
      Y.applyUpdate(this.doc, update, 'remote');
    });

    // Handle awareness updates from other users
    this.channel.on('broadcast', { event: 'yjs-awareness' }, (payload) => {
      if (this.destroyed) return;
      const update = this.decodeAwareness(payload.payload.awareness);
      applyAwarenessUpdate(this.awareness, update, 'remote');
    });

    // Handle sync request (when a new user joins)
    this.channel.on('broadcast', { event: 'yjs-sync-request' }, (payload) => {
      if (this.destroyed) return;
      // Send current state to the requesting client
      const state = Y.encodeStateAsUpdate(this.doc);
      const encodedState = this.encodeUpdate(state);
      this.channel?.send({
        type: 'broadcast',
        event: 'yjs-sync-response',
        payload: {
          state: encodedState,
          targetClient: payload.payload.clientId,
        },
      });
    });

    // Handle sync response
    this.channel.on('broadcast', { event: 'yjs-sync-response' }, (payload) => {
      if (this.destroyed) return;
      // Only apply if this response is for us
      if (payload.payload.targetClient !== this.awareness.clientID.toString()) return;

      const state = this.decodeUpdate(payload.payload.state);
      Y.applyUpdate(this.doc, state, 'remote');

      if (!this.synced) {
        this.synced = true;
        this.onSynced.forEach(cb => cb());
      }
    });

    // Handle presence sync for awareness
    this.channel.on('presence', { event: 'sync' }, () => {
      // Presence sync - we use broadcast for awareness instead
    });

    // Subscribe to the channel
    await this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        this.connected = true;
        this.onStatusChange.forEach(cb => cb({ connected: true }));

        // Request sync from other clients
        this.channel?.send({
          type: 'broadcast',
          event: 'yjs-sync-request',
          payload: { clientId: this.awareness.clientID.toString() },
        });

        // If no response in 1 second, consider ourselves synced
        setTimeout(() => {
          if (!this.synced && !this.destroyed) {
            this.synced = true;
            this.onSynced.forEach(cb => cb());
          }
        }, 1000);
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        this.connected = false;
        this.onStatusChange.forEach(cb => cb({ connected: false }));
      }
    });
  }

  private broadcastUpdate(encodedUpdate: string) {
    if (!this.channel || !this.connected) return;

    this.channel.send({
      type: 'broadcast',
      event: 'yjs-update',
      payload: { update: encodedUpdate },
    });
  }

  private broadcastAwareness(encodedAwareness: string) {
    if (!this.channel || !this.connected) return;

    this.channel.send({
      type: 'broadcast',
      event: 'yjs-awareness',
      payload: { awareness: encodedAwareness },
    });
  }

  private encodeUpdate(update: Uint8Array): string {
    return btoa(String.fromCharCode(...update));
  }

  private decodeUpdate(encoded: string): Uint8Array {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private encodeAwareness(changedClients: number[]): string {
    const update = encodeAwarenessUpdate(this.awareness, changedClients);
    return this.encodeUpdate(update);
  }

  private decodeAwareness(encoded: string): Uint8Array {
    return this.decodeUpdate(encoded);
  }

  // Public API

  get isConnected(): boolean {
    return this.connected;
  }

  get isSynced(): boolean {
    return this.synced;
  }

  onStatus(callback: (status: { connected: boolean }) => void): void {
    this.onStatusChange.push(callback);
  }

  onSync(callback: () => void): void {
    this.onSynced.push(callback);
    if (this.synced) {
      callback();
    }
  }

  setAwarenessState(state: AwarenessState): void {
    this.awareness.setLocalStateField('user', state.user);
    if (state.cursor) {
      this.awareness.setLocalStateField('cursor', state.cursor);
    }
  }

  clearAwarenessCursor(): void {
    this.awareness.setLocalStateField('cursor', null);
  }

  getAwarenessStates(): Map<number, AwarenessState> {
    return this.awareness.getStates() as Map<number, AwarenessState>;
  }

  destroy(): void {
    this.destroyed = true;

    // Remove awareness state
    removeAwarenessStates(
      this.awareness,
      [this.awareness.clientID],
      'destroy'
    );

    // Unsubscribe from channel
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }

    this.connected = false;
    this.onStatusChange = [];
    this.onSynced = [];
  }
}
