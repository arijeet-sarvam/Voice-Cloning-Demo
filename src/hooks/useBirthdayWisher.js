import { useState, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import TTSCloningAPI from '../services/TTSCloningAPI';

// Custom hook for Birthday Wisher logic
export const useBirthdayWisher = (apiKey) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [referenceAudio, setReferenceAudio] = useState(null);
  const [friendName, setFriendName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [generatedAudio, setGeneratedAudio] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const ttsApiRef = useRef(new TTSCloningAPI());

  // Trigger confetti animation
  const triggerConfetti = useCallback(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#ff69b4', '#ffd700', '#87ceeb', '#98fb98', '#dda0dd']
    });
  }, []);

  // Start recording reference voice
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setReferenceAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      setError('Could not access microphone. Please check permissions.');
    }
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  // STT API call
  const transcribeAudio = useCallback(async (audioFile) => {
    const mimeType = audioFile.type.includes('webm') && audioFile.type.includes('codecs=') 
      ? 'audio/webm' 
      : audioFile.type;
    
    const formattedAudioFile = new File([audioFile], 'recording.webm', { type: mimeType });
    
    const formData = new FormData();
    formData.append('file', formattedAudioFile);
    formData.append('model', 'saarika:v2');
    
    const sttResponse = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'API-Subscription-Key': apiKey
      },
      body: formData
    });
    
    if (!sttResponse.ok) {
      const errorData = await sttResponse.json();
      console.error('❌ STT API Error:', errorData);
      throw new Error(`STT API Error: ${JSON.stringify(errorData)}`);
    }
    
    const transcriptionResponse = await sttResponse.json();
    return transcriptionResponse.transcript;
  }, [apiKey]);

  // Generate birthday wish audio
  const generateBirthdayWish = useCallback(async (template, friendName, referenceAudio, referenceScript) => {
    if (!referenceAudio || !friendName.trim()) {
      setError('Please complete all steps first.');
      return;
    }

    setIsProcessing(true);
    setProcessingStep('Transcribing your voice...');
    setError(null);

    try {
      // Replace {friendName} in template
      const personalizedMessage = template.template.replace('{friendName}', friendName);
      console.log('📝 Personalized message:', personalizedMessage);
      
      // Step 1: Transcribe user's actual audio
      console.log('🎤 Transcribing user recorded audio...');
      const actualRefText = await transcribeAudio(referenceAudio);
      console.log('🎯 Actual reference text from user:', actualRefText);
      
      // Step 2: Generate audio using actual transcribed text as ref_text
      setProcessingStep('Generating your personalized birthday wish...');
      
      const audioResult = await ttsApiRef.current.generateAudio(
        personalizedMessage,    // genText (what to generate)
        actualRefText,          // refText (what the user actually said)  
        referenceAudio,         // audioFile (user's recorded audio)
        'en-IN',               // targetLanguage (not used for voice cloning)
        apiKey,                // apiKey
        'cloning'              // voiceMode (force voice cloning)
      );
      
      if (audioResult.success) {
        // Convert base64 to blob for playback
        const byteCharacters = atob(audioResult.audio_base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const audioBlob = new Blob([byteArray], { type: 'audio/wav' });
        
        setGeneratedAudio(audioBlob);
        setCurrentStep(4);
        triggerConfetti();
        setProcessingStep('');
      } else {
        throw new Error('Audio generation failed');
      }
    } catch (error) {
      console.error('Failed to generate birthday wish:', error);
      setError(`Failed to generate birthday wish: ${error.message}`);
      setProcessingStep('');
    } finally {
      setIsProcessing(false);
    }
  }, [apiKey, transcribeAudio, triggerConfetti]);

  // Play generated audio
  const playGeneratedAudio = useCallback(() => {
    if (generatedAudio) {
      const audio = new Audio(URL.createObjectURL(generatedAudio));
      setIsPlayingAudio(true);
      audio.play();
      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => {
        setIsPlayingAudio(false);
        setError('Error playing audio');
      };
    }
  }, [generatedAudio]);

  // Download generated audio
  const downloadAudio = useCallback(() => {
    if (generatedAudio) {
      const url = URL.createObjectURL(generatedAudio);
      const a = document.createElement('a');
      a.href = url;
      a.download = `birthday-wish-${friendName || 'friend'}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [generatedAudio, friendName]);

  // Reset to start over
  const resetApp = useCallback(() => {
    setCurrentStep(1);
    setReferenceAudio(null);
    setFriendName('');
    setSelectedTemplate(null);
    setGeneratedAudio(null);
    setIsProcessing(false);
    setIsPlayingAudio(false);
    setProcessingStep('');
    setError(null);
  }, []);

  return {
    // State
    currentStep,
    isRecording,
    referenceAudio,
    friendName,
    selectedTemplate,
    generatedAudio,
    isProcessing,
    isPlayingAudio,
    processingStep,
    error,
    
    // Actions
    setCurrentStep,
    setFriendName,
    setSelectedTemplate,
    startRecording,
    stopRecording,
    generateBirthdayWish,
    playGeneratedAudio,
    downloadAudio,
    resetApp
  };
};
