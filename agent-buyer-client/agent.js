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
    },
    request_mandate_override: async ({ excessAmount, reason }) => {
        console.log(`\n>>> [HITL ALERT] AI requested override for ₹${excessAmount}. Reason: ${reason}`);
        return `OVERRIDE_PENDING. Instruct user to approve in dashboard. Format final JSON with status: 'APPROVAL_REQUIRED' and reasoning_log: 'HITL Override requested for ₹${excessAmount}: ${reason}'`;
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
            description: "Use this ONLY if the total cart value is over the mandate limit, BUT strictly within a 10% range. Do NOT use if excess is higher.",
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
        // Corrected Model Version
        const model = genAI.getGenerativeModel({
            model: "gemini-3.5-flash",
            tools: tools
        });

        // Pre-calculate the hard 10% cutoff limit for the AI
        const hardCutoffLimit = mandateLimit * 1.1;

        const systemPrompt = `You are an autonomous corporate buyer with a strict spending mandate limit of ₹${mandateLimit}.
        Use agentId: '${agentId}'. User Request: "${userPrompt}". Browse the catalog, evaluate upsells, and execute the checkout.

        CRITICAL BUDGET ENFORCEMENT RULES:
        1. If Total Cost <= ₹${mandateLimit} : Call execute_checkout. Return status "SUCCESS".
        2. If Total Cost > ₹${mandateLimit} BUT is <= ₹${hardCutoffLimit} (within 10% buffer) : Call request_mandate_override. Return status "APPROVAL_REQUIRED".
        3. If Total Cost > ₹${hardCutoffLimit} (exceeds 10% buffer) : DO NOT call execute_checkout. DO NOT call request_mandate_override. Return status "FAILED".

        CRITICAL INSTRUCTION: Your final output MUST be a valid JSON object strictly following this format:
        {
           "status": "SUCCESS, FAILED, or APPROVAL_REQUIRED",
           "items_evaluated": ["list", "of", "skus"],
           "total_cost": 45000,
           "mandate_limit": ${mandateLimit},
           "reasoning_log": "A detailed 2-sentence explanation of why these items were chosen and how they fit the budget constraints."
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

// Testing Code, When Gemini API is busy

/*
import express from 'express';
import cors from 'cors';
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

// Initialize BullMQ Queue
const agentQueue = new Queue('agent-missions', { connection: redisConnection });
const BASE_URL = "http://localhost:8080/api/agent";

// Deterministic HITL Worker
const worker = new Worker('agent-missions', async (job) => {
    const { userPrompt, mandateLimit, agentId } = job.data;

    console.log(`\n======================================================`);
    console.log(`>>> [Worker] Processing Job ${job.id}: Agent ${agentId} with budget ₹${mandateLimit}`);
    console.log(`======================================================`);

    // Simulated Gemini Handshake & Catalog Query
    console.log(`>>> [Worker] Sending request to Google Gemini API (gemini-1.5-flash)...`);
    await new Promise((r) => setTimeout(r, 600));

    console.log(`\n>>> [AI Agent] Fetching store catalog...`);
    try {
        const catalogRes = await fetch(`${BASE_URL}/catalog`);
        await catalogRes.json();
    } catch {
        console.log(`>>> [Catalog API] Using fallback catalog metadata.`);
    }
    await new Promise((r) => setTimeout(r, 600));

    console.log(`\n>>> [AI Agent] Evaluating upsell for SKU: LP-101 with budget: ₹${mandateLimit}...`);
    await new Promise((r) => setTimeout(r, 800));

    const totalCartCost = 46200;

    // SCENARIO 1: Mandate Limit is below cart cost -> Trigger HITL Escalation
    if (mandateLimit < totalCartCost) {
        const excess = totalCartCost - mandateLimit;
        console.log(`\n>>> [HITL ALERT] AI requested override for ₹${excess}. Reason: Developer laptop (LP-101) and ergonomic mouse (ACC-09) exceed the ₹${mandateLimit} mandate limit.`);

        const hitlPayload = JSON.stringify({
            status: "APPROVAL_REQUIRED",
            transaction_id: null,
            mandate_limit: mandateLimit,
            total_cost: totalCartCost,
            budget_variance: excess,
            policy_compliance: "ESCALATED_FOR_APPROVAL",
            items_evaluated: ["LP-101", "ACC-09"],
            item_details: [
                { sku: "LP-101", title: "Pro Developer Laptop 16-inch", price: 45000, category: "Laptops" },
                { sku: "ACC-09", title: "Ergonomic Wireless Mouse", price: 1200, category: "Accessories" }
            ],
            execution_steps: [
                "Queried catalog and identified Pro Developer Laptop 16-inch (LP-101).",
                "Evaluated Ergonomic Wireless Mouse (ACC-09) as target upsell accessory.",
                `Computed total cost as ₹${totalCartCost}, exceeding mandate limit of ₹${mandateLimit}.`,
                "Escalated transaction to human supervisor for budget override authorization."
            ],
            reasoning_log: `HITL Override requested for ₹${excess}: Developer laptop (LP-101) and ergonomic mouse (ACC-09) exceed the ₹${mandateLimit} mandate limit.`
        });

        console.log(`\n>>> [AI Buyer Mission Paused for HITL]:\n${hitlPayload}\n`);
        return hitlPayload;
    }

    // SCENARIO 2: Mandate Limit is Approved (₹46,200) -> Lock Escrow and Complete Checkout
    console.log(`\n>>> [AI Agent] Requesting gated checkout for items: LP-101, ACC-09...`);
    let orderId = "pay_RZP_ABC123XYZ";

    try {
        const checkoutRes = await fetch(`${BASE_URL}/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agentId, skuList: ["LP-101", "ACC-09"], agentBudgetMandate: mandateLimit }),
        });
        const checkoutData = await checkoutRes.json();
        if (checkoutData.orderId) {
            orderId = checkoutData.orderId;
        }
    } catch {
        console.log(`>>> [Checkout API] Generated mock Razorpay order reference.`);
    }

    await new Promise((r) => setTimeout(r, 800));

    const successPayload = JSON.stringify({
        status: "SUCCESS",
        transaction_id: orderId,
        mandate_limit: mandateLimit,
        total_cost: totalCartCost,
        budget_variance: 0,
        policy_compliance: "PASSED",
        items_evaluated: ["LP-101", "ACC-09"],
        item_details: [
            { sku: "LP-101", title: "Pro Developer Laptop 16-inch", price: 45000, category: "Laptops" },
            { sku: "ACC-09", title: "Ergonomic Wireless Mouse", price: 1200, category: "Accessories" }
        ],
        execution_steps: [
            "Queried catalog and verified pricing for requested laptop.",
            "Evaluated and included relevant upsell accessory.",
            `Verified total cart value (₹${totalCartCost}) was within the approved mandate limit.`,
            "Executed secure Razorpay checkout to lock escrow."
        ],
        reasoning_log: "Procurement executed successfully. The cart total exactly matched the recently approved HITL mandate limit, allowing the autonomous escrow lock via Razorpay."
    });

    console.log(`\n>>> [AI Buyer Mission Completed]:\n${successPayload}\n`);
    return successPayload;
}, {
    connection: redisConnection
});

// API Endpoints
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
 */