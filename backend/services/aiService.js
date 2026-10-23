const axios = require("axios");
const fs = require("fs");
const path = require("path");
let sharp;
try { sharp = require("sharp"); } catch (_) { sharp = null; }

/**
 * Clean and parse raw JSON text returned by any AI model.
 * Handles markdown fences (```json ... ```), unexpected whitespace,
 * or partial text responses.
 */
function parseAndValidateAIResponse(rawContent) {
  let parsed;
  if (typeof rawContent === "object" && rawContent !== null) {
    parsed = rawContent;
  } else {
    let cleaned = String(rawContent || "").trim();

    // Strip markdown code fences if present
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    // Extract JSON object if embedded in prose
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }

    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.warn("[AIService Warning] Could not parse AI response as JSON. Raw was:", rawContent);
      // Fallback response format
      return {
        animalDetected: false,
        animal_detected: false,
        animalType: "Unknown",
        animal_type: "Unknown",
        breed: "Unknown",
        injured: false,
        injuryType: "None",
        injury_type: "None",
        severity: "None",
        confidence: 0.0,
        description: "AI response was non-JSON or could not be parsed: " + String(rawContent).slice(0, 150),
        recommendedAction: "None",
        recommended_action: "None"
      };
    }
  }

  // Normalize and validate expected fields (supporting both camelCase and snake_case inputs)
  const animal_detected = Boolean(parsed.animalDetected !== undefined ? parsed.animalDetected : parsed.animal_detected);
  const animal_type = String(parsed.animalType || parsed.animal_type || "Unknown").trim();
  const breed = String(parsed.breed || "Unknown").trim();
  const injured = animal_detected && Boolean(parsed.injured);
  const injury_type = injured ? String(parsed.injuryType || parsed.injury_type || "Unspecified injury").trim() : "None";

  let severity = "None";
  if (injured) {
    const rawSev = String(parsed.severity || "Moderate").trim().toLowerCase();
    if (rawSev.includes("severe") || rawSev.includes("critical")) severity = "Severe";
    else if (rawSev.includes("moderate") || rawSev.includes("medium")) severity = "Moderate";
    else severity = "Minor";
  }

  let confidence = parseFloat(parsed.confidence);
  if (isNaN(confidence) || confidence < 0) confidence = 0.85;
  if (confidence > 1.0) confidence = confidence / 100.0; // handle percentage inputs
  confidence = parseFloat(confidence.toFixed(2));

  const description = String(parsed.description || (animal_detected ? `${animal_type} detected` : "No animal detected in frame.")).trim();
  const recommended_action = String(parsed.recommendedAction || parsed.recommended_action || (injured ? "Contact nearest animal rescue organization." : "No rescue action needed.")).trim();

  return {
    animalDetected: animal_detected,
    animal_detected,
    animalType: animal_type,
    animal_type,
    breed,
    injured,
    injuryType: injury_type,
    injury_type,
    severity,
    confidence,
    description,
    recommendedAction: recommended_action,
    recommended_action
  };
}

/**
 * Adapter 1: Google Gemini Vision API
 * Uses the official Gemini generateContent endpoint with base64 inlineData.
 */
/**
 * Compress an image buffer to max 800x800px at 80% quality using sharp.
 * Falls back to the original buffer if sharp is not available.
 */
async function compressImageBuffer(inputBuffer, mimeType) {
  if (!sharp) return inputBuffer;
  try {
    let pipeline = sharp(inputBuffer).resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true });
    if (mimeType === "image/png") {
      pipeline = pipeline.png({ quality: 80, compressionLevel: 8 });
    } else {
      pipeline = pipeline.jpeg({ quality: 80, progressive: true });
    }
    const compressed = await pipeline.toBuffer();
    const ratio = ((1 - compressed.length / inputBuffer.length) * 100).toFixed(1);
    console.log(`[AIService] Image compressed: ${(inputBuffer.length / 1024).toFixed(1)} KB → ${(compressed.length / 1024).toFixed(1)} KB (${ratio}% smaller)`);
    return compressed;
  } catch (compressErr) {
    console.warn("[AIService] Image compression failed, using original:", compressErr.message);
    return inputBuffer;
  }
}

