'use client';

// A simple function to play a sound using the Web Audio API
// This avoids needing to host audio files.
export const playSound = (type: 'notification' | 'message') => {
  // Use a lazy-loaded audio context to ensure it's created only after a user interaction
  // and to prevent it from attempting to run on the server.
  let audioContext: AudioContext;

  try {
    // Re-use existing context if available
    audioContext = window.audioContext || new (window.AudioContext || (window as any).webkitAudioContext)();
    window.audioContext = audioContext;
  } catch (e) {
    console.warn("Web Audio API is not supported in this browser.", e);
    return;
  }
  
  // Create an oscillator (for generating the sound wave)
  const oscillator = audioContext.createOscillator();
  // Create a gain node (for controlling the volume)
  const gainNode = audioContext.createGain();

  // Connect the oscillator to the gain node, and the gain node to the device's speakers
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Set sound properties based on the notification type
  if (type === 'notification') {
    // A short, clear "ping" for general notifications
    oscillator.type = 'triangle'; 
    oscillator.frequency.setValueAtTime(900, audioContext.currentTime); // High pitch
    gainNode.gain.setValueAtTime(0.4, audioContext.currentTime); // Start at reasonable volume
    // Fade out quickly
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.5);
  } else { // 'message'
    // A slightly softer, two-tone sound for messages
    oscillator.type = 'sine'; 
    oscillator.frequency.setValueAtTime(650, audioContext.currentTime); // Lower pitch start
    oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.1); // Rise pitch quickly
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime); // Start softer
    // Fade out
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.4);
  }

  // Start the sound now
  oscillator.start(audioContext.currentTime);
  // Stop the sound after 0.5 seconds
  oscillator.stop(audioContext.currentTime + 0.5);
};

// Add a global audioContext to the window interface to avoid TypeScript errors
// This tells TypeScript that we're adding a property to the global window object.
declare global {
  interface Window {
    audioContext: AudioContext;
  }
}
