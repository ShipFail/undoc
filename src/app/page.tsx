"use client";

import { useState } from "react";

interface Section {
  title: string;
  content: string;
  type: "overview" | "quickstart" | "key-concepts" | "api-reference" | "examples" | "troubleshooting";
}

interface ProcessedDoc {
  title: string;
  summary: string;
  sections: Section[];
  keyTakeaways: string[];
  originalUrl: string;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessedDoc | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      setError("Please enter a documentation URL");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process documentation");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const getSectionIcon = (type: Section["type"]) => {
    switch (type) {
      case "overview":
        return "📋";
      case "quickstart":
        return "🚀";
      case "key-concepts":
        return "💡";
      case "api-reference":
        return "🔧";
      case "examples":
        return "📝";
      case "troubleshooting":
        return "🔍";
      default:
        return "📄";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold text-slate-900 dark:text-white mb-4">
            Un<span className="text-blue-600">Doc</span>
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Undo the docs. Read what matters.
          </p>
          <p className="text-md text-slate-500 dark:text-slate-400 mt-2 max-w-xl mx-auto">
            Transform complex documentation into structured, readable, and actionable pages.
          </p>
        </header>

        {/* URL Input Form */}
        <form onSubmit={handleSubmit} className="mb-12">
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste a documentation URL..."
              className="flex-1 px-6 py-4 text-lg rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-4 text-lg font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                "Transform"
              )}
            </button>
          </div>
        </form>

        {/* Error Display */}
        {error && (
          <div className="mb-8 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-red-600 dark:text-red-400 flex items-center gap-2">
              <span>⚠️</span> {error}
            </p>
          </div>
        )}

        {/* Results Display */}
        {result && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Title and Summary */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg border border-slate-200 dark:border-slate-700">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
                {result.title}
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                {result.summary}
              </p>
              <a 
                href={result.originalUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-4 text-blue-600 hover:text-blue-700 text-sm"
              >
                View original documentation →
              </a>
            </div>

            {/* Key Takeaways */}
            {result.keyTakeaways.length > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-8 border border-blue-100 dark:border-blue-800">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span>🎯</span> Key Takeaways
                </h3>
                <ul className="space-y-3">
                  {result.keyTakeaways.map((takeaway, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center font-medium">
                        {index + 1}
                      </span>
                      <span className="text-slate-700 dark:text-slate-300">{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sections */}
            <div className="space-y-6">
              {result.sections.map((section, index) => (
                <div 
                  key={index}
                  className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg border border-slate-200 dark:border-slate-700"
                >
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <span>{getSectionIcon(section.type)}</span>
                    {section.title}
                  </h3>
                  <div className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {section.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!result && !loading && !error && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Ready to simplify documentation
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Paste a link to any documentation page and we&apos;ll transform it into 
              a clean, structured format that&apos;s easy to read and understand.
            </p>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>Built with ❤️ for developers who value their time</p>
        </footer>
      </div>
    </div>
  );
}
