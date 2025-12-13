# Requirements — Planet Life 3D

## EARS-style Acceptance Requirements

1. WHEN the user loads the app, THE SYSTEM SHALL show a 3D planet with an overlay grid and Leva controls [Acceptance: visible planet, overlay texture, controls accessible].

2. WHEN the user changes birth/survive digits, THE SYSTEM SHALL update the simulation rules without page reload [Acceptance: cell behaviour updated on subsequent ticks].

3. WHEN the user clicks the planet, THE SYSTEM SHALL fire a meteor that seeds the grid on impact with the current seed pattern [Acceptance: meteor appears, impact ring shows, grid cells update].

4. WHEN a user chooses 'Custom ASCII', THE SYSTEM SHALL parse the ASCII and apply offsets to seed patterns [Acceptance: parsed offsets match expected coordinates].

