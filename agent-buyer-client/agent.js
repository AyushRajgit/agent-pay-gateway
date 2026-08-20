import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const BASE_URL = "http://localhost:8080/api/agent";
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// 1. Map our API calls to JavaScript functions
const functions = {
    fetch_catalog: async () => {
        console.log("\n>>> [AI Agent] Fetching store catalog...");
        const res = await fetch(`${BASE_URL}/catalog`);
        return await res.json();
    },

    evaluate_upsell: async ({ sku, mandateLimit }) => {
        console.log(`\n>>> [AI Agent] Evaluating upsell for SKU: ${sku} with budget: ₹${mandateLimit}...`);
        const res = await fetch(`${BASE_URL}/cart/upsell`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sku, agentBudgetMandate: mandateLimit }),
        });
        return await res.json();
    },

    execute_checkout: async ({ agentId, skuList, mandateLimit }) => {
        console.log(`\n>>> [AI Agent] Requesting gated checkout for items: ${skuList.join(", ")}...`);
        const res = await fetch(`${BASE_URL}/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agentId, skuList, agentBudgetMandate: mandateLimit }),
        });
        return await res.json();
    }
};

// 2. Define the tool schemas for Gemini
const tools = [{
    functionDeclarations: [
        {
            name: "fetch_catalog",
            description: "Fetches available products and prices from the store.",
        },
        {
            name: "evaluate_upsell",
            description: "Sends product SKU and spending mandate to get bundle options.",
            parameters: {
                type: "OBJECT",
                properties: {
                    sku: { type: "STRING", description: "Product SKU, e.g., LP-101" },
                    mandateLimit: { type: "NUMBER", description: "Maximum budget limit" }
                },
                required: ["sku", "mandateLimit"]
            }
        },
        {
            name: "execute_checkout",
            description: "Submits final item list to generate a Razorpay payment order.",
            parameters: {
                type: "OBJECT",
                properties: {
                    agentId: { type: "STRING", description: "Agent identifier" },
                    skuList: { type: "ARRAY", items: { type: "STRING" }, description: "List of SKUs to buy" },
                    mandateLimit: { type: "NUMBER", description: "Spending mandate cap" }
                },
                required: ["agentId", "skuList", "mandateLimit"]
            }
        }
    ]
}];

async function runAgentDemo() {
    console.log(">>> [AI Buyer] Starting autonomous shopping mission...");

    const model = genAI.getGenerativeModel({
        model: "gemini-3.6-flash",
        tools: tools
    });

    const prompt = "You are an autonomous corporate buyer with a strict spending mandate limit of ₹50,000. Browse the store catalog, find the laptop, check the upsell options to maximize value within your budget, and execute the gated checkout process. Use agentId: 'AGENT-ALPHA-01'.";

    // 1. Manually create the conversation history array
    let history = [
        {
            role: "user",
            parts: [{ text: prompt }]
        }
    ];

    let result = await model.generateContent({ contents: history });
    let call = result.response.functionCalls();

    // Execution Loop
    while (call && call.length > 0) {
        const currentCall = call[0];
        const apiResponse = await functions[currentCall.name](currentCall.args);

        // 2. Push the model's function request into history
        history.push({
            role: "model",
            parts: result.response.candidates[0].content.parts
        });

        // 3. Push your Spring Boot API response into history, explicitly forcing the role to "user"
        history.push({
            role: "user",
            parts: [{
                functionResponse: {
                    name: currentCall.name,
                    response: { data: apiResponse }
                }
            }]
        });

        // 4. Send the updated history back to Gemini
        result = await model.generateContent({ contents: history });
        call = result.response.functionCalls();
    }

    console.log("\n>>> [AI Buyer Mission Completed]:\n", result.response.text());
}

runAgentDemo();