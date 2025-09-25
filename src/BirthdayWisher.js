import React, { useMemo } from 'react';
import { useBirthdayWisher } from './hooks/useBirthdayWisher';
import { BIRTHDAY_TEMPLATES, REFERENCE_SCRIPT, STEPS } from './constants/birthdayConstants';
import ProgressSteps from './components/ProgressSteps';
import ProcessingStatus from './components/ProcessingStatus';

const API_KEY = '954b2595-6a49-49ec-8974-268a7cec4b69';

function BirthdayWisher() {
  const {
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
    setCurrentStep,
    setFriendName,
    setSelectedTemplate,
    startRecording,
    stopRecording,
    generateBirthdayWish,
    playGeneratedAudio,
    downloadAudio,
    resetApp
  } = useBirthdayWisher(API_KEY);

  // Initialize selected template
  const currentTemplate = selectedTemplate || BIRTHDAY_TEMPLATES[0];

  // Memoized handlers
  const handleGenerateWish = useMemo(() => 
    () => generateBirthdayWish(currentTemplate, friendName, referenceAudio, REFERENCE_SCRIPT),
    [generateBirthdayWish, currentTemplate, friendName, referenceAudio]
  );

  const handleTemplateSelect = useMemo(() => 
    (template) => setSelectedTemplate(template),
    [setSelectedTemplate]
  );

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 bg-clip-text text-transparent mb-4">
          🎂 Birthday Wisher
        </h1>
        <p className="text-black text-lg">
          Create personalized birthday wishes with your voice
        </p>
      </div>

      <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 shadow-premium border border-gray-800">
        {/* Progress Steps */}
        <ProgressSteps currentStep={currentStep} />

        {/* Step Content */}
        {currentStep === 1 && (
          <RecordingStep 
            isRecording={isRecording}
            referenceAudio={referenceAudio}
            startRecording={startRecording}
            stopRecording={stopRecording}
            onNext={() => setCurrentStep(2)}
            referenceScript={REFERENCE_SCRIPT}
          />
        )}

        {currentStep === 2 && (
          <NameInputStep 
            friendName={friendName}
            setFriendName={setFriendName}
            onNext={() => setCurrentStep(3)}
          />
        )}

        {currentStep === 3 && (
          <TemplateSelectionStep 
            templates={BIRTHDAY_TEMPLATES}
            selectedTemplate={currentTemplate}
            onTemplateSelect={handleTemplateSelect}
            friendName={friendName}
            isProcessing={isProcessing}
            onGenerate={handleGenerateWish}
          />
        )}

        {currentStep === 4 && (
          <ResultStep 
            friendName={friendName}
            selectedTemplate={currentTemplate}
            generatedAudio={generatedAudio}
            isPlayingAudio={isPlayingAudio}
            isProcessing={isProcessing}
            onPlay={playGeneratedAudio}
            onDownload={downloadAudio}
            onRegenerate={handleGenerateWish}
            onReset={resetApp}
          />
        )}

        {/* Processing Status */}
        <ProcessingStatus 
          isProcessing={isProcessing}
          processingStep={processingStep}
          error={error}
        />
      </div>
    </div>
  );
}

// Step Components
const RecordingStep = ({ isRecording, referenceAudio, startRecording, stopRecording, onNext, referenceScript }) => (
  <div className="text-center">
    <h2 className="text-2xl font-semibold mb-4 text-white">Record Your Voice</h2>
    <p className="text-gray-300 mb-6">
      Please read this script to capture your voice:
    </p>
    <div className="bg-gray-800 p-6 rounded-2xl mb-6 text-left shadow-dark-inset border border-gray-700">
      <p className="text-sm italic text-gray-300">"{referenceScript}"</p>
    </div>
    
    {!referenceAudio ? (
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={`px-8 py-4 rounded-2xl font-bold transition-all duration-300 shadow-gold hover:shadow-gold-hover transform hover:scale-105 border ${
          isRecording 
            ? 'bg-gradient-to-br from-red-500 to-red-700 text-white border-red-400' 
            : 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black border-yellow-500'
        }`}
      >
        {isRecording ? '🛑 Stop Recording' : '🎤 Start Recording'}
      </button>
    ) : (
      <div>
        <p className="text-yellow-400 mb-4 font-semibold">✅ Voice recorded successfully!</p>
        <button
          onClick={onNext}
          className="px-8 py-4 bg-gradient-to-br from-yellow-400 to-yellow-600 text-black rounded-2xl font-bold hover:shadow-gold-hover transition-all duration-300 transform hover:scale-105 border border-yellow-500 shadow-gold"
        >
          Next Step →
        </button>
      </div>
    )}
  </div>
);

