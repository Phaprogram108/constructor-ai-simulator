import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "PHA - Convertimos consultas en ventas para tu constructora";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #0a0f1e 0%, #111d3a 40%, #1a2a52 70%, #0d1528 100%)",
          padding: "60px 80px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Subtle accent line at top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, transparent 0%, #3b82f6 30%, #60a5fa 50%, #3b82f6 70%, transparent 100%)",
          }}
        />

        {/* Brand name */}
        <div
          style={{
            display: "flex",
            fontSize: 28,
            fontWeight: 600,
            color: "#60a5fa",
            letterSpacing: "4px",
            textTransform: "uppercase",
            marginBottom: "32px",
          }}
        >
          Programa PHA
        </div>

        {/* Main headline */}
        <div
          style={{
            display: "flex",
            fontSize: 52,
            fontWeight: 700,
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 1.2,
            marginBottom: "28px",
            maxWidth: "900px",
          }}
        >
          Convertimos consultas en ventas para tu constructora
        </div>

        {/* Subtitle */}
        <div
          style={{
            display: "flex",
            fontSize: 24,
            fontWeight: 400,
            color: "#94a3b8",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          IA + Publicidad + CRM — Un equipo dedicado a tu empresa
        </div>

        {/* Bottom accent dots */}
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            display: "flex",
            gap: "8px",
          }}
        >
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#3b82f6" }} />
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#60a5fa" }} />
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#3b82f6" }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
