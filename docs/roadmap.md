# Roadmap

## Phase 0: Community and validation

Goal: avoid building the wrong thing.

- Interview blind and low-vision users, including braille readers and non-braille screen reader users.
- Ask about real workflows: reading, coding, studying, browsing, banking, maps, diagrams, forms, and messaging.
- Find at least 2 recurring problems where tactile output would clearly help.
- Define safety and comfort constraints for fingertip hardware.

Deliverable:

- User problem brief with real workflows and quotes.

## Phase 1: Software tactile renderer

Goal: make the data pipeline before hardware is scaled.

- Convert plain text into braille cells through Liblouis.
- Represent output as frames: cell index, dot pattern, cursor, and metadata.
- Add a simulated display view for sighted collaborators.
- Add export over serial for microcontrollers.
- Add keyboard-only controls and screen-reader-friendly UI.

Deliverable:

- Desktop/web prototype that can stream braille frames to a device emulator.

## Phase 2: One-cell tactile hardware

Goal: prove fingertip readability, actuation, latency, noise, heat, and durability.

- Build a 6-dot or 8-dot pin cell.
- Drive it from a microcontroller.
- Accept serial frames from the software renderer.
- Test cell recognition, comfort, and reading speed with users.

Deliverable:

- One readable refreshable braille cell.

## Phase 3: Four-to-eight-cell strip

Goal: make short words, numbers, commands, and status practical.

- Expand the hardware into multiple cells.
- Add physical navigation buttons.
- Add a braille input mode if the hardware supports it.
- Explore USB HID braille compatibility.

Deliverable:

- Small braille strip that can read text from the prototype app.

## Phase 4: Spatial tactile output

Goal: move beyond text.

- Convert simple SVG/bitmap diagrams into tactile lines and regions.
- Support charts, grids, maps, and math layouts.
- Evaluate whether pin-array hardware or hybrid haptics is realistic.

Deliverable:

- Low-resolution tactile graphics prototype.

## Phase 5: Integration

Goal: make the tool useful outside demos.

- Integrate with NVDA, BRLTTY/BrlAPI, Narrator, TalkBack, or VoiceOver where practical.
- Support common document formats.
- Package setup instructions for schools, makerspaces, and accessibility labs.

Deliverable:

- Reproducible open-source assistive technology kit.

