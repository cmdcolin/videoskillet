// What the hover text adds about a press. A dim target drops the filter, and
// one that folds says which way it goes.
export const pressHint = (dim: boolean, fold: boolean, open: boolean) =>
  dim
    ? ' — outside the filter: click to drop it and open this stage'
    : fold
      ? open
        ? ' — click to close'
        : ' — click to open'
      : ''
