import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dns from "dns";

// Initialize Firebase SDK
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";

// Fix for Node ESM directory resolver
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Load Firebase configuration
const CONFIG_PATH = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Setup Firestore Error Logger for security diagnostic rules (Firebase Integration Skill)
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: "server-admin",
      email: "server@internal.node"
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// 1. Helper function to read posts from Firestore
async function readPostsFromFirestore(): Promise<any[]> {
  try {
    const querySnapshot = await getDocs(collection(db, "posts"));
    const posts: any[] = [];
    querySnapshot.forEach((docSnap) => {
      posts.push({ id: docSnap.id, ...docSnap.data() });
    });
    // Sort by date descending
    posts.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });
    return posts;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, "posts");
    return [];
  }
}

// 2. Helper to save a single post to Firestore
async function savePostToFirestore(post: any): Promise<boolean> {
  try {
    const docRef = doc(db, "posts", post.id);
    await setDoc(docRef, post);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `posts/${post.id}`);
    return false;
  }
}

// 3. Helper to delete a single post from Firestore
async function deletePostFromFirestore(id: string): Promise<boolean> {
  try {
    const docRef = doc(db, "posts", id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return false;
    }
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `posts/${id}`);
    return false;
  }
}

// 4. Helper function to read urgent news from Firestore
async function readUrgentNewsFromFirestore(): Promise<any[]> {
  try {
    const docRef = doc(db, "settings", "urgent_news");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().news || [];
    }
  } catch (error) {
    console.error("Error reading urgent news from Firestore, fallback to default news bulletin:", error);
  }
  // Standard non-blocking start news
  return [
    { text: "DECOUPLED HEADLESS CMS ONLINE • FIRESTORE REAL-TIME PERSISTENCE READY", color: "emerald", style: "pulsing" },
    { text: "NEWSPAPER DESIGN LANGUAGE REVIVED • DIGITAL EDITION 1.0.4", color: "default", style: "normal" }
  ];
}

// 5. Helper to write urgent news to Firestore
async function writeUrgentNewsToFirestore(news: any[]): Promise<boolean> {
  try {
    await setDoc(doc(db, "settings", "urgent_news"), { news });
    return true;
  } catch (error) {
    console.error("Error writing urgent news to Firestore:", error);
    return false;
  }
}

// Helper function to extract YouTube Video ID from any pasted link or share link
function extractYoutubeId(urlOrId: string | undefined): string | undefined {
  if (!urlOrId) return undefined;
  const trimmed = urlOrId.trim();
  if (!trimmed) return undefined;
  // If it's already an 11-char ID without url separators, keep it
  if (trimmed.length === 11 && !trimmed.includes("/") && !trimmed.includes("?")) {
    return trimmed;
  }
  // Try pattern matching for regular and share links
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = trimmed.match(regExp);
  if (match && match[2].length === 11) {
    return match[2];
  }
  return trimmed;
}

// Parse JSON payloads
app.use(express.json());

// --- API ROUTES ---

// 1. Get all posts
app.get("/api/posts", async (req, res) => {
  try {
    const posts = await readPostsFromFirestore();
    res.json(posts);
  } catch (err) {
    console.error("Error in GET /api/posts:", err);
    res.status(500).json({ error: "Failed to fetch posts from live database." });
  }
});

