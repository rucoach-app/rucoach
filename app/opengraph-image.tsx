import { ImageResponse } from "next/og";

export const alt = "RU Coach | Entrenamiento Personalizado de Élite";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background:
            "radial-gradient(circle at 85% 20%, rgba(245, 158, 11, 0.24), transparent 48%), radial-gradient(circle at 15% 85%, rgba(245, 158, 11, 0.14), transparent 45%), #09090b",
          color: "#fafafa",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        {/* Top brand bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "14px",
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#09090b",
                fontSize: "24px",
                fontWeight: 900,
                letterSpacing: "-0.04em",
              }}
            >
              RU
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: "24px",
                  fontWeight: 900,
                  letterSpacing: "-0.02em",
                  color: "#fafafa",
                }}
              >
                RU Coach
              </span>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#f59e0b",
                }}
              >
                Rodrigo Urbina
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 20px",
              borderRadius: "999px",
              border: "1px solid rgba(245, 158, 11, 0.35)",
              background: "rgba(245, 158, 11, 0.12)",
              color: "#fbbf24",
              fontSize: "16px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            rucoach.app
          </div>
        </div>

        {/* Center headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
            maxWidth: "920px",
          }}
        >
          <div
            style={{
              fontSize: "62px",
              fontWeight: 900,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              color: "#ffffff",
            }}
          >
            Entrenamiento Personalizado y Progreso Medible
          </div>
          <div
            style={{
              fontSize: "26px",
              fontWeight: 500,
              lineHeight: 1.4,
              color: "#a1a1aa",
            }}
          >
            Rutinas a tu medida, control de cargas, récords personales y seguimiento continuo con tu coach.
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255,255,255,0.12)",
            paddingTop: "24px",
            fontSize: "18px",
            color: "#d4d4d8",
            fontWeight: 600,
          }}
        >
          <span>Progresión Inteligente · Historial · Récords 1RM</span>
          <span style={{ color: "#fbbf24", fontWeight: 800 }}>
            Fuerza &amp; Hipertrofia
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
