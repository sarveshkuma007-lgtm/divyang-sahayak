// src/components/AccessibilitySettings.tsx

import { useEffect, useState } from "react";
import {
  Sun,
  Moon,
  BookOpen,
  Eye,
  Mic,
  Volume2,
  Type,
  Contrast,
} from "lucide-react";

type ThemeMode = "light" | "dark" | "reading";

export default function AccessibilitySettings() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("divyang-theme");
    return saved === "dark" || saved === "reading" ? saved : "light";
  });

  const [largeText, setLargeText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("divyang-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle("large-text", largeText);
  }, [largeText]);

  useEffect(() => {
    document.documentElement.classList.toggle("high-contrast", highContrast);
  }, [highContrast]);

  function speak(message: string) {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(message));
    }
  }

  function applyVoiceCommand(command: string) {
    const text = command.toLowerCase();

    if (text.includes("dark mode")) {
      setTheme("dark");
      speak("Dark mode enabled");
    } else if (
      text.includes("light mode") ||
      text.includes("day mode")
    ) {
      setTheme("light");
      speak("Light mode enabled");
    } else if (
      text.includes("reading mode") ||
      text.includes("eye protection") ||
      text.includes("yellow screen")
    ) {
      setTheme("reading");
      speak("Reading mode enabled");
    } else if (
      text.includes("normal mode") ||
      text.includes("reset screen")
    ) {
      setTheme("light");
      setLargeText(false);
      setHighContrast(false);
      speak("Normal display restored");
    } else if (
      text.includes("large text") ||
      text.includes("bigger text")
    ) {
      setLargeText(true);
      speak("Large text enabled");
    } else if (text.includes("high contrast")) {
      setHighContrast(true);
      speak("High contrast enabled");
    } else if (text.includes("stop listening")) {
      setListening(false);
      speak("Voice commands stopped");
    } else {
      speak("Command not recognized. Please try again.");
    }
  }

  function startVoiceControl() {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setVoiceStatus(
        "Voice recognition is not supported in this browser."
      );
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setListening(true);
      setVoiceStatus("Listening for your command…");
    };

    recognition.onresult = (event: any) => {
      const command = event.results[0][0].transcript;
      setVoiceStatus(`Command: ${command}`);
      applyVoiceCommand(command);
    };

    recognition.onerror = () => {
      setVoiceStatus("Voice recognition failed. Try again.");
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
  }

  const modes = [
    {
      id: "light" as const,
      label: "Light mode",
      description: "Bright, clean display",
      icon: Sun,
    },
    {
      id: "dark" as const,
      label: "Dark mode",
      description: "Reduced screen brightness",
      icon: Moon,
    },
    {
      id: "reading" as const,
      label: "Reading mode",
      description: "Warm yellowish background",
      icon: BookOpen,
    },
  ];

  return (
    <section className="accessibility-panel" aria-labelledby="access-title">
      <header className="accessibility-heading">
        <div className="accessibility-heading-icon">
          <Eye size={25} aria-hidden="true" />
        </div>

        <div>
          <h2 id="access-title">Accessibility & Display</h2>
          <p>Customize your screen for comfortable use.</p>
        </div>
      </header>

      <div className="display-mode-grid" role="group" aria-label="Display mode">
        {modes.map(({ id, label, description, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`display-mode-card ${
              theme === id ? "selected" : ""
            }`}
            aria-pressed={theme === id}
            onClick={() => {
              setTheme(id);
              speak(`${label} enabled`);
            }}
          >
            <Icon size={25} aria-hidden="true" />
            <span className="mode-label">{label}</span>
            <span className="mode-description">{description}</span>
            {theme === id && (
              <span className="mode-selected">Active</span>
            )}
          </button>
        ))}
      </div>

      <div className="accessibility-option">
        <div className="option-icon">
          <Type size={21} aria-hidden="true" />
        </div>
        <div className="option-copy">
          <strong>Large text</strong>
          <p>Make text easier to read across the site.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={largeText}
          aria-label="Large text"
          className={`accessible-switch ${largeText ? "on" : ""}`}
          onClick={() => setLargeText((value) => !value)}
        >
          <span />
        </button>
      </div>

      <div className="accessibility-option">
        <div className="option-icon">
          <Contrast size={21} aria-hidden="true" />
        </div>
        <div className="option-copy">
          <strong>High contrast</strong>
          <p>Strengthen text and control visibility.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={highContrast}
          aria-label="High contrast"
          className={`accessible-switch ${highContrast ? "on" : ""}`}
          onClick={() => setHighContrast((value) => !value)}
        >
          <span />
        </button>
      </div>

      <div className="voice-control-box">
        <div className="voice-control-copy">
          <Mic size={23} aria-hidden="true" />
          <div>
            <strong>Voice display control</strong>
            <p>Change display modes without touching the screen.</p>
          </div>
        </div>

        <button
          type="button"
          className="voice-control-button"
          onClick={startVoiceControl}
          disabled={listening}
        >
          <Mic size={19} aria-hidden="true" />
          {listening ? "Listening…" : "Use voice command"}
        </button>

        <div className="voice-command-examples">
          <span>Try saying:</span>
          <button onClick={() => applyVoiceCommand("dark mode")}>
            “Dark mode”
          </button>
          <button onClick={() => applyVoiceCommand("light mode")}>
            “Light mode”
          </button>
          <button onClick={() => applyVoiceCommand("reading mode")}>
            “Reading mode”
          </button>
        </div>

        {voiceStatus && (
          <p className="voice-status" role="status" aria-live="polite">
            <Volume2 size={16} aria-hidden="true" />
            {voiceStatus}
          </p>
        )}
      </div>
    </section>
  );
}