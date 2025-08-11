import { signal, computed } from '@preact/signals';
import { doc, collection, query, where, onSnapshot, setDoc, deleteDoc, serverTimestamp, Unsubscribe } from 'firebase/firestore';
import { getDb } from '../app/firebase';
import { ConnectionManager } from './connection-manager';

export interface UserPresence {
  userId: string;
  userName: string;
  userAvatar?: string;
  location: 'group' | 'expense-form' | 'expense-detail';
  locationId: string;
  activity: 'viewing' | 'editing' | 'typing';
  lastSeen: number;
  isOnline: boolean;
}

export interface TypingIndicator {
  userId: string;
  userName: string;
  location: string;
  startedAt: number;
}

export class PresenceManager {
  private static instance: PresenceManager;
  
  // State
  public presences = signal<UserPresence[]>([]);
  public typingUsers = signal<TypingIndicator[]>([]);
  public isPresenceEnabled = signal<boolean>(false);
  
  // Computed values
  public onlineUsers = computed(() => 
    this.presences.value.filter(p => p.isOnline && Date.now() - p.lastSeen < 60000)
  );
  
  public usersInCurrentLocation = computed(() => {
    const currentLocation = this.getCurrentLocation();
    return this.onlineUsers.value.filter(p => 
      p.location === currentLocation.type && p.locationId === currentLocation.id
    );
  });

  // Private state
  private currentUser: { id: string; name: string; avatar?: string } | null = null;
  private currentLocation: { type: string; id: string } | null = null;
  private presenceListener: Unsubscribe | null = null;
  private typingListener: Unsubscribe | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private typingTimeout: NodeJS.Timeout | null = null;
  private connectionManager = ConnectionManager.getInstance();

  private constructor() {
    this.setupConnectionListener();
  }

  static getInstance(): PresenceManager {
    if (!PresenceManager.instance) {
      PresenceManager.instance = new PresenceManager();
    }
    return PresenceManager.instance;
  }

  /**
   * Initialize presence tracking for a user
   */
  async initialize(user: { id: string; name: string; avatar?: string }): Promise<void> {
    this.currentUser = user;
    
    if (this.connectionManager.isOnline.value) {
      await this.startPresenceTracking();
    }
    
    this.isPresenceEnabled.value = true;
  }

  /**
   * Update current location (group, expense form, etc.)
   */
  async updateLocation(
    type: 'group' | 'expense-form' | 'expense-detail',
    id: string,
    activity: 'viewing' | 'editing' = 'viewing'
  ): Promise<void> {
    if (!this.currentUser || !this.connectionManager.isOnline.value) return;

    this.currentLocation = { type, id };

    try {
      await this.updatePresenceDoc({
        location: type,
        locationId: id,
        activity,
        lastSeen: Date.now()
      });
      
      // Subscribe to others in this location
      this.subscribeToLocationPresence(type, id);
      
    } catch (error) {
      console.debug('Failed to update presence location:', error);
    }
  }

  /**
   * Start typing indicator
   */
  startTyping(location?: string): void {
    if (!this.currentUser || !this.connectionManager.isOnline.value) return;

    const typingLocation = location || this.getTypingLocation();
    if (!typingLocation) return;

    // Clear existing typing timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    // Update typing status
    this.updateTypingStatus(typingLocation, true);

    // Auto-stop typing after 3 seconds of inactivity
    this.typingTimeout = setTimeout(() => {
      this.stopTyping();
    }, 3000);
  }

  /**
   * Stop typing indicator
   */
  stopTyping(): void {
    if (!this.currentUser) return;

    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }

