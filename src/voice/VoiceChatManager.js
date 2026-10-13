export class VoiceChatManager {
  constructor(net) {
    this.net = net;
    this.localStream = null;
    this.peerConnections = new Map(); // peerId -> RTCPeerConnection
    this.audioElements = new Map();   // peerId -> HTMLAudioElement
    this.isMuted = true;
    this.isPushToTalk = false;
    this.isEnabled = false;
    this.statusEl = document.getElementById('voice-status');

    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    this.initNetworkListeners();
    this.initControls();
  }

  async enableVoice() {
    if (this.isEnabled) return;
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Muted by default until Push-to-Talk or Unmute
      this.setMicrophoneEnabled(false);
      this.isEnabled = true;
      this.updateStatusUI();

      // Audio analyser for speaking detection
      this.initVoiceActivityDetection();
    } catch (err) {
      console.warn('Microphone access denied or unavailable:', err);
      if (this.statusEl) {
        this.statusEl.innerHTML = `🎙️ <span style="color:#ef4444">MIC DISABLED</span>`;
      }
    }
  }

  initVoiceActivityDetection() {
    if (!this.localStream) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(this.localStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      let wasSpeaking = false;

      setInterval(() => {
        if (this.isMuted && !this.isPushToTalk) {
          if (wasSpeaking) {
            wasSpeaking = false;
            this.net.send({ type: 'voice_speaking', isSpeaking: false });
          }
          return;
        }

        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i];
        const avg = sum / buffer.length;
        const isSpeaking = avg > 18;

        if (isSpeaking !== wasSpeaking) {
          wasSpeaking = isSpeaking;
          this.net.send({ type: 'voice_speaking', isSpeaking });
          this.updateSpeakingIndicator(isSpeaking);
        }
      }, 100);
    } catch (e) {
      console.warn('Voice activity detection error:', e);
    }
  }

  initControls() {
    // [V] Push-To-Talk & [M] Toggle Mute
    window.addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;

      if (e.code === 'KeyV' && !this.isPushToTalk) {
        this.isPushToTalk = true;
        this.setMicrophoneEnabled(true);
        this.updateStatusUI();
      }

      if (e.code === 'KeyM') {
        this.isMuted = !this.isMuted;
        this.setMicrophoneEnabled(!this.isMuted);
        this.updateStatusUI();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyV') {
        this.isPushToTalk = false;
        this.setMicrophoneEnabled(!this.isMuted);
        this.updateStatusUI();
      }
    });
  }

  setMicrophoneEnabled(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  updateStatusUI() {
    if (!this.statusEl) return;
    const transmitting = (!this.isMuted || this.isPushToTalk) && this.isEnabled;
    if (transmitting) {
      this.statusEl.innerHTML = `🟢 <span style="color: #22c55e">VOICE TRANSMITTING</span> <span style="font-size:12px;color:#94a3b8;">[PTT: V]</span>`;
    } else {
      this.statusEl.innerHTML = `🎙️ <span style="color: #94a3b8">MIC MUTED</span> <span style="font-size:12px;color:#ffd166;">[HOLD V OR PRESS M]</span>`;
    }
  }

  updateSpeakingIndicator(speaking) {
    if (this.statusEl && speaking) {
      this.statusEl.style.boxShadow = '0 0 10px #22c55e';
    } else if (this.statusEl) {
      this.statusEl.style.boxShadow = 'none';
    }
  }

  initNetworkListeners() {
    this.net.on('player_joined', (data) => {
      // Create WebRTC Offer for newly joined peer
      if (this.isEnabled && data.player.id !== this.net.playerId) {
        this.createPeerConnection(data.player.id, true);
      }
    });

    this.net.on('player_left', (data) => {
      this.removePeer(data.id);
    });

    this.net.on('webrtc_signal', async (data) => {
      const { senderId, signal } = data;
      let pc = this.peerConnections.get(senderId);

      if (!pc) {
        pc = this.createPeerConnection(senderId, false);
      }

      try {
        if (signal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          if (signal.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            this.net.send({
              type: 'webrtc_signal',
              targetId: senderId,
              signal: { sdp: pc.localDescription }
            });
          }
        } else if (signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch (err) {
        console.warn('WebRTC signaling error:', err);
      }
    });
  }

  createPeerConnection(peerId, isInitiator) {
    const pc = new RTCPeerConnection(this.rtcConfig);
    this.peerConnections.set(peerId, pc);

    // Add local tracks if available
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.net.send({
          type: 'webrtc_signal',
          targetId: peerId,
          signal: { candidate: event.candidate }
        });
      }
    };

    pc.ontrack = (event) => {
      let audio = this.audioElements.get(peerId);
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        document.body.appendChild(audio);
        this.audioElements.set(peerId, audio);
      }
      audio.srcObject = event.streams[0];
    };

    if (isInitiator) {
      pc.createOffer().then(offer => {
        return pc.setLocalDescription(offer);
      }).then(() => {
        this.net.send({
          type: 'webrtc_signal',
          targetId: peerId,
          signal: { sdp: pc.localDescription }
        });
      }).catch(err => console.warn('Offer creation failed:', err));
    }

    return pc;
  }

  removePeer(peerId) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
    const audio = this.audioElements.get(peerId);
    if (audio) {
      if (audio.parentNode) audio.parentNode.removeChild(audio);
      this.audioElements.delete(peerId);
    }
  }
}
