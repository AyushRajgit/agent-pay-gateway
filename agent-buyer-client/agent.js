import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Set up Redis connection
const redisConnection = new Redis({ host: '127.0.0.1', port: 6379, maxRetriesPerRequest: null });

// Created the Queue
const agentQueue = new Queue('agent-missions', { connection: redisConnection });

const BASE_URL = "http://localhost:8080/api/agent";
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Tools and Functions
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

const tools = [{
    functionDeclarations: [
        { name: "fetch_catalog", description: "Fetches available products and prices." },
        {
            name: "evaluate_upsell",
            description: "Sends product SKU and spending mandate to get bundle options.",
            parameters: {
                type: "OBJECT",
                properties: {
                    sku: { type: "STRING" },
                    mandateLimit: { type: "NUMBER" }
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
                    agentId: { type: "STRING" },
                    skuList: { type: "ARRAY", items: { type: "STRING" } },
                    mandateLimit: { type: "NUMBER" }
                },
                required: ["agentId", "skuList", "mandateLimit"]
            }
        },
        {
            name: "request_mandate_override",
            description: "Use this ONLY if the total cart value is slightly over the mandate limit (within 10%). Asks the human supervisor for approval.",
            parameters: {
                type: "OBJECT",
                properties: {
                    excessAmount: { type: "NUMBER" },
                    reason: { type: "STRING" }
                },
                required: ["excessAmount", "reason"]
            }
        }
    ]
}];

// The worker runs in the background
const worker = new Worker('agent-missions', async (job) => {
    const { userPrompt, mandateLimit, agentId } = job.data;

    console.log(`\n======================================================`);
    console.log(`>>> [Worker] Processing Job ${job.id}: Agent ${agentId} with budget ₹${mandateLimit}`);
    console.log(`======================================================`);

    try {
        // Here, I used google-gemini-API
        const model = genAI.getGenerativeModel({
            model: "gemini-flash-latest",
            tools: tools
        });

        const systemPrompt = `You are an autonomous corporate buyer with a strict spending mandate limit of ₹${mandateLimit}. 
Use agentId: '${agentId}'. User Request: "${userPrompt}". 
Browse the catalog, evaluate upsells, and execute the checkout.

CRITICAL INSTRUCTION: Your final output MUST be a valid JSON object strictly following this format:
{
  "status": "SUCCESS or FAILED",
  "items_evaluated": ["list", "of", "skus"],
  "total_cost": 45000,
  "mandate_limit": ${mandateLimit},
  "reasoning_log": "A detailed 2-sentence explanation of why these items were chosen and how they fit the budget."
}`;

        let history = [{ role: "user", parts: [{ text: systemPrompt }] }];

        console.log(`>>> [Worker] Sending request to Google Gemini API...`);
        let result = await model.generateContent({ contents: history });
        let call = result.response.functionCalls();

        while (call && call.length > 0) {
            const currentCall = call[0];
            const apiResponse = await functions[currentCall.name](currentCall.args);

            history.push({ role: "model", parts: result.response.candidates[0].content.parts });
            history.push({
                role: "user",
                parts: [{ functionResponse: { name: currentCall.name, response: { data: apiResponse } } }]
            });

            console.log(`>>> [Worker] Sending tool results back to Gemini...`);
            result = await model.generateContent({ contents: history });
            call = result.response.functionCalls();
        }

        const finalOutput = result.response.text();
        console.log(`\n>>> [AI Buyer Mission Completed]:\n${finalOutput}\n`);

        return finalOutput;
    } catch (error) {
        console.error(`\nXXX [GOOGLE API ERROR] XXX\n`, error);
        throw error;
    }
}, {
    connection: redisConnection,
    limiter: { max: 1, duration: 15000 },
    // it Automatically retries up to 3 times if Google returns a 503 error
    settings: {
        backoffStrategy: (attemptsMade) => Math.min(attemptsMade * 5000, 20000)
    }});

// The API endpoint for the Frontend
// Quickly adds the mission to the queue and returns a Job ID
app.post('/api/run-agent', async (req, res) => {
    try {
        const job = await agentQueue.add('buy-mission', req.body);
        res.json({ success: true, jobId: job.id, message: "Mission queued successfully." });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/job/:id', async (req, res) => {
    try {
        const job = await agentQueue.getJob(req.params.id);
        if (!job) return res.status(404).json({ error: "Job not found" });

        const state = await job.getState();
        const result = job.returnvalue;

        res.json({ state, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3001, () => {
    console.log(">>> AI Agent Queue Server running on http://localhost:3001");
});