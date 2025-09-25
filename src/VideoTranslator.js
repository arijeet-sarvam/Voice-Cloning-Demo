import React, { useState, useRef, useEffect } from 'react';
import { SarvamAIClient } from 'sarvamai';

// Language options with their codes (same as main app)
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

// Source languages (for detection)
const SOURCE_LANGUAGES = [
  { code: 'auto', name: 'Auto-detect' },
  { code: 'en-IN', name: 'English' },
  ...LANGUAGES
];

// TTS Cloning Audio API Class (voice cloning service)
class TTSCloningAPI {
  constructor(baseUrl = '') {
    // Use CORS proxy server for TTS Cloning endpoint
    this.baseUrl = baseUrl;
    this.cloningUrl = 'http://localhost:3001/voice-cloning'; // CORS proxy
    this.directCloningUrl = 'http://34.16.237.235/v2/models/f5_190000/versions/1/infer'; // Direct (CORS blocked)
  }

  // Convert audio blob to WAV format
  async convertToWav(audioBlob) {
    try {
      console.log('🔄 Converting audio to WAV format...');
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
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
    const length = audioBuffer.length * numberOfChannels * 2;
    
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);
    
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length, true);
    
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

  // Convert Float32Array to WAV buffer (for Triton response processing)
  float32ToWav(float32Array, sampleRate = 24000) {
    const numChannels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    
    // Create ArrayBuffer for WAV file
    const arrayBuffer = new ArrayBuffer(44 + float32Array.length * 2);
    const view = new DataView(arrayBuffer);

    // Helper function to write string
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

    // Return base64 string instead of Buffer
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
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
        
        console.log('🔍 Detailed field analysis:');
        Object.keys(data).forEach(key => {
          const value = data[key];
          console.log(`  - "${key}": ${typeof value} (${value ? value.toString().substring(0, 50) + '...' : 'null/undefined'})`);
        });
        
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

  // Generate audio using standard TTS mode (primary) with F5 voice cloning fallback
  async generateAudio(genText, refText, audioFile, targetLanguage, apiKey, voiceMode = 'standard') {
    console.log(`🎯 Audio generation mode: ${voiceMode}`);
    
    // Standard mode - use Sarvam TTS directly (primary method)
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
      
      // Use optimized male_mono_10s.wav as reference audio (better for TTS Cloning GPU memory)
      const maleWavResponse = await fetch('/male_mono_10s.wav');
      const maleWavBlob = await maleWavResponse.blob();
      const maleWavBase64 = await this.fileToBase64(maleWavBlob);
      
      console.log('🎵 Using optimized reference audio:', {
        file: 'male_mono_10s.wav',
        size: maleWavBlob.size,
        type: maleWavBlob.type
      });
      
      // Create Triton-compatible payload
      const payload = {
        inputs: [
          { 
            name: "ref_audio", 
            shape: [1], 
            datatype: "BYTES", 
            data: [maleWavBase64] 
          },
          { 
            name: "ref_text", 
            shape: [1], 
            datatype: "BYTES", 
            data: ["Hi, I'm really excited to be here today. I enjoy spending time with my friends and family, reading new stories, and exploring new places. This is just a short message to help you understand my voice and how I sound naturally."] 
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
      
      console.log('🎯 Triton F5 API Debug Info:');
      console.log('Generated Text:', genText);
      console.log('Using Male.wav as reference audio');
      console.log('Male WAV size:', maleWavBlob.size);
      console.log('Base64 Audio Length:', maleWavBase64.length);
      console.log('TTS Cloning Payload size:', JSON.stringify(payload).length);

      const response = await fetch(this.cloningUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });
      
      console.log('🔍 Triton F5 API Response Info:');
      console.log('Response Status:', response.status);
      console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Triton F5 API Error:', errorText);
        throw new Error(`Triton API error! status: ${response.status}, error: ${errorText}`);
      }
      
      const result = await response.json();
      console.log('✅ Triton F5 API Success Response keys:', Object.keys(result));
      
      if (result.outputs && result.outputs[0]?.data) {
        const rawAudio = result.outputs[0].data;
        console.log('🎵 Generated audio data length:', rawAudio.length);
        console.log('🎵 Audio data type:', typeof rawAudio[0]);
        
        // Process Triton response (convert Float32Array to WAV)
        const flattenAudio = (data) => Array.isArray(data) ? data.flat(Infinity) : [data];
        const floatArray = flattenAudio(rawAudio);
        const float32Array = Float32Array.from(floatArray);
        
        // Convert to WAV buffer (browser-compatible)
        const audio_base64 = this.float32ToWav(float32Array, 24000);
        
        console.log('🎵 Converted WAV audio length:', audio_base64.length);
        return { success: true, audio_base64: audio_base64, source: 'Triton-F5-VoiceClone' };
      } else {
        throw new Error('No audio data in Triton response');
      }
      
    } catch (error) {
      console.warn('🚨 Triton F5 API failed, trying Sarvam TTS Bulbul fallback...', error);
      
      // Log specific error types for debugging
      if (error.message.includes('CUDA')) {
        console.warn('🚨 CUDA memory error detected - Triton server GPU issue');
      } else if (error.message.includes('illegal memory access')) {
        console.warn('🚨 GPU memory access error - Triton server needs restart');
      }
      
      // Fallback to Sarvam TTS Bulbul API
      const fallbackResult = await this.generateAudioWithSarvam(genText, targetLanguage, apiKey);
      
      if (fallbackResult.success) {
        return { success: true, audio_base64: fallbackResult.audio_base64, source: 'Sarvam-Bulbul-Fallback' };
      }
      
      return { success: false, error: `Both F5 (${error.message}) and Sarvam TTS Bulbul (${fallbackResult.error}) failed` };
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
}

function VideoTranslator({ apiKey }) {
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('hi-IN');
  const [delay, setDelay] = useState(9);
  const [audioMode, setAudioMode] = useState('original'); // 'original' or 'translated'
  const [voiceMode, setVoiceMode] = useState('standard'); // 'standard' or 'cloning'
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [chunks, setChunks] = useState([]);
  const [processedChunks, setProcessedChunks] = useState(new Map());
  const [audioQueue, setAudioQueue] = useState([]);
  const [currentlyPlayingAudio, setCurrentlyPlayingAudio] = useState(null);
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);
  const [nextChunkToPlay, setNextChunkToPlay] = useState(0);

  const originalVideoRef = useRef(null);
  const translatedVideoRef = useRef(null);
  const audioContextRef = useRef(null);
  const translatedAudioRef = useRef(null);
  const scheduledAudioTimeouts = useRef(new Map());
  const sarvamClient = new SarvamAIClient({ apiSubscriptionKey: apiKey });
  const ttsApi = new TTSCloningAPI();

  // Handle video file upload
  const handleVideoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      
      // Reset states
      setChunks([]);
      setProcessedChunks(new Map());
      setAudioQueue([]);
      setCurrentTime(0);
      setIsPlaying(false);
      
      // Clear any playing audio
      if (currentlyPlayingAudio) {
        currentlyPlayingAudio.pause();
        setCurrentlyPlayingAudio(null);
      }
      scheduledAudioTimeouts.current.clear();
    }
  };

