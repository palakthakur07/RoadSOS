const express = require("express");
const router  = express.Router();
const https   = require("https");
const { fetchNearby } = require("../utils/locationService");

function getFallback(msg) {
  const m = msg.toLowerCase();
  if (m.includes("hospital") || m.includes("medical") || m.includes("doctor"))
    return "Nearest Hospitals:\n1. AIIMS Delhi - 011-2659-3800\n2. Safdarjung - 011-2673-0000\n3. RML Hospital - 011-2336-5525\n\nFor ambulance call 102!";
  if (m.includes("police") || m.includes("fir"))
    return "Nearest Police:\n1. Hauz Khas PS - 011-2685-3136\n2. Green Park PS - 011-2686-3588\n3. Saket PS - 011-2953-7171\n\nEmergency: Call 100!";
  if (m.includes("tow") || m.includes("breakdown") || m.includes("car broke"))
    return "Towing Services:\n1. NHAI Helpline - 1033 (FREE)\n2. Delhi Traffic Aid - 011-2584-2584\n3. QuickTow - +91-98103-33333";
  if (m.includes("ambulance") || m.includes("injured") || m.includes("accident"))
    return "Emergency Help:\n1. Call 102 - Free Ambulance\n2. CATS Ambulance - +91-98108-48484\n3. National Emergency - 112";
  if (m.includes("first aid") || m.includes("bleeding"))
    return "First Aid Steps:\n1. Move to safe area\n2. Check breathing\n3. Call 112 immediately\n4. Apply firm pressure to stop bleeding\n5. Do NOT move if spinal injury suspected";
  if (m.includes("drunk") || m.includes("dui") || m.includes("alcohol"))
    return "Drunk Driving Law:\n- Fine: Rs.10,000 (1st offence)\n- Fine: Rs.15,000 (repeat)\n- Jail: Up to 6 months\n- License suspended 6 months\n\nSection 185 MV Act 2019";
  if (m.includes("traffic") || m.includes("fine") || m.includes("challan") || m.includes("speed"))
    return "Traffic Fines (MV Act 2019):\n- Speeding: Rs.1,000-Rs.4,000\n- No helmet: Rs.1,000\n- Red light: Rs.5,000\n- No seatbelt: Rs.1,000\n- Mobile driving: Rs.1,000-Rs.10,000\n- Drunk driving: Rs.10,000\n- Hit and run: Rs.2,00,000";
  if (m.includes("hi") || m.includes("hello") || m.includes("hey"))
    return "Hello! I am RoadSoS AI!\n\nI can help with:\n- Nearest hospitals\n- Police stations\n- Ambulance services\n- Towing services\n- First aid tips\n- Traffic laws\n\nWhat do you need?";
  return "I am RoadSoS AI! Ask me:\n- nearest hospital\n- nearest police\n- ambulance\n- towing service\n- first aid\n- traffic laws\n\nFor emergencies call 112!";
}

function formatResults(results) {
  return results
    .slice(0, 5)
    .map((r, i) => `${i+1}. ${r.name} - ${r.distanceStr}${r.phone ? " - " + r.phone : ""}`)
    .join("\n");
}

router.post("/", async (req, res) => {
  const { message, lat, lng } = req.body;
  const m = message.toLowerCase();
  const hasLocation = lat && lng;

  try {
    // Use REAL location service directly
    if (hasLocation) {
      if (m.includes("hospital") || m.includes("medical") || m.includes("doctor") || m.includes("trauma")) {
        const data = await fetchNearby(parseFloat(lat), parseFloat(lng), "hospital", { limit: 5, radiusKm: 10 });
        if (data.results && data.results.length > 0) {
          const list = formatResults(data.results);
          return res.json({ success: true, reply: `Nearest Hospitals near you:\n${list}\n\nFor ambulance call 102!\nSource: ${data.meta.source}` });
        }
      }
      if (m.includes("police") || m.includes("fir") || m.includes("cop")) {
        const data = await fetchNearby(parseFloat(lat), parseFloat(lng), "police", { limit: 5, radiusKm: 10 });
        if (data.results && data.results.length > 0) {
          const list = formatResults(data.results);
          return res.json({ success: true, reply: `Nearest Police Stations near you:\n${list}\n\nEmergency: Call 100!` });
        }
      }
      if (m.includes("tow") || m.includes("breakdown") || m.includes("puncture") || m.includes("car broke")) {
        const data = await fetchNearby(parseFloat(lat), parseFloat(lng), "towing", { limit: 5, radiusKm: 10 });
        if (data.results && data.results.length > 0) {
          const list = formatResults(data.results);
          return res.json({ success: true, reply: `Nearest Towing Services:\n${list}\n\nNHAI free helpline: 1033` });
        }
      }
    }
  } catch(err) {
    console.log("Location fetch error:", err.message);
  }

  // Try Gemini AI
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.json({ success: true, reply: getFallback(message) });

  const payload = JSON.stringify({
    contents: [{ parts: [{ text: `You are RoadSoS, an emergency road safety AI for India. Help find hospitals, police, towing. Mention 112 for emergencies. Be concise. User location: ${lat ? lat+","+lng : "unknown"}. User: ${message}` }] }]
  });

  const options = {
    hostname: "generativelanguage.googleapis.com",
    path    : `/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${key}`,
    method  : "POST",
    headers : { "Content-Type": "application/json" }
  };

  const apiReq = https.request(options, (apiRes) => {
    let data = "";
    apiRes.on("data", chunk => data += chunk);
    apiRes.on("end", () => {
      try {
        const parsed = JSON.parse(data);
        const reply  = parsed.candidates[0].content.parts[0].text;
        res.json({ success: true, reply });
      } catch(e) {
        res.json({ success: true, reply: getFallback(message) });
      }
    });
  });

  apiReq.on("error", () => res.json({ success: true, reply: getFallback(message) }));
  apiReq.write(payload);
  apiReq.end();
});

module.exports = router;