/**
 * The overlay the vision pipeline puts on the frame: corner
 * brackets and thirds guides. Drawn on a 100×100 grid so it scales
 * with whatever photograph sits underneath.
 */
export default function Viewfinder() {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <g stroke="rgba(250,248,244,0.22)" strokeWidth="0.14" vectorEffect="non-scaling-stroke">
        <line x1="33.3" y1="0" x2="33.3" y2="100" />
        <line x1="66.7" y1="0" x2="66.7" y2="100" />
        <line x1="0" y1="33.3" x2="100" y2="33.3" />
        <line x1="0" y1="66.7" x2="100" y2="66.7" />
      </g>
    </svg>
  );
}
