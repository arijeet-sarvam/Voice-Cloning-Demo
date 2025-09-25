// Shared TTS Cloning API Service
class TTSCloningAPI {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
    this.cloningUrl = 'http://localhost:3001/voice-cloning'; // Use CORS proxy
  }

  // Convert audio blob to WAV format
  async convertToWav(audioBlob) {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Get first channel (mono)
      const audioData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      
      // Create WAV file
      const wavBuffer = this.createWAVBuffer(audioData, sampleRate);
      return new Blob([wavBuffer], { type: 'audio/wav' });
    } catch (error) {
      console.error('Error converting audio to WAV:', error);
      throw error;
    }
  }

  createWAVBuffer(audioData, sampleRate) {
    const length = audioData.length;
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);
    
    // WAV file header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);
    
    // Convert float32 to int16
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
    
    return buffer;
  }

  async generateAudio(genText, refText, audioFile, targetLanguage, apiKey, voiceMode = 'standard') {
    // Create audio file with proper MIME type for Sarvam STT
    // Strip codec specification if present (e.g., 'audio/webm;codecs=opus' → 'audio/webm')
    const mimeType = audioFile.type.includes('webm') && audioFile.type.includes('codecs=') 
      ? 'audio/webm' 
      : audioFile.type;
    
    audioFile = new File([audioFile], 'recording.webm', { type: mimeType });

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
        console.error('❌ TTS Cloning API error:', response.status, errorText);
        throw new Error(`TTS Cloning API error: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('✅ TTS Cloning response received:', {
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
      console.error('❌ TTS Cloning failed:', error);
      throw error;
    }
  }

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
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

export default TTSCloningAPI;
