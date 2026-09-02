// What a lap of a crossfaded loop makes back of what it was handed, said in
// words. Its own module rather than a second export off the component, so a
// hot update to either still refreshes.

export function loopTripSays(signed: number, zoom: number | undefined): string {
  // The mixer loop's trim goes negative: the return comes back inverted, so a
  // region alternates polarity frame to frame and edges buzz. What decides
  // whether it builds is still how much of itself a lap makes back, which is
  // the magnitude — the sign only says which way up it arrives.
  const trip = Math.abs(signed)
  const flips = signed < 0 ? ', inverting' : ''
  if (trip < 0.75) {
    // 1/(1-trip) laps to fall to 1/e, which at these numbers is a smear a few
    // frames deep rather than anything that accumulates.
    return `decays in about ${Math.max(1, Math.round(1 / (1 - trip)))} frames${flips}`
  }
  if (trip < 0.98) {
    return `just under — trails hold, structure does not build${flips}`
  }
  if (trip <= 1.02) {
    return `at the edge — patterns persist${flips}`
  }
  // Above unity the camera loop's transport decides whether there is a picture:
  // expanding spreads what it gains over the whole raster and pins it white
  // within a second, collapsing concentrates it into a shrinking core while the
  // surround is refreshed from the live picture, and holds. Measured in
  // docs/CURATION.md. The mixer loop has no zoom and so no such escape.
  if (zoom !== undefined && zoom >= 1) {
    return `building, and expanding — this walks to white${flips}`
  }
  return `building${flips}`
}
