import React, { useState, useRef } from 'react';
import { SarvamAIClient } from 'sarvamai';
import BirthdayWisher from './BirthdayWisher';
import VideoTranslator from './VideoTranslator';

const API_KEY = '954b2595-6a49-49ec-8974-268a7cec4b69';

// Language options with their codes
const LANGUAGES = [
  { code: 'bn-IN', name: 'Bengali' },
  { code: 'gu-IN', name: 'Gujarati' },
  { code: 'hi-IN', name: 'Hindi' },
  { code: 'kn-IN', name: 'Kannada' },
  { code: 'ml-IN', name: 'Malayalam' },
  { code: 'mr-IN', name: 'Marathi' },
  { code: 'od-IN', name: 'Odia' },
  { code: 'pa-IN', name: 'Punjabi' },
  { code: 'ta-IN', name: 'Tamil' },
  { code: 'te-IN', name: 'Telugu' }
];

// TTS Cloning API Class (voice cloning service)
class TTSCloningAPI {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl; // Empty string uses proxy
    this.cloningUrl = 'http://localhost:3001/voice-cloning'; // Use CORS proxy
  }

  // Convert audio blob to WAV format
  async convertToWav(audioBlob) {
    try {
      console.log('🔄 Converting audio to WAV format...');
      
      // Create audio context
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Convert to WAV
      const wavBlob = this.audioBufferToWav(audioBuffer);
      
      console.log('✅ Audio converted to WAV:', {
        originalSize: audioBlob.size,
        originalType: audioBlob.type,
        wavSize: wavBlob.size,
        wavType: wavBlob.type,
        channels: audioBuffer.numberOfChannels,
        sampleRate: audioBuffer.sampleRate,
        duration: audioBuffer.duration
      });
      
      return wavBlob;
    } catch (error) {
      console.error('❌ Audio conversion failed:', error);
      throw new Error(`Audio conversion failed: ${error.message}`);
    }
  }

  // Convert AudioBuffer to WAV blob
  audioBufferToWav(audioBuffer) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length * numberOfChannels * 2; // 16-bit samples
    
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF'); // ChunkID
    view.setUint32(4, 36 + length, true); // ChunkSize
    writeString(8, 'WAVE'); // Format
    writeString(12, 'fmt '); // Subchunk1ID
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true); // AudioFormat (PCM)
    view.setUint16(22, numberOfChannels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * numberOfChannels * 2, true); // ByteRate
    view.setUint16(32, numberOfChannels * 2, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample
    writeString(36, 'data'); // Subchunk2ID
    view.setUint32(40, length, true); // Subchunk2Size
    
    // Convert audio data to 16-bit PCM (interleaved for multiple channels)
    let offset = 44;
    const channelData = [];
    for (let channel = 0; channel < numberOfChannels; channel++) {
      channelData.push(audioBuffer.getChannelData(channel));
    }
    
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }
  
  // Sarvam AI Text-to-Speech using Bulbul model
  async generateAudioWithSarvam(text, targetLanguage, apiKey) {
    try {
      console.log('🔄 Using Sarvam TTS Bulbul model...');
      
      const payload = {
        text: text,
        target_language_code: targetLanguage,
        speaker: "anushka",
        model: "bulbul:v2",
        enable_preprocessing: true,
        sample_rate: 22050
      };
      
      console.log('🎯 Sarvam TTS Bulbul Payload:', payload);
      
      const response = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: {
          'api-subscription-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      console.log('🔍 Sarvam TTS Response Status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Sarvam TTS HTTP Error:', errorText);
        console.log('❌ Response Status:', response.status);
        console.log('❌ Response Headers:', Object.fromEntries(response.headers.entries()));
        
        // Try to parse error as JSON for better debugging
        try {
          const errorData = JSON.parse(errorText);
          console.log('❌ Parsed Error Data:', errorData);
        } catch (parseError) {
          console.log('❌ Error text (not JSON):', errorText);
        }
        
        throw new Error(`Sarvam TTS failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Sarvam TTS Bulbul Success Response:', data);
      console.log('🔍 Response keys:', Object.keys(data));
      
      // Check for different possible field names
      let audioData = null;
      if (data.audios && Array.isArray(data.audios) && data.audios.length > 0) {
        audioData = data.audios[0];
        console.log('📦 Found audio data in "audios" array (Sarvam TTS format)');
      } else if (data.audio) {
        audioData = data.audio;
        console.log('📦 Found audio data in "audio" field');
      } else if (data.audio_base64) {
        audioData = data.audio_base64;
        console.log('📦 Found audio data in "audio_base64" field');
      } else if (data.data) {
        audioData = data.data;
        console.log('📦 Found audio data in "data" field');
      } else if (data.audio_url) {
        console.log('📦 Found audio URL:', data.audio_url);
        // Handle URL case - download the audio
        try {
          const audioResponse = await fetch(data.audio_url);
          const audioBlob = await audioResponse.blob();
          const reader = new FileReader();
          return new Promise((resolve) => {
            reader.onload = () => {
              const base64 = reader.result.split(',')[1];
              resolve({ success: true, audio_base64: base64 });
            };
            reader.readAsDataURL(audioBlob);
          });
        } catch (urlError) {
          console.error('❌ Failed to download audio from URL:', urlError);
          throw new Error(`Failed to download audio: ${urlError.message}`);
        }
      } else {
        console.error('❌ No recognized audio field found in response');
        console.log('📋 Full response structure:', JSON.stringify(data, null, 2));
        
        // Also log each field individually for better debugging
        console.log('🔍 Detailed field analysis:');
        Object.keys(data).forEach(key => {
          const value = data[key];
          console.log(`  - "${key}": ${typeof value} (${value ? value.toString().substring(0, 50) + '...' : 'null/undefined'})`);
        });
        
        alert(`🚨 DEBUG: Sarvam TTS returned unexpected response format. Check console for details.\n\nResponse keys: ${Object.keys(data).join(', ')}`);
        throw new Error('No audio data found in Sarvam response. Response structure logged to console.');
      }
      
      if (!audioData) {
        throw new Error('Audio data is empty');
      }
      
      console.log('🎵 Audio data preview:', audioData.substring(0, 100) + '...');
      return { success: true, audio_base64: audioData };
      
    } catch (error) {
      console.warn('Sarvam TTS Error:', error);
      return { success: false, error: error.message };
    }
  }

  async generateAudio(genText, refText, audioFile, targetLanguage, apiKey, voiceMode = 'standard') {
    console.log(`🎯 Audio generation mode: ${voiceMode}`);
    
    // If standard mode is selected, go directly to Sarvam TTS
          if (voiceMode === 'standard') {
        console.log('📢 Using standard TTS mode - going directly to Sarvam TTS Bulbul');
        const result = await this.generateAudioWithSarvam(genText, targetLanguage, apiKey);
        
        if (result.success) {
          return { success: true, audio_base64: result.audio_base64, source: 'Sarvam-Bulbul' };
        } else {
          return { success: false, error: `Sarvam TTS Bulbul failed: ${result.error}` };
        }
      }
    
    // Voice cloning mode - try TTS Cloning first, then fallback to Sarvam TTS
    try {
      console.log('🎭 Using voice cloning mode - trying TTS Cloning API first');
      
      // Use the user's recorded audio as reference for voice cloning
      console.log('🎤 Using user recorded audio as reference:', {
        size: audioFile.size,
        type: audioFile.type,
        name: audioFile.name
      });
      
      // Convert user's webm audio to WAV format for TTS Cloning compatibility
      let referenceAudioBase64;
      if (audioFile.type.includes('webm')) {
        console.log('🔄 Converting webm audio to WAV for TTS Cloning...');
        const wavBlob = await this.convertToWav(audioFile);
        referenceAudioBase64 = await this.fileToBase64(wavBlob);
        console.log('✅ Converted webm to WAV for TTS Cloning');
      } else {
        referenceAudioBase64 = await this.fileToBase64(audioFile);
      }

      // Create TTS Cloning payload
      const payload = {
        inputs: [
          { 
            name: "ref_audio", 
            shape: [1], 
            datatype: "BYTES", 
            data: [referenceAudioBase64] 
          },
          { 
            name: "ref_text", 
            shape: [1], 
            datatype: "BYTES", 
            data: [refText] 
          },
          { 
            name: "gen_text", 
            shape: [1], 
            datatype: "BYTES", 
            data: [genText] 
          }
        ],
        outputs: [{ name: "gen_audio" }]
      };
      
      console.log('🎭 TTS Cloning payload ready:', JSON.stringify(payload).length, 'bytes');
      
      const response = await fetch(this.cloningUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });
      
      console.log('🔍 TTS Cloning response:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Error Response Body:', errorText);
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('✅ TTS Cloning Success Response:', { 
        model: result.model_name, 
        version: result.model_version,
        outputsLength: result.outputs?.length 
      });
      
      if (result.outputs && result.outputs[0]?.data) {
        const rawAudio = result.outputs[0].data;
        const flattenAudio = (data) => Array.isArray(data) ? data.flat(Infinity) : [data];
        const floatArray = flattenAudio(rawAudio);
        const float32Array = Float32Array.from(floatArray);
        const audio_base64 = this.float32ToWav(float32Array, 24000); // Convert to WAV
        return { success: true, audio_base64: audio_base64, source: 'TTS-Cloning-VoiceClone' };
      } else {
        throw new Error('No audio data in TTS Cloning response');
      }
      
          } catch (error) {
        console.warn('🚨 TTS Cloning API failed, trying Sarvam TTS Bulbul fallback...', error);
        // Log specific error types for debugging
        if (error.message.includes('CUDA')) {
          console.warn('🚨 CUDA memory error detected - TTS Cloning server GPU issue');
        } else if (error.message.includes('illegal memory access')) {
          console.warn('🚨 GPU memory access error - TTS Cloning server needs restart');
        }
        
        // Fallback to Sarvam TTS Bulbul API
        const fallbackResult = await this.generateAudioWithSarvam(genText, targetLanguage, apiKey);
        
        if (fallbackResult.success) {
          return { success: true, audio_base64: fallbackResult.audio_base64, source: 'Sarvam-Bulbul-Fallback' };
        }
        
        return { success: false, error: `Both TTS Cloning (${error.message}) and Sarvam TTS Bulbul (${fallbackResult.error}) failed` };
      }
  }
  
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  }

  // Convert Float32Array to WAV buffer (for TTS Cloning response processing)
  float32ToWav(float32Array, sampleRate = 24000) {
    const numChannels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    
    const arrayBuffer = new ArrayBuffer(44 + float32Array.length * 2);
    const view = new DataView(arrayBuffer);

    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    // WAV header
    writeString(0, "RIFF");
    view.setUint32(4, 36 + float32Array.length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, "data");
    view.setUint32(40, float32Array.length * 2, true);

    // Convert float32 samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < float32Array.length; i++) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
    }
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary); // Return base64 string
  }
}

function App() {
  const [activeTab, setActiveTab] = useState('translator'); // 'translator', 'birthday', or 'video'
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('hi-IN');
  const [transcribedText, setTranscribedText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [generatedAudio, setGeneratedAudio] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [voiceCloningMode, setVoiceCloningMode] = useState('standard'); // 'standard' or 'cloning'
  const [sessionHistory, setSessionHistory] = useState([]); // Store all interactions
  const [playingHistoryIndex, setPlayingHistoryIndex] = useState(null); // Track which history item is playing
  const [audioGenerationFailed, setAudioGenerationFailed] = useState(false); // Track if audio generation failed

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const sarvamClient = new SarvamAIClient({ apiSubscriptionKey: API_KEY });
  const ttsApi = new TTSCloningAPI();

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup MediaRecorder with best supported format
      const supportedTypes = ['audio/wav', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const selectedType = supportedTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';
      
      mediaRecorderRef.current = new MediaRecorder(stream, selectedType ? { mimeType: selectedType } : {});
      audioChunksRef.current = [];
      
      console.log('🎤 Recording with:', mediaRecorderRef.current.mimeType || 'default format');

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const actualMimeType = mediaRecorderRef.current.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: actualMimeType });
        
        console.log('🎵 Recording complete:', { 
          chunks: audioChunksRef.current.length, 
          size: blob.size, 
          type: blob.type 
        });
        
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
        
        // Auto-start processing after audioBlob is set
        setTimeout(() => {
          // Call processAudio with the blob directly to avoid state timing issues
          processAudioWithBlob(blob);
        }, 100);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Error accessing microphone. Please check permissions.');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Note: Removed unused audio conversion functions - using F5AudioAPI.convertToWav() instead

  // Process audio with a specific blob (for auto-processing)
  const processAudioWithBlob = async (blob) => {
    if (!blob) {
      console.error('No audio blob provided');
      return;
    }
    
    setProcessing(true);
    setCurrentStep('Transcribing audio...');
    setAudioGenerationFailed(false); // Reset audio generation state

    try {
      // Step 1: Transcribe audio
      console.log('🎤 Audio blob details:', {
        size: blob.size,
        type: blob.type,
        constructor: blob.constructor.name
      });
      
      // Convert blob to proper WAV format for Sarvam STT
      let audioFile;
      
      // Create audio file with proper MIME type for Sarvam STT
      // Strip codec specification if present (e.g., 'audio/webm;codecs=opus' → 'audio/webm')
      const mimeType = blob.type.includes('webm') && blob.type.includes('codecs=') 
        ? 'audio/webm' 
        : blob.type;
      
      audioFile = new File([blob], 'recording.webm', { type: mimeType });
      console.log('📁 Audio file ready:', { size: audioFile.size, type: audioFile.type });
      
      console.log('🎤 Sending to Sarvam STT:', { size: audioFile.size, type: audioFile.type });
      
      // Use direct fetch like the working test instead of SDK
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('model', 'saarika:v2');
      
      const sttResponse = await fetch('https://api.sarvam.ai/speech-to-text', {
        method: 'POST',
        headers: {
          'API-Subscription-Key': API_KEY
        },
        body: formData
      });
      
      if (!sttResponse.ok) {
        const errorData = await sttResponse.json();
        console.error('❌ STT API Error:', errorData);
        throw new Error(`STT API Error: ${JSON.stringify(errorData)}`);
      }
      
      const transcriptionResponse = await sttResponse.json();
      console.log('✅ STT Response received:', transcriptionResponse);

      const transcribed = transcriptionResponse.transcript;
      const detectedLanguage = transcriptionResponse.language_code;
      setTranscribedText(transcribed);
      setCurrentStep('Translating text...');

      // Step 2: Translate text
      const translationResponse = await sarvamClient.text.translate({
        input: transcribed,
        source_language_code: detectedLanguage,
        target_language_code: selectedLanguage,
        model: 'sarvam-translate:v1'
      });

      const translated = translationResponse.translated_text;
      setTranslatedText(translated);

      // Step 3: Generate audio based on selected mode
      setCurrentStep('Generating audio...');
      const audioResult = await ttsApi.generateAudio(translated, transcribed, audioFile, selectedLanguage, API_KEY, voiceCloningMode);
      
      if (audioResult.success) {
        setGeneratedAudio(audioResult.audio_base64);
        setCurrentStep(`Complete! (${audioResult.source} used)`);
        console.log(`🎵 Audio generated successfully using ${audioResult.source}`);
        
        // Add to session history
        const historyEntry = {
          id: Date.now(),
          timestamp: new Date().toLocaleTimeString(),
          transcribedText: transcribed,
          translatedText: translated,
          targetLanguage: selectedLanguage,
          languageName: LANGUAGES.find(l => l.code === selectedLanguage)?.name,
          generatedAudio: audioResult.audio_base64,
          audioSource: audioResult.source,
          voiceMode: voiceCloningMode
        };
        
        setSessionHistory(prev => [historyEntry, ...prev]); // Add to beginning of array
        
        // Auto-play the generated audio
        setTimeout(() => {
          playAudioData(audioResult.audio_base64);
        }, 500); // Small delay to ensure UI updates
        
      } else {
        console.warn('Audio generation failed:', audioResult.error);
        setCurrentStep('Translation completed! (Audio generation unavailable)');
        // Only show the warning message if both TTS Cloning AND Sarvam TTS fallback failed
        if (voiceCloningMode === 'cloning') {
          setAudioGenerationFailed(true);
        }
        // Don't set generatedAudio, so the Play Audio button won't appear
      }

      setTimeout(() => {
        setProcessing(false);
        setCurrentStep('');
      }, 2000);

    } catch (error) {
      console.error('❌ Processing error:', error);
      
      // More detailed error handling
      if (error.message && error.message.includes('400')) {
        console.error('🚨 Sarvam API 400 Error Details:', {
          error: error,
          message: error.message,
          stack: error.stack
        });
        
        // Check if it's an STT error
        if (error.message.includes('speech-to-text') || error.message.includes('transcribe')) {
          alert(`❌ Speech-to-Text Error: The audio format may not be supported by Sarvam AI.\n\nDetails: ${error.message}\n\nTry:\n1. Record for longer (5+ seconds)\n2. Speak clearly into microphone\n3. Check microphone permissions`);
        } else {
          alert(`❌ API Error: ${error.message}`);
        }
      } else {
        alert(`❌ Processing Error: ${error.message}`);
      }
      
      setProcessing(false);
      setCurrentStep('');
      setAudioGenerationFailed(false);
    }
  };



  // Reset all states
  const resetAll = () => {
    setAudioBlob(null);
    setTranscribedText('');
    setTranslatedText('');
    setGeneratedAudio(null);
    setProcessing(false);
    setCurrentStep('');
    setVoiceCloningMode('standard'); // Reset to default mode
    setIsPlayingAudio(false);
    setPlayingHistoryIndex(null);
  };

  // Clear session history
  const clearHistory = () => {
    setSessionHistory([]);
  };

  // Generic function to play audio data
  const playAudioData = (audioData, isHistoryItem = false, historyIndex = null) => {
    if (!audioData || isPlayingAudio || (isHistoryItem && playingHistoryIndex !== null)) {
      return; // Prevent multiple simultaneous playback
    }
    
    try {
      setIsPlayingAudio(true);
      if (isHistoryItem) {
        setPlayingHistoryIndex(historyIndex);
      }
      
      // Handle different audio formats from different APIs
      let audioDataUrl;
      
      if (audioData.startsWith('data:')) {
        // Audio already has data URL format
        audioDataUrl = audioData;
      } else {
        // Detect format based on base64 header
        // WAV files start with "UklGR" (RIFF in base64)
        // MP3 files start with "//M" or "/+M" or similar
        if (audioData.startsWith('UklGR')) {
          audioDataUrl = `data:audio/wav;base64,${audioData}`;
          console.log('🎵 Detected WAV format from base64 header');
        } else {
          audioDataUrl = `data:audio/mp3;base64,${audioData}`;
          console.log('🎵 Assuming MP3 format');
        }
      }
      
      console.log('🎵 Playing audio with format:', audioDataUrl.substring(0, 50) + '...');
      
      const audio = new Audio(audioDataUrl);
      
      audio.oncanplaythrough = () => {
        console.log('✅ Audio loaded successfully');
      };
      
      audio.onended = () => {
        setIsPlayingAudio(false);
        setPlayingHistoryIndex(null);
        console.log('🏁 Audio playback completed');
      };
      
      audio.onerror = (error) => {
        setIsPlayingAudio(false);
        setPlayingHistoryIndex(null);
        console.error('❌ Audio load error:', error);
        // Try with WAV format as fallback
        if (audioDataUrl.includes('mp3')) {
          console.log('🔄 Retrying with WAV format...');
          setIsPlayingAudio(true);
          if (isHistoryItem) {
            setPlayingHistoryIndex(historyIndex);
          }
          const wavAudioUrl = `data:audio/wav;base64,${audioData}`;
          const audioWav = new Audio(wavAudioUrl);
          audioWav.onended = () => {
            setIsPlayingAudio(false);
            setPlayingHistoryIndex(null);
          };
          audioWav.onerror = () => {
            setIsPlayingAudio(false);
            setPlayingHistoryIndex(null);
            alert('Unable to play audio. Format may not be supported.');
          };
          audioWav.play().catch(err => {
            setIsPlayingAudio(false);
            setPlayingHistoryIndex(null);
            console.error('❌ WAV playback also failed:', err);
            alert('Unable to play audio. Format may not be supported.');
          });
        } else {
          alert('Unable to play audio. Format may not be supported.');
        }
      };
      
      audio.play().catch(error => {
        setIsPlayingAudio(false);
        setPlayingHistoryIndex(null);
        console.error('❌ Audio playback error:', error);
        // Try alternative format
        audio.onerror(error);
      });
      
    } catch (error) {
      setIsPlayingAudio(false);
      setPlayingHistoryIndex(null);
      console.error('❌ Audio setup error:', error);
      alert('Error setting up audio playback');
    }
  };

  // Play current generated audio
  const playGeneratedAudio = () => {
    if (generatedAudio && !isPlayingAudio) {
      playAudioData(generatedAudio);
    }
  };

  // Play audio from history
  const playHistoryAudio = (audioData, index) => {
    playAudioData(audioData, true, index);
  };



  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8" style={{ 
      backgroundColor: '#F4EFE4'
    }}>
      <div className="max-w-4xl mx-auto">
        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-full p-2 shadow-lg">
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab('translator')}
                className={`px-4 py-3 rounded-full font-semibold transition-colors duration-200 text-sm ${
                  activeTab === 'translator'
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'text-gray-600 hover:text-blue-500'
                }`}
              >
                🎤 Voice Translator
              </button>
              <button
                onClick={() => setActiveTab('birthday')}
                className={`px-4 py-3 rounded-full font-semibold transition-colors duration-200 text-sm ${
                  activeTab === 'birthday'
                    ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black shadow-md'
                    : 'text-gray-600 hover:text-yellow-600'
                }`}
              >
                🎂 Birthday Wisher
              </button>
              {false && <button
                onClick={() => setActiveTab('video')}
                className={`px-4 py-3 rounded-full font-semibold transition-colors duration-200 text-sm ${
                  activeTab === 'video'
                    ? 'bg-purple-500 text-white shadow-md'
                    : 'text-gray-600 hover:text-purple-500'
                }`}
              >
                🎬 Video Translator
              </button>}
            </div>
          </div>
        </div>

        {/* Render Active Tab Content */}
        {activeTab === 'translator' ? (
          <div>
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-black mb-4">
                🎤 Sarvam Voice Translation
              </h1>
              <p className="text-xl text-black">
                Record, translate, and listen to your voice in different languages
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8 space-y-8">
          {/* Language Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Target Language
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={processing}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Voice Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Audio Generation Mode
            </label>
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  id="standard-mode"
                  name="voice-mode"
                  type="radio"
                  value="standard"
                  checked={voiceCloningMode === 'standard'}
                  onChange={(e) => setVoiceCloningMode(e.target.value)}
                  disabled={processing}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <label htmlFor="standard-mode" className="ml-3 block text-sm text-gray-700">
                  <span className="font-medium">Without Voice Clone</span>
                  <span className="text-gray-500 block text-xs">Standard text-to-speech (Recommended)</span>
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="cloning-mode"
                  name="voice-mode"
                  type="radio"
                  value="cloning"
                  checked={voiceCloningMode === 'cloning'}
                  onChange={(e) => setVoiceCloningMode(e.target.value)}
                  disabled={processing}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <label htmlFor="cloning-mode" className="ml-3 block text-sm text-gray-700">
                  <span className="font-medium">Voice Cloning</span>
                  <span className="text-gray-500 block text-xs">Clone your voice style (Experimental)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Recording Section */}
          <div className="text-center">
            <div className="mb-6">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="inline-flex items-center px-8 py-4 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-full transition-colors duration-200 shadow-lg"
                  disabled={processing}
                >
                  <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                  Start Recording
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="inline-flex items-center px-8 py-4 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-full transition-colors duration-200 shadow-lg animate-pulse"
                >
                  <div className="w-6 h-6 bg-red-500 rounded-full mr-2 animate-pulse"></div>
                  Stop Recording
                </button>
              )}
            </div>

            {audioBlob && !isRecording && !processing && (
              <div className="mb-6">
                <p className="text-green-600 font-medium">✓ Audio recorded successfully! Processing...</p>
              </div>
            )}
          </div>

          {/* Processing Status */}
          {processing && currentStep && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="animate-spin h-5 w-5 text-blue-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-blue-700 font-medium">{currentStep}</span>
              </div>
            </div>
          )}

          {/* Results Section */}
          {transcribedText && (
            <div className="space-y-6">
              {/* Audio Generation Section - Now First */}
              {generatedAudio ? (
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Generated Audio:</h3>
                  <button
                    onClick={playGeneratedAudio}
                    disabled={isPlayingAudio}
                    className={`inline-flex items-center px-6 py-3 font-semibold rounded-lg transition-colors duration-200 shadow-md ${
                      isPlayingAudio 
                        ? 'bg-green-500 text-white cursor-not-allowed' 
                        : 'bg-purple-500 hover:bg-purple-600 text-white'
                    }`}
                  >
                    {isPlayingAudio ? (
                      <>
                        <svg className="w-5 h-5 mr-2 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM15.657 6.343a1 1 0 011.414 0A9.972 9.972 0 0119 12a9.972 9.972 0 01-1.929 5.657 1 1 0 11-1.414-1.414A7.971 7.971 0 0017 12c0-1.594-.471-3.076-1.343-4.243a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 12a5.983 5.983 0 01-.757 2.829 1 1 0 11-1.415-1.415A3.987 3.987 0 0014 12a3.987 3.987 0 00-.171-1.414 1 1 0 010-1.415z" clipRule="evenodd" />
                        </svg>
                        Playing...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                        Play Audio
                      </>
                    )}
                  </button>
                </div>
              ) : translatedText && audioGenerationFailed && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Audio Generation</h3>
                  <p className="text-yellow-700">
                    🔧 Voice cloning service is currently unavailable.<br />
                    Your text has been successfully transcribed and translated!
                  </p>
                </div>
              )}

              {/* Transcribed Text Section - Now Second */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Transcribed Text:</h3>
                <p className="text-gray-700">{transcribedText}</p>
              </div>

              {/* Translated Text Section - Now Third */}
              {translatedText && (
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    Translated Text ({LANGUAGES.find(l => l.code === selectedLanguage)?.name}):
                  </h3>
                  <p className="text-gray-700">{translatedText}</p>
                </div>
              )}
            </div>
          )}

          {/* Session History */}
          {sessionHistory.length > 0 && (
            <div className="mt-8 pt-8 border-t-2 border-gray-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Session History</h2>
                <button
                  onClick={clearHistory}
                  className="px-4 py-2 bg-red-400 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors duration-200"
                >
                  Clear History
                </button>
              </div>
              
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {sessionHistory.map((entry, index) => (
                  <div key={entry.id} className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex justify-between items-start mb-3">
                      <div className="text-sm text-gray-500">
                        <span className="font-medium">#{sessionHistory.length - index}</span> • {entry.timestamp} • {entry.languageName} • {entry.voiceMode} mode
                      </div>
                      <div className="text-xs text-gray-400">
                        {entry.audioSource}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Transcribed Text */}
                      <div className="bg-gray-50 rounded-lg p-3">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Original</h4>
                        <p className="text-sm text-gray-600">{entry.transcribedText}</p>
                      </div>
                      
                      {/* Translated Text */}
                      <div className="bg-green-50 rounded-lg p-3">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Translated</h4>
                        <p className="text-sm text-gray-600">{entry.translatedText}</p>
                      </div>
                      
                      {/* Audio Player */}
                      <div className="bg-purple-50 rounded-lg p-3 flex flex-col justify-center items-center">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Audio</h4>
                        <button
                          onClick={() => playHistoryAudio(entry.generatedAudio, index)}
                          disabled={isPlayingAudio}
                          className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                            playingHistoryIndex === index && isPlayingAudio
                              ? 'bg-green-500 text-white cursor-not-allowed'
                              : 'bg-purple-500 hover:bg-purple-600 text-white'
                          }`}
                        >
                          {playingHistoryIndex === index && isPlayingAudio ? (
                            <>
                              <svg className="w-4 h-4 mr-1 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" clipRule="evenodd" />
                              </svg>
                              Playing
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                              </svg>
                              Play
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reset Button */}
          {(audioBlob || transcribedText) && !processing && (
            <div className="text-center pt-4">
              <button
                onClick={resetAll}
                className="px-6 py-2 bg-gray-400 hover:bg-gray-500 text-white font-medium rounded-lg transition-colors duration-200"
              >
                Reset All
              </button>
            </div>
          )}
            </div>
          </div>
        ) : activeTab === 'birthday' ? (
          <BirthdayWisher apiKey={API_KEY} />
        ) : (
          <VideoTranslator apiKey={API_KEY} />
        )}
      </div>
    </div>
  );
}

export default App;
