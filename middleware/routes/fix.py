code = """const express = require("express");
const router = express.Router();
const https = require("https");
const { fetchNearby } = require("../utils/locationService");

function getFallback(msg) {
  const m = msg.toLowerCase();
  if (m.includes("hospital") || m.includes("trauma") || m.includes("medical"))
    return "Nearest Hospitals:\\n1. AIIMS Delhi - 011-2659-3800\\n2. Safdarjung - 011-2673-0000\\n3. RML Hospital - 011-2336-5525\\n\\nFor ambulance call 102!";
  if (m.includes("police") || m.includes("fir"))
    return "Nearest Police:\\n1. Hauz Khas PS - 011-2685-3136\\n2. Green Park PS - 011-2686-3588\\n\\nCall 100!";
  if (m.includes("tow") || m.includes("breakdown"))
    return "Towing:\\n1. NHAI - 1033\\n2. Delhi Traffic Aid - 011-2584-2584";
  if (m.includes("ambulance") || m.includes("injured"))
    return "Call 102 - Free Ambulance\\nNational Emergency - 112";
  if (m.includes("first aid") || m.includes("bleeding"))
    return "First Aid:\\n1. Move to safety\\n2. Check breathing\\n3. Call 112\\n4. Stop bleeding with pressure";
  if (m.includes("drunk") || m.includes("alcohol"))
    return "Drunk Driving:\\nFine: Rs.10,000\\nJail: 6 months\\nSection 185 MV Act 2019";
  if (m.includes("traffic") || m.includes("fine") || m.includes("challan"))
    return "Traffic Fines:\\nSpeeding: Rs.2,000\\nNo helmet: Rs.1,000\\nRed light: Rs.5,000";
  if (m.includes("hi") || m.includes("hello"))
    return "Hello! RoadSoS AI here!\\nAsk me about:\\n- nearest hospital\\n- police station\\n- ambulance\\n- towing\\n- first aid\\n- traffic laws";
  return "Ask me: nearest hospital, police, ambulance, towing, first aid, traffic laws.\\nEmergency: call 112!";
}

router.post("/", async (req, res) => {
  const { message, lat, lng } = req.body;
  const m = message.toLowerCase();
  const hasLocation = lat && lng;
  console.log("Chat - lat:", lat, "lng:", lng, "msg:", message);
  try {
    if (hasLocation) {
      if (m.includes("hospital") || m.includes("medical") || m.includes("trauma") || m.includes("doctor")) {
        const data = await fetchNearby(parseFloat(lat), parseFloat(lng), "hospital", { limit: 5, radiusKm: 10 });
        if (data.results && data.results.length > 0) {
          const list = data.results.slice(0,5).map((r,i) => (i+1)+". "+r.name+" - "+r.distanceStr+(r.phone?" - "+r.phone:"")).join("\\n");
          return res.json({ success: true, reply: "Nearest Hospitals near you:\\n"+list+"\\n\\nFor ambulance call 102!" });
        }
      }
      if (m.includes("police") || m.includes("fir")) {
        const data = await fetchNearby(parseFloat(lat), parseFloat(lng), "police", { limit: 5, radiusKm: 10 });
        if (data.results && data.results.length > 0) {
          const list = data.results.slice(0,5).map((r,i) => (i+1)+". "+r.name+" - "+r.distanceStr+(r.phone?" - "+r.phone:"")).join("\\n");
          return res.json({ success: true, reply: "Nearest Police Stations near you:\\n"+list+"\\n\\nEmergency: Call 100!" });
        }
      }
      if (m.includes("tow") || m.includes("breakdown") || m.includes("puncture")) {
        const data = await fetchNearby(parseFloat(lat), parseFloat(lng), "towing", { limit: 5, radiusKm: 10 });
        if (data.results && data.results.length > 0) {
          const list = data.results.slice(0,5).map((r,i) => (i+1)+". "+r.name+" - "+r.distanceStr+(r.phone?" - "+r.phone:"")).join("\\n");
          return res.json({ success: true, reply: "Nearest Towing Services:\\n"+list+"\\n\\nNHAI free: 1033" });
        }
      }
    }
  } catch(err) { console.log("fetchNearby error:", err.message); }
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.json({ success: true, reply: getFallback(message) });
  const payload = JSON.stringify({ contents:[{ parts:[{ text: "You are RoadSoS emergency AI for India. Be concise. User: "+message }] }] });
  const options = { hostname: "generativelanguage.googleapis.com", path: "/v1beta/models/gemini-2.0-flash-lite:generateContent?key="+key, method: "POST", headers: {"Content-Type":"application/json"} };
  const apiReq = https.request(options, (apiRes) => {
    let d = ""; apiRes.on("data", c => d += c);
    apiRes.on("end", () => { try { const reply = JSON.parse(d).candidates[0].content.parts[0].text; res.json({ success:true, reply }); } catch(e) { res.json({ success:true, reply:getFallback(message) }); } });
  });
  apiReq.on("error", () => res.json({ success:true, reply:getFallback(message) }));
  apiReq.write(payload); apiReq.end();
});

module.exports = router;"""

with open('./routes/chat.js', 'w', encoding='utf-8') as f:
    f.write(code)
print('Done! fetchNearby:', 'fetchNearby' in code)