const byte DOT_PINS[6] = {2, 3, 4, 5, 6, 7};
const unsigned long DEFAULT_HOLD_MS = 900;
const unsigned long MIN_HOLD_MS = 100;
const unsigned long MAX_HOLD_MS = 5000;
const size_t LINE_MAX = 96;
const size_t QUEUE_CAPACITY = 12;

String lineBuffer;

// Ring buffer of pending command lines parsed off the serial wire.
// Lines are dequeued and executed only when no frame hold is active.
String queue[QUEUE_CAPACITY];
size_t queueHead = 0;
size_t queueTail = 0;
size_t queueSize = 0;
bool batchAborted = false;

unsigned long holdMs = DEFAULT_HOLD_MS;
bool blankBetweenFrames = true;

// Non-blocking frame hold state.
bool holdActive = false;
unsigned long holdEndMillis = 0;
bool blankWhenHoldEnds = false;

void setup() {
  Serial.begin(115200);

  for (byte i = 0; i < 6; i++) {
    pinMode(DOT_PINS[i], OUTPUT);
    digitalWrite(DOT_PINS[i], LOW);
  }

  Serial.println("isVisible single-cell tactile firmware ready");
}

void loop() {
  drainSerial();
  finishHoldIfDue();
  processNextLineIfIdle();
}

// Drains the hardware serial buffer on every loop tick so a long frame hold
// can never let the 64-byte AVR RX buffer overflow.
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
  setMask(0);
  Serial.println(message);
}

void finishHoldIfDue() {
  if (!holdActive) return;
  // Signed subtraction handles millis() rollover safely.
  if (static_cast<long>(millis() - holdEndMillis) < 0) return;

  if (blankWhenHoldEnds) {
    setMask(0);
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
    setMask(0);
    return;
  }

  if (line == "END") {
    setMask(0);
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

void handleConfig(const String& line) {
  bool sawHold = false;
  bool sawBlank = false;
  unsigned long nextHold = holdMs;
  bool nextBlank = blankBetweenFrames;

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
  unsigned long mask = 0;

  if (!parseUnsignedStrict(line.substring(firstSpace + 1, secondSpace), frameIndex)) {
    Serial.println("ERR frame index must be a non-negative integer");
    return;
  }
  if (!parseUnsignedStrict(line.substring(secondSpace + 1, thirdSpace), cellStart)) {
    Serial.println("ERR cellStart must be a non-negative integer");
    return;
  }

  int maskPos = thirdSpace + 1;
  bool sawMask = false;
  while (maskPos < line.length()) {
    int nextSpace = line.indexOf(' ', maskPos);
    String maskText = nextSpace >= 0 ? line.substring(maskPos, nextSpace) : line.substring(maskPos);
    maskText.trim();
    maskPos = nextSpace >= 0 ? nextSpace + 1 : line.length();

    if (maskText.length() == 0) continue;

    unsigned long parsedMask = 0;
    if (!parseUnsignedStrict(maskText, parsedMask) || parsedMask > 63) {
      Serial.println("ERR mask must be an integer from 0 to 63");
      return;
    }
    if (!sawMask) {
      mask = parsedMask;
    }
    sawMask = true;
  }

  if (!sawMask) {
    Serial.println("ERR frame requires at least one mask");
    return;
  }

  setMask(static_cast<byte>(mask));
  Serial.print("OK F ");
  Serial.println(frameIndex);

  holdActive = true;
  holdEndMillis = millis() + holdMs;
  blankWhenHoldEnds = blankBetweenFrames;
}

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

void setMask(byte mask) {
  for (byte dot = 0; dot < 6; dot++) {
    bool raised = (mask & (1 << dot)) != 0;
    digitalWrite(DOT_PINS[dot], raised ? HIGH : LOW);
  }
}