    const typingLocation = this.getTypingLocation();
    if (typingLocation) {
      this.updateTypingStatus(typingLocation, false);
    }
  }

  /**
   * Get users currently in the same location
   */
  getUsersInLocation(type: string, id: string): UserPresence[] {
    return this.onlineUsers.value.filter(p => 
      p.location === type && p.locationId === id && p.userId !== this.currentUser?.id
    );
  }

  /**
   * Get typing users in current location
   */
  getTypingUsersInLocation(location?: string): TypingIndicator[] {
    const targetLocation = location || this.getTypingLocation();
    if (!targetLocation) return [];

    return this.typingUsers.value.filter(t => 
      t.location === targetLocation && t.userId !== this.currentUser?.id
    );
  }

  /**
   * Cleanup and stop presence tracking
   */
  dispose(): void {
    this.stopPresenceTracking();
    this.isPresenceEnabled.value = false;
    this.presences.value = [];
    this.typingUsers.value = [];
    this.currentUser = null;
    this.currentLocation = null;
  }

  // Private methods

  private setupConnectionListener(): void {
    // Start/stop presence based on connection status
    this.connectionManager.isOnline.subscribe((isOnline) => {
      if (isOnline && this.currentUser) {
        this.startPresenceTracking();
      } else {
        this.stopPresenceTracking();
      }
    });
  }

  private async startPresenceTracking(): Promise<void> {
    if (!this.currentUser) return;

    try {
      // Create initial presence document
      await this.updatePresenceDoc({
        location: 'group',
        locationId: '',
        activity: 'viewing',
        lastSeen: Date.now()
      });

      // Start heartbeat to keep presence alive
      this.startHeartbeat();

      // Setup cleanup on disconnect
      this.setupDisconnectCleanup();
      
    } catch (error) {
      console.debug('Failed to start presence tracking:', error);
    }
  }

  private stopPresenceTracking(): void {
    // Stop listeners
    if (this.presenceListener) {
      this.presenceListener();
      this.presenceListener = null;
    }
    
    if (this.typingListener) {
      this.typingListener();
      this.typingListener = null;
    }

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Clean up presence document
    this.cleanupPresenceDoc();
  }

  private async updatePresenceDoc(updates: Partial<UserPresence>): Promise<void> {
    if (!this.currentUser) return;

    const presenceDoc = doc(getDb(), 'user-presence', this.currentUser.id);
    
    await setDoc(presenceDoc, {
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      userAvatar: this.currentUser.avatar || null,
      isOnline: true,
      lastSeen: serverTimestamp(),
      ...updates
    }, { merge: true });
  }

  private async cleanupPresenceDoc(): Promise<void> {
    if (!this.currentUser) return;

    try {
      const presenceDoc = doc(getDb(), 'user-presence', this.currentUser.id);
      await deleteDoc(presenceDoc);
    } catch (error) {
      console.debug('Failed to cleanup presence doc:', error);
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(async () => {
      if (this.currentUser && this.connectionManager.isOnline.value) {
        try {
          await this.updatePresenceDoc({
            lastSeen: Date.now()
          });
        } catch (error) {
          console.debug('Heartbeat failed:', error);
        }
      }
    }, 30000); // Update every 30 seconds
  }

  private setupDisconnectCleanup(): void {
    // Cleanup presence when window/tab closes
    window.addEventListener('beforeunload', () => {
      this.cleanupPresenceDoc();
    });

    // Cleanup on page visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.cleanupPresenceDoc();
      } else if (this.currentUser && this.connectionManager.isOnline.value) {
        this.startPresenceTracking();
      }
    });
  }

  private subscribeToLocationPresence(type: string, id: string): void {
    // Unsubscribe from previous listener
    if (this.presenceListener) {
      this.presenceListener();
    }

    // Subscribe to presence in current location
    const presenceQuery = query(
      collection(getDb(), 'user-presence'),
      where('location', '==', type),
      where('locationId', '==', id),
      where('isOnline', '==', true)
    );

    this.presenceListener = onSnapshot(
      presenceQuery,
      { includeMetadataChanges: false },
      (snapshot) => {
        const presences: UserPresence[] = [];
        const now = Date.now();
        
        snapshot.forEach(doc => {
          const data = doc.data() as UserPresence;
          
          // Only include recent presence (within 2 minutes)
          if (now - data.lastSeen < 120000) {
            presences.push(data);
          }
        });
        
        this.presences.value = presences;
      },
      (error) => {
        console.debug('Presence listener error:', error);
      }
    );

    // Subscribe to typing indicators in this location
    this.subscribeToTypingIndicators(this.getTypingLocation());
  }

  private subscribeToTypingIndicators(location: string): void {
    if (!location) return;

    if (this.typingListener) {
      this.typingListener();
    }

    const typingQuery = query(
      collection(getDb(), 'typing-indicators'),
      where('location', '==', location)
    );

    this.typingListener = onSnapshot(
      typingQuery,
      { includeMetadataChanges: false },
      (snapshot) => {
        const typingIndicators: TypingIndicator[] = [];
        const now = Date.now();
        
        snapshot.forEach(doc => {
          const data = doc.data() as TypingIndicator;
          
          // Only include recent typing (within 5 seconds)
          if (now - data.startedAt < 5000) {
            typingIndicators.push(data);
          }
        });
        
        this.typingUsers.value = typingIndicators;
      },
      (error) => {
        console.debug('Typing listener error:', error);
      }
    );
  }

  private async updateTypingStatus(location: string, isTyping: boolean): Promise<void> {
    if (!this.currentUser) return;

    const typingDoc = doc(getDb(), 'typing-indicators', `${this.currentUser.id}-${location}`);
    
    try {
      if (isTyping) {
        await setDoc(typingDoc, {
          userId: this.currentUser.id,
          userName: this.currentUser.name,
          location,
          startedAt: Date.now()
        });
      } else {
        await deleteDoc(typingDoc);
      }
    } catch (error) {
      console.debug('Failed to update typing status:', error);
    }
  }

  private getCurrentLocation(): { type: string; id: string } {
    return this.currentLocation || { type: 'group', id: '' };
  }

  private getTypingLocation(): string {
    if (!this.currentLocation) return '';
    return `${this.currentLocation.type}-${this.currentLocation.id}`;
  }
}