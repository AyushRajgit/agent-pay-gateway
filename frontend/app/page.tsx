"use client";

import { useState } from "react";

export default function AgentDashboard() {
    const [agentId, setAgentId] = useState("AGENT-OMEGA-99");
    const [mandateLimit, setMandateLimit] = useState(50000);
    const [userPrompt, setUserPrompt] = useState("Find the developer laptop, check upsells, and execute secure checkout.");

    const [jobId, setJobId] = useState<string | null>(null);
    const [jobState, setJobState] = useState<string | null>(null);
    const [workerId, setWorkerId] = useState<string | null>(null);
    const [result, setResult] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // 1. Submit mission to Node.js backend queue (Port 3001)
    const handleRunAgent = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setJobId(null);
        setJobState("queued");
        setWorkerId(null);
        setResult(null);

        try {
            const res = await fetch("http://localhost:3001/api/run-agent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ agentId, mandateLimit, userPrompt }),
            });
            const data = await res.json();

            if (data.success) {
                setJobId(data.jobId);
                pollJobStatus(data.jobId);
            } else {
                alert("Error queuing mission: " + data.error);
                setLoading(false);
            }
        } catch (err) {
            console.error(err);
            alert("Failed to connect to agent server on port 3001.");
            setLoading(false);
        }
    };

    // 2. Poll the job status endpoint until it completes or fails
    const pollJobStatus = (id: string) => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`http://localhost:3001/api/job/${id}`);
                const data = await res.json();

                setJobState(data.state);
                if (data.workerId) {
                    setWorkerId(data.workerId);
                }

                if (data.state === "completed") {
                    clearInterval(interval);
                    setResult(data.result);
                    setLoading(false);
                } else if (data.state === "failed") {
                    clearInterval(interval);
                    setResult("Mission failed during execution. Check server logs.");
                    setLoading(false);
                }
            } catch (err) {
                console.error("Polling error:", err);
            }
        }, 2000); // Poll every 2 seconds
    };

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Header */}
                <div className="border-b border-slate-800 pb-6">
                    <h1 className="text-3xl font-extrabold tracking-tight text-indigo-400">
                        🤖 AgentPay Command Center
                    </h1>
                    <p className="text-slate-400 mt-2">
                        Dispatch autonomous shopping agents with strict budget mandates and secure policy enforcement.
                    </p>
                </div>

                {/* Input Form Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
                    <form onSubmit={handleRunAgent} className="space-y-4">

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Agent ID */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Agent ID</label>
                                <input
                                    type="text"
                                    value={agentId}
                                    onChange={(e) => setAgentId(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                                    required
                                />
                            </div>

                            {/* Mandate Limit */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Spending Mandate Limit (₹)</label>
                                <input
                                    type="number"
                                    value={mandateLimit}
                                    onChange={(e) => setMandateLimit(Number(e.target.value))}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                                    required
                                />
                            </div>
                        </div>

                        {/* User Prompt */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Agent Prompt Instructions</label>
                            <textarea
                                rows={3}
                                value={userPrompt}
                                onChange={(e) => setUserPrompt(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                                required
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-lg transition-all shadow-lg disabled:opacity-50 cursor-pointer"
                        >
                            {loading ? "🚀 Dispatching Mission to Queue..." : "▶️ Run AI Buyer"}
                        </button>
                    </form>
                </div>

                {/* Live Status & Results Section */}
                {(jobState || result) && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h2 className="text-lg font-bold text-slate-200">Mission Execution Status</h2>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                                jobState === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                    jobState === 'failed' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                                        'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                            }`}>
                {jobState || "idle"}
              </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono text-slate-400 bg-slate-950 p-3 rounded-lg border border-slate-800">
                            <div>📦 Job ID: <span className="text-indigo-300">{jobId || "Assigning..."}</span></div>
                            <div>⚙️ Assigned Worker: <span className="text-emerald-300">{workerId || "Waiting for worker..."}</span></div>
                        </div>

                        {result && (
                            <div className="mt-4 bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-sm">
                                <h3 className="text-emerald-400 border-b border-slate-800 pb-2 mb-2">✅ XAI Audit Trail</h3>
                                {(() => {
                                    try {
                                        const audit = JSON.parse(result);
                                        return (
                                            <ul className="space-y-2 text-slate-300">
                                                <li><span className="text-slate-500">Decision:</span> {audit.status}</li>
                                                <li><span className="text-slate-500">Evaluated:</span> {audit.items_evaluated.join(", ")}</li>
                                                <li><span className="text-slate-500">Financials:</span> ₹{audit.total_cost} / ₹{audit.mandate_limit} Limit</li>
                                                <li className="mt-2 text-indigo-300">"{audit.reasoning_log}"</li>
                                            </ul>
                                        );
                                    } catch {
                                        // Fallback if the AI just returns plain text
                                        return <span>{result}</span>;
                                    }
                                })()}
                            </div>
                        )}
                    </div>
                )}

            </div>
        </main>
    );
}