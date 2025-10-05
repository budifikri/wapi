import { Suspense } from 'react';
import HomeContent from './home-content';

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4">
            <div className="h-8 w-8 animate-spin text-blue-500 inline-block">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="h-full w-full">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          </div>
          <h2 className="text-xl font-semibold">Loading...</h2>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}