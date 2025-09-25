import React from 'react';

const ProcessingStatus = ({ isProcessing, processingStep, error }) => {
  if (error) {
    return (
      <div className="mt-6 bg-gradient-to-br from-red-900 to-red-800 border border-red-500 rounded-2xl p-4 shadow-dark">
        <div className="flex items-center justify-center">
          <svg className="h-5 w-5 text-red-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-red-400 font-semibold">{error}</span>
        </div>
      </div>
    );
  }

  if (!isProcessing || !processingStep) {
    return null;
  }

  return (
    <div className="mt-6 bg-gradient-to-br from-gray-800 to-gray-900 border border-yellow-500 rounded-2xl p-4 shadow-gold">
      <div className="flex items-center justify-center">
        <svg className="animate-spin h-5 w-5 text-yellow-400 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-yellow-400 font-semibold">{processingStep}</span>
      </div>
    </div>
  );
};

export default ProcessingStatus;
