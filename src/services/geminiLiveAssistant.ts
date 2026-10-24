
export type AssistantLanguage =
  | "en"
  | "hi"
  | "mr"
  | "bn"
  | "ta"
  | "te"
  | "gu"
  | "kn"
  | "ml"
  | "pa"
  | "ur"
  | "or";

export const ASSISTANT_LANGUAGES: Record<AssistantLanguage, string> = {
  en: "English",
  hi: "Hindi",
  mr: "Marathi",
  bn: "Bengali",
  ta: "Tamil",
  te: "Telugu",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi",
  ur: "Urdu",
  or: "Odia",
};

export interface GeminiLiveCallbacks {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onTranscript?: (text: string, speaker: "user" | "assistant") => void;
  onAudio?: (audio: ArrayBuffer) => void;
  onError?: (error: Error) => void;
}

export class GeminiLiveAssistant {
  private socket: WebSocket | null = null;
  private microphoneStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private active = false;
  private callbacks: GeminiLiveCallbacks;
  private language: AssistantLanguage;

  constructor(
    language: AssistantLanguage = "en",
    callbacks: GeminiLiveCallbacks = {},
  ) {
    this.language = language;
    this.callbacks = callbacks;
  }

  get isActive(): boolean {
    return this.active;
  }

  async start(): Promise<void> {
    if (this.active) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone access is not supported by this browser.");
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socketUrl = `${protocol}//${window.location.host}/api/gemini/live`;

    const socket = new WebSocket(socketUrl);
    socket.binaryType = "arraybuffer";
    this.socket = socket;

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        socket.close();
        reject(new Error("Timed out connecting to the voice assistant."));
      }, 10000);

      socket.onopen = () => {
        window.clearTimeout(timeout);
        this.active = true;

        socket.send(
          JSON.stringify({
            type: "start",
            language: ASSISTANT_LANGUAGES[this.language],
          }),
        );

        this.callbacks.onConnected?.();
        resolve();
      };

      socket.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("Could not connect to the Gemini Live server."));
      };

      socket.onclose = () => {
        window.clearTimeout(timeout);
        this.active = false;
        this.stopMicrophone();
        this.callbacks.onDisconnected?.();
      };

      socket.onmessage = (event: MessageEvent) => {
        this.handleServerMessage(event.data);
      };
    });

    try {
      this.microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      await this.startMicrophone();
    } catch (error) {
      this.stop();
      throw new Error(
        error instanceof Error
          ? `Microphone unavailable: ${error.message}`
          : "Microphone permission was denied.",
      );
    }
  }

  setLanguage(language: AssistantLanguage): void {
    this.language = language;

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: "language",
          language: ASSISTANT_LANGUAGES[language],
        }),
      );
    }
  }

  sendText(text: string): void {
    const trimmed = text.trim();

    if (!trimmed || this.socket?.readyState !== WebSocket.OPEN) return;

    this.socket.send(
      JSON.stringify({
        type: "text",
        text: trimmed,
        language: ASSISTANT_LANGUAGES[this.language],
      }),
    );
  }

  async sendCameraFrame(frame: Blob): Promise<void> {
    if (this.socket?.readyState !== WebSocket.OPEN) return;

    try {
      const base64 = await this.blobToBase64(frame);

      this.socket.send(
        JSON.stringify({
          type: "video",
          data: base64,
          mimeType: frame.type || "image/jpeg",
        }),
      );
    } catch (error) {
      this.callbacks.onError?.(
        error instanceof Error
          ? error
          : new Error("Unable to send camera frame."),
      );
    }
  }

  stop(): void {
    this.active = false;
    this.stopMicrophone();

    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: "stop" }));
      }

      this.socket.close();
      this.socket = null;
    }

    this.callbacks.onDisconnected?.();
  }

  private async startMicrophone(): Promise<void> {
    if (!this.microphoneStream) return;

    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error("Web Audio is not supported by this browser.");
    }

    this.audioContext = new AudioContextClass({ sampleRate: 16000 });

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    this.source = this.audioContext.createMediaStreamSource(
      this.microphoneStream,
    );

    // ScriptProcessorNode is used for compatibility with this simple
    // implementation. AudioWorklet is preferable for a production app.
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (event: AudioProcessingEvent) => {
      if (
        !this.active ||
        this.socket?.readyState !== WebSocket.OPEN
      ) {
        return;
      }

      const input = event.inputBuffer.getChannelData(0);
      const pcm16 = this.floatTo16BitPCM(input);
      const bytes = new Uint8Array(pcm16.buffer);

      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }

      this.socket.send(
        JSON.stringify({
          type: "audio",
          data: btoa(binary),
          mimeType: "audio/pcm;rate=16000",
        }),
      );
    };

    this.source.connect(this.processor);

    // Keep the processing graph active without playing microphone audio
    // through the speakers, which could cause feedback.
    const silentGain = this.audioContext.createGain();
    silentGain.gain.value = 0;

    this.processor.connect(silentGain);
    silentGain.connect(this.audioContext.destination);
  }

  private handleServerMessage(data: unknown): void {
    if (typeof data !== "string") {
      if (data instanceof ArrayBuffer) {
        this.callbacks.onAudio?.(data);
      }
      return;
    }

    try {
      const message = JSON.parse(data) as {
        type?: string;
        text?: string;
        speaker?: "user" | "assistant";
        data?: string;
        error?: string;
      };

      if (message.type === "transcript" && message.text) {
        this.callbacks.onTranscript?.(
          message.text,
          message.speaker ?? "assistant",
        );
      } else if (message.type === "audio" && message.data) {
        const binary = atob(message.data);
        const bytes = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        this.callbacks.onAudio?.(bytes.buffer);
      } else if (message.type === "error") {
        this.callbacks.onError?.(
          new Error(message.error || "Gemini Live returned an error."),
        );
      }
    } catch {
      this.callbacks.onError?.(
        new Error("Received an invalid response from the voice server."),
      );
    }
  }

  private stopMicrophone(): void {
    if (this.processor) {
      this.processor.onaudioprocess = null;
      this.processor.disconnect();
      this.processor = null;
    }

    this.source?.disconnect();
    this.source = null;

    this.microphoneStream?.getTracks().forEach((track) => track.stop());
    this.microphoneStream = null;

    if (this.audioContext) {
      void this.audioContext.close().catch(() => undefined);
      this.audioContext = null;
    }
  }

  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);

    for (let i = 0; i < input.length; i++) {
      const sample = Math.max(-1, Math.min(1, input[i]));
      output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    return output;
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result;

        if (typeof result !== "string") {
          reject(new Error("Unable to read camera frame."));
          return;
        }

        resolve(result.split(",")[1] ?? "");
      };

      reader.onerror = () => reject(new Error("Unable to read camera frame."));
      reader.readAsDataURL(blob);
    });
  }
}
