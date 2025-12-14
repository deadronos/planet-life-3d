export const SIM_DEFAULTS = {
  latCells: 48,
  lonCells: 96,
  planetRadius: 2.6,
  cellLift: 0.04,
};

export const SIM_CONSTRAINTS = {
  latCells: { min: 8, max: 256 },
  lonCells: { min: 8, max: 512 },
  planetRadius: { min: 0.1, max: 100 },
  cellLift: { min: 0, max: 10 },
};