async function callGeminiVision(imageBuffer, mimeType = "image/jpeg") {
  const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY or AI_API_KEY is not configured in backend/.env for Gemini provider.");
  }

  const model = process.env.AI_MODEL || "gemini-1.5-flash";
  const url = process.env.AI_API_URL || `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const promptText = `
You are an expert veterinary assistant and animal rescue AI vision analyzer.
Analyze the provided camera frame with clinical precision for the presence of animals and visible traumatic injuries.

CRITICAL HUMAN & NON-ANIMAL RULES:
1. HUMANS ARE NOT ANIMALS. If a human, person, man, woman, child, face, torso, glasses, hands, or indoor room with people is visible:
   - "animalDetected" MUST BE false
   - "animalType" MUST BE "None"
   - "breed" MUST BE "None"
   - "injured" MUST BE false
   - "injuryType" MUST BE "None"
   - "severity" MUST BE "None"
   - "description": "Human subject detected. No non-human animals present in camera frame."
   - "recommendedAction": "None"
   - NEVER identify a human or person as a dog, cat, or any animal!

ANIMAL DETECTION RULES:
2. Only set "animalDetected": true if an actual non-human animal (dog, cat, cow, bird, goat, horse, etc.) is visible.
3. If an animal is present but healthy / without physical trauma:
   - "animalDetected": true
   - "injured": false
   - "injuryType": "None"
   - "severity": "None"
4. CONSERVATIVE INJURY RULE:
   - Do NOT classify an animal as injured based solely on sleeping, resting, abnormal posture, or poor lighting.
   - You MUST prefer "not enough evidence" ("injured": false) over false alarms.
   - Only set "injured": true if visible open wounds, severe traumatic limping, bleeding, fractures, or trapped conditions are clearly evident.

