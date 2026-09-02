import { useEffect, useState } from "react";
import Lottie from "lottie-react";
import type { RecordingState } from "../../../hooks/use-voice-recording";

interface AnimatedVoiceProps {
  recordingState?: RecordingState;
  isListening?: boolean;
}

const AnimatedVoice = ({ recordingState = 'idle', isListening = false }: AnimatedVoiceProps) => {
  const [wave, setWave] = useState<unknown>();
  
  useEffect(() => {
    import("../../../assets/wave.json").then((mod) => {
      setWave(mod.default || mod);
    });
  }, []);

  const getAnimationStyle = () => {
    switch (recordingState) {
      case 'recording':
        return {
          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
          animation: 'pulse 1.5s ease-in-out infinite',
          transform: isListening ? 'scale(1.1)' : 'scale(1)',
          transition: 'all 0.3s ease-in-out',
        };
      case 'paused':
        return {
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          animation: 'none',
          transform: 'scale(0.95)',
          transition: 'all 0.3s ease-in-out',
        };
      case 'stopped':
        return {
          background: 'linear-gradient(135deg, #6b7280, #4b5563)',
          animation: 'none',
          transform: 'scale(1)',
          transition: 'all 0.3s ease-in-out',
        };
      default:
        return {
          background: 'linear-gradient(135deg, #e5e7eb, #d1d5db)',
          animation: 'none',
          transform: 'scale(1)',
          transition: 'all 0.3s ease-in-out',
        };
    }
  };

  const shouldAnimate = recordingState === 'recording' && isListening;

  return (
    <div 
      className="w-36 h-36 flex items-center justify-center rounded-full overflow-hidden shadow-lg relative"
      style={getAnimationStyle()}
    >
      <Lottie
        animationData={wave}
        loop={shouldAnimate}
        autoplay={shouldAnimate}
        style={{ 
          width: "80%", 
          height: "80%",
          filter: recordingState === 'recording' ? 'brightness(1.2)' : 'none'
        }}
        rendererSettings={{
          preserveAspectRatio: "xMidYMid slice",
        }}
      />
      
      {/* Recording indicator */}
      {recordingState === 'recording' && (
        <div className="absolute inset-0 rounded-full border-4 border-white/30 animate-ping"></div>
      )}
      
      {/* Listening pulse */}
      {isListening && recordingState === 'recording' && (
        <div className="absolute inset-0 rounded-full bg-white/10 animate-pulse"></div>
      )}
    </div>
  );
};

export default AnimatedVoice;
