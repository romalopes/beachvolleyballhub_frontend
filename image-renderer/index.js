import express from 'express';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

let browser = null;

async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return browser;
}

async function renderShareCard(snapshotData, outputPath) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    await page.setViewportSize({ width: 2400, height: 1260 });
    await page.setDeviceScaleFactor(2);
    
    const html = generateHTML(snapshotData);
    
    await page.setContent(html, { waitUntil: 'networkidle' });
    
    await page.waitForFunction(() => {
      const images = document.querySelectorAll('img');
      return Array.from(images).every(img => img.complete);
    }, { timeout: 10000 }).catch(() => {});
    
    await page.screenshot({ 
      path: outputPath, 
      type: 'png',
      clip: { x: 0, y: 0, width: 2400, height: 1260 }
    });
    
    return true;
  } finally {
    await page.close();
  }
}

function generateHTML(snapshot) {
  const { location_name, forecast_target_time, timezone, current, forecast, volleyball, public_url } = snapshot;
  const targetTime = forecast_target_time || new Date().toISOString();
  
  const forecastDay = forecast.find((d) => d.date === targetTime.split('T')[0]) || forecast[0];
  
  const rainChance = current?.rain_chance_percent ?? forecastDay?.rain_chance_percent ?? null;
  const temp = current?.feels_like_c ?? current?.temperature_c ?? forecastDay?.average_temp_c ?? null;
  const condition = current?.condition ?? forecastDay?.condition ?? 'Unknown';
  const iconUrl = current?.icon_url ?? forecastDay?.icon_url ?? null;
  const wind = current?.wind_kph ?? forecastDay?.max_wind_kph ?? null;
  const windDir = current?.wind_direction ?? forecastDay?.max_wind_direction ?? null;
  const gust = current?.wind_gust_kph ?? null;
  const humidity = current?.humidity_percent ?? null;
  const uv = current?.uv_index ?? null;
  
  function formatTime(isoString, tz) {
    if (!isoString) return 'Current';
    try {
      const date = new Date(isoString);
      return date.toLocaleString(undefined, {
        timeZone: tz || undefined,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  }
  
  function metric(value, format) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return '–';
    }
    return format(value);
  }
  
  function severityClass(label) {
    return `weather-advisor--${label.toLowerCase().replace(/\\s+/g, '-')}`;
  }
  
  const formattedTime = formatTime(forecast_target_time, timezone);
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .weather-share-card {
      width: 1200px;
      height: 630px;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      border-radius: 16px;
      padding: 32px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1e293b;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-sizing: border-box;
    }
    .weather-share-card__header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .weather-share-card__brand { display: flex; align-items: center; gap: 12px; }
    .weather-share-card__logo { flex-shrink: 0; }
    .weather-share-card__title { font-size: 24px; font-weight: 700; color: #0066cc; letter-spacing: -0.02em; }
    .weather-share-card__time { text-align: right; }
    .weather-share-card__label { display: block; font-size: 12px; font-weight: 500; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .weather-share-card__value { font-size: 18px; font-weight: 600; color: #1e293b; }
    .weather-share-card__location { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
    .weather-share-card__location-icon { font-size: 20px; }
    .weather-share-card__location-name { font-size: 20px; font-weight: 600; color: #1e293b; }
    .weather-share-card__main { display: flex; gap: 32px; margin-bottom: 20px; }
    .weather-share-card__condition { flex: 0 0 200px; display: flex; flex-direction: column; align-items: center; text-align: center; }
    .weather-share-card__icon { width: 96px; height: 96px; margin-bottom: 8px; }
    .weather-share-card__temp-row { display: flex; flex-direction: column; gap: 4px; }
    .weather-share-card__temperature { font-size: 48px; font-weight: 700; color: #1e293b; line-height: 1; }
    .weather-share-card__condition-text { font-size: 16px; color: #475569; font-weight: 500; }
    .weather-share-card__metrics { flex: 1; display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .weather-share-card__metric { background: white; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); }
    .weather-share-card__metric-icon { font-size: 20px; }
    .weather-share-card__metric-label { font-size: 12px; font-weight: 500; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .weather-share-card__metric-value { font-size: 20px; font-weight: 600; color: #1e293b; }
    .weather-share-card__gust { font-size: 11px; color: #ef4444; font-weight: 500; margin-top: 4px; }
    .weather-share-card__advisor { border-radius: 12px; padding: 20px; margin-bottom: 16px; background: white; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); }
    .weather-share-card__advisor--excellent { border-left: 4px solid #22c55e; }
    .weather-share-card__advisor--good { border-left: 4px solid #84cc16; }
    .weather-share-card__advisor--fair { border-left: 4px solid #eab308; }
    .weather-share-card__advisor--poor { border-left: 4px solid #f97316; }
    .weather-share-card__advisor--unsuitable { border-left: 4px solid #ef4444; }
    .weather-share-card__advisor-score { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
    .weather-share-card__advisor-label { font-size: 20px; font-weight: 700; color: #1e293b; }
    .weather-share-card__advisor-value { font-size: 14px; color: #475569; }
    .weather-share-card__advisor-note { font-size: 11px; color: #94a3b8; margin: 0 0 12px 0; }
    .weather-share-card__warnings { margin: 0 0 12px 0; }
    .weather-share-card__warning { font-size: 12px; color: #ef4444; margin: 0 0 6px 0; line-height: 1.4; }
    .weather-share-card__advice { margin: 0; padding-left: 20px; font-size: 12px; color: #475569; line-height: 1.6; }
    .weather-share-card__advice li { margin-bottom: 4px; }
    .weather-share-card__footer { display: flex; justify-content: space-between; align-items: center; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; }
    .weather-share-card__url { font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; background: #f1f5f9; padding: 4px 8px; border-radius: 4px; word-break: break-all; max-width: 60%; }
    .weather-share-card__attribution { display: flex; gap: 8px; align-items: center; }
    .weather-share-card__attribution a { color: #0066cc; text-decoration: none; }
  </style>
</head>
<body>
  <div class="weather-share-card ${severityClass(volleyball.label)}">
    <div class="weather-share-card__header">
      <div class="weather-share-card__brand">
        <svg class="weather-share-card__logo" viewBox="0 0 120 120" width="48" height="48" aria-hidden="true">
          <circle cx="60" cy="60" r="58" fill="#0066cc" />
          <text x="60" y="72" textAnchor="middle" fontSize="50" fontWeight="bold" fill="white" fontFamily="system-ui, sans-serif">🏐</text>
        </svg>
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
        ${iconUrl ? `<img src="${iconUrl}" alt="" class="weather-share-card__icon" width="96" height="96" />` : ''}
        <div class="weather-share-card__temp-row">
          <span class="weather-share-card__temperature">${metric(temp, (v) => Math.round(v) + '°C')}</span>
          <span class="weather-share-card__condition-text">${escapeHtml(condition)}</span>
        </div>
      </div>

      <div class="weather-share-card__metrics">
        <div class="weather-share-card__metric">
          <span class="weather-share-card__metric-icon" aria-hidden="true">💨</span>
          <span class="weather-share-card__metric-label">Wind</span>
          <span class="weather-share-card__metric-value">${metric(wind, (v) => Math.round(v) + ' km/h')}${windDir ? ' ' + windDir : ''}</span>
          ${gust && wind !== null && gust > wind && gust - wind > 15 ? `<span class="weather-share-card__gust">Gusts ${Math.round(gust)} km/h</span>` : ''}
        </div>

        <div class="weather-share-card__metric">
          <span class="weather-share-card__metric-icon" aria-hidden="true">🌧️</span>
          <span class="weather-share-card__metric-label">Rain</span>
          <span class="weather-share-card__metric-value">${metric(rainChance, (v) => Math.round(v) + '%')}</span>
        </div>

        <div class="weather-share-card__metric">
          <span class="weather-share-card__metric-icon" aria-hidden="true">☀️</span>
          <span class="weather-share-card__metric-label">UV Index</span>
          <span class="weather-share-card__metric-value">${metric(uv, (v) => v.toFixed(1))}</span>
        </div>

        <div class="weather-share-card__metric">
          <span class="weather-share-card__metric-icon" aria-hidden="true">💧</span>
          <span class="weather-share-card__metric-label">Humidity</span>
          <span class="weather-share-card__metric-value">${metric(humidity, (v) => Math.round(v) + '%')}</span>
        </div>
      </div>
    </div>

    <div class="weather-share-card__advisor ${severityClass(volleyball.label)}">
      <div class="weather-share-card__advisor-score">
        <span class="weather-share-card__advisor-label">${escapeHtml(volleyball.label)}</span>
        <span class="weather-share-card__advisor-value">${volleyball.score === null ? 'No data' : volleyball.score + '/100 for beach volleyball'}</span>
      </div>
      <p class="weather-share-card__advisor-note">Playing-suitability estimate for coaching — not an official safety rating.</p>

      ${volleyball.warnings.length > 0 ? `<div class="weather-share-card__warnings">${volleyball.warnings.map(w => `<p class="weather-share-card__warning" role="alert">⚠️ ${escapeHtml(w)}</p>`).join('')}</div>` : ''}

      ${volleyball.advice.length > 0 ? `<ul class="weather-share-card__advice">${volleyball.advice.map(tip => `<li>💡 ${escapeHtml(tip)}</li>`).join('')}</ul>` : ''}
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
  if (!text) return '';
  return text
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

app.post('/render', async (req, res) => {
  try {
    const { snapshot, outputPath } = req.body;
    
    if (!snapshot || !outputPath) {
      return res.status(400).json({ error: 'Missing snapshot or outputPath' });
    }
    
    await renderShareCard(snapshot, outputPath);
    res.json({ success: true, path: outputPath });
  } catch (error) {
    console.error('Render error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Image renderer listening on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});
