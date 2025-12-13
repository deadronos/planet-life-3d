# Planet Life 3D (Conway on a Sphere)

A 3D Conway-style cellular automaton that runs on a lat/lon grid wrapped onto a planet.
Click the planet to shoot a meteor. On impact it seeds the grid using a configurable pattern.

## Run

```bash
npm install
npm run dev
```

## Controls

- Orbit with mouse (right drag to pan, wheel zoom).
- Click the planet to fire a meteor at the clicked spot.
- Tune grid/rules/speed/meteor + seeding parameters via the Leva UI.

## Pre-commit hook (automatic formatting)

This repo uses lint-staged to automatically format and lint staged files before commit. A lightweight git hook lives in `.githooks/pre-commit` and runs `npm run format:staged` for JS/TS and other file types.

- Run `npm install` to install dependencies and configure the hook (the `postinstall` script runs `npm run install:hooks`).
- To install hooks manually, run `npm run install:hooks`.
- To format staged files manually, run `npm run format:staged`.

If you prefer not to use the hook, unset your local git hooks path with `git config --unset core.hooksPath`.
