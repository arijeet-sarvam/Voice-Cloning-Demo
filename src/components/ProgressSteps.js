import React from 'react';

const ProgressSteps = ({ currentStep, totalSteps = 4 }) => {
  return (
    <div className="flex justify-between items-center mb-8">
      {Array.from({ length: totalSteps }, (_, index) => {
        const step = index + 1;
        return (
          <div key={step} className="flex items-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all duration-300 border ${
              currentStep >= step 
                ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black shadow-gold border-yellow-500' 
                : 'bg-gray-800 text-gray-400 shadow-dark border-gray-700'
            }`}>
              {step}
            </div>
            {step < totalSteps && (
              <div className={`w-16 h-1 mx-2 rounded-full ${
                currentStep > step 
                  ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 shadow-gold-sm' 
                  : 'bg-gray-700 shadow-dark-inset'
              }`}></div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ProgressSteps;