// 2. Create a new post
app.post("/api/posts", async (req, res) => {
  try {
    const { title, summary, content, category, youtubeId, imageUrls, author, readTime, isFeatured, isDraft } = req.body;

    if (!title || !content || !category || !author) {
      return res.status(400).json({ error: "Missing required fields (title, content, category, author)." });
    }

    // Generate unique ID and slug
    const id = Date.now().toString();
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    // Extract cleanest YouTube video ID
    const cleanYoutubeId = extractYoutubeId(youtubeId);

    // Convert comma separated list or array to array of clean image urls
    const cleanImageUrls = Array.isArray(imageUrls) 
      ? imageUrls.map((u: any) => String(u).trim()).filter(Boolean)
      : [];

    const newPost = {
      id,
      title,
      slug,
      summary: summary || content.slice(0, 150).replace(/[#*`>]/g, "") + "...",
      category,
      youtubeId: cleanYoutubeId || null,
      imageUrls: cleanImageUrls,
      author,
      date: new Date().toISOString().split("T")[0],
      readTime: Number(readTime) || 3,
      isFeatured: !!isFeatured,
      isDraft: !!isDraft,
      content,
    };

    const posts = await readPostsFromFirestore();

    // If this post is set as featured, unfeature others in Firestore
    if (newPost.isFeatured) {
      for (const p of posts) {
        if (p.isFeatured) {
          p.isFeatured = false;
          await savePostToFirestore(p);
        }
      }
    }

    await savePostToFirestore(newPost);
    res.status(201).json(newPost);
  } catch (err) {
    console.error("Error in POST /api/posts:", err);
    res.status(500).json({ error: "Failed to create post." });
  }
});

// 3. Update an existing post
app.put("/api/posts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const posts = await readPostsFromFirestore();
    const index = posts.findIndex((p: any) => p.id === id);

    if (index === -1) {
      return res.status(404).json({ error: "Post not found." });
    }

    const currentPost = posts[index];
    const { title, summary, content, category, youtubeId, imageUrls, author, readTime, isFeatured, isDraft } = req.body;

    // Generate slug if title changes
    const slug = title
      ? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")
      : currentPost.slug;

    const cleanYoutubeId = youtubeId !== undefined ? extractYoutubeId(youtubeId) : currentPost.youtubeId;
    const cleanImageUrls = imageUrls !== undefined 
      ? (Array.isArray(imageUrls) ? imageUrls.map((u: any) => String(u).trim()).filter(Boolean) : []) 
      : currentPost.imageUrls;

    const updatedPost = {
      ...currentPost,
      title: title !== undefined ? title : currentPost.title,
      slug,
      summary: summary !== undefined ? summary : currentPost.summary,
      content: content !== undefined ? content : currentPost.content,
      category: category !== undefined ? category : currentPost.category,
      youtubeId: cleanYoutubeId || null,
      imageUrls: cleanImageUrls,
      author: author !== undefined ? author : currentPost.author,
      readTime: readTime !== undefined ? Number(readTime) : currentPost.readTime,
      isFeatured: isFeatured !== undefined ? !!isFeatured : currentPost.isFeatured,
      isDraft: isDraft !== undefined ? !!isDraft : currentPost.isDraft,
    };

    // If updated post is featured, unfeature others
    if (updatedPost.isFeatured) {
      for (const p of posts) {
        if (p.id !== id && p.isFeatured) {
          p.isFeatured = false;
          await savePostToFirestore(p);
        }
      }
    }

    await savePostToFirestore(updatedPost);
    res.json(updatedPost);
  } catch (err) {
    console.error("Error in PUT /api/posts:", err);
    res.status(500).json({ error: "Failed to update post." });
  }
});

// 4. Delete a post
app.delete("/api/posts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const wasDeleted = await deletePostFromFirestore(id);

    if (!wasDeleted) {
      return res.status(404).json({ error: "Post not found." });
    }

    res.json({ success: true, message: `Post with ID ${id} deleted successfully.` });
  } catch (err) {
    console.error("Error in DELETE /api/posts:", err);
    res.status(500).json({ error: "Failed to delete post." });
  }
});

// 5. CMS Stats endpoint
app.get("/api/stats", async (req, res) => {
  try {
    const posts = await readPostsFromFirestore();
    const totalPosts = posts.length;
    const draftsCount = posts.filter((p: any) => p.isDraft).length;
    const publishedCount = totalPosts - draftsCount;
    const totalReadingTime = posts.reduce((acc: number, p: any) => acc + (p.readTime || 3), 0);

    res.json({
      totalPosts,
      publishedCount,
      draftsCount,
      totalReadingTime,
    });
  } catch (err) {
    console.error("Error in GET /api/stats:", err);
    res.status(500).json({ error: "Failed to load database stats." });
  }
});

// 5b. Urgent News management endpoints
app.get("/api/urgent-news", async (req, res) => {
  const news = await readUrgentNewsFromFirestore();
  res.json(news);
});

