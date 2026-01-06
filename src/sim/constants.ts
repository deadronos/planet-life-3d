export const SIM_DEFAULTS = {
  latCells: 100,
  lonCells: 160,
  planetRadius: 2.6,
  cellLift: 0.04,
};

export const SIM_CONSTRAINTS = {
  latCells: { min: 8, max: 2048 },
  lonCells: { min: 8, max: 4096 },
  planetRadius: { min: 0.1, max: 100 },
  cellLift: { min: 0, max: 10 },
};
