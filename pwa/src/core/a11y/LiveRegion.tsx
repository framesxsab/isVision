import { useEffect, useState } from "react";

export function TranscriptRegion({ messages }: { messages: string[] }) {
  const [live, setLive] = useState("");

  useEffect(() => {
    if (messages.length === 0) return;
    setLive(messages[messages.length - 1] ?? "");
  }, [messages]);

  return (
    <>
      <div aria-live="polite" aria-atomic="true" role="status" className="sr-only">
        {live}
      </div>
      <ol aria-label="Transcript" className="sr-only">
        {messages.map((m, i) => (
          <li key={i}>{m}</li>
        ))}
      </ol>
    </>
  );
}
