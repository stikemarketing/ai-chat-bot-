"use client";

export default function SentryExamplePage() {
  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Sentry test page</h1>
      <p>Click the button below to send a test error to Sentry.</p>
      <button
        style={{
          padding: "12px 20px",
          borderRadius: 8,
          background: "#c1123f",
          color: "white",
          border: "none",
          cursor: "pointer",
          fontSize: 16,
        }}
        onClick={async () => {
          await fetch("/api/sentry-example-api");
          throw new Error("Sentry test error (client-side)");
        }}
      >
        Send test error
      </button>
    </div>
  );
}
