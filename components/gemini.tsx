"use client";

import { useState } from "react";
import { askStudyAI } from "@/app/actions/ai";

export default function StudyAIPanel() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);

    const result = await askStudyAI(input);
    if (result.success) {
      setOutput(result.text || "");
    } else {
      setOutput("Error loading AI response.");
    }
    setLoading(false);
  };

  return (
    <div className="panel p-6 max-w-2xl mx-auto my-6">
      <div className="mb-4">
        <h2 className="panel-title text-lg font-bold">Study AI Assistant</h2>
        <p className="text-xs text-[var(--muted)] mt-1">
          Powered by Gemini to help you master your coursework.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3 mb-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a study question or prompt..."
          className="input flex-1"
        />
        <button type="submit" disabled={loading} className="primary-button">
          {loading ? "Thinking..." : "Ask AI"}
        </button>
      </form>

      {output && (
        <div className="mt-4 p-4 rounded-[var(--radius)] bg-[var(--surface-muted)] border border-[var(--border)] whitespace-pre-wrap text-sm leading-relaxed">
          {output}
        </div>
      )}
    </div>
  );
}
