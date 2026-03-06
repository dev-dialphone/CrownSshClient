import React, { useState, useEffect, useRef } from 'react';
import { Search, Server, X } from 'lucide-react';
import { useEnvStore } from '../store/envStore';
import { VM } from '../types';

const API_URL = import.meta.env.VITE_API_URL || '';

// Simple in-memory search cache
const searchCache = new Map<string, VM[]>();

export const GlobalSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VM[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const { selectEnvironment } = useEnvStore();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      const trimmedQuery = query.trim();
      if (trimmedQuery.length > 1) {
        // Check cache first
        if (searchCache.has(trimmedQuery)) {
          setResults(searchCache.get(trimmedQuery)!);
          setIsOpen(true);
          return;
        }

        setLoading(true);
        try {
          const res = await fetch(`${API_URL}/api/vms?search=${encodeURIComponent(trimmedQuery)}`);
          if (res.ok) {
            const { data } = await res.json();
            setResults(data);
            searchCache.set(trimmedQuery, data); // Cache results
            setIsOpen(true);
          }
        } catch (error) {
          console.error('Search failed', error);
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
        setIsOpen(false);
      }
    }, 150);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleSelect = (vm: VM) => {
    if (vm.environmentId) {
      selectEnvironment(vm.environmentId);
    }
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={searchRef}>
      <div className="relative">
        <Search className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 text-zinc-500" size={18} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search VMs by name, IP, username..."
          aria-label="Search virtual machines"
          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-10 md:pl-12 pr-10 md:pr-12 py-3 md:py-3.5 text-sm md:text-base text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600"
          autoFocus
        />
        {query && (
          <button 
            onClick={() => setQuery('')}
            className="absolute right-3 md:right-4 top-1/2 transform -translate-y-1/2 text-zinc-500 hover:text-white p-1"
            aria-label="Clear search"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-zinc-500 text-sm" role="status" aria-live="polite">Searching...</div>
          ) : results.length > 0 ? (
            <ul>
              {results.map((vm) => (
                <li key={vm.id}>
                  <button
                    onClick={() => handleSelect(vm)}
                    className="w-full text-left p-3 md:p-4 hover:bg-zinc-800 flex items-center gap-3 border-b border-zinc-800/50 last:border-0 first:rounded-t-xl last:rounded-b-xl"
                  >
                    <Server size={18} className="text-blue-500 shrink-0" />
                    <div className="overflow-hidden">
                      <div className="font-medium text-sm md:text-base truncate text-white">{vm.name || 'VM'}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center text-zinc-500 text-sm" role="status" aria-live="polite">No VMs found matching "{query}"</div>
          )}
        </div>
      )}
    </div>
  );
};
