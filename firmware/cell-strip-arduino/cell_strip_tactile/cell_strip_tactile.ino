/*
 * isVisible Cell-Strip Tactile Firmware (Phase 3)
 *
 * Drives a strip of N braille cells (N = CELL_COUNT, default 4, up to 8)
 * from 74HC595 shift registers daisy-chained on three pins, reads the same
 * compact protocol as the single-cell sketch, and additionally reports
 * physical navigation buttons and a braille keyboard over the same serial
 * wire as `IN` lines.
 *
 * Wiring
 * ------
 *   DATA_PIN  -> 74HC595 #0 SER (pin 14)
 *   CLOCK_PIN -> 74HC595 #0 SRCLK (pin 11)
 *   LATCH_PIN -> 74HC595 #0 RCLK (pin 12)
 *   Q7'       -> next register's SER (daisy chain)
 *   Nav buttons (active-low, 10k pull-up to VCC):
 *     prev   -> PREV_PIN
 *     next   -> NEXT_PIN
 *     select -> SELECT_PIN
 *   Braille keyboard (active-low, 10k pull-up):
 *     dot 1-8 -> DOT_KEY_PINS[0..7], space -> SPACE_PIN
 *
 * Output wire (115200 baud, newline-terminated lines):
 *   "isVisible cell-strip firmware ready (4 cells)"
 *   "OK F <index>"        after each frame
 *   "OK END"              after END
 *   "OK CFG"              after a valid CFG
 *   "IN key=prev|next|select|enter"
 *   "IN braille=<mask>"   dot keyboard, only in braille input mode
 *
 * The mask bit order matches the compact protocol: dot 1 = bit 0 ... dot 8 =
 * bit 7. Six-dot cells on a register simply never set bits 6/7.
 */

const byte CELL_COUNT = 4; // 1..8 — each cell is one daisy-chained 74HC595

const byte DATA_PIN = 2;
const byte CLOCK_PIN = 3;
const byte LATCH_PIN = 4;

const byte PREV_PIN = 5;
const byte NEXT_PIN = 6;
const byte SELECT_PIN = 7;

// Braille keyboard: dot 1..8 then space. All active-low with pull-ups.
const byte DOT_KEY_PINS[8] = {8, 9, 10, 11, 12, 13, A0, A1};
const byte SPACE_PIN = A2;

const unsigned long DEFAULT_HOLD_MS = 900;
const unsigned long MIN_HOLD_MS = 100;
const unsigned long MAX_HOLD_MS = 5000;
const size_t LINE_MAX = 128;
const size_t QUEUE_CAPACITY = 16;

const unsigned long DEBOUNCE_MS = 25;

String lineBuffer;

String queue[QUEUE_CAPACITY];
size_t queueHead = 0;
size_t queueTail = 0;
size_t queueSize = 0;
bool batchAborted = false;

unsigned long holdMs = DEFAULT_HOLD_MS;
bool blankBetweenFrames = true;
bool brailleInputMode = false;

bool holdActive = false;
unsigned long holdEndMillis = 0;
bool blankWhenHoldEnds = false;

// One byte per cell — the current dot pattern for every register.
byte cellMasks[CELL_COUNT];

// Edge detection for the braille keyboard and nav buttons.
bool prevNavState[3] = {true, true, true};
bool prevDotState[8] = {true, true, true, true, true, true, true, true};
bool prevSpaceState = true;
byte prevDots = 0;

void setup() {
  Serial.begin(115200);

  pinMode(DATA_PIN, OUTPUT);
  pinMode(CLOCK_PIN, OUTPUT);
  pinMode(LATCH_PIN, OUTPUT);
  pinMode(PREV_PIN, INPUT_PULLUP);
  pinMode(NEXT_PIN, INPUT_PULLUP);
  pinMode(SELECT_PIN, INPUT_PULLUP);
  pinMode(SPACE_PIN, INPUT_PULLUP);
  for (byte i = 0; i < 8; i++) {
    pinMode(DOT_KEY_PINS[i], INPUT_PULLUP);
  }

  latchCells();
  Serial.print("isVisible cell-strip firmware ready (");
  Serial.print(CELL_COUNT);
  Serial.println(" cells)");
}

void loop() {
  drainSerial();
  finishHoldIfDue();
  processNextLineIfIdle();
  pollInputs();
}

// ---------------------------------------------------------------------------
// Serial receive — same strict handling as the single-cell sketch
// ---------------------------------------------------------------------------

void drainSerial() {
  while (Serial.available() > 0) {
    char ch = static_cast<char>(Serial.read());

    if (ch == '\n') {
      lineBuffer.trim();
      if (lineBuffer.length() > 0) {
        enqueueLine(lineBuffer);
      }
      lineBuffer = "";
    } else if (ch != '\r') {
      if (lineBuffer.length() < LINE_MAX) {
        lineBuffer += ch;
      } else {
        abortBatch("ERR line too long, batch aborted");
        lineBuffer = "";
      }
    }
  }
}