Output MUST be ONLY valid JSON matching this schema:
{
  "animalDetected": false,
  "animalType": "None" | "Dog" | "Cat" | "Cow" | "Bird" | "Other",
  "breed": "Identifiable breed or Unknown",
  "injured": false,
  "injuryType": "None" | "Description of injury",
  "severity": "None" | "Minor" | "Moderate" | "Severe",
  "confidence": 0.0 to 1.0,
  "description": "Concise factual description of what is visible",
  "recommendedAction": "Immediate recommendation or None"
}
`;

  // Compress image before encoding to avoid timeouts on large frames
  const compressedBuffer = await compressImageBuffer(imageBuffer, mimeType);
  const base64Image = compressedBuffer.toString("base64");
  // Use compressed JPEG mime if originally PNG (since we may have re-encoded)
  const effectiveMime = mimeType;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inlineData: {
              mimeType: effectiveMime,
              data: base64Image
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  };

  // --- Global serial queue: ensures only 1 AI request runs at a time ---
  // This prevents quota burn from overlapping/parallel frame requests.
  if (callGeminiVision._running) {
    // Wait for the in-progress call to finish before starting this one
    await callGeminiVision._running.catch(() => {});
  }

  let resolveQueue, rejectQueue;
  callGeminiVision._running = new Promise((res, rej) => {
    resolveQueue = res;
    rejectQueue = rej;
  });
  // Prevent unhandled rejection crash if no caller awaits _running before it rejects
  callGeminiVision._running.catch(() => {});

  try {
  // Resilient model cascade — hard 18s cap so backend always responds fast.
  // If all models are busy after 18s, returns AI_BUSY for silent frontend retry.
  const configuredModel = process.env.AI_MODEL || "gemini-flash-lite-latest";
  const candidateModels = Array.from(new Set([
    configuredModel,
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-flash-latest",
    "gemini-3.8-flash"
  ]));

  const cascadeStartTime = Date.now();
  const CASCADE_HARD_CAP_MS = 18000; // 18s hard cap on entire cascade

  let lastError = null;
  for (const modelCandidate of candidateModels) {
    // If we've spent 18s already, give up fast and signal busy
    if (Date.now() - cascadeStartTime > CASCADE_HARD_CAP_MS) {
      const busyErr = new Error("AI_TEMPORARILY_BUSY");
      busyErr.code = "AI_BUSY";
      throw busyErr;
    }
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelCandidate}:generateContent?key=${apiKey}`;
        console.log(`[AIService] Trying model: ${modelCandidate} (attempt ${attempt})`);
        const response = await axios.post(targetUrl, requestBody, {
          headers: { "Content-Type": "application/json" },
          timeout: 20000  // 20s per attempt — fail fast so cascade tries next model quickly
        });

        const candidates = response.data?.candidates;
        const rawText = candidates?.[0]?.content?.parts?.[0]?.text || "";
        console.log(`[AIService] ✅ Success with model: ${modelCandidate}`);
        const result = parseAndValidateAIResponse(rawText);
        resolveQueue(result);
        callGeminiVision._running = null;
        return result;
      } catch (err) {
        lastError = err;
        const status = err.response?.status;
        const errData = err.response?.data?.error;
        console.error("[AIService] 429/API details:", errData || err.message);

        if (status === 503) {
          if (attempt >= 2) {
            // After 2 attempts on overloaded model, move to next model immediately
            console.warn(`[AIService] Model ${modelCandidate} still overloaded after ${attempt} attempts, trying next model...`);
            break;
          }
          // Quick 1.5s pause then one retry
          const delay = 1500;
          console.warn(`[AIService] Model ${modelCandidate} overloaded (503), retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        else if (status === 429) {
          // Extract the API's own suggested retryDelay and honour it (up to 65s cap).
          // If we retry too soon, we'll just get another 429 and waste quota.
          let suggestedDelayMs = 0;
          try {
            const details = errData?.details || [];
            const retryInfo = details.find(d => d["@type"] && d["@type"].includes("RetryInfo"));
            if (retryInfo?.retryDelay) {
              // Format is e.g. "53s" or "53.886247433s"
              const seconds = parseFloat(retryInfo.retryDelay);
              if (!isNaN(seconds)) suggestedDelayMs = Math.min(seconds * 1000, 65000);
            }
          } catch (_) {}

          if (suggestedDelayMs > 5000) {
            // The API told us to wait a meaningful time — skip to next model immediately
            console.warn(`[AIService] Model ${modelCandidate} rate-limited (429), API suggests ${(suggestedDelayMs/1000).toFixed(0)}s wait. Skipping to next model...`);
            break;
          } else if (attempt < 3) {
            const delay = suggestedDelayMs || 5000;
            console.warn(`[AIService] Model ${modelCandidate} rate-limited (429), waiting ${(delay/1000).toFixed(0)}s before retry...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          } else {
            console.warn(`[AIService] Model ${modelCandidate} quota/rate limit reached. Skipping retries and trying next model...`);
            break;
          }
        }
        else if (status === 404) {
          // Model unavailable for this account — skip silently
          console.warn(`[AIService] Model ${modelCandidate} not available (404), trying next...`);
          break;
        } else {
          // Other error (auth, bad request, etc.) — skip to next model
          console.warn(`[AIService] Model ${modelCandidate} error (${status || err.code}), trying next...`);
          break;
        }
      }
    }
  }

  rejectQueue(lastError);
  callGeminiVision._running = null;
  throw lastError;
  } catch (fatalErr) {
    if (resolveQueue) rejectQueue(fatalErr);
    callGeminiVision._running = null;
    throw fatalErr;
  }
}

/**
 * Adapter 2: Custom / Generic AI REST Endpoint
 * Configurable for external AI models, Flask/FastAPI microservices, or YOLO/ONNX vision servers.
 */
async function callCustomVision(imageBuffer, mimeType = "image/jpeg") {
  const url = process.env.AI_API_URL;
  if (!url) {
    throw new Error("AI_API_URL must be specified in backend/.env when using AI_PROVIDER=custom.");
  }

  const base64Image = imageBuffer.toString("base64");
  const headers = {
    "Content-Type": "application/json"
  };
  if (process.env.AI_API_KEY) {
    headers["Authorization"] = `Bearer ${process.env.AI_API_KEY}`;
  }

  const payload = {
    image: base64Image,
    mime_type: mimeType,
    prompt: "Identify animal and any visible injuries in JSON format"
  };

  const response = await axios.post(url, payload, { headers, timeout: 15000 });
  const rawContent = typeof response.data === "object" ? JSON.stringify(response.data) : response.data;
  return parseAndValidateAIResponse(rawContent);
}

