const express = require("express");
const router  = express.Router();
const https   = require("https");
const { fetchNearby } = require("../utils/locationService");

function getFallback(msg) {
  const m = msg.toLowerCase();
  if (m.includes("hospital") || m.includes("trauma") || m.includes("medical"))
    return "Nearest Hospitals:\n1. AIIMS Delhi - 011-2659-3800\n2. Safdarjung - 011-2673-0000\n3. RML Hospital - 011-2336-5525\n\nFor ambulance call 102!";
  if (m.includes("police") || m.includes("fir"))
    return "Nearest Police:\n1. Hauz Khas PS - 011-2685-3136\n2. Green Park PS - 011-2686-3588\n\nCall 100!";
  if (m.includes("tow") || m.includes("breakdown") || m.includes("puncture") || m.includes("crane"))
    return "Towing & Roadside Assistance:\n\n1. NHAI Helpline - 1033\n   (FREE on all national highways!)\n\n2. Delhi Traffic Aid - 011-2584-2584\n   (24x7 city towing)\n\n3. QuickTow Delhi - +91-98103-33333\n   (GPS tracked fleet)\n\n4. GoMechanic - +91-99999-99999\n   (Puncture, battery, towing)\n\nTip: NHAI 1033 is completely FREE on highways!";
  if (m.includes("ambulance") || m.includes("injured"))
    return "Call 102 - Free Ambulance\nNational Emergency - 112";
  if (m.includes("first aid") || m.includes("bleeding"))
    return "First Aid:\n1. Move to safety\n2. Check breathing\n3. Call 112\n4. Stop bleeding with pressure";
  if (m.includes("drunk") || m.includes("alcohol"))
    return "Drunk Driving:\nFine: Rs.10,000\nJail: 6 months\nSection 185 MV Act 2019";
  if (m.includes("traffic") || m.includes("fine") || m.includes("challan"))
    return "Traffic Fines:\nSpeeding: Rs.2,000\nNo helmet: Rs.1,000\nRed light: Rs.5,000\nDrunk driving: Rs.10,000";
  if (m.includes("hi") || m.includes("hello"))
    return "Hello! RoadSoS AI here!\nAsk me about:\n- nearest hospital\n- police station\n- ambulance\n- towing\n- first aid\n- traffic laws";
  return "Ask me: nearest hospital, police, ambulance, towing, first aid, traffic laws.\nEmergency: call 112!";
}

router.post("/", async (req, res) => {
  const { message, lat, lng } = req.body;
  const m = message.toLowerCase();
  const hasLocation = lat && lng;
  console.log("Chat - lat:", lat, "lng:", lng, "msg:", message);

  try {
   if (hasLocation) {
  // First aid check FIRST (before accident)
 if (m.includes("ambulance") || m.includes("injured") || m.includes("accident"))
    return res.json({ success: true, reply: getFallback(message) });
  }
  if (m.includes("hospital") || m.includes("medical") || m.includes("trauma") || m.includes("doctor")) {
    // hospital fetch...
  }
 if (m.includes("police") || m.includes("fir"))
    // police fetch...
  }
      }
      if (m.includes("police") || m.includes("fir")) {
        const data = await fetchNearby(parseFloat(lat), parseFloat(lng), "police", { limit: 5, radiusKm: 10 });
        if (data.results && data.results.length > 0) {
          const list = data.results.slice(0, 5)
            .map((r, i) => `${i+1}. ${r.name} - ${r.distanceStr}${r.phone ? " - " + r.phone : ""}`)
            .join("\n");
          return res.json({ success: true, reply: `Nearest Police Stations near you:\n${list}\n\nEmergency: Call 100!` });
        }
      }
      if (m.includes("tow") || m.includes("breakdown") || m.includes("puncture")) {
        const data = await fetchNearby(parseFloat(lat), parseFloat(lng), "towing", { limit: 5, radiusKm: 10 });
        if (data.results && data.results.length > 0) {
          const list = data.results.slice(0, 5)
            .map((r, i) => `${i+1}. ${r.name} - ${r.distanceStr}${r.phone ? " - " + r.phone : ""}`)
            .join("\n");
          return res.json({ success: true, reply: `Nearest Towing Services:\n${list}\n\nNHAI free: 1033` });
        }
      }
    }
  } catch(err) {
    console.log("fetchNearby error:", err.message);
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.json({ success: true, reply: getFallback(message) });

  const payload = JSON.stringify({
  text: "You are RoadSoS, a friendly AI assistant for road safety in India. Help with emergency services, traffic laws, first aid, and general conversation. For casual questions respond naturally. Always be helpful. For emergencies mention 112. User location: "+(lat ? lat+","+lng : "India")+". User message: "+message
  const options = {
    hostname: "generativelanguage.googleapis.com",
    path: "/v1beta/models/gemini-2.5-flash:generateContent?key="+key
    method: "POST",
    headers: { "Content-Type": "application/json" }
  };
  const apiReq = https.request(options, (apiRes) => {
    let d = "";
    apiRes.on("data", c => d += c);
    apiRes.on("end", () => {
  try {
    const parsed = JSON.parse(d);
    console.log("Gemini raw:", d.slice(0, 200));
    // Check for rate limit error
    if (parsed.error && parsed.error.code === 429) {
      console.log("Gemini rate limited - using fallback");
      return res.json({ success:true, reply: getFallback(message) });
    }
    const reply = parsed.candidates[0].content.parts[0].text;
    res.json({ success:true, reply });
  } catch(e) {
    res.json({ success:true, reply: getFallback(message) });
  }
});
    });
  });
  apiReq.on("error", () => res.json({ success: true, reply: getFallback(message) }));
  apiReq.write(payload);
  apiReq.end();
});

module.exports = router;