const byte DOT_PINS[6] = {2, 3, 4, 5, 6, 7};
const unsigned long DEFAULT_HOLD_MS = 900;
const size_t LINE_MAX = 96;
const size_t QUEUE_CAPACITY = 12;

String lineBuffer;

// Ring buffer of pending command lines parsed off the serial wire.
// Lines are dequeued and executed only when no frame hold is active.
String queue[QUEUE_CAPACITY];
size_t queueHead = 0;
size_t queueTail = 0;
size_t queueSize = 0;
bool queueDropped = false;

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
      }
    }
  }
}

void enqueueLine(const String& line) {
  if (queueSize >= QUEUE_CAPACITY) {
    if (!queueDropped) {
      Serial.println("ERR queue full, dropping lines");
      queueDropped = true;
    }
    return;
  }
  queue[queueTail] = line;
  queueTail = (queueTail + 1) % QUEUE_CAPACITY;
  queueSize++;
  queueDropped = false;
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
  int holdIndex = line.indexOf("hold_ms=");
  if (holdIndex >= 0) {
    int start = holdIndex + 8;
    int end = line.indexOf(' ', start);
    String value = end >= 0 ? line.substring(start, end) : line.substring(start);
    holdMs = max(100UL, min(5000UL, static_cast<unsigned long>(value.toInt())));
  }

  int blankIndex = line.indexOf("blank=");
  if (blankIndex >= 0) {
    int start = blankIndex + 6;
    blankBetweenFrames = line.substring(start, start + 1) == "1";
  }

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

  int frameIndex = line.substring(firstSpace + 1, secondSpace).toInt();
  int maskEnd = line.indexOf(' ', thirdSpace + 1);
  String maskText = maskEnd >= 0 ? line.substring(thirdSpace + 1, maskEnd) : line.substring(thirdSpace + 1);
  int mask = constrain(maskText.toInt(), 0, 63);

  setMask(static_cast<byte>(mask));
  Serial.print("OK F ");
  Serial.println(frameIndex);

  holdActive = true;
  holdEndMillis = millis() + holdMs;
  blankWhenHoldEnds = blankBetweenFrames;
}

void setMask(byte mask) {
  for (byte dot = 0; dot < 6; dot++) {
    bool raised = (mask & (1 << dot)) != 0;
    digitalWrite(DOT_PINS[dot], raised ? HIGH : LOW);
  }
}
