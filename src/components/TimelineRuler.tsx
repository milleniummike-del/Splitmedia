import React from 'react';
import { formatSeconds, formatDurationLabel } from '../utils/formatters.ts';
import { SplitConfig } from '../types.ts';
import { Plus, X } from 'lucide-react';

interface TimelineRulerProps {
  totalDuration: number;
  currentTime: number;
  config: SplitConfig;
  activeSegmentIndex: number | null;
  onSelectSegment: (start: number, end: number, index: number) => void;
  onAddCustomCutPoint?: (time: number) => void;
  onRemoveCustomCutPoint?: (time: number) => void;
}

export const TimelineRuler: React.FC<TimelineRulerProps> = ({
  totalDuration,
  currentTime,
  config,
  activeSegmentIndex,
  onSelectSegment,
  onAddCustomCutPoint,
  onRemoveCustomCutPoint,
}) => {
  if (totalDuration <= 0) return null;

  // Calculate segment breakdown for visual ruler
  interface VisualSegment {
    index: number;
    start: number;
    end: number;
    duration: number;
  }

  const segments: VisualSegment[] = [];

  if (config.mode === 'fixed') {
    const interval = Math.max(0.5, config.intervalSeconds || 10);
    let curr = 0;
    let idx = 0;
    while (curr < totalDuration) {
      const next = Math.min(curr + interval, totalDuration);
      if (next - curr < 0.15 && segments.length > 0) {
        segments[segments.length - 1].end = totalDuration;
        segments[segments.length - 1].duration = totalDuration - segments[segments.length - 1].start;
        break;
      }
      segments.push({
        index: idx,
        start: curr,
        end: next,
        duration: next - curr,
      });
      curr = next;
      idx++;
    }
  } else if (config.mode === 'equal') {
    const parts = Math.max(2, Math.min(50, config.equalPartsCount || 2));
    const interval = totalDuration / parts;
    for (let i = 0; i < parts; i++) {
      const start = i * interval;
      const end = i === parts - 1 ? totalDuration : (i + 1) * interval;
      segments.push({
        index: i,
        start,
        end,
        duration: end - start,
      });
    }
  } else if (config.mode === 'custom') {
    const sorted = [...config.customCutPoints]
      .filter((pt) => pt > 0 && pt < totalDuration)
      .sort((a, b) => a - b);
    let last = 0;
    let idx = 0;
    for (const pt of sorted) {
      segments.push({
        index: idx,
        start: last,
        end: pt,
        duration: pt - last,
      });
      last = pt;
      idx++;
    }
    segments.push({
      index: idx,
      start: last,
      end: totalDuration,
      duration: totalDuration - last,
    });
  }

  const playheadPercent = (currentTime / totalDuration) * 100;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-200">Segment Layout Timeline</span>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-400 font-mono">
            {segments.length} {segments.length === 1 ? 'piece' : 'pieces'} generated
          </span>
        </div>
        <div className="text-zinc-500 text-[11px]">
          Click any segment block to jump playhead
        </div>
      </div>

      {/* Visual Track Container */}
      <div className="relative h-16 w-full rounded-lg bg-zinc-950 border border-zinc-800/80 overflow-hidden flex shadow-inner group">
        {/* Playhead indicator across segments */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-30 pointer-events-none shadow-[0_0_10px_rgba(251,191,36,0.9)]"
          style={{ left: `${Math.min(100, Math.max(0, playheadPercent))}%` }}
        />

        {/* Segments */}
        {segments.map((seg, idx) => {
          const widthPercent = (seg.duration / totalDuration) * 100;
          const isActive = activeSegmentIndex === seg.index;
          const isEven = idx % 2 === 0;

          return (
            <div
              key={seg.index}
              onClick={() => onSelectSegment(seg.start, seg.end, seg.index)}
              style={{ width: `${widthPercent}%` }}
              className={`h-full border-r border-zinc-700/80 relative cursor-pointer select-none transition-all flex flex-col justify-between p-1.5 shrink-0 ${
                isActive
                  ? 'bg-amber-500/25 ring-2 ring-inset ring-amber-400 z-20'
                  : isEven
                  ? 'bg-zinc-900/90 hover:bg-zinc-800/90'
                  : 'bg-zinc-900/50 hover:bg-zinc-800/70'
              }`}
              title={`Part ${seg.index + 1}: ${formatSeconds(seg.start)} - ${formatSeconds(seg.end)} (${formatDurationLabel(seg.duration)})`}
            >
              {/* Part Label & Duration */}
              <div className="flex items-center justify-between pointer-events-none truncate text-[11px] leading-tight">
                <span className={`font-semibold truncate ${isActive ? 'text-amber-300' : 'text-zinc-300'}`}>
                  P{seg.index + 1}
                </span>
                <span className="font-mono text-[10px] text-zinc-500 hidden sm:inline">
                  {formatDurationLabel(seg.duration)}
                </span>
              </div>

              {/* Time boundary stamp */}
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pointer-events-none">
                <span>{formatSeconds(seg.start)}</span>
                <span className="truncate text-right">{formatSeconds(seg.end)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom Cut Marker Management (when custom mode is selected) */}
      {config.mode === 'custom' && (
        <div className="mt-3 pt-3 border-t border-zinc-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onAddCustomCutPoint?.(currentTime)}
              className="px-2.5 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-black font-semibold flex items-center gap-1.5 transition-all text-xs active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Split Point at Playhead ({formatSeconds(currentTime, true)})
            </button>
            <span className="text-zinc-400 text-[11px]">
              Or scrub the video and click to place split points
            </span>
          </div>

          {/* List of custom points */}
          {config.customCutPoints.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-zinc-500 text-[11px]">Markers:</span>
              {config.customCutPoints
                .slice()
                .sort((a, b) => a - b)
                .map((pt) => (
                  <span
                    key={pt}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[11px] border border-zinc-700"
                  >
                    <span>{formatSeconds(pt, true)}</span>
                    <button
                      onClick={() => onRemoveCustomCutPoint?.(pt)}
                      className="text-zinc-400 hover:text-red-400"
                      title="Remove marker"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