  // Extract audio from video and create chunks
  const extractAudioChunks = async (videoElement) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      // Create media source from video element
      const mediaSource = audioContext.createMediaElementSource(videoElement);
      const analyser = audioContext.createAnalyser();
      mediaSource.connect(analyser);
      
      const videoDuration = videoElement.duration;
      const chunkDuration = delay; // Use delay as chunk duration
      const numChunks = Math.ceil(videoDuration / chunkDuration);
      
      const newChunks = [];
      for (let i = 0; i < numChunks; i++) {
        const startTime = i * chunkDuration;
        const endTime = Math.min(startTime + chunkDuration, videoDuration);
        
        newChunks.push({
          id: i,
          startTime,
          endTime,
          status: 'pending', // pending, processing, completed, error
          audioData: null,
          translatedText: '',
          translatedAudio: null
        });
      }
      
      setChunks(newChunks);
      return newChunks;
    } catch (error) {
      console.error('Error extracting audio chunks:', error);
      return [];
    }
  };

  // Process a single audio chunk through STT → Translate → TTS
  const processAudioChunk = async (chunk, audioBlob) => {
    try {
      console.log(`🔄 Processing chunk ${chunk.id} (${chunk.startTime}s - ${chunk.endTime}s)`);
      
      // Update chunk status
      setChunks(prev => prev.map(c => 
        c.id === chunk.id ? { ...c, status: 'processing' } : c
      ));

      // Step 1: Transcribe audio - audioBlob is already in WAV format from extraction
      const audioFile = new File([audioBlob], `chunk_${chunk.id}.wav`, { type: 'audio/wav' });
      
      const transcriptionResponse = await sarvamClient.speechToText.transcribe(audioFile, {
        model: 'saarika:v2',
      });

      const transcribed = transcriptionResponse.transcript;
      const detectedLanguage = sourceLanguage === 'auto' ? transcriptionResponse.language_code : sourceLanguage;
      
      console.log(`📝 Chunk ${chunk.id} transcribed:`, transcribed);

      // Step 2: Translate text (if needed)
      let translatedText = transcribed;
      if (detectedLanguage !== targetLanguage) {
        const translationResponse = await sarvamClient.text.translate({
          input: transcribed,
          source_language_code: detectedLanguage,
          target_language_code: targetLanguage,
          model: 'sarvam-translate:v1'
        });
        translatedText = translationResponse.translated_text;
      }

      console.log(`🌐 Chunk ${chunk.id} translated:`, translatedText);

      // Step 3: Generate audio using selected voice mode
      const audioResult = await ttsApi.generateAudio(translatedText, transcribed, audioBlob, targetLanguage, apiKey, voiceMode);
      
      if (audioResult.success) {
        // Update chunk with results
        const updatedChunk = {
          ...chunk,
          status: 'completed',
          translatedText,
          translatedAudio: audioResult.audio_base64
        };
        
        setChunks(prev => prev.map(c => 
          c.id === chunk.id ? updatedChunk : c
        ));
        
        setProcessedChunks(prev => new Map(prev.set(chunk.id, updatedChunk)));
        
        console.log(`✅ Chunk ${chunk.id} completed successfully`);
        
        // Auto-queue the chunk for sequential playback (if in translated mode and video is playing)
        // Manual controls take precedence over auto-playback
        if (audioMode === 'translated' && isPlaying && !isPlayingSequence) {
          console.log(`🚀 Auto-queueing chunk ${chunk.id} for sequential playback`);
          queueChunkForPlayback(updatedChunk);
        } else if (audioMode === 'translated') {
          console.log(`📋 Chunk ${chunk.id} processed and ready for manual playback`);
        }
        
        return updatedChunk;
      } else {
        throw new Error(`TTS failed: ${audioResult.error}`);
      }

    } catch (error) {
      console.error(`❌ Error processing chunk ${chunk.id}:`, error);
      
      // Update chunk status to error
      setChunks(prev => prev.map(c => 
        c.id === chunk.id ? { ...c, status: 'error' } : c
      ));
      
      return null;
    }
  };

  // Extract audio chunk from video at specific time range using Web Audio API
  const extractAudioFromTimeRange = async (startTime, endTime) => {
    return new Promise(async (resolve) => {
      try {
        if (!videoFile) {
          console.error('No video file available');
          resolve(null);
          return;
        }

        console.log(`🎵 Extracting audio chunk: ${startTime}s - ${endTime}s`);

        // Create audio context
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Read the video file as array buffer
        const arrayBuffer = await videoFile.arrayBuffer();
        
        // Decode the audio data from the video file
        let audioBuffer;
        try {
          audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        } catch (error) {
          console.error('Error decoding audio data:', error);
          resolve(null);
          return;
        }

        const sampleRate = audioBuffer.sampleRate;
        const numberOfChannels = audioBuffer.numberOfChannels;
        
        // Calculate sample indices for the time range
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.floor(endTime * sampleRate);
        const chunkLength = endSample - startSample;

        // Create a new audio buffer for the chunk
        const chunkBuffer = audioContext.createBuffer(numberOfChannels, chunkLength, sampleRate);
        
        // Copy the audio data for the specified time range
        for (let channel = 0; channel < numberOfChannels; channel++) {
          const originalChannelData = audioBuffer.getChannelData(channel);
          const chunkChannelData = chunkBuffer.getChannelData(channel);
          
          for (let i = 0; i < chunkLength; i++) {
            const sampleIndex = startSample + i;
            if (sampleIndex < originalChannelData.length) {
              chunkChannelData[i] = originalChannelData[sampleIndex];
            } else {
              chunkChannelData[i] = 0; // Pad with silence if beyond audio length
            }
          }
        }

        // Convert the chunk buffer to a WAV blob
        const wavBlob = audioBufferToWav(chunkBuffer);
        console.log(`✅ Audio chunk extracted: ${wavBlob.size} bytes`);
        resolve(wavBlob);

      } catch (error) {
        console.error('Error extracting audio chunk:', error);
        resolve(null);
      }
    });
  };

  // Helper function to convert AudioBuffer to WAV blob
  const audioBufferToWav = (audioBuffer) => {
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
  };

  // Start video playback and processing
  const handlePlay = async () => {
    if (!videoFile || !originalVideoRef.current) return;
    
    setIsPlaying(true);
    setNextChunkToPlay(0); // Reset sequence tracking
    setIsPlayingSequence(false);
    
    // Start both videos
    originalVideoRef.current.play();
    if (translatedVideoRef.current) {
      translatedVideoRef.current.play();
    }
    
    // Extract and process chunks
    const videoChunks = await extractAudioChunks(originalVideoRef.current);
    
    // Process chunks with lookahead
    videoChunks.forEach(async (chunk, index) => {
      // Add some delay before processing to allow video to load
      setTimeout(async () => {
        const audioBlob = await extractAudioFromTimeRange(chunk.startTime, chunk.endTime);
        if (audioBlob) {
          await processAudioChunk(chunk, audioBlob);
        }
      }, index * 100); // Stagger chunk processing
    });
  };

  // Pause video playback
  const handlePause = () => {
    setIsPlaying(false);
    setIsPlayingSequence(false);
    
    if (originalVideoRef.current) {
      originalVideoRef.current.pause();
    }
    if (translatedVideoRef.current) {
      translatedVideoRef.current.pause();
    }
  };

  // Stop video playback
  const handleStop = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setIsPlayingSequence(false);
    setNextChunkToPlay(0);
    
    // Stop any currently playing audio
    if (currentlyPlayingAudio) {
      currentlyPlayingAudio.pause();
      currentlyPlayingAudio.currentTime = 0;
      setCurrentlyPlayingAudio(null);
    }
    
    if (originalVideoRef.current) {
      originalVideoRef.current.pause();
      originalVideoRef.current.currentTime = 0;
    }
    if (translatedVideoRef.current) {
      translatedVideoRef.current.pause();
      translatedVideoRef.current.currentTime = 0;
    }
  };

  // Update current time
  useEffect(() => {
    const updateTime = () => {
      if (originalVideoRef.current) {
        setCurrentTime(originalVideoRef.current.currentTime);
      }
    };

    const video = originalVideoRef.current;
    if (video) {
      video.addEventListener('timeupdate', updateTime);
      video.addEventListener('loadedmetadata', () => {
        setDuration(video.duration);
      });
      
      return () => {
        video.removeEventListener('timeupdate', updateTime);
      };
    }
  }, [videoUrl]);

  // Clean up audio when not playing or switching modes
  useEffect(() => {
    if (!isPlaying) {
      // Stop any currently playing audio
      if (currentlyPlayingAudio) {
        currentlyPlayingAudio.pause();
        currentlyPlayingAudio.currentTime = 0;
        setCurrentlyPlayingAudio(null);
      }
    }
  }, [isPlaying, currentlyPlayingAudio]);

  // Handle audio mode changes
  useEffect(() => {
    // Stop any currently playing translated audio when switching modes
    if (currentlyPlayingAudio) {
      currentlyPlayingAudio.pause();
      currentlyPlayingAudio.currentTime = 0;
      setCurrentlyPlayingAudio(null);
    }

    // Update video audio muting based on mode
    if (originalVideoRef.current) {
      originalVideoRef.current.muted = (audioMode === 'translated');
    }
    if (translatedVideoRef.current) {
      translatedVideoRef.current.muted = true; // Always muted since we play translated audio separately
    }
  }, [audioMode]);

  // Queue chunk for sequential playback
  const queueChunkForPlayback = (chunk) => {
    console.log(`📋 Queueing chunk ${chunk.id} for sequential playback (next expected: ${nextChunkToPlay})`);
    
    // If this is the next chunk in sequence and we're not currently playing, start playing
    if (chunk.id === nextChunkToPlay && !isPlayingSequence) {
      console.log(`🎬 Starting sequential playback with chunk ${chunk.id}`);
      playSequentialChunk(chunk);
    } else if (chunk.id === nextChunkToPlay && isPlayingSequence) {
      console.log(`⏳ Chunk ${chunk.id} is ready but sequence is already playing`);
    } else {
      console.log(`📋 Chunk ${chunk.id} queued, waiting for chunk ${nextChunkToPlay}`);
    }
  };

  // Play chunks sequentially to create continuous audio
  const playSequentialChunk = (chunk) => {
    if (audioMode !== 'translated' || !isPlaying) {
      console.log(`⏭️ Skipping sequential playback - mode: ${audioMode}, playing: ${isPlaying}`);
      return;
    }

    try {
      console.log(`🔊 Playing sequential chunk ${chunk.id}`);
      setIsPlayingSequence(true);
      
      // Stop any currently playing audio
      if (currentlyPlayingAudio) {
        currentlyPlayingAudio.pause();
        currentlyPlayingAudio.currentTime = 0;
      }

      const audioDataUrl = chunk.translatedAudio.startsWith('data:') 
        ? chunk.translatedAudio 
        : `data:audio/wav;base64,${chunk.translatedAudio}`;
      
      const audio = new Audio(audioDataUrl);
      audio.volume = 0.9;
      
      audio.onended = () => {
        console.log(`🏁 Finished playing sequential chunk ${chunk.id}`);
        setCurrentlyPlayingAudio(null);
        
        // Move to next chunk
        const nextChunkId = chunk.id + 1;
        setNextChunkToPlay(nextChunkId);
        
        // Check if next chunk is ready
        const nextChunk = processedChunks.get(nextChunkId);
        if (nextChunk && nextChunk.status === 'completed' && nextChunk.translatedAudio) {
          console.log(`➡️ Playing next chunk ${nextChunkId}`);
          setTimeout(() => playSequentialChunk(nextChunk), 100); // Small gap between chunks
        } else {
          console.log(`⏳ Waiting for chunk ${nextChunkId} to be ready`);
          setIsPlayingSequence(false);
        }
      };
      
      audio.onerror = (error) => {
        console.error(`❌ Error playing sequential chunk ${chunk.id}:`, error);
        setCurrentlyPlayingAudio(null);
        setIsPlayingSequence(false);
      };
      
      setCurrentlyPlayingAudio(audio);
      
      audio.play()
        .then(() => {
          console.log(`✅ Successfully started sequential chunk ${chunk.id}`);
        })
        .catch(error => {
          console.error(`❌ Failed to play sequential chunk ${chunk.id}:`, error);
          setCurrentlyPlayingAudio(null);
          setIsPlayingSequence(false);
        });
      
    } catch (error) {
      console.error(`❌ Error setting up sequential chunk ${chunk.id}:`, error);
      setIsPlayingSequence(false);
    }
  };

  // Function to play a single translated audio chunk (for individual playback)
  const playTranslatedAudioChunk = (chunk, chunkIndex) => {
    try {
      console.log(`🔊 Attempting to play translated audio for chunk ${chunkIndex}`);
      console.log(`🎵 Audio mode: ${audioMode}`);
      console.log(`🎵 Chunk status: ${chunk.status}`);
      console.log(`🎵 Has translated audio: ${!!chunk.translatedAudio}`);
      
      // Only play if we're in translated mode
      if (audioMode !== 'translated') {
        console.log(`⏭️ Skipping chunk ${chunkIndex} - not in translated mode`);
        return;
      }

      // Stop any currently playing translated audio to prevent overlap
      if (currentlyPlayingAudio) {
        console.log(`⏹️ Stopping previous audio`);
        currentlyPlayingAudio.pause();
        currentlyPlayingAudio.currentTime = 0;
      }

      console.log(`🔊 Playing translated audio for chunk ${chunkIndex}`);
      
      const audioDataUrl = chunk.translatedAudio.startsWith('data:') 
        ? chunk.translatedAudio 
        : `data:audio/wav;base64,${chunk.translatedAudio}`;
      
      console.log(`🎵 Audio data URL length: ${audioDataUrl.length}`);
      console.log(`🎵 Audio data preview: ${audioDataUrl.substring(0, 50)}...`);
      
      const audio = new Audio(audioDataUrl);
      
      // Set volume to prevent interference
      audio.volume = 0.9;
      
      audio.onloadstart = () => {
        console.log(`📥 Started loading audio for chunk ${chunkIndex}`);
      };
      
      audio.oncanplay = () => {
        console.log(`✅ Audio can play for chunk ${chunkIndex}`);
      };
      
      audio.onloadeddata = () => {
        console.log(`✅ Audio loaded for chunk ${chunkIndex}, duration: ${audio.duration}s`);
      };
      
      audio.onplay = () => {
        console.log(`▶️ Audio started playing for chunk ${chunkIndex}`);
      };
      
      audio.onended = () => {
        console.log(`🏁 Finished playing chunk ${chunkIndex}`);
        if (currentlyPlayingAudio === audio) {
          setCurrentlyPlayingAudio(null);
        }
      };
      
      audio.onerror = (error) => {
        console.error(`❌ Error playing chunk ${chunkIndex}:`, error);
        console.error(`❌ Audio error details:`, {
          error: audio.error,
          networkState: audio.networkState,
          readyState: audio.readyState
        });
        if (currentlyPlayingAudio === audio) {
          setCurrentlyPlayingAudio(null);
        }
      };
      
      setCurrentlyPlayingAudio(audio);
      
      // Try to play with more detailed error handling
      console.log(`🎬 Attempting to start playback for chunk ${chunkIndex}`);
      audio.play()
        .then(() => {
          console.log(`✅ Successfully started playing chunk ${chunkIndex}`);
        })
        .catch(error => {
          console.error(`❌ Failed to play chunk ${chunkIndex}:`, error);
          console.error(`❌ Play error details:`, {
            name: error.name,
            message: error.message,
            code: error.code
          });
          setCurrentlyPlayingAudio(null);
        });
      
    } catch (error) {
      console.error(`❌ Error setting up audio for chunk ${chunkIndex}:`, error);
    }
  };

  // Function to play individual chunk audio
  const playIndividualChunk = (chunk) => {
    try {
      console.log(`🎵 Playing individual chunk ${chunk.id}`);
      
      // Stop any currently playing audio
      if (currentlyPlayingAudio) {
        currentlyPlayingAudio.pause();
        currentlyPlayingAudio.currentTime = 0;
      }
      
      const audioDataUrl = chunk.translatedAudio.startsWith('data:') 
        ? chunk.translatedAudio 
        : `data:audio/wav;base64,${chunk.translatedAudio}`;
      
      const audio = new Audio(audioDataUrl);
      audio.volume = 0.9;
      
      audio.onended = () => {
        console.log(`🏁 Finished playing individual chunk ${chunk.id}`);
        if (currentlyPlayingAudio === audio) {
          setCurrentlyPlayingAudio(null);
        }
      };
      
      audio.onerror = (error) => {
        console.error(`❌ Error playing individual chunk ${chunk.id}:`, error);
        if (currentlyPlayingAudio === audio) {
          setCurrentlyPlayingAudio(null);
        }
      };
      
      setCurrentlyPlayingAudio(audio);
      
      audio.play()
        .then(() => {
          console.log(`✅ Successfully started playing individual chunk ${chunk.id}`);
        })
        .catch(error => {
          console.error(`❌ Failed to play individual chunk ${chunk.id}:`, error);
          setCurrentlyPlayingAudio(null);
        });
      
    } catch (error) {
      console.error(`❌ Error setting up individual chunk audio ${chunk.id}:`, error);
    }
  };

  // Sequential audio control functions
  const startSequentialPlayback = () => {
    console.log('🎬 Starting sequential playback manually');
    
    // Find the first available chunk if we haven't started, or resume from current position
    let startChunkId = nextChunkToPlay;
    
    // If we're at the beginning, find the first completed chunk
    if (nextChunkToPlay === 0) {
      const firstCompletedChunk = Array.from(processedChunks.values())
        .find(chunk => chunk.status === 'completed' && chunk.translatedAudio);
      
      if (firstCompletedChunk) {
        startChunkId = firstCompletedChunk.id;
        setNextChunkToPlay(startChunkId);
      }
    }
    
    const chunk = processedChunks.get(startChunkId);
    if (chunk && chunk.status === 'completed' && chunk.translatedAudio) {
      playSequentialChunk(chunk);
    } else {
      console.log(`⏳ Chunk ${startChunkId} not ready yet`);
      alert(`Chunk ${startChunkId + 1} is not ready yet. Please wait for processing to complete.`);
    }
  };

  const pauseSequentialPlayback = () => {
    console.log('⏸️ Pausing sequential playback');
    setIsPlayingSequence(false);
    
    if (currentlyPlayingAudio) {
      currentlyPlayingAudio.pause();
      currentlyPlayingAudio.currentTime = 0;
      setCurrentlyPlayingAudio(null);
    }
  };

  const stopSequentialPlayback = () => {
    console.log('⏹️ Stopping sequential playback');
    setIsPlayingSequence(false);
    setNextChunkToPlay(0);
    
    if (currentlyPlayingAudio) {
      currentlyPlayingAudio.pause();
      currentlyPlayingAudio.currentTime = 0;
      setCurrentlyPlayingAudio(null);
    }
  };

  // Function to download individual chunk audio
  const downloadChunkAudio = (chunk) => {
    try {
      console.log(`💾 Downloading chunk ${chunk.id} audio`);
      
      const audioDataUrl = chunk.translatedAudio.startsWith('data:') 
        ? chunk.translatedAudio 
        : `data:audio/wav;base64,${chunk.translatedAudio}`;
      
      // Create download link
      const link = document.createElement('a');
      link.href = audioDataUrl;
      link.download = `chunk_${chunk.id + 1}_${chunk.startTime.toFixed(1)}s-${chunk.endTime.toFixed(1)}s.wav`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log(`✅ Download triggered for chunk ${chunk.id}`);
      
    } catch (error) {
      console.error(`❌ Error downloading chunk ${chunk.id}:`, error);
      alert(`Error downloading chunk ${chunk.id + 1}. Please try again.`);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getChunkStatus = (chunkId) => {
    const chunk = chunks.find(c => c.id === chunkId);
    return chunk ? chunk.status : 'pending';
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#F0F4F8' }}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎬 Real-time Video Translation
          </h1>
          <p className="text-xl text-gray-600">
            Upload a video and get real-time translated audio with configurable delay
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
            {/* Video Upload */}
            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Video
              </label>
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            {/* Source Language */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Source Language
              </label>
              <select
                value={sourceLanguage}
                onChange={(e) => setSourceLanguage(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={isPlaying}
              >
                {SOURCE_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Language */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Language
              </label>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={isPlaying}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Delay */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delay (seconds): {delay}s
              </label>
              <input
                type="range"
                min="6"
                max="12"
                value={delay}
                onChange={(e) => setDelay(parseInt(e.target.value))}
                className="w-full"
                disabled={isPlaying}
              />
            </div>

            {/* Voice Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Voice Mode
              </label>
              <select
                value={voiceMode}
                onChange={(e) => setVoiceMode(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                disabled={isPlaying}
              >
                <option value="standard">Standard TTS</option>
                <option value="cloning">Voice Cloning</option>
              </select>
            </div>

            {/* Audio Mode Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Audio Output
              </label>
              <select
                value={audioMode}
                onChange={(e) => setAudioMode(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="original">Original Audio</option>
                <option value="translated">Translated Audio</option>
              </select>
            </div>
          </div>

          {/* Video Playback Controls */}
          <div className="flex justify-center space-x-4 mb-4">
            <button
              onClick={handlePlay}
              disabled={!videoFile || isPlaying}
              className="px-6 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold rounded-lg transition-colors duration-200"
            >
              ▶️ Play Video
            </button>
            <button
              onClick={handlePause}
              disabled={!isPlaying}
              className="px-6 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-white font-semibold rounded-lg transition-colors duration-200"
            >
              ⏸️ Pause Video
            </button>
            <button
              onClick={handleStop}
              disabled={!videoFile}
              className="px-6 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white font-semibold rounded-lg transition-colors duration-200"
            >
              ⏹️ Stop Video
            </button>
          </div>

          {/* Sequential Audio Controls */}
          {chunks.length > 0 && audioMode === 'translated' && (
            <div className="flex justify-center space-x-4 mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <h4 className="text-sm font-medium text-purple-800 self-center mr-4">Translated Audio:</h4>
              <button
                onClick={startSequentialPlayback}
                disabled={isPlayingSequence || processedChunks.size === 0}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors duration-200"
              >
                {nextChunkToPlay === 0 ? '▶️ Play Sequential' : '▶️ Resume Sequential'}
              </button>
              <button
                onClick={pauseSequentialPlayback}
                disabled={!isPlayingSequence}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors duration-200"
              >
                ⏸️ Pause Sequential
              </button>
              <button
                onClick={stopSequentialPlayback}
                disabled={!isPlayingSequence && nextChunkToPlay === 0}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors duration-200"
              >
                ⏹️ Stop Sequential
              </button>
              <div className="text-sm text-purple-600 self-center">
                {isPlayingSequence ? 
                  `🔊 Playing chunk ${nextChunkToPlay + 1}/${chunks.length}` : 
                  nextChunkToPlay > 0 ? 
                    `⏸️ Paused at chunk ${nextChunkToPlay + 1}/${chunks.length}` :
                    `✅ Ready: ${processedChunks.size}/${chunks.length} chunks`
                }
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {duration > 0 && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Chunk Status with Audio Players */}
          {chunks.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Processing Status & Audio Chunks:</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {chunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className={`p-3 rounded-lg border ${
                      chunk.status === 'completed' ? 'border-green-200 bg-green-50' :
                      chunk.status === 'processing' ? 'border-yellow-200 bg-yellow-50' :
                      chunk.status === 'error' ? 'border-red-200 bg-red-50' :
                      'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            chunk.status === 'completed' ? 'bg-green-100 text-green-800' :
                            chunk.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                            chunk.status === 'error' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            Chunk {chunk.id + 1}
                          </span>
                          <span className="text-xs text-gray-500">
                            {chunk.startTime.toFixed(1)}s - {chunk.endTime.toFixed(1)}s
                          </span>
                          <span className="text-xs text-gray-500">
                            ({chunk.status})
                          </span>
                        </div>
                        
                        {/* Show translated text if available */}
                        {chunk.translatedText && (
                          <div className="mt-1 text-xs text-gray-600 italic">
                            "{chunk.translatedText.substring(0, 100)}{chunk.translatedText.length > 100 ? '...' : ''}"
                          </div>
                        )}
                      </div>
                      
                      {/* Individual audio controls */}
                      {chunk.status === 'completed' && chunk.translatedAudio && (
                        <div className="ml-2 flex space-x-2">
                          <button
                            onClick={() => playIndividualChunk(chunk)}
                            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors duration-200"
                          >
                            ▶️ Play
                          </button>
                          <button
                            onClick={() => downloadChunkAudio(chunk)}
                            className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors duration-200"
                          >
                            💾 Save
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Video Players */}
        {videoUrl && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Original Video */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Original Video</h2>
              <video
                ref={originalVideoRef}
                src={videoUrl}
                className="w-full rounded-lg"
                controls={false}
                muted={audioMode === 'translated'}
                onLoadedMetadata={() => setDuration(originalVideoRef.current?.duration || 0)}
              />
              <div className="mt-4 text-center">
                <span className="text-sm text-gray-600">
                  Original audio {audioMode === 'original' ? '(playing)' : '(muted)'}
                </span>
              </div>
            </div>

            {/* Translated Video */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Translated Video (immediate playback)
              </h2>
              <video
                ref={translatedVideoRef}
                src={videoUrl}
                className="w-full rounded-lg"
                controls={false}
                muted={true} // Always muted as we play translated audio separately
              />
              <div className="mt-4 text-center">
                <span className="text-sm text-gray-600">
                  Translated audio in {LANGUAGES.find(l => l.code === targetLanguage)?.name} {audioMode === 'translated' ? '(plays when ready)' : '(muted)'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Upload Prompt */}
        {!videoUrl && (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="text-6xl mb-4">🎬</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Upload a Video to Get Started</h3>
            <p className="text-gray-600 mb-6">
              Choose a video file and configure your translation settings above
            </p>
            <div className="inline-block">
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="hidden"
                id="video-upload-main"
              />
              <label
                htmlFor="video-upload-main"
                className="px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg cursor-pointer transition-colors duration-200"
              >
                Choose Video File
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VideoTranslator;
