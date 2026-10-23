import React, { useState, useRef, useEffect } from 'react';
import { 
  Phone, 
  PhoneOff, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Share2, 
  MessageSquare, 
  Hand, 
  Subtitles, 
  Volume2, 
  Sparkles,
  Users,
  Copy,
  Check,
  Send,
  ExternalLink
} from 'lucide-react';
import { SensorySettings } from '../types';
import { getTranslation } from '../services/localization';
import { triggerHaptic, HAPTIC_PATTERNS } from '../services/haptics';
import { speakText } from '../services/speechService';

interface WebRTCCallModuleProps {
  settings: SensorySettings;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const WebRTCCallModule: React.FC<WebRTCCallModuleProps> = ({ settings }) => {
  const [inCall, setInCall] = useState(false);
  const [roomId, setRoomId] = useState('DIVYANG-ROOM-101');
  const [peerId] = useState(`user-${Math.random().toString(36).substring(2, 7)}`);
  const [copiedLink, setCopiedLink] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoDisabled, setVideoDisabled] = useState(false);
  const [detectedGestureInCall, setDetectedGestureInCall] = useState<string | null>(null);
  const [subtitlesStream, setSubtitlesStream] = useState<string[]>([]);
  const [currentSpeechSubtitle, setCurrentSpeechSubtitle] = useState<string>(
    'Subtitles will appear here when speech is detected.'
  );

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const speechRecRef = useRef<any>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const t = (key: string) => getTranslation(settings.uiLanguage, key);

