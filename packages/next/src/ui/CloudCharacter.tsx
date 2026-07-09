// The built-in kawaii cloud companion. Pure CSS + inline SVG — no assets, no
// dependencies. It is designed to be dropped into GlimProvider's `character`
// prop, where it rides the same positioned/rotated/scaled transform wrapper as
// the default orb (flight rotation, breathing swoop, scale). All of this
// component's own animation is transform/opacity only, so it never triggers
// host-page layout. The warm glow halo behind the body is what keeps the cloud
// legible against both light and dark host pages.
//
// The stylesheet for these classes lives in theme.ts (.glim-cloud-*), injected
// into the same shadow root as the orb styles.
export function CloudCharacter() {
  return (
    <div className="glim-cloud">
      {/* Warm radial bloom behind the body — the orb's halo idea, in yellow. */}
      <div className="glim-cloud-glow" />

      {/* Cloud body: classic three-lobe silhouette drawn as one filled path so
          the lobes read as a single soft shape. Big center-left dome, smaller
          right dome, wide rounded base. */}
      <svg
        className="glim-cloud-body"
        viewBox="0 0 72 56"
        width="72"
        height="56"
        aria-hidden="true"
        focusable="false"
      >
        <path
          className="glim-cloud-fill"
          d="
            M20 50
            C10 50 4 44 4 36
            C4 29 9 24 15 23
            C15 14 22 8 30 8
            C37 8 43 12 45 19
            C47 18 49 17 52 17
            C60 17 66 23 66 31
            C68 32 70 35 70 39
            C70 45 65 50 58 50
            Z
          "
        />

        {/* Cream highlight ellipse on the upper-left of the body, slightly rotated. */}
        <ellipse
          className="glim-cloud-highlight"
          cx="21"
          cy="22"
          rx="9"
          ry="5"
          transform="rotate(-24 21 22)"
        />

        {/* Peach blush ellipses, outside-under each eye. */}
        <ellipse className="glim-cloud-blush" cx="24" cy="39" rx="5" ry="3.2" />
        <ellipse className="glim-cloud-blush" cx="46" cy="39" rx="5" ry="3.2" />

        {/* Near-black vertical-oval eyes. */}
        <ellipse className="glim-cloud-eye" cx="28" cy="33" rx="2.4" ry="4.2" />
        <ellipse className="glim-cloud-eye" cx="42" cy="33" rx="2.4" ry="4.2" />

        {/* Small open smile: a dark rounded half-mouth. */}
        <path
          className="glim-cloud-smile"
          d="M31 40 Q35 45 39 40"
          fill="none"
        />
      </svg>

      {/* Antenna: short stem angled up-right from the top-right lobe, golden ball
          on the end. Kept as separate positioned elements so the ball can be its
          own glowing dot. */}
      <div className="glim-cloud-antenna" />
      <div className="glim-cloud-antenna-ball" />
    </div>
  )
}