void enqueueLine(const String& line) {
  if (batchAborted) {
    if (line == "END") {
      batchAborted = false;
      Serial.println("ERR batch aborted; resynced at END");
    }
    return;
  }

  if (queueSize >= QUEUE_CAPACITY) {
    abortBatch("ERR queue full, batch aborted");
    return;
  }
  queue[queueTail] = line;
  queueTail = (queueTail + 1) % QUEUE_CAPACITY;
  queueSize++;
}

void clearQueue() {
  for (size_t i = 0; i < QUEUE_CAPACITY; i++) {
    queue[i] = "";
  }
  queueHead = 0;
  queueTail = 0;
  queueSize = 0;
}

void abortBatch(const char* message) {
  clearQueue();
  holdActive = false;
  blankWhenHoldEnds = false;
  batchAborted = true;
  zeroCells();
  Serial.println(message);
}

void finishHoldIfDue() {
  if (!holdActive) return;
  if (static_cast<long>(millis() - holdEndMillis) < 0) return;

  if (blankWhenHoldEnds) {
    zeroCells();
  }
  holdActive = false;
}

void processNextLineIfIdle() {
  if (holdActive || queueSize == 0) return;

  String line = queue[queueHead];
  queue[queueHead] = "";
  queueHead = (queueHead + 1) % QUEUE_CAPACITY;
  queueSize--;

  handleLine(line);
}

void handleLine(const String& line) {
  if (line.startsWith("#")) {
    return;
  }
  if (line.startsWith("CFG ")) {
    handleConfig(line);
    return;
  }
  if (line == "B") {
    zeroCells();
    return;
  }
  if (line == "END") {
    zeroCells();
    Serial.println("OK END");
    return;
  }
  if (line.startsWith("F ")) {
    handleFrame(line);
    return;
  }
  Serial.print("ERR unknown command: ");
  Serial.println(line);
}

// CFG accepts the single-cell tokens plus `input_mode=0|1` (strip extension).
void handleConfig(const String& line) {
  bool sawHold = false;
  bool sawBlank = false;
  unsigned long nextHold = holdMs;
  bool nextBlank = blankBetweenFrames;
  bool nextInputMode = brailleInputMode;

  int pos = 4;
  while (pos < line.length()) {
    int nextSpace = line.indexOf(' ', pos);
    String token = nextSpace >= 0 ? line.substring(pos, nextSpace) : line.substring(pos);
    token.trim();
    pos = nextSpace >= 0 ? nextSpace + 1 : line.length();

    if (token.length() == 0) continue;

    int eq = token.indexOf('=');
    if (eq <= 0 || eq == token.length() - 1) {
      Serial.print("ERR bad CFG token: ");
      Serial.println(token);
      return;
    }

    String key = token.substring(0, eq);
    String value = token.substring(eq + 1);
    if (key == "hold_ms") {
      unsigned long parsed = 0;
      if (!parseUnsignedStrict(value, parsed) || parsed < MIN_HOLD_MS || parsed > MAX_HOLD_MS) {
        Serial.println("ERR hold_ms must be an integer from 100 to 5000");
        return;
      }
      nextHold = parsed;
      sawHold = true;
    } else if (key == "blank") {
      if (value == "0") {
        nextBlank = false;
      } else if (value == "1") {
        nextBlank = true;
      } else {
        Serial.println("ERR blank must be 0 or 1");
        return;
      }
      sawBlank = true;
    } else if (key == "input_mode") {
      if (value == "0") {
        nextInputMode = false;
      } else if (value == "1") {
        nextInputMode = true;
      } else {
        Serial.println("ERR input_mode must be 0 or 1");
        return;
      }
    } else {
      Serial.print("ERR unknown CFG key: ");
      Serial.println(key);
      return;
    }
  }

  if (!sawHold || !sawBlank) {
    Serial.println("ERR CFG requires hold_ms and blank");
    return;
  }

  holdMs = nextHold;
  blankBetweenFrames = nextBlank;
  brailleInputMode = nextInputMode;
  Serial.println("OK CFG");
}

