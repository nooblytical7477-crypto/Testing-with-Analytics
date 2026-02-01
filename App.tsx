import { Analytics } from "@vercel/analytics/react";
import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { ImageUploader } from './components/ImageUploader';
import { CameraCapture } from './components/CameraCapture';
import { Button } from './components/Button';
import { generateFutureSelf } from './services/geminiService';
import { AppState } from './types';

// Helper to resize image and convert to Base64
// This is crucial for Vercel Serverless functions which have a 4.5MB body size limit.
const resizeImage = (file: File, maxWidth = 1024, maxHeight = 1024, quality = 0.8): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Get Base64, remove prefix
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };
      img.onerror = (error) => reject(new Error("Failed to load image for resizing"));
    };
    reader.onerror = (error) => reject(new Error("Failed to read file"));
  });
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setAppState(AppState.PREVIEW);
  };

  const handleCameraCapture = (file: File) => {
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setAppState(AppState.PREVIEW);
  };

  const handleGenerate = async () => {
    if (!selectedFile || !prompt.trim()) return;

    setAppState(AppState.GENERATING);
    setError(null);

    try {
      // Resize and compress image before sending to API to avoid payload limits
      let base64;
      try {
        base64 = await resizeImage(selectedFile);
      } catch (resizeError) {
        throw new Error("Failed to process image. Please try a different photo.");
      }

      // We always send as jpeg after resizing
      const mimeType = 'image/jpeg';
      
      const resultUrl = await generateFutureSelf(base64, mimeType, prompt);
      
      setGeneratedImage(resultUrl);
      setAppState(AppState.RESULT);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to generate image. Please try again.");
      setAppState(AppState.PREVIEW);
    }
  };

  const resetApp = () => {
    setAppState(AppState.IDLE);
    setSelectedFile(null);
    setPreviewUrl(null);
    setGeneratedImage(null);
    setPrompt('');
    setError(null);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        
        {/* Header Section */}
        <div className="text-center mb-6 md:mb-10 px-2">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 mb-3 tracking-tight">
            Plan your retirement <span className="text-[#c02126] block sm:inline">right here right now</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
            Upload your photo, describe your ideal lifestyle, and let us visualize your future self.
          </p>
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl overflow-hidden border border-slate-100 flex flex-col relative transition-all duration-500 min-h-[400px]">
          
          {/* STEP 1: UPLOAD or CAMERA */}
          {appState === AppState.IDLE && (
            <div className="flex-grow flex flex-col items-center justify-center p-6 md:p-8 animate-fade-in">
              <ImageUploader 
                onFileSelect={handleFileSelect} 
                onCameraSelect={() => setAppState(AppState.CAPTURING)} 
              />
            </div>
          )}

          {/* STEP 2: CAMERA CAPTURE */}
          {appState === AppState.CAPTURING && (
            <div className="flex-grow flex flex-col items-center justify-center p-0 md:p-4 bg-black animate-fade-in h-[500px] md:h-auto">
              <CameraCapture 
                onCapture={handleCameraCapture} 
                onCancel={() => setAppState(AppState.IDLE)} 
              />
            </div>
          )}

          {/* STEP 3: PREVIEW & PROMPT */}
          {appState === AppState.PREVIEW && previewUrl && (
            <div className="flex-grow flex flex-col md:flex-row animate-fade-in">
              <div className="w-full md:w-1/2 bg-slate-50 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-200 p-4 md:p-6">
                <div className="relative group w-full max-w-sm">
                   <img 
                    src={previewUrl} 
                    alt="Current You" 
                    className="w-full h-auto max-h-[400px] rounded-lg shadow-md object-contain mx-auto" 
                  />
                  <button 
                    onClick={resetApp}
                    className="absolute top-2 right-2 bg-[#c02126] text-white p-2 rounded-full shadow-lg hover:bg-red-700 transition-colors"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
              </div>

              <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col justify-center">
                <h3 className="text-xl md:text-2xl font-bold text-slate-800 mb-4">Your Vision</h3>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="prompt" className="block text-sm font-medium text-slate-700 mb-1">
                      Where do you see yourself?
                    </label>
                    <textarea
                      id="prompt"
                      rows={5}
                      className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#c02126] focus:border-transparent resize-none bg-white text-gray-900 placeholder-gray-400 text-base"
                      placeholder="e.g. Traveling through Tuscany, enjoying a vineyard tour, looking stylish and relaxed..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
                      {error}
                    </div>
                  )}

                  <div className="space-y-3 pt-2">
                    <Button 
                      onClick={handleGenerate} 
                      fullWidth 
                      disabled={!prompt.trim()}
                    >
                      Generate Vision
                    </Button>
                    <Button 
                      onClick={resetApp} 
                      variant="outline" 
                      fullWidth
                    >
                      Start Over
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: GENERATING */}
          {appState === AppState.GENERATING && (
            <div className="flex-grow flex flex-col items-center justify-center p-8 md:p-12 text-center animate-fade-in min-h-[400px]">
              <div className="relative w-20 h-20 md:w-24 md:h-24 mb-6">
                <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-[#c02126] rounded-full border-t-transparent animate-spin"></div>
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-slate-800 mb-2">Creating your future...</h3>
              <p className="text-sm md:text-base text-slate-500 max-w-md px-4">
                We are visualizing your prompt "{prompt}" with your future self. <br className="hidden md:block" />Please wait a moment.
              </p>
            </div>
          )}

          {/* STEP 5: RESULT */}
          {appState === AppState.RESULT && generatedImage && previewUrl && (
            <div className="flex-grow flex flex-col animate-fade-in">
              <div className="flex-grow p-4 md:p-6 flex flex-col md:flex-row gap-6 items-center justify-center">
                
                {/* Result Image */}
                <div className="relative group w-full max-w-md">
                    <div className="absolute -inset-1 bg-gradient-to-r from-[#c02126] via-red-500 to-orange-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                    <div className="relative bg-white rounded-xl shadow-lg overflow-hidden border border-slate-100">
                        <img 
                          src={generatedImage} 
                          alt="Future Self" 
                          className="w-full h-auto object-cover"
                        />
                    </div>
                </div>

                <div className="w-full max-w-xs space-y-4">
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                        <h4 className="text-xs font-bold text-[#c02126] uppercase tracking-widest mb-1">Scenario</h4>
                        <p className="text-slate-700 italic text-sm">"{prompt}"</p>
                    </div>
                    
                    <a 
                      href={generatedImage} 
                      download="my-vision.png"
                      className="block w-full"
                    >
                      <Button fullWidth>Download Image</Button>
                    </a>
                    
                    <Button onClick={resetApp} variant="outline" fullWidth>
                      New Vision
                    </Button>
                </div>

              </div>
            </div>
          )}
        </div>
        
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 text-center px-4">
             <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                <div className="text-[#c02126] text-2xl mb-2">📸</div>
                <h4 className="font-semibold text-slate-800">1. Add Photo</h4>
                <p className="text-sm text-slate-500">Upload or take a photo</p>
             </div>
             <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                <div className="text-[#c02126] text-2xl mb-2">💭</div>
                <h4 className="font-semibold text-slate-800">2. Dream It</h4>
                <p className="text-sm text-slate-500">Describe your ideal future</p>
             </div>
             <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                <div className="text-[#c02126] text-2xl mb-2">✨</div>
                <h4 className="font-semibold text-slate-800">3. Visualize</h4>
                <p className="text-sm text-slate-500">See your future self</p>
             </div>
        </div>

      </div>
         <Analytics />
    </Layout>
  );
};

export default App;
