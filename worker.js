/**
 * ANZARG CODE STUDIO - DEDICATED AI COPILOT & PROXY GATEWAY
 * Primary: Google Gemini 3 Core (gemini-3.8-flash)
 * Secondary Backup: Cloudflare Workers AI (@cf/meta/llama-4-scout-17b-16e-instruct)
 * Route: https://anzarg-studio-api.freenews782.workers.dev
 */

export default {
  async fetch(request, env) {
    // 1. CORS Headers: Studio Web App ko connect karne ke liye
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Pre-flight check handle karna
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: { message: "Method not allowed. Studio engine requires POST." } }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    try {
      const { model, payload } = await request.json();
      const activeModel = model || "gemini-3.8-flash";
      const masterApiKey = env.GEMINI_API_KEY;

      // User prompt text nikalna (Backup engine ke liye)
      const userPrompt = payload?.contents?.[0]?.parts?.[0]?.text || "";

      // LAYER 1: Primary Attempt -> Google Gemini 3 API
      if (masterApiKey) {
        try {
          const googleEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${masterApiKey}`;
          const res = await fetch(googleEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

          const data = await res.json();

          // Agar Google se valid answer mil gaya toh seedha return karein
          if (res.ok && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
            return new Response(JSON.stringify(data), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }

          console.warn("Gemini busy / spike encountered. Activating Llama 4 Scout backup...");
        } catch (geminiErr) {
          console.warn("Gemini network unreachable. Switching to Workers AI...", geminiErr);
        }
      }

      // LAYER 2: Secondary Backup Engine -> Cloudflare Workers AI (Llama 4 Scout)
      if (env.AI) {
        try {
          const systemMsg = "You are ANZARG CODE STUDIO Engine. Give complete single-file runnable code immediately inside markdown block (```html ... ```). Never give theory or long explanations.";
          const aiResponse = await env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", {
            messages: [
              { role: "system", content: systemMsg },
              { role: "user", content: userPrompt }
            ]
          });

          const generatedText = aiResponse?.response || "";
          if (generatedText) {
            // Frontend format compatibility wrapper
            const compatibleResponse = {
              candidates: [
                {
                  content: {
                    parts: [{ text: generatedText }]
                  }
                }
              ]
            };

            return new Response(JSON.stringify(compatibleResponse), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }
        } catch (cfAiErr) {
          console.error("Workers AI Llama-4 execution error:", cfAiErr);
        }
      }

      // Agar dono layers temporarily fail ho jayein tabhi error aayega
      return new Response(JSON.stringify({ 
        error: { message: "Studio AI busy under high traffic spike. Please retry in 3 seconds." } 
      }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ 
        error: { message: err.message || "AnzarG Studio Gateway execution failed." } 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};