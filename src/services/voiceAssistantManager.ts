// src/services/voiceAssistantManager.ts

export class VoiceAssistantManager {
  private recognition: any = null;
  private listener: (command: string) => void;
  private isRunning: boolean = false;

  constructor(onCommand: (command: string) => void) {
    this.listener = onCommand;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-IN'; // Default to Indian English (changeable to 'hi-IN' for Hindi)

      this.recognition.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
        console.log("Voice Command Recognized: ", transcript);
        this.handleGlobalCommands(transcript);
        this.listener(transcript);
      };

      this.recognition.onerror = (event: any) => {
        console.warn("Speech recognition warning/error:", event.error);
      };

      // Auto-restart if it cuts out unexpectedly
      this.recognition.onend = () => {
        if (this.isRunning) {
          try {
            this.recognition.start();
          } catch (e) {
            console.log("Recognition restart skipped");
          }
        }
      };
    } else {
      console.error("Speech Recognition is not supported in this browser. Please use Google Chrome or Edge.");
    }
  }

  // Native Text-to-Speech handler built right in (No external imports needed)
  public speak(text: string) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-IN';
      window.speechSynthesis.speak(utterance);
    }
  }

  public startListening() {
    if (this.recognition && !this.isRunning) {
      try {
        this.isRunning = true;
        this.recognition.start();
        this.speak("Voice assistant activated.");
      } catch (e) {
        console.error("Could not start recognition:", e);
      }
    }
  }

  public stopListening() {
    if (this.recognition && this.isRunning) {
      this.isRunning = false;
      this.recognition.stop();
      this.speak("Voice assistant paused.");
    }
  }

  private handleGlobalCommands(command: string) {
    if (command.includes('open scanner') || command.includes('document scanner')) {
      this.speak("Opening Document Scanner");
      window.location.hash = '#scanner';
    } else if (command.includes('emergency') || command.includes('sos')) {
      this.speak("Triggering Emergency SOS immediately!");
    } else if (command.includes('currency') || command.includes('detect money')) {
      this.speak("Opening Currency Detector");
      window.location.hash = '#currency';
    } else if (command.includes('read screen') || command.includes('read page')) {
      this.speak(document.body.innerText.slice(0, 400));
    }
  }
}