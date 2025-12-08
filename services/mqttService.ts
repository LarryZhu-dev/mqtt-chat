
import mqtt from 'mqtt';
import { ChatMessage, PresencePayload, PublicRoomPayload, Reaction, RoomConfig, VotePayload } from '../types';

// EMQX Public Broker
const BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';

export class MqttService {
  client: mqtt.MqttClient | null = null;
  clientId: string;
  callbacks: {
    onMessage: (msg: ChatMessage) => void;
    onPresence: (payload: PresencePayload) => void;
    onReaction: (reaction: { targetId: string; reaction: Reaction }) => void;
    onRoomListUpdate: (payload: PublicRoomPayload) => void;
    onConnectionChange: (connected: boolean) => void;
    onConfigUpdate: (config: RoomConfig) => void;
    onVote: (payload: VotePayload) => void;
  };

  constructor(clientId: string) {
    this.clientId = clientId;
    this.callbacks = {
      onMessage: () => {},
      onPresence: () => {},
      onReaction: () => {},
      onRoomListUpdate: () => {},
      onConnectionChange: () => {},
      onConfigUpdate: () => {},
      onVote: () => {},
    };
  }

  // Updated to support Last Will and Testament (LWT)
  connect(onConnected: () => void, lwtOptions?: { topic: string, payload: string }) {
    console.log(`Connecting to ${BROKER_URL} as ${this.clientId}`);
    
    const options: mqtt.IClientOptions = {
      clientId: this.clientId,
      clean: true,
      keepalive: 60,
      protocolVersion: 5, 
      properties: {
        sessionExpiryInterval: 60,
      }
    };

    // If LWT is provided (used when joining a room to handle ungraceful disconnects)
    if (lwtOptions) {
        options.will = {
            topic: lwtOptions.topic,
            payload: lwtOptions.payload,
            qos: 0,
            retain: false
        };
    }

    this.client = mqtt.connect(BROKER_URL, options);

    this.client.on('connect', () => {
      console.log('MQTT Connected');
      this.callbacks.onConnectionChange(true);
      onConnected();
    });

    this.client.on('error', (err) => {
      console.error('MQTT Error:', err);
      this.callbacks.onConnectionChange(false);
    });

    this.client.on('offline', () => {
      this.callbacks.onConnectionChange(false);
    });

    this.client.on('message', (topic, payload, packet) => {
      try {
        // Handle empty payload (deletion)
        if (payload.length === 0) {
            if (topic.startsWith('darkmqtt/lobby/')) {
                const roomId = topic.split('/').pop();
                if (roomId) this.callbacks.onRoomListUpdate({ roomId, topicName: '', userCount: 0 });
            }
            return;
        }

        const data = JSON.parse(payload.toString());
        
        if (topic.includes('/messages')) {
            this.callbacks.onMessage(data);
        } else if (topic.includes('/presence')) {
            this.callbacks.onPresence(data);
        } else if (topic.includes('/reactions')) {
            this.callbacks.onReaction(data);
        } else if (topic.includes('/config')) {
            this.callbacks.onConfigUpdate(data);
        } else if (topic.includes('/vote')) {
            this.callbacks.onVote(data);
        } else if (topic.startsWith('darkmqtt/lobby/')) {
            this.callbacks.onRoomListUpdate(data);
        }

      } catch (e) {
        console.warn('Failed to parse MQTT message', e);
      }
    });
  }

  joinRoom(roomId: string) {
    if (!this.client) return;
    
    const root = `darkmqtt/room/${roomId}`;
    this.client.subscribe(`${root}/messages`);
    this.client.subscribe(`${root}/presence`);
    this.client.subscribe(`${root}/reactions`);
    this.client.subscribe(`${root}/config`);
    this.client.subscribe(`${root}/vote`);
  }

  leaveRoom(roomId: string) {
      if (!this.client) return;
      const root = `darkmqtt/room/${roomId}`;
      this.client.unsubscribe(`${root}/messages`);
      this.client.unsubscribe(`${root}/presence`);
      this.client.unsubscribe(`${root}/reactions`);
      this.client.unsubscribe(`${root}/config`);
      this.client.unsubscribe(`${root}/vote`);
  }

  // Config Management (Retained)
  publishRoomConfig(roomId: string, config: RoomConfig) {
      if (!this.client) return;
      this.client.publish(`darkmqtt/room/${roomId}/config`, JSON.stringify(config), { retain: true });
  }

  // Voting
  sendVote(roomId: string, payload: VotePayload) {
      if (!this.client) return;
      // Voting messages should not be retained, they are real-time events
      this.client.publish(`darkmqtt/room/${roomId}/vote`, JSON.stringify(payload));
  }

  subscribeToLobby() {
      if (!this.client) return;
      this.client.subscribe('darkmqtt/lobby/+');
  }
  
  unsubscribeLobby() {
    if (!this.client) return;
    this.client.unsubscribe('darkmqtt/lobby/+');
  }

  sendMessage(roomId: string, message: ChatMessage) {
    if (!this.client) return;
    this.client.publish(`darkmqtt/room/${roomId}/messages`, JSON.stringify(message));
  }

  sendPresence(roomId: string, payload: PresencePayload) {
      if (!this.client) return;
      // Use LWT behavior manually if needed, but for now standard publish
      this.client.publish(`darkmqtt/room/${roomId}/presence`, JSON.stringify(payload));
  }

  sendReaction(roomId: string, targetId: string, reaction: Reaction) {
      if (!this.client) return;
      this.client.publish(`darkmqtt/room/${roomId}/reactions`, JSON.stringify({ targetId, reaction }));
  }

  // Update lobby with expiry. If nobody updates for 15s, it vanishes.
  updatePublicRoomListing(roomId: string, topicName: string, userCount: number) {
      if (!this.client) return;
      const payload: PublicRoomPayload = { roomId, topicName, userCount };
      
      this.client.publish(`darkmqtt/lobby/${roomId}`, JSON.stringify(payload), { 
          retain: true,
          properties: {
              messageExpiryInterval: 15 // seconds. Requires MQTT 5.0
          }
      });
  }

  // Explicitly delete lobby entry
  clearPublicRoomListing(roomId: string) {
      if (!this.client) return;
      this.client.publish(`darkmqtt/lobby/${roomId}`, '', { retain: true });
  }

  setCallbacks(callbacks: typeof this.callbacks) {
    this.callbacks = callbacks;
  }

  disconnect() {
    if (this.client) {
      this.client.end();
    }
  }
}