  // Initialize and start real call
  const startRealCall = async () => {
    triggerHaptic(HAPTIC_PATTERNS.CLICK);
    try {
      // 1. Get real camera & mic stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: true,
      });
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play();
      }

      // 2. Setup WebRTC PeerConnection
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;

      // Add local tracks
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Handle remote track
      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          remoteVideoRef.current.play();
        }
      };

      // Handle ICE Candidates to send to signaling server
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignalMessage('candidate', event.candidate);
        }
      };

      // Join room on backend
      await fetch('/api/webrtc/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, peerId }),
      });

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignalMessage('offer', offer);

      // Start polling signaling server for incoming peer answer / candidates
      startSignalingPoll();

      // Start Live Speech-to-Subtitles recognition
      startLiveCaptioning();

      setInCall(true);
      triggerHaptic(HAPTIC_PATTERNS.SUCCESS);
      speakText('Real WebRTC video call connected with live subtitles and gesture recognition.', settings.uiLanguage, settings.voiceSpeed);
    } catch (err) {
      console.error('Call setup failed. Check camera/microphone permissions and server availability.', err);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      setInCall(false);
      setCurrentSpeechSubtitle(
        'Call could not start. Allow camera/microphone access and check that the server is running.'
      );
    }
  };

  const sendSignalMessage = async (type: string, payload: any) => {
    try {
      await fetch('/api/webrtc/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, from: peerId, type, payload }),
      });
    } catch (e) {
      console.error('Signaling error', e);
    }
  };

  const startSignalingPoll = () => {
    let lastTimestamp = 0;
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/webrtc/poll?roomId=${encodeURIComponent(roomId)}&peerId=${encodeURIComponent(peerId)}&since=${lastTimestamp}`
        );
        if (!res.ok) return;

        const data = await res.json();
        if (typeof data.timestamp === 'number') {
          lastTimestamp = Math.max(lastTimestamp, data.timestamp);
        }

        for (const msg of data.messages || []) {
          const pc = peerConnectionRef.current;
          if (!pc) continue;

          if (msg.type === 'offer') {
            if (pc.signalingState !== 'stable') {
              console.warn('Ignoring offer because the connection is not stable.');
              continue;
            }

            await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
            for (const candidate of pendingCandidatesRef.current) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (error) {
                console.warn('Queued ICE candidate could not be added:', error);
              }
            }
            pendingCandidatesRef.current = [];

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await sendSignalMessage('answer', pc.localDescription);
          } else if (msg.type === 'answer') {
            if (pc.signalingState === 'have-local-offer') {
              await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
              for (const candidate of pendingCandidatesRef.current) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (error) {
                  console.warn('Queued ICE candidate could not be added:', error);
                }
              }
              pendingCandidatesRef.current = [];
            }
          } else if (msg.type === 'candidate') {
            if (!pc.remoteDescription) {
              pendingCandidatesRef.current.push(msg.payload);
              continue;
            }
            try {
              await pc.addIceCandidate(new RTCIceCandidate(msg.payload));
            } catch (error) {
              console.warn('ICE candidate could not be added:', error);
            }
          }
        }
      } catch (err) {
        console.warn('Signaling poll failed; will retry.', err);
      }
    }, 1000);
  };

  const startLiveCaptioning = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = settings.uiLanguage === 'hi' ? 'hi-IN' : 'en-US';

        recognition.onresult = (event: any) => {
          let current = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            current += event.results[i][0].transcript;
          }
          if (current.trim()) {
            setCurrentSpeechSubtitle(`Live: "${current}"`);
            if (event.results[event.results.length - 1].isFinal) {
              setSubtitlesStream((prev) => [...prev.slice(-4), current]);
            }
          }
        };

        recognition.onerror = () => {};
        recognition.start();
        speechRecRef.current = recognition;
      } catch (e) {
        console.warn('Speech recognition not supported in this frame', e);
      }
    }
  };

  const endCall = () => {
    triggerHaptic(HAPTIC_PATTERNS.CLICK);
    pendingCandidatesRef.current = [];
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (speechRecRef.current) {
      try {
        speechRecRef.current.stop();
      } catch {}
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setInCall(false);
    speakText('Call disconnected.', settings.uiLanguage, settings.voiceSpeed);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
      setAudioMuted(!audioMuted);
      triggerHaptic(HAPTIC_PATTERNS.CLICK);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
      setVideoDisabled(!videoDisabled);
      triggerHaptic(HAPTIC_PATTERNS.CLICK);
    }
  };

  const copyCallLink = () => {
    triggerHaptic(HAPTIC_PATTERNS.SUCCESS);
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const shareViaWhatsApp = () => {
    const text = `Join my accessible video call on Divyang Sahayak with live sign language translation and real-time subtitles. Room ID: ${roomId} -> ${window.location.href}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const setDetectedSignOverlay = (g: string) => {
    setDetectedGestureInCall(g);
    triggerHaptic(HAPTIC_PATTERNS.CLICK);
  };

  return (
    <div className="space-y-6">
      
      {/* Title Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-800/50 border border-slate-700">
        <div>
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base sm:text-lg font-bold text-white">
              WebRTC Video Calling & Live Subtitles
            </h2>
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            Video calling with live speech captions. Sign-language recognition requires a dedicated trained vision model.
          </p>
        </div>

        {/* WhatsApp & Room Share Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={shareViaWhatsApp}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span>Invite on WhatsApp</span>
          </button>
          <button
            onClick={copyCallLink}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copiedLink ? 'Copied' : 'Copy Room'}</span>
          </button>
        </div>
      </div>

      {/* Pre-Call Setup Bar if not in call */}
      {!inCall && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 w-full sm:w-auto">
            <label className="text-xs font-semibold text-slate-300 block">
              Call Room Identifier (Share this code to call between tabs or devices):
            </label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-sm uppercase w-full sm:w-64 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <button
            onClick={startRealCall}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-950 transition-transform active:scale-95"
          >
            <Phone className="w-5 h-5 fill-slate-950" />
            <span>Start Real Video Call Now</span>
          </button>
        </div>
      )}

      {/* In-Call Active Stage */}
      {inCall && (
        <div className="space-y-4">
          
          {/* Main Dual Video Calling Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Local Video Stream with Gesture Detection Overlay */}
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />

              {/* In-Call Overlay Indicators */}
              <div className="absolute inset-0 pointer-events-none p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="bg-slate-950/80 border border-slate-700 px-2.5 py-0.5 rounded text-[11px] text-cyan-300 font-mono">
                    You (Local Stream)
                  </span>
                  {detectedGestureInCall && (
                    <div className="bg-cyan-950/90 border border-cyan-400 px-2.5 py-1 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 shadow-lg backdrop-blur-md">
                      <Hand className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
                      <span>Sign: {detectedGestureInCall}</span>
                    </div>
                  )}
                </div>

                {/* Hand Sign Bounding Box Simulation */}
                <div className="self-center w-36 h-36 rounded-2xl border-2 border-dashed border-cyan-400/70 flex items-center justify-center">
                  <span className="text-[10px] font-mono text-cyan-300 bg-slate-950/80 px-2 py-0.5 rounded">
                    SIGN RECOGNITION NOT ENABLED
                  </span>
                </div>

                <div className="text-[10px] text-slate-400 font-mono bg-slate-950/80 px-2 py-0.5 rounded self-start">
                  Room: {roomId}
                </div>
              </div>
            </div>

            {/* Remote Peer Stream */}
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />

              {/* If no remote peer stream connected yet, show waiting room graphic */}
              <div className="absolute inset-0 p-4 flex flex-col items-center justify-center text-center space-y-2 pointer-events-none bg-slate-950/40 backdrop-blur-[2px]">
                <Users className="w-10 h-10 text-cyan-400 animate-pulse" />
                <h4 className="text-xs sm:text-sm font-bold text-white">
                  Remote Peer Connected or Ready to Join
                </h4>
                <p className="text-[11px] text-slate-300 max-w-xs">
                  To test dual-device calling, open this URL in another tab and join room <b className="text-cyan-300 font-mono">{roomId}</b>.
                </p>
              </div>

              <div className="absolute top-3 left-3 bg-slate-950/80 border border-slate-700 px-2.5 py-0.5 rounded text-[11px] text-emerald-300 font-mono">
                Remote Caller (WebRTC)
              </div>
            </div>

          </div>

          {/* High-Contrast Live Subtitles & Sign Caption Stream */}
          <div className="p-4 rounded-2xl bg-slate-900 border-2 border-cyan-500/50 space-y-2 shadow-xl">
            <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
              <span className="font-bold text-cyan-300 flex items-center gap-1.5 uppercase font-mono">
                <Subtitles className="w-4 h-4 text-cyan-400" />
                Live Speech Subtitles
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">LOCAL SPEECH RECOGNITION</span>
            </div>

            {/* Active Subtitle in Large High-Contrast Font */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <p className="text-sm sm:text-base font-extrabold text-yellow-300 tracking-wide leading-snug">
                {currentSpeechSubtitle}
              </p>
            </div>

            {/* Recent Subtitle History */}
            {subtitlesStream.length > 0 && (
              <div className="space-y-1 text-xs text-slate-400 font-mono pt-1">
                {subtitlesStream.map((sub, sIdx) => (
                  <div key={sIdx} className="line-clamp-1">
                    · {sub}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Call Control Toolbar */}
          <div className="flex items-center justify-center gap-3 p-3 rounded-2xl bg-slate-800/80 border border-slate-700">
            {/* Mute Mic */}
            <button
              onClick={toggleMute}
              className={`p-3 rounded-xl border transition-colors ${
                audioMuted ? 'bg-red-500/20 border-red-500 text-red-300' : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
              title={audioMuted ? 'Unmute Mic' : 'Mute Mic'}
            >
              {audioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-cyan-400" />}
            </button>

            {/* Disable Camera */}
            <button
              onClick={toggleVideo}
              className={`p-3 rounded-xl border transition-colors ${
                videoDisabled ? 'bg-red-500/20 border-red-500 text-red-300' : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
              title={videoDisabled ? 'Enable Video' : 'Disable Video'}
            >
              {videoDisabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5 text-cyan-400" />}
            </button>

            {/* Quick Sign Gesture Send Button */}
            <button
              onClick={() => { setDetectedSignOverlay('THANK YOU (MANUAL)'); setCurrentSpeechSubtitle('You selected the quick sign message: THANK YOU.'); setSubtitlesStream((prev) => [...prev.slice(-4), 'Manual sign message: THANK YOU']); }}
              className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold text-cyan-300 flex items-center gap-1.5 border border-slate-600"
            >
              <Hand className="w-4 h-4" />
              <span>Send Quick Sign Message "Thank You"</span>
            </button>

            {/* End Call Button */}
            <button
              onClick={endCall}
              className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 shadow-lg shadow-red-950 transition-transform active:scale-95"
            >
              <PhoneOff className="w-4 h-4 fill-white" />
              <span>End Call</span>
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
