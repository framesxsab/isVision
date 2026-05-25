# Research Notes

Research date: 2026-05-26

## What problem are we solving?

Blind and low-vision access is not a niche issue. WHO reports that globally at least 1 billion people have a near or distance vision impairment that could have been prevented or has not yet been addressed. WHO also reports that more than 2.5 billion people need one or more assistive products, and that access is still missing for many people, especially where cost and availability are barriers.

Sources:

- https://www.who.int/health-topics/blindness-and-vision-loss
- https://www.who.int/news-room/fact-sheets/detail/assistive-technology

## What already exists?

### Screen readers

Existing screen readers are mature and widely used. NVDA is free and open source on Windows. WebAIM's 2024 survey shows NVDA, JAWS, VoiceOver, Narrator, and Orca are all part of real users' workflows, and many users use more than one screen reader.

Sources:

- https://github.com/nvaccess/nvda
- https://webaim.org/projects/screenreadersurvey10/

### Braille output

Refreshable braille displays already work with computers and phones. Android TalkBack supports refreshable braille displays over Bluetooth or USB. Windows Narrator supports many braille displays. The USB-IF published a HID standard for braille displays so devices can work across hardware and operating systems with less custom driver work.

Sources:

- https://support.google.com/accessibility/android/answer/3535226
- https://support.microsoft.com/en-US/accessibility/windows/narrator/appendix-c-supported-braille-displays
- https://www.usb.org/sites/default/files/2018-08/usb-if_hid_press_release_final.pdf

### Tactile graphics and multiline braille

High-end tactile displays exist, but they are expensive:

- APH Monarch: 10 lines by 32 braille cells, tactile graphics plus braille, listed at USD 15,500.
- Dot Pad: tactile graphics and multiline braille, listed around USD 10,000 to 12,000.
- Bristol Braille Canute Console: 360-cell multiline braille, open-source oriented, listed from GBP 2,495 to 4,995 depending on package.

Sources:

- https://www.aph.org/product/monarch/
- https://www.dotincorp.com/en/product/pad
- https://bristolbraille.org/about-canute-console-the-next-generation-in-braille/

### Braille translation

Liblouis is the important open-source braille translator/back-translator to build around. We should not write our own production braille translator unless there is a very specific reason.

Source:

- https://liblouis.io/documentation/liblouis.html

### Surface haptics

Surface haptics can create programmable tactile sensations on touch surfaces, usually through vibrotactile, electrostatic, or ultrasonic effects. This is promising for orientation, edges, controls, texture cues, and training, but it is not the same as raised refreshable braille dots. A blind user needs stable, readable physical dot patterns for true braille reading.

Sources:

- https://arxiv.org/abs/2004.13864
- https://tanvas.co/technology

## Main insight

The meaningful gap is not "no accessibility exists." The gap is affordable, open, tactile access to spatial information:

- diagrams
- maps
- graphs
- tables
- math layouts
- code indentation
- UI layout
- dense documents

Speech is fast for many tasks, but it is not always enough for structure, spelling, math, programming, quiet environments, deafblind users, or learning braille.

## Recommended project path

Build an open tactile access platform in stages:

1. Software-first tactile renderer.
2. One-cell hardware prototype.
3. Multi-cell braille strip.
4. Simple tactile graphics pad.
5. OS/screen-reader integration.

Avoid starting with a full tactile tablet. That would consume time and money before proving the user workflow.

