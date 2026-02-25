import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Lock, Loader } from 'lucide-react';

const PinEntry: React.FC = () => {
  const { verifyPin } = useAuthStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const success = await verifyPin(pin);
    setIsLoading(false);
    if (success) {
      setError(false);
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white p-4">
      <div className="w-full max-w-xs space-y-8">
        <div className="flex flex-col items-center">
          <div className="bg-zinc-800 p-4 rounded-full mb-4">
            <Lock size={32} className="text-zinc-400" />
          </div>
          <h2 className="text-xl font-semibold text-zinc-100">Security Check</h2>
          <p className="text-sm text-zinc-500 mt-2">Enter PIN to access the dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <input
              type="password"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError(false);
              }}
              className={`w-full bg-zinc-900 border ${
                error ? 'border-red-500' : 'border-zinc-800'
              } rounded-lg px-4 py-3 text-center text-2xl tracking-widest focus:outline-none focus:border-blue-500 transition-colors`}
              placeholder="••••••"
              maxLength={6}
              autoFocus
              disabled={isLoading}
            />
          </div>
          
          {error && (
            <p className="text-red-500 text-xs text-center">Incorrect PIN. Please try again.</p>
          )}

          <button
            type="submit"
            disabled={isLoading || pin.length < 4}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader className="animate-spin" size={18} /> : null}
            {isLoading ? 'Verifying...' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PinEntry;
