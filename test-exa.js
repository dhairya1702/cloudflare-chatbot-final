// test-exa-api.js
import fetch from "node-fetch";

const EXA_API_KEY = "822d785c-72d9-4030-b588-cdd27cd82dc0";

const res = await fetch("https://api.exa.ai/search", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": EXA_API_KEY,
  },
  body: JSON.stringify({
    query: "find recent news, LinkedIn, GitHub, or portfolio links for Dhairya Lalwani software engineer",
    type: "neural",
    numResults: 5,
  }),
});

const data = await res.json();
console.log("✅ [EXA API] Results:", data);