void handleFrame(const String& line) {
  int firstSpace = line.indexOf(' ');
  int secondSpace = line.indexOf(' ', firstSpace + 1);
  int thirdSpace = line.indexOf(' ', secondSpace + 1);

  if (firstSpace < 0 || secondSpace < 0 || thirdSpace < 0) {
    Serial.println("ERR malformed frame");
    return;
  }

  unsigned long frameIndex = 0;
  unsigned long cellStart = 0;
  if (!parseUnsignedStrict(line.substring(firstSpace + 1, secondSpace), frameIndex)) {
    Serial.println("ERR frame index must be a non-negative integer");
    return;
  }
  if (!parseUnsignedStrict(line.substring(secondSpace + 1, thirdSpace), cellStart)) {
    Serial.println("ERR cellStart must be a non-negative integer");
    return;
  }

  byte masks[CELL_COUNT];
  byte maskCount = 0;

  int maskPos = thirdSpace + 1;
  while (maskPos < line.length()) {
    int nextSpace = line.indexOf(' ', maskPos);
    String maskText = nextSpace >= 0 ? line.substring(maskPos, nextSpace) : line.substring(maskPos);
    maskText.trim();
    maskPos = nextSpace >= 0 ? nextSpace + 1 : line.length();

    if (maskText.length() == 0) continue;

    unsigned long parsedMask = 0;
    if (!parseUnsignedStrict(maskText, parsedMask) || parsedMask > 255) {
      Serial.println("ERR mask must be an integer from 0 to 255");
      return;
    }
    if (maskCount < CELL_COUNT) {
      masks[maskCount] = static_cast<byte>(parsedMask);
      maskCount++;
    }
  }

  if (maskCount == 0) {
    Serial.println("ERR frame requires at least one mask");
    return;
  }

  // Write masks into the cell array starting at cellStart. Masks that fall
  // past the physical cell count are ignored (the host should not send them,
  // but a longer-than-strip frame must not wrap around).
  for (byte i = 0; i < maskCount; i++) {
    unsigned long target = cellStart + i;
    if (target < CELL_COUNT) {
      cellMasks[target] = masks[i];
    }
  }

  latchCells();
  Serial.print("OK F ");
  Serial.println(frameIndex);

  holdActive = true;
  holdEndMillis = millis() + holdMs;
  blankWhenHoldEnds = blankBetweenFrames;
}

// ---------------------------------------------------------------------------
// Shift-register output
// ---------------------------------------------------------------------------

void zeroCells() {
  for (byte i = 0; i < CELL_COUNT; i++) {
    cellMasks[i] = 0;
  }
  latchCells();
}

void latchCells() {
  digitalWrite(LATCH_PIN, LOW);
  // Daisy chain: shift out the last cell first so cell 0 ends up in the
  // register wired closest to DATA_PIN.
  for (int i = CELL_COUNT - 1; i >= 0; i--) {
    shiftOut(DATA_PIN, CLOCK_PIN, MSBFIRST, cellMasks[i]);
  }
  digitalWrite(LATCH_PIN, HIGH);
}

// ---------------------------------------------------------------------------
// Physical input — nav buttons and braille keyboard
// ---------------------------------------------------------------------------

// Read an active-low pin with a small debounce settle.
bool readDebounced(byte pin, unsigned long settleMs) {
  bool low = digitalRead(pin) == LOW;
  if (low) {
    delay(settleMs);
    low = digitalRead(pin) == LOW;
  }
  return low;
}

void pollInputs() {
  bool navPressed[3] = {
    readDebounced(PREV_PIN, DEBOUNCE_MS),
    readDebounced(NEXT_PIN, DEBOUNCE_MS),
    readDebounced(SELECT_PIN, DEBOUNCE_MS),
  };

  for (byte i = 0; i < 3; i++) {
    bool pressed = navPressed[i];
    if (pressed && !prevNavState[i]) {
      continue; // ignore auto-repeat on a held button
    }
    if (pressed != prevNavState[i]) {
      prevNavState[i] = pressed;
      if (pressed) {
        const char* name = (i == 0) ? "prev" : (i == 1) ? "next" : "select";
        Serial.print("IN key=");
        Serial.println(name);
      }
    }
  }

  pollBrailleKeyboard();
}

void pollBrailleKeyboard() {
  // Dot keys: only meaningful in braille input mode.
  byte currentDots = 0;
  for (byte i = 0; i < 8; i++) {
    bool pressed = readDebounced(DOT_KEY_PINS[i], DEBOUNCE_MS);
    if (pressed) {
      currentDots |= (1 << i);
    }
    if (pressed != prevDotState[i]) {
      prevDotState[i] = pressed;
    }
  }

  if (brailleInputMode) {
    bool spacePressed = readDebounced(SPACE_PIN, DEBOUNCE_MS);
    if (spacePressed != prevSpaceState) {
      prevSpaceState = spacePressed;
      if (spacePressed) {
        Serial.println("IN key=enter");
      }
    }
    // Report the current mask on any dot-key state change (the mask is the
    // 8-dot bit pattern exactly as a braille cell would carry it).
    if (currentDots != prevDots) {
      prevDots = currentDots;
      Serial.print("IN braille=");
      Serial.println(currentDots);
    }
  } else {
    prevSpaceState = true;
    prevDots = 0;
  }
}

// ---------------------------------------------------------------------------
// Strict unsigned integer parsing (shared with the single-cell sketch)
// ---------------------------------------------------------------------------

bool parseUnsignedStrict(String value, unsigned long& out) {
  value.trim();
  if (value.length() == 0) return false;

  unsigned long result = 0;
  for (unsigned int i = 0; i < value.length(); i++) {
    char ch = value.charAt(i);
    if (ch < '0' || ch > '9') return false;
    unsigned long digit = static_cast<unsigned long>(ch - '0');
    if (result > (4294967295UL - digit) / 10UL) return false;
    result = result * 10UL + digit;
  }

  out = result;
  return true;
}
