import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  let requestedLang = "English";
  
  const fallbacks: Record<string, string> = {
    "Hindi": "उठो। जागो। तब तक मत रुको जब तक लक्ष्य प्राप्त न हो जाए। तुम्हारे भीतर असीम शक्ति है। यह दुनिया एक व्यायामशाला है जहाँ हम खुद को मजबूत बनाने आते हैं।",
    "English": "Arise. Awake. Stop not till the goal is reached. All power is within you. You can do anything and everything."
  };

  try {
    const body = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    requestedLang = body.language || "English";
    
    if (!apiKey) {
      return NextResponse.json({ reply: "API Key missing in .env.local", response: fallbacks[requestedLang] || fallbacks["English"] });
    }

    // ==========================================
    // 1. CHATBOT LOGIC 
    // ==========================================
    if (body.isChat) {
      const { message, history } = body;
      const prompt = `
        You are Swami Vivekananda counseling a modern youth.
        Conversation so far:
        ${history.map((msg: any) => `${msg.role === 'user' ? 'Youth' : 'Swami'}:${msg.content}`).join('\n')}
        Youth's latest message: "${message}"
        
        CRITICAL: Reply in the EXACT SAME LANGUAGE the Youth just used. Keep your response conversational, fierce, wise, and strictly under 60 words.
        DO NOT USE ASTERISKS, BOLDING, OR MARKDOWN.
      `;

      // Permanently locked to Gemini 3.5 Flash
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const data = await response.json();
      
      if (!response.ok) {
        return NextResponse.json({ reply: `GEMINI API ERROR: ${data.error?.message || "Unknown error"}` });
      }

      let replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "My child, all power is within you. Trust in yourself.";
      replyText = replyText.replace(/[*#"`_~\[\]]/g, '').trim();
      
      return NextResponse.json({ reply: replyText });
    }

    // ==========================================
    // 2. VIDEO REEL LOGIC 
    // ==========================================
    const userStruggle = body.userStruggle || "I fear failure.";
    const reelPrompt = `
      You are Swami Vivekananda counseling a modern youth who says: "${userStruggle}"
      
      CRITICAL INSTRUCTION: You MUST translate and write your entire response natively in ${requestedLang}.
      - If ${requestedLang} is Hindi, write ONLY in the Devanagari script.
      - If ${requestedLang} is Bengali, write ONLY in the Bengali script.

      Rules:
      1. LENGTH REQUIRED: You MUST write a MINIMUM of 8 full, long sentences. Elaborate heavily. Make this a long, extended monologue. DO NOT give a short answer.
      2. Quote your teachings on strength, rejecting fear, and the soul.
      3. CRITICAL: DO NOT use commas. DO NOT use dashes. Use short, punchy sentences ending in periods.
      
      OUTPUT ONLY THE RAW TRANSLATED TEXT.
    `;

    // Permanently locked to Gemini 3.5 Flash
    const reelResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: reelPrompt }] }] })
    });

    const reelData = await reelResponse.json();
    if (!reelResponse.ok) {
       console.error("Gemini Reel Error:", reelData.error?.message);
       throw new Error(reelData.error?.message);
    }
    
    const rawAiText = reelData.candidates?.[0]?.content?.parts?.[0]?.text || fallbacks[requestedLang] || fallbacks["English"];
    
    const cleanAiText = rawAiText
      .replace(/[*#"`_~\[\]]/g, '') 
      .replace(/,/g, ' ')           
      .replace(/[-—]/g, ' ')        
      .replace(/\n/g, ' ')          
      .replace(/\s{2,}/g, ' ')      
      .trim();

    let audioBase64 = null;
    try {
      const langCodes: Record<string, string> = { "Hindi": "hi", "Bengali": "bn", "Tamil": "ta", "English": "en" };
      const targetLang = langCodes[requestedLang] || "en";

      const bhashiniRes = await fetch("https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/compute", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipelineTasks: [{ taskType: "tts", config: { language: { sourceLanguage: targetLang }, gender: "MALE", samplingRate: 8000, audioFormat: "mp3" } }],
          inputData: { input: [{ source: cleanAiText }] }
        })
      });

      if (bhashiniRes.ok) {
        const bhashiniText = await bhashiniRes.text();
        if (bhashiniText) {
          const bhashiniData = JSON.parse(bhashiniText);
          audioBase64 = bhashiniData?.pipelineResponse?.[0]?.audio?.[0]?.audioContent || null;
        }
      }
    } catch (bhErr) {
      console.log("Bhashini failed, skipping to fallback audio.");
    }

    return NextResponse.json({ response: cleanAiText, audioBase64: audioBase64 });

  } catch (error: any) {
    console.error('Unified API Error:', error);
    return NextResponse.json({ 
      reply: `SYSTEM ERROR: ${error.message}`, 
      response: fallbacks[requestedLang] || fallbacks["English"] 
    });
  }
}