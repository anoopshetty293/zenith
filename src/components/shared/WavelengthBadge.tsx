import clsx from 'clsx';
import type { Wavelength } from '../../types/nodes';

const WAVELENGTH_COLORS: Record<number, string> = {
  850: 'bg-red-900/30 text-red-300 border-red-800/40',
  1064: 'bg-emerald-900/30 text-emerald-300 border-emerald-800/40',
  1550: 'bg-cyan-900/30 text-fsoc-cyan border-fsoc-cyan/30',
};

interface WavelengthBadgeProps {
  wavelength: Wavelength;
  selected?: boolean;
  onClick?: () => void;
}

export default function WavelengthBadge({ wavelength, selected, onClick }: WavelengthBadgeProps) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-mono tracking-wider transition-all',
        WAVELENGTH_COLORS[wavelength] ?? 'bg-gray-900/30 text-gray-300 border-gray-700',
        selected && 'ring-1 ring-fsoc-cyan ring-offset-1 ring-offset-fsoc-panel',
        onClick && 'hover:brightness-125 cursor-pointer',
        !onClick && 'cursor-default'
      )}
    >
      {wavelength} nm
    </button>
  );
}

export function WavelengthCompatibility({
  wavelengthsA,
  wavelengthsB,
  selected,
  onSelect,
}: {
  wavelengthsA: Wavelength[];
  wavelengthsB: Wavelength[];
  selected: Wavelength | null;
  onSelect?: (w: Wavelength) => void;
}) {
  const common = wavelengthsA.filter(w => wavelengthsB.includes(w));

  if (common.length === 0) {
    return (
      <div className="rounded border border-fsoc-red/40 bg-red-950/20 p-2">
        <div className="text-[10px] font-mono text-fsoc-red font-semibold uppercase tracking-wider mb-1">
          NO COMPATIBLE WAVELENGTH
        </div>
        <div className="text-[9px] font-mono text-red-400 mb-1">LINK CANNOT BE ESTABLISHED</div>
        <div className="text-[9px] font-mono text-fsoc-dim">
          Node A: {wavelengthsA.map(w => `${w}nm`).join(', ')}<br />
          Node B: {wavelengthsB.map(w => `${w}nm`).join(', ')}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded border border-fsoc-green/20 bg-fsoc-green/5 p-2">
      <div className="text-[9px] font-mono text-fsoc-dim uppercase tracking-wider mb-1.5">Compatible Wavelengths</div>
      <div className="flex flex-wrap gap-1">
        {common.map(w => (
          <WavelengthBadge
            key={w}
            wavelength={w}
            selected={selected === w}
            onClick={onSelect ? () => onSelect(w) : undefined}
          />
        ))}
      </div>
      {onSelect && selected && (
        <div className="mt-1.5 text-[9px] font-mono text-fsoc-cyan">Selected: {selected} nm</div>
      )}
    </div>
  );
}