app.post("/api/urgent-news", async (req, res) => {
  try {
    const { news } = req.body;
    if (!Array.isArray(news)) {
      return res.status(400).json({ error: "Required 'news' field as array." });
    }
    
    const cleanNews = news.map((item: any) => {
      if (!item) return null;
      if (typeof item === 'string') {
        return { text: item.trim(), color: 'default', style: 'normal' };
      }
      return {
        text: String(item.text || "").trim(),
        color: String(item.color || "default").trim(),
        style: String(item.style || "normal").trim()
      };
    }).filter((item: any) => item && item.text);

    await writeUrgentNewsToFirestore(cleanNews);
    res.json({ success: true, news: cleanNews });
  } catch (err) {
    console.error("Error in POST /api/urgent-news:", err);
    res.status(500).json({ error: "Failed to update urgent news." });
  }
});

// Lazy-initialized Gemini Client helper to prevent crashing if key is missing
let aiClient: GoogleGenAI | null = null;
function getAiClient() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is not configured in Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// 6. Decoupled AI CMS Assistant - Outline Generator
app.post("/api/cms/suggest-ai", async (req, res) => {
  try {
    const { topic, youtubeUrl } = req.body;
    if (!topic && !youtubeUrl) {
      return res.status(400).json({ error: "Please provide either a topic description or a YouTube Video URL." });
    }

    const ai = getAiClient();
    
    let prompt = "";
    if (youtubeUrl) {
      // Extract youtube ID if possible
      let videoId = youtubeUrl;
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = youtubeUrl.match(regExp);
      if (match && match[2].length === 11) {
        videoId = match[2];
      }

      prompt = `Draft a high-quality newspaper-style political editorial analysis based on the YouTube Video with ID "${videoId}" and URL "${youtubeUrl}". 
The theme must be informative, objective, clean, and balanced. Formulate structured arguments, central debate questions, and insightful background context.
Create a compelling, professional headline and a clean summaries suitable for an educated audience.`;
    } else {
      prompt = `Draft a high-quality newspaper-style political editorial analysis or brief about the topic: "${topic}". 
Include balanced commentary, key diplomatic elements, economic ripple effects, historical context, and potential future outlook. 
Create a compelling, professional headline and summaries suitable for an educated audience.`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: `You are an expert editorial chief at a premium non-partisan political newspaper like The Economist or Financial Times.
You generate deep, balanced, clean, objective journalism with premium typography structures in Markdown.
Your response MUST be formatted strictly as a single JSON object. Do not include markdown wraps around the JSON block, just return valid JSON.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "A compelling, sharp cerebral headline for a political newspaper" },
            summary: { type: Type.STRING, description: "One-sentence executive summary of the geopolitical or policy debate" },
            suggestedContent: { type: Type.STRING, description: "A rich Markdown-formatted article content. Include subtitled sections using Markdown headers (e.g. ### Subheader), bulleted items, and a blockquote highlight detailing the political trade-off." },
            suggestedReadTime: { type: Type.INTEGER, description: "An estimated reading time in minutes (integer between 3 and 10)" },
            analysisPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "A list of 3-4 key focal points of analysis or policy friction."
            }
          },
          required: ["title", "summary", "suggestedContent", "suggestedReadTime", "analysisPoints"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response returned from Gemini.");
    }

    const jsonResult = JSON.parse(resultText.trim());
    res.json(jsonResult);
  } catch (error: any) {
    console.error("Gemini suggestion error:", error);
    res.status(500).json({ 
      error: error.message || "An error occurred while generating AI suggestions.",
      fallback: {
        title: "The Friction of Modern Multi-Alignment",
        summary: "An overview of contemporary geopolitical leverage in a split world.",
        suggestedContent: "### Geopolitical Drift\n\nIn the current global architecture, rising superpowers are pioneering 'multi-alignment' strategies rather than joining absolute blocs. Here is how they maneuver:\n\n* **Hedging Autonomy:** Engaging in tech co-investments with major capital groups.\n* **Strategic Commodity Leverage:** Negotiating terms for raw battery components.\n\n> 'Under classical diplomatic theories, middle powers were forced to pledge fealty. Today, autonomy is purchased through fluid, calculated contracts.'",
        suggestedReadTime: 4,
        analysisPoints: ["Hedging global strategies", "Commodity supply leveraging", "Sovereign autonomy pricing"]
      }
    });
  }
});


// --- INTEGRATE VITE DEV SERVER OR SERVE STATIC PRODUCTION FILES ---

async function start() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting Express + Vite Dev Server...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    // Mount Vite dev server middleware
    app.use(vite.middlewares);
  } else {
    console.log("Serving build-optimized static production files...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Politics & Video Blog running at http://localhost:${PORT}`);
  });
}

start();
