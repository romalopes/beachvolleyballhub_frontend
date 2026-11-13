import express from "express";
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

let browser = null;

async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
  }
  return browser;
}

async function renderShareCard(snapshotData, outputPath) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1344, height: 1260 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  try {
    const html = generateHTML(snapshotData);

    await page.setContent(html, { waitUntil: "networkidle" });

    await page
      .waitForFunction(
        () => {
          const images = document.querySelectorAll("img");
          return Array.from(images).every((img) => img.complete);
        },
        { timeout: 10000 },
      )
      .catch(() => {});

    await page.screenshot({
      path: outputPath,
      type: "png",
    });

    return true;
  } finally {
    await context.close();
  }
}

function generateHTML(snapshot) {
  const {
    location_name,
    forecast_target_time,
    timezone,
    current,
    forecast,
    volleyball,
    public_url,
  } = snapshot;
  const targetTime = forecast_target_time || new Date().toISOString();

  const forecastDay =
    forecast.find((d) => d.date === targetTime.split("T")[0]) || forecast[0];

  const rainChance =
    current?.rain_chance_percent ?? forecastDay?.rain_chance_percent ?? null;
  const temp =
    current?.feels_like_c ??
    current?.temperature_c ??
    forecastDay?.average_temp_c ??
    null;
  const condition = current?.condition ?? forecastDay?.condition ?? "Unknown";
  const iconUrl = current?.icon_url ?? forecastDay?.icon_url ?? null;
  const wind = current?.wind_kph ?? forecastDay?.max_wind_kph ?? null;
  const windDir =
    current?.wind_direction ?? forecastDay?.max_wind_direction ?? null;
  const gust = current?.wind_gust_kph ?? null;
  const humidity = current?.humidity_percent ?? null;
  const uv = current?.uv_index ?? null;

  function formatTime(isoString, tz) {
    if (!isoString) return "Current";
    try {
      const date = new Date(isoString);
      return date.toLocaleString(undefined, {
        timeZone: tz || undefined,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  }

  function metric(value, format) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return "–";
    }
    return format(value);
  }

  function severityClass(label) {
    return `weather-advisor--${label.toLowerCase().replace(/\s+/g, "-")}`;
  }

  const formattedTime = formatTime(forecast_target_time, timezone);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 1344px; height: 1260px; overflow: hidden; }
    .weather-share-card {
      width: 1344px;
      height: 1260px;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      border-radius: 32px;
      padding: 48px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1e293b;
      box-shadow: 0 8px 48px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.05);
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      overflow: hidden;
    }
    .weather-share-card__header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .weather-share-card__brand { display: flex; align-items: center; gap: 20px; }
    .weather-share-card__logo { flex-shrink: 0; }
    .weather-share-card__title { font-size: 44px; font-weight: 700; color: #0066cc; letter-spacing: -0.02em; }
    .weather-share-card__time { text-align: right; }
    .weather-share-card__label { display: block; font-size: 22px; font-weight: 500; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
    .weather-share-card__value { font-size: 32px; font-weight: 600; color: #1e293b; }
    .weather-share-card__location { display: flex; align-items: center; gap: 14px; margin-bottom: 28px; padding-bottom: 24px; border-bottom: 2px solid #e2e8f0; }
    .weather-share-card__location-icon { font-size: 36px; }
    .weather-share-card__location-name { font-size: 36px; font-weight: 600; color: #1e293b; }
    .weather-share-card__main { display: flex; gap: 32px; flex: 1; margin-bottom: 8px; }
    .weather-share-card__condition { flex: 0 0 360px; display: flex; flex-direction: column; align-items: center; text-align: center; }
    .weather-share-card__icon { width: 240px; height: 240px; margin-bottom: 12px; }
    .weather-share-card__temp-row { display: flex; flex-direction: column; gap: 4px; }
    .weather-share-card__temperature { font-size: 68px; font-weight: 700; color: #1e293b; line-height: 1; }
    .weather-share-card__condition-text { font-size: 24px; color: #475569; font-weight: 500; }
    .weather-share-card__metrics { flex: 1; display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
    .weather-share-card__metric { background: white; border-radius: 18px; padding: 17px; display: flex; flex-direction: column; gap: 7px; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05); }
    .weather-share-card__metric-top { display: flex; align-items: center; gap: 10px; }
    .weather-share-card__metric-icon { font-size: 28px; }
    .weather-share-card__metric-label { font-size: 18px; font-weight: 500; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .weather-share-card__metric-value { font-size: 25px; font-weight: 600; color: #1e293b; }
    .weather-share-card__gust { font-size: 16px; color: #ef4444; font-weight: 500; margin-top: 3px; }
    .weather-share-card__advisor { border-radius: 20px; padding: 40px; margin-bottom: 16px; background: white; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05); flex-shrink: 0; }
    .weather-share-card__advisor--excellent { border-left: 6px solid #22c55e; }
    .weather-share-card__advisor--good { border-left: 6px solid #84cc16; }
    .weather-share-card__advisor--fair { border-left: 6px solid #eab308; }
    .weather-share-card__advisor--poor { border-left: 6px solid #f97316; }
    .weather-share-card__advisor--unsuitable { border-left: 6px solid #ef4444; }
    .weather-share-card__advisor-score { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
    .weather-share-card__advisor-label { font-size: 48px; font-weight: 700; color: #1e293b; }
    .weather-share-card__advisor-value { font-size: 36px; color: #475569; }
    .weather-share-card__advisor-note { font-size: 18px; color: #94a3b8; margin: 0 0 20px 0; }
    .weather-share-card__warnings { margin: 0 0 20px 0; }
    .weather-share-card__warning { font-size: 28px; color: #ef4444; margin: 0 0 12px 0; line-height: 1.4; }
    .weather-share-card__advice { margin: 0; padding-left: 36px; font-size: 28px; color: #475569; line-height: 1.6; }
    .weather-share-card__advice li { margin-bottom: 8px; }
    .weather-share-card__footer { display: flex; justify-content: space-between; align-items: center; padding-top: 24px; border-top: 2px solid #e2e8f0; font-size: 20px; color: #94a3b8; flex-shrink: 0; }
    .weather-share-card__url { font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; background: #f1f5f9; padding: 8px 16px; border-radius: 8px; word-break: break-all; max-width: 60%; }
    .weather-share-card__attribution { display: flex; gap: 16px; align-items: center; }
    .weather-share-card__attribution a { color: #0066cc; text-decoration: none; }
    .weather-share-card__attribution a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="weather-share-card">
    <div class="weather-share-card__header">
      <div class="weather-share-card__brand">
        <img src="http://localhost:3002/ball.png" class="weather-share-card__logo" width="96" height="96" aria-hidden="true">
        <span class="weather-share-card__title">BeachVolleyballHub</span>
      </div>
      <div class="weather-share-card__time">
        <span class="weather-share-card__label">Forecast for</span>
        <span class="weather-share-card__value">${formattedTime}</span>
      </div>
    </div>

    <div class="weather-share-card__location">
      <span class="weather-share-card__location-icon" aria-hidden="true">📍</span>
      <span class="weather-share-card__location-name">${escapeHtml(location_name)}</span>
    </div>

    <div class="weather-share-card__main">
      <div class="weather-share-card__condition">
        ${iconUrl ? `<img src="${iconUrl}" alt="" class="weather-share-card__icon" width="384" height="384" />` : ""}
        <div class="weather-share-card__temp-row">
          <span class="weather-share-card__temperature">${metric(temp, (v) => Math.round(v) + "°C")}</span>
          <span class="weather-share-card__condition-text">${escapeHtml(condition)}</span>
        </div>
      </div>

      <div class="weather-share-card__metrics">
        <div class="weather-share-card__metric">
          <div class="weather-share-card__metric-top">
            <span class="weather-share-card__metric-icon" aria-hidden="true">💨</span>
            <span class="weather-share-card__metric-label">Wind</span>
          </div>
          <span class="weather-share-card__metric-value">${metric(wind, (v) => Math.round(v) + " km/h")}${windDir ? " " + windDir : ""}</span>
          ${gust && wind !== null && gust > wind && gust - wind > 15 ? `<span class="weather-share-card__gust">Gusts ${Math.round(gust)} km/h</span>` : ""}
        </div>

        <div class="weather-share-card__metric">
          <div class="weather-share-card__metric-top">
            <span class="weather-share-card__metric-icon" aria-hidden="true">🌧️</span>
            <span class="weather-share-card__metric-label">Rain</span>
          </div>
          <span class="weather-share-card__metric-value">${metric(rainChance, (v) => Math.round(v) + "%")}</span>
        </div>

        <div class="weather-share-card__metric">
          <div class="weather-share-card__metric-top">
            <span class="weather-share-card__metric-icon" aria-hidden="true">☀️</span>
            <span class="weather-share-card__metric-label">UV Index</span>
          </div>
          <span class="weather-share-card__metric-value">${metric(uv, (v) => v.toFixed(1))}</span>
        </div>

        <div class="weather-share-card__metric">
          <div class="weather-share-card__metric-top">
            <span class="weather-share-card__metric-icon" aria-hidden="true">💧</span>
            <span class="weather-share-card__metric-label">Humidity</span>
          </div>
          <span class="weather-share-card__metric-value">${metric(humidity, (v) => Math.round(v) + "%")}</span>
        </div>
      </div>
    </div>

    <div class="weather-share-card__advisor ${severityClass(volleyball.label)}">
      <div class="weather-share-card__advisor-score">
        <span class="weather-share-card__advisor-label">${escapeHtml(volleyball.label)}</span>
        <span class="weather-share-card__advisor-value">${volleyball.score === null ? "No data" : volleyball.score + "/100 for beach volleyball"}</span>
      </div>
      <p class="weather-share-card__advisor-note">Playing-suitability estimate for coaching — not an official safety rating.</p>

      ${volleyball.warnings.length > 0 ? `<div class="weather-share-card__warnings">${volleyball.warnings.map((w) => `<p class="weather-share-card__warning" role="alert">⚠️ ${escapeHtml(w)}</p>`).join("")}</div>` : ""}

      ${volleyball.advice.length > 0 ? `<ul class="weather-share-card__advice">${volleyball.advice.map((tip) => `<li>💡 ${escapeHtml(tip)}</li>`).join("")}</ul>` : ""}
    </div>

    <div class="weather-share-card__footer">
      <span class="weather-share-card__url">${escapeHtml(public_url)}</span>
      <span class="weather-share-card__attribution">Weather data: <a href="https://www.weatherapi.com/" target="_blank" rel="noopener noreferrer">WeatherAPI.com</a> · Warnings: <a href="https://www.bom.gov.au/" target="_blank" rel="noopener noreferrer">BOM</a></span>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

app.post("/render", async (req, res) => {
  try {
    const { snapshot, outputPath } = req.body;

    if (!snapshot || !outputPath) {
      return res.status(400).json({ error: "Missing snapshot or outputPath" });
    }

    await renderShareCard(snapshot, outputPath);
    res.json({ success: true, path: outputPath });
  } catch (error) {
    console.error("Render error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Image renderer listening on port ${PORT}`);
});

process.on("SIGTERM", async () => {
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});
