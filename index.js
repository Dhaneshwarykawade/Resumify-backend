import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import multer from "multer";
import mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

dotenv.config();
const app = express();
app.use(cors({ origin: "http://localhost:5173" })); // your React port

app.use(cors());
app.use(express.json());
console.log("Google AI API Key Loaded:", !!process.env.GOOGLE_AI_API_KEY);

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

// Multer for handling file uploads (in memory)
const upload = multer();

/* ------------------------- 1. TEXT-BASED ANALYSIS ------------------------- */
app.post("/api/analyzeResume", async (req, res) => {
  const { resumeText } = req.body;
  if (!resumeText)
    return res.status(400).json({ error: "No resume text provided" });

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are an AI assistant that strictly returns JSON. Respond ONLY in JSON format like this: {"score":75,"keywords":["word1","word2"],"suggestions":["tip1","tip2"]}

Analyze this resume and return:
1. ATS score (0-100)
2. Top 5 keywords
3. 5 improvement suggestions

Resume: ${resumeText}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    let jsonResult;
    try {
      const cleanedText = text.replace(/```json\n?|\n?```/g, "").trim();
      jsonResult = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("JSON parsing error:", parseError);
      jsonResult = {
        score: 50,
        keywords: ["resume", "experience", "skills", "education", "work"],
        suggestions: [
          "Unable to parse AI response properly",
          "Please try again with a different resume format",
          "Ensure your resume has clear sections",
          "Include relevant keywords for your industry",
          "Format your resume consistently",
        ],
      };
    }

    res.json(jsonResult);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI analysis failed" });
  }
});

