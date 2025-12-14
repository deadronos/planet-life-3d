# Requirements — Planet Life 3D

## EARS-style Acceptance Requirements

1. WHEN the user loads the app, THE SYSTEM SHALL show a 3D planet with an overlay grid and Leva controls [Acceptance: visible planet, overlay texture, controls accessible].

2. WHEN the user changes birth/survive digits, THE SYSTEM SHALL update the simulation rules without page reload [Acceptance: cell behaviour updated on subsequent ticks].

3. WHEN the user clicks the planet, THE SYSTEM SHALL fire a meteor that seeds the grid on impact with the current seed pattern [Acceptance: meteor appears, impact ring shows, grid cells update].

4. WHEN a user chooses 'Custom ASCII', THE SYSTEM SHALL parse the ASCII and apply offsets to seed patterns [Acceptance: parsed offsets match expected coordinates].

5. WHEN the planet is rendered, THE SYSTEM SHALL expose controls to adjust rim glow and terminator strength so the sphere depth cues become visible [Acceptance: Leva folder toggles change the halo/terminator appearance in the scene].

6. WHEN cell state changes over time, THE SYSTEM SHALL offer a visualizer mode that encodes age or neighbor stress via color gradients [Acceptance: switching the mode re-colors alive cells without breaking simulation updates].

7. WHEN a meteor impacts the planet, THE SYSTEM SHALL render a streak, a flash, and an expanding ring with user-tunable styling [Acceptance: clicking the planet shows the streak in flight and both flash + ring on impact].
5. WHEN the user selects 'Random Disk', THE SYSTEM SHALL generate a disk-shaped seeding area scaled by `seedScale` and apply it at the impact point [Acceptance: seeded cells count and distribution approximate a disk shape].
