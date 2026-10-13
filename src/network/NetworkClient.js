export class NetworkClient {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.listeners = new Map();
    this.roomId = 'main';
    this.playerId = null;
  }

  connect(roomId = 'main', playerName = 'Jonesy') {
    this.roomId = roomId;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // If dev port 5173, connect to 3000 where server runs; otherwise same port
    const port = window.location.port === '5173' ? '3000' : (window.location.port || '3000');
    const wsUrl = `${protocol}//${window.location.hostname}:${port}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.connected = true;
      this.emit('connected');

      // Send join message
      this.send({
        type: 'join',
        roomId: this.roomId,
        name: playerName
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit(data.type, data);
      } catch (err) {
        console.error('Error parsing server message:', err);
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.emit('disconnected');
    };

    this.ws.onerror = (err) => {
      console.warn('WebSocket connection error:', err);
    };
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }
}