/* ------------------------- 2. FILE-BASED ANALYSIS ------------------------- */
app.post(
  "/api/analyzeResumeFile",
  upload.single("resumeFile"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      let text = "";

      if (req.file.mimetype === "application/pdf") {
        const pdfData = await pdfParse(req.file.buffer);
        text = pdfData.text;
      } else if (
        req.file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        const result = await mammoth.extractRawText({
          buffer: req.file.buffer,
        });
        text = result.value;
      } else if (req.file.mimetype === "text/plain") {
        text = req.file.buffer.toString("utf-8");
      } else {
        return res.status(400).json({ error: "Unsupported file type" });
      }

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `You are an AI assistant that strictly returns JSON. Respond ONLY in JSON format like this: {"score":75,"keywords":["word1","word2"],"suggestions":["tip1","tip2"]}

Analyze this resume and return:
1. ATS score (0-100)
2. Top 5 keywords
3. 5 improvement suggestions

Resume: ${text}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const aiText = response.text();

      const cleanedText = aiText.replace(/```json\n?|\n?```/g, "").trim();
      const jsonResult = JSON.parse(cleanedText);

      res.json(jsonResult);
    } catch (err) {
      console.error("Error analyzing file:", err);
      res.status(500).json({ error: "File analysis failed" });
    }
  }
);
/* ------------------------- 3. FETCH LANGUAGES ------------------------- */
app.get("/api/languages", async (req, res) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `List all the languages that are supported by gemini and can be translated without any problems with their ISO codes.
Respond ONLY in JSON format like this:
[
  {"code":"en","name":"English"},
  {"code":"hi","name":"Hindi"},
  {"code":"ja","name":"Japanese"}
]`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("🔎 Raw response from Gemini:", text);

    let languages;
    try {
      const cleanedText = text.replace(/```json\n?|\n?```/g, "").trim();
      languages = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("❌ JSON parse failed:", parseError);

      // fallback: at least return some default common languages
    }

    res.json(languages);
  } catch (err) {
    console.error("Error fetching languages:", err);
    res.status(500).json({ error: "Failed to fetch languages" });
  }
});

/* ------------------------- 4. FETCH TRANSLATED LABELS ------------------------- */
app.get("/api/labels/:lang", async (req, res) => {
  const { lang } = req.params || { lang: "en" };
  console.log(lang);

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // ✅ Define your form labels in English
    const labels = [
      {
        fullName: "Full Name",
        title: "Professional Title",
        email: "Email",
        phone: "Phone Number",
        linkedin: "LinkedIn URL",
        github: "GitHub / Portfolio URL",
        location: "Location (City, State)",
        summary: "Professional Summary / Objective",
        skills: "Key Skills (separate by commas)",
        experience: "Work Experience",
        education: "Education",
        projects: "Projects",
        internship: "Internship Experience",
        certifications: "Certifications / Trainings",
        achievements: "Achievements / Awards",
        languages: "Languages",
        volunteer: "Volunteer Work / Social Initiatives",
        hobbies: "Hobbies / Interests",
        next: "Next",
        back: "Back",
        save: "Save Resume",
        update: "Update Resume",
      },
    ];

    const prompt = `
      Translate the following keys of this object
      {
        fullName: "Full Name",
        title: "Professional Title",
        email: "Email",
        phone: "Phone Number",
        linkedin: "LinkedIn URL",
        github: "GitHub / Portfolio URL",
        location: "Location (City, State)",
        summary: "Professional Summary / Objective",
        skills: "Key Skills (separate by commas)",
        experience: "Work Experience",
        education: "Education",
        projects: "Projects",
        internship: "Internship Experience",
        certifications: "Certifications / Trainings",
        achievements: "Achievements / Awards",
        languages: "Languages",
        volunteer: "Volunteer Work / Social Initiatives",
        hobbies: "Hobbies / Interests",
        next: "Next",
        back: "Back",
        save: "Save Resume",
        update: "Update Resume",
      }
       into language code ${lang} and keep the keys same only translate the values not keys.
      Respond ONLY in valid JSON format where keys are translated only keep the keys same as giving in object.
     
    `;

    const result = await model.generateContent(prompt);
    console.log(result);
    const response = await result.response;
    const text = response.text();

    console.log("🔎 Raw Gemini translation response:", text);

    let translatedLabels;
    try {
      const cleanedText = text.replace(/```json\n?|\n?```/g, "").trim();
      translatedLabels = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("❌ JSON parse failed for labels:", parseError);

      // fallback: return English labels if parsing fails
      translatedLabels = Object.fromEntries(labels.map((l) => [l, l]));
    }

    res.json(translatedLabels);
  } catch (err) {
    console.error("Error fetching translated labels:", err);
    res.status(500).json({ error: "Failed to fetch translated labels" });
  }
});

/* ------------------------- 5. EXTRA ------------------------- */
// Optional route to silence DevTools CSP warning
app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
  res.json({});
});

app.listen(5000, () =>
  console.log("🚀 Server running on http://localhost:5000")
);

/* ------------------------- 6. TRANSLATE THE RESUME DATA ------------------------- */

app.post("/api/translateResume", async (req, res) => {
  try {
    const { resumeData, targetLang } = req.body;
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Translate the following resume data object values into language code ${targetLang}:
      ${JSON.stringify(
        resumeData
      )} also provide me a json of the translated keys like this {"fullName":"translated key","title":"key"} this should be the in key named translatedLabels in resume data.
      Respond ONLY in valid JSON format where keys are same only translate the values not keys.
    `;

    const result = await model.generateContent(prompt);
    console.log(result);
    const response = await result.response;
    const text = response.text();

    console.log("🔎 Raw Gemini translation response:", text);

    let translatedResume;
    try {
      const cleanedText = text.replace(/```json\n?|\n?```/g, "").trim();
      translatedResume = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("❌ JSON parse failed for resume:", parseError);

      // fallback: return original resume data if parsing fails
      translatedResume = resumeData;
    }

    res.json(translatedResume);
  } catch (err) {
    console.error("Error fetching translated resume:", err);
    res.status(500).json({ error: "Failed to fetch translated resume" });
  }
});