const NameInputStep = ({ friendName, setFriendName, onNext }) => (
  <div className="text-center">
    <h2 className="text-2xl font-semibold mb-4 text-white">Friend's Name</h2>
    <p className="text-gray-300 mb-6">Enter your friend's name:</p>
    
    <input
      type="text"
      value={friendName}
      onChange={(e) => setFriendName(e.target.value)}
      placeholder="Enter friend's name"
      className="w-full max-w-md px-4 py-3 bg-gray-800 border border-gray-600 rounded-2xl text-center text-lg mb-6 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 shadow-dark-inset"
      autoFocus
    />
    
    {friendName.trim() && (
      <button
        onClick={onNext}
        className="px-8 py-4 bg-gradient-to-br from-yellow-400 to-yellow-600 text-black rounded-2xl font-bold hover:shadow-gold-hover transition-all duration-300 transform hover:scale-105 border border-yellow-500 shadow-gold"
      >
        Next Step →
      </button>
    )}
  </div>
);

const TemplateSelectionStep = ({ templates, selectedTemplate, onTemplateSelect, friendName, isProcessing, onGenerate }) => (
  <div className="text-center">
    <h2 className="text-2xl font-semibold mb-4 text-white">Choose Template</h2>
    <p className="text-gray-300 mb-6">Select a birthday message template:</p>
    
    <div className="space-y-4 mb-6">
      {templates.map((template) => (
        <div
          key={template.id}
          onClick={() => onTemplateSelect(template)}
          className={`p-4 border rounded-2xl cursor-pointer transition-all duration-300 ${
            selectedTemplate.id === template.id
              ? 'border-yellow-500 bg-gradient-to-br from-gray-800 to-gray-900 shadow-gold'
              : 'border-gray-600 bg-gray-800 hover:border-gray-500 shadow-dark'
          }`}
        >
          <h3 className="font-semibold mb-2 text-yellow-400">{template.name}</h3>
          <p className="text-sm text-gray-300">
            {template.template.replace('{friendName}', friendName || '[Friend\'s Name]')}
          </p>
        </div>
      ))}
    </div>
    
    <button
      onClick={onGenerate}
      disabled={isProcessing}
      className="px-8 py-4 bg-gradient-to-br from-yellow-400 to-yellow-600 text-black rounded-2xl font-bold hover:shadow-gold-hover transition-all duration-300 transform hover:scale-105 border border-yellow-500 shadow-gold disabled:opacity-50 disabled:transform-none"
    >
      {isProcessing ? 'Generating...' : 'Generate Wish 🎉'}
    </button>
  </div>
);

const ResultStep = ({ friendName, selectedTemplate, generatedAudio, isPlayingAudio, isProcessing, onPlay, onDownload, onRegenerate, onReset }) => (
  <div className="text-center">
    <h2 className="text-2xl font-semibold mb-4 text-white">🎉 Birthday Wish Ready!</h2>
    <p className="text-gray-300 mb-6">
      Your personalized birthday wish for <strong className="text-yellow-400">{friendName}</strong> is ready!
    </p>
    
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl mb-6 border border-gray-700 shadow-dark-inset">
      <h3 className="font-semibold mb-3 text-yellow-400">Preview Message:</h3>
      <p className="text-sm italic text-gray-300">
        "{selectedTemplate.template.replace('{friendName}', friendName)}"
      </p>
    </div>
    
    <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
      <button
        onClick={onPlay}
        disabled={isPlayingAudio || !generatedAudio}
        className="px-6 py-3 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-2xl font-bold hover:shadow-gold-hover transition-all duration-300 transform hover:scale-105 border border-green-400 shadow-dark disabled:opacity-50 disabled:transform-none"
      >
        {isPlayingAudio ? '🔊 Playing...' : '▶️ Play Wish'}
      </button>
      
      <button
        onClick={onDownload}
        disabled={!generatedAudio}
        className="px-6 py-3 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl font-bold hover:shadow-gold-hover transition-all duration-300 transform hover:scale-105 border border-blue-400 shadow-dark disabled:opacity-50 disabled:transform-none"
      >
        📥 Download
      </button>
      
      <button
        onClick={onRegenerate}
        disabled={isProcessing}
        className="px-6 py-3 bg-gradient-to-br from-yellow-400 to-yellow-600 text-black rounded-2xl font-bold hover:shadow-gold-hover transition-all duration-300 transform hover:scale-105 border border-yellow-500 shadow-gold disabled:opacity-50 disabled:transform-none"
      >
        {isProcessing ? '🔄 Regenerating...' : '🔄 Regenerate'}
      </button>
      
      <button
        onClick={onReset}
        className="px-6 py-3 bg-gradient-to-br from-gray-600 to-gray-700 text-white rounded-2xl font-bold hover:shadow-dark transition-all duration-300 transform hover:scale-105 border border-gray-500 shadow-dark"
      >
        🆕 Create Another
      </button>
    </div>
  </div>
);

export default BirthdayWisher;