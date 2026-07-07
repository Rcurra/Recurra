// Shared background atmosphere for app screens — the landing's depth
// treatment, tuned down for the product: whisper-faint corner tints, a fine
// dot grid that fades away from the edges, and a soft top light. You feel
// it more than you see it; the canvas stops reading as dead flat.
export function Ambient() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute rounded-full"
        style={{
          top: '-12%',
          left: '-10%',
          width: 560,
          height: 560,
          background: 'rgba(87,230,176,0.05)',
          filter: 'blur(130px)',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          bottom: '-16%',
          right: '-10%',
          width: 520,
          height: 520,
          background: 'rgba(167,139,250,0.06)',
          filter: 'blur(140px)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.5,
          backgroundImage: 'radial-gradient(circle, rgba(232,237,242,0.05) 1px, transparent 1px)',
          backgroundSize: '30px 30px',
          maskImage: 'radial-gradient(ellipse 70% 70% at 50% 45%, transparent 25%, black 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at 50% 45%, transparent 25%, black 100%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(167,139,250,0.04) 0%, transparent 40%)' }}
      />
    </div>
  );
}
