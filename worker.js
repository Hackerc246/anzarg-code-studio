/**
 * ANZARG CODE STUDIO - DEDICATED AI COPILOT & PROXY GATEWAY
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

      if (!masterApiKey) {
        return new Response(JSON.stringify({ 
          error: { message: "Configuration Error: GEMINI_API_KEY secret Cloudflare settings mein set nahi hai." } 
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 2. Direct Google Gemini 3 API Call
      const googleEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${masterApiKey}`;

      const res = await fetch(googleEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      return new Response(JSON.stringify(data), {
        status: res.status,
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