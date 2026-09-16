import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { google } from "googleapis";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "5mb" }));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Gemini AI RF Assistant endpoint
app.post("/api/gemini-rf", async (req, res) => {
  try {
    const { prompt, context } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured." });
    }

    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = `You are an expert RF and microwave engineering AI assistant specialized in Smith Chart impedance matching, transmission lines, S-parameters, VSWR, and stub tuning. Provide clear, precise, and practical engineering advice, formulas, and step-by-step matching network recommendations.`;

    const fullPrompt = `Context:\n${JSON.stringify(context, null, 2)}\n\nUser Request: ${prompt}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: fullPrompt,
      config: {
        systemInstruction,
        temperature: 0.3,
      },
    });

    res.json({ result: response.text });
  } catch (error: any) {
    console.error("Gemini API error:", error);
    res.status(500).json({ error: error.message || "Failed to generate AI response." });
  }
});

// Google Sheets Live Calculation Template endpoint
app.post("/api/sheets/create-template", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization bearer token." });
    }
    const token = authHeader.split(" ")[1];
    const { z0 = 50, rLoad = 25, xLoad = 50 } = req.body;

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });

    const sheets = google.sheets({ version: "v4", auth: oauth2Client });

    // 1. Create a new Spreadsheet
    const createResponse = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: `Smith Chart Live Calculator - ${new Date().toISOString().slice(0, 10)}`,
        },
      },
    });

    const spreadsheetId = createResponse.data.spreadsheetId;
    const spreadsheetUrl = createResponse.data.spreadsheetUrl;

    if (!spreadsheetId) {
      throw new Error("Failed to create Google Spreadsheet.");
    }

    // 2. Populate spreadsheet with live formulas for Smith Chart calculations
    const values = [
      ["SMITH CHART LIVE CALCULATION SPREADSHEET"],
      ["", ""],
      ["System Parameters", "Value"],
      ["Characteristic Impedance (Z0) [Ohms]", z0],
      ["Load Resistance (R) [Ohms]", rLoad],
      ["Load Reactance (X) [Ohms]", xLoad],
      ["", ""],
      ["Normalized Impedance", "Formula / Calculated Value"],
      ["Normalized Resistance (r)", "=B5/B4"],
      ["Normalized Reactance (x)", "=B6/B4"],
      ["", ""],
      ["Reflection Coefficient (Gamma)", "Formula / Calculated Value"],
      ["Gamma Real (Gr)", "=(B9^2 + B10^2 - 1) / ((B9 + 1)^2 + B10^2)"],
      ["Gamma Imag (Gi)", "=(2 * B10) / ((B9 + 1)^2 + B10^2)"],
      ["Gamma Magnitude (|G|)", "=SQRT(B13^2 + B14^2)"],
      ["Gamma Phase (Degrees)", "=ATAN2(B13, B14) * 180 / PI()"],
      ["", ""],
      ["RF Performance Metrics", "Formula / Calculated Value"],
      ["VSWR", "=(1 + B15) / (1 - B15)"],
      ["Return Loss (S11) [dB]", "=-20 * LOG10(B15)"],
      ["Reflection Coefficient dB", "=20 * LOG10(B15)"],
      ["", ""],
      ["Matching Network Calculator (Series Component Addition)", ""],
      ["Step", "Component Type", "Input Value (nH / pF / Ohms)", "New Resistance (R_new)", "New Reactance (X_new)", "Resulting VSWR"],
      [1, "Series Inductor (nH)", 15, "=B5", "=B6 + (2 * PI() * 1e9 * (C25 * 1e-9)) / B4 * B4", "=(1 + SQRT(( (D25/B4-1)^2 + (E25/B4)^2 ) / ( (D25/B4+1)^2 + (E25/B4)^2 ))) / (1 - SQRT(( (D25/B4-1)^2 + (E25/B4)^2 ) / ( (D25/B4+1)^2 + (E25/B4)^2 )))"],
      [2, "Series Capacitor (pF)", 4.7, "=D25", "=E25 - (1 / (2 * PI() * 1e9 * (C26 * 1e-12) * B4)) * B4", "=(1 + SQRT(( (D26/B4-1)^2 + (E26/B4)^2 ) / ( (D26/B4+1)^2 + (E26/B4)^2 ))) / (1 - SQRT(( (D26/B4-1)^2 + (E26/B4)^2 ) / ( (D26/B4+1)^2 + (E26/B4)^2 )))"],
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Sheet1!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values,
      },
    });

    res.json({
      success: true,
      spreadsheetId,
      spreadsheetUrl,
    });
  } catch (error: any) {
    console.error("Google Sheets template creation error:", error);
    res.status(500).json({ error: error.message || "Failed to create Google Sheets template." });
  }
});

// Google Sheets Export endpoint
app.post("/api/sheets/export", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization bearer token." });
    }
    const token = authHeader.split(" ")[1];
    const { title, dataRows } = req.body;

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });

    const sheets = google.sheets({ version: "v4", auth: oauth2Client });

    // 1. Create a new Spreadsheet
    const createResponse = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: title || `Smith Chart Export - ${new Date().toISOString().slice(0, 10)}`,
        },
      },
    });

    const spreadsheetId = createResponse.data.spreadsheetId;
    const spreadsheetUrl = createResponse.data.spreadsheetUrl;

    if (!spreadsheetId) {
      throw new Error("Failed to create Google Spreadsheet.");
    }

    // 2. Format & Append Data Rows
    // dataRows is an array of arrays (or objects)
    const values = [
      ["Smith Chart Calculation Report"],
      ["Generated on:", new Date().toLocaleString()],
      [],
      ["Step", "Component / Action", "Value", "Normalized Impedance (r + jx)", "Reflection Coeff (Gamma)", "VSWR", "Return Loss (dB)"],
      ...dataRows,
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Sheet1!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values,
      },
    });

    res.json({
      success: true,
      spreadsheetId,
      spreadsheetUrl,
    });
  } catch (error: any) {
    console.error("Google Sheets export error:", error);
    res.status(500).json({ error: error.message || "Failed to export to Google Sheets." });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
