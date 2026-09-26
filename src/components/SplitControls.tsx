import React from 'react';
import { Scissors, Clock, Split, Sliders, ShieldCheck, Loader2 } from 'lucide-react';
import { SplitConfig, SplitMode } from '../types.ts';
import { formatDurationLabel } from '../utils/formatters.ts';

interface SplitControlsProps {
  totalDuration: number;
  config: SplitConfig;
  onChangeConfig: (newConfig: SplitConfig) => void;
  onExecuteSplit: () => void;
  isSplitting: boolean;
  calculatedPiecesCount: number;
}

export const SplitControls: React.FC<SplitControlsProps> = ({
  totalDuration,
  config,
  onChangeConfig,
  onExecuteSplit,
  isSplitting,
  calculatedPiecesCount,
}) => {
  const secondPresets = [
    { label: '15s', value: 15, hint: 'Stories' },
    { label: '20s', value: 20, hint: '20 sec' },
    { label: '30s', value: 30, hint: 'Reels / WA' },
    { label: '60s', value: 60, hint: '1 min' },
    { label: '90s', value: 90, hint: '1.5 min' },
    { label: '120s', value: 120, hint: '2 min' },
    { label: '300s', value: 300, hint: '5 min' },
  ];

  const handleModeChange = (mode: SplitMode) => {
    onChangeConfig({
      ...config,
      mode,
    });
  };

  const handleIntervalChange = (val: number) => {
    const valid = Math.max(0.5, Math.min(totalDuration, val));
    onChangeConfig({
      ...config,
      intervalSeconds: valid,
    });
  };

  const handleEqualPartsChange = (parts: number) => {
    const valid = Math.max(2, Math.min(50, parts));
    onChangeConfig({
      ...config,
      equalPartsCount: valid,
    });
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col gap-6">
      {/* Top: Mode Selection segmented control */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Scissors className="w-4 h-4 text-amber-400" />
            Split Configuration
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Set your duration interval in seconds
          </p>
        </div>

        {/* Mode switcher tabs */}
        <div className="flex items-center gap-1 p-1 bg-zinc-950 border border-zinc-800 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => handleModeChange('fixed')}
            className={`px-3 py-1.5 font-medium rounded-lg transition-all flex items-center gap-1.5 ${
              config.mode === 'fixed'
                ? 'bg-amber-500 text-black shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            By Seconds
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('equal')}
            className={`px-3 py-1.5 font-medium rounded-lg transition-all flex items-center gap-1.5 ${
              config.mode === 'equal'
                ? 'bg-amber-500 text-black shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Split className="w-3.5 h-3.5" />
            Equal Parts
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('custom')}
            className={`px-3 py-1.5 font-medium rounded-lg transition-all flex items-center gap-1.5 ${
              config.mode === 'custom'
                ? 'bg-amber-500 text-black shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Custom Markers
          </button>
        </div>
      </div>

      {/* Mode Specific Controls */}
      {config.mode === 'fixed' && (
        <div className="flex flex-col gap-4 bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Choice of Seconds per Piece:
            </label>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0.5"
                max={Math.ceil(totalDuration)}
                step="1"
                value={config.intervalSeconds}
                onChange={(e) => handleIntervalChange(parseFloat(e.target.value) || 1)}
                className="w-24 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
              <span className="text-xs font-mono text-zinc-400">seconds</span>
            </div>
          </div>

          {/* Quick Preset Buttons (Includes 15s, 20s, 30s, 60s, 90s, 120s, 300s) */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-zinc-500 mr-1">Quick Presets:</span>
            {secondPresets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => handleIntervalChange(preset.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 border ${
                  Math.abs(config.intervalSeconds - preset.value) < 0.1
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800'
                }`}
              >
                <span>{preset.label}</span>
                <span className="text-[10px] text-zinc-500">({preset.hint})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {config.mode === 'equal' && (
        <div className="flex flex-col gap-4 bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
              <Split className="w-4 h-4 text-amber-400" />
              Number of Equal Pieces:
            </label>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min="2"
                max="50"
                step="1"
                value={config.equalPartsCount}
                onChange={(e) => handleEqualPartsChange(parseInt(e.target.value, 10) || 2)}
                className="w-20 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
              <span className="text-xs text-zinc-400">parts</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[2, 3, 4, 5, 6, 8, 10].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleEqualPartsChange(num)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all border ${
                  config.equalPartsCount === num
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800'
                }`}
              >
                {num} parts (~{formatDurationLabel(totalDuration / num)})
              </button>
            ))}
          </div>
        </div>
      )}

      {config.mode === 'custom' && (
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-4 text-xs text-zinc-300">
          <p className="font-semibold text-white mb-1">Interactive Custom Markers</p>
          <p className="text-zinc-400">
            Click on the Timeline Ruler above to add split points wherever you like.
            Currently {config.customCutPoints.length} custom markers set ({config.customCutPoints.length + 1} pieces).
          </p>
        </div>
      )}

      {/* Browser-Side Engine & Split Execution */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-1 border-t border-zinc-800/80 text-xs">
        <div className="flex items-center gap-2 text-emerald-400">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span className="text-[11px] text-zinc-400">
            100% In-Browser Audio & Video Processing
          </span>
        </div>

        {/* Big Action Button */}
        <button
          onClick={onExecuteSplit}
          disabled={isSplitting || calculatedPiecesCount === 0}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-black font-bold text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:pointer-events-none"
        >
          {isSplitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-black" />
              <span>Generating Segments...</span>
            </>
          ) : (
            <>
              <Scissors className="w-4 h-4 text-black -rotate-45" />
              <span>
                Create {calculatedPiecesCount} {calculatedPiecesCount === 1 ? 'Piece' : 'Pieces'}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