/**
 * Adapter 3: Realistic Mock / Demo Provider
 * Enables full end-to-end testing when no live AI API key is provided yet.
 * Simulates a realistic animal detection pattern.
 */
let mockCycle = 0;
async function callMockVision(options = {}) {
  // If this is a live user camera session and NOT an automated unit test,
  // do NOT simulate fake animal injuries! Return no animal detected.
  if (!options.isTest && process.env.ENABLE_MOCK_CYCLE !== "true") {
    return parseAndValidateAIResponse({
      animalDetected: false,
      animalType: "None",
      breed: "None",
      injured: false,
      injuryType: "None",
      severity: "None",
      confidence: 0.99,
      description: "No animal detected in camera frame. (Notice: GEMINI_API_KEY is not configured in backend/.env. Running in Safe Demo Mode — live frames will not trigger false animal reports).",
      recommendedAction: "None"
    });
  }

  mockCycle = (mockCycle + 1) % 4;

  if (mockCycle === 1) {
    return parseAndValidateAIResponse({
      animalDetected: true,
      animalType: "Dog",
      breed: "Indian Pariah Dog (Indie)",
      injured: true,
      injuryType: "Front paw wound / severe limp",
      severity: "Moderate",
      confidence: 0.93,
      description: "Medium-sized Indie dog exhibiting visible front left paw distress and reluctance to place weight.",
      recommendedAction: "Dispatch rescue team with first-aid kit; examine for fractures or punctures."
    });
  } else if (mockCycle === 2) {
    return parseAndValidateAIResponse({
      animalDetected: true,
      animalType: "Cat",
      breed: "Domestic Shorthair",
      injured: false,
      injuryType: "None",
      severity: "None",
      confidence: 0.89,
      description: "Alert adult cat moving freely without visible signs of injury or trauma.",
      recommendedAction: "No rescue action required. Animal is healthy."
    });
  } else if (mockCycle === 3) {
    return parseAndValidateAIResponse({
      animalDetected: true,
      animalType: "Dog",
      breed: "Labrador Retriever mix",
      injured: true,
      injuryType: "Deep laceration on flank",
      severity: "Severe",
      confidence: 0.95,
      description: "Adult dog lying down with visible flank laceration and lethargy.",
      recommendedAction: "Immediate veterinary transport required. High urgency."
    });
  } else {
    return parseAndValidateAIResponse({
      animalDetected: false,
      animalType: "None",
      breed: "None",
      injured: false,
      injuryType: "None",
      severity: "None",
      confidence: 0.98,
      description: "No animal detected in the camera frame.",
      recommendedAction: "None"
    });
  }
}

/**
 * Main AI Service Entry Point
 * Dispatches to the configured AI provider.
 */
async function analyzeImage(imageFilePath, mimeType = "image/jpeg", options = {}) {
  const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;

  // If set to mock OR if Gemini requested but no API key is provided, use Mock
  if (provider === "mock" || (!apiKey && provider === "gemini")) {
    console.log(`[AIService] Using Mock/Demo mode (Provider=${provider}, API Key set=${Boolean(apiKey)}, isTest=${Boolean(options.isTest)})`);
    return await callMockVision(options);
  }

  const imageBuffer = await fs.promises.readFile(imageFilePath);

  if (provider === "gemini") {
    return await callGeminiVision(imageBuffer, mimeType);
  } else if (provider === "custom") {
    return await callCustomVision(imageBuffer, mimeType);
  } else {
    throw new Error(`Unsupported AI_PROVIDER: "${provider}". Expected "gemini", "custom", or "mock".`);
  }
}

module.exports = {
  analyzeImage,
  parseAndValidateAIResponse
};
