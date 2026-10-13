export class ChatManager {
  constructor(net, domElement) {
    this.net = net;
    this.domElement = domElement;
    this.isOpen = false;

    this.container = document.getElementById('chat-container');
    this.messagesList = document.getElementById('chat-messages');
    this.input = document.getElementById('chat-input');

    this.initEvents();
    this.initNetwork();
  }

  initEvents() {
    window.addEventListener('keydown', (e) => {
      // Press Enter to open or send chat
      if (e.code === 'Enter') {
        if (!this.isOpen) {
          this.openChat();
        } else {
          this.sendChat();
        }
      }

      // Press Esc to cancel chat
      if (e.code === 'Escape' && this.isOpen) {
        this.closeChat();
      }
    });
  }

  openChat() {
    this.isOpen = true;
    if (this.container) this.container.classList.add('active');
    if (this.input) {
      this.input.style.display = 'block';
      this.input.focus();
      this.input.value = '';
    }
    // Release pointer lock so user can type
    if (document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  closeChat() {
    this.isOpen = false;
    if (this.container) this.container.classList.remove('active');
    if (this.input) {
      this.input.style.display = 'none';
      this.input.blur();
    }
    // Re-lock pointer
    if (this.domElement && this.domElement.requestPointerLock) {
      this.domElement.requestPointerLock();
    }
  }

  sendChat() {
    const text = this.input ? this.input.value.trim() : '';
    if (text.length > 0) {
      if (text === '/help') {
        this.addMessage('System', 'Controls: WASD Move • Q/E/F/R Build • 1-5 Weapons • B Dance • V Voice (PTT) • M Mute', '#ffd166');
      } else {
        this.net.send({
          type: 'chat_message',
          text
        });
      }
    }
    this.closeChat();
  }

  initNetwork() {
    this.net.on('chat_message', (data) => {
      this.addMessage(data.senderName, data.text);
    });
  }

  addMessage(senderName, text, color = '#38bdf8') {
    if (!this.messagesList) return;

    const msgEl = document.createElement('div');
    msgEl.className = 'chat-entry';
    msgEl.innerHTML = `<span style="color: ${color}; font-weight: bold;">[${senderName}]:</span> <span style="color: #ffffff;">${this.escapeHtml(text)}</span>`;

    this.messagesList.appendChild(msgEl);
    this.messagesList.scrollTop = this.messagesList.scrollHeight;

    // Fade out message after 10 seconds if chat not open
    setTimeout(() => {
      if (!this.isOpen && msgEl.parentNode) {
        msgEl.style.opacity = '0.5';
      }
    }, 10000);
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.innerText = str;
    return div.innerHTML;
  }
}
