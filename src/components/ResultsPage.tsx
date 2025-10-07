import { API_BASE_URL } from '../services/api';
import { useEffect, useMemo, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';

export default function ResultsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const resumeIdRaw = sessionStorage.getItem('rb_resume_id');
    const resumeId = Number(resumeIdRaw || '');
    if (!resumeId) {
      setError('Missing resume_id in session');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/evaluation/${resumeId}`);
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`${res.status} ${txt}`);
        }
        const json = await res.json();
        setData(json);
      } catch (e: any) {
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Compute all derived values via hooks BEFORE any early returns
  const result = data?.result || {};
  // Map to the provided schema
  const overallScore10: number | undefined = result?.overall_assessment?.score;
  const overallFeedback: string = result?.overall_assessment?.feedback_summary || '';
  const technicalScore10: number | undefined = result?.technical_competency?.score;
  const technicalFeedback: string = result?.technical_competency?.feedback || '';
  const communicationScore10: number | undefined = result?.communication_assessment?.score;
  const communicationFeedback: string = result?.communication_assessment?.feedback || '';
  const sentiment: string | undefined = result?.communication_assessment?.sentiment?.overall_sentiment;
  const callSummary: string = result?.overall_assessment?.feedback_summary || '';

  const sentimentBadge = useMemo(() => {
    if (!sentiment) return null;
    const s = sentiment.toLowerCase();
    const color = s.includes('pos') ? 'text-green-700 bg-green-50 border-green-200' : s.includes('neg') ? 'text-red-700 bg-red-50 border-red-200' : 'text-gray-700 bg-gray-50 border-gray-200';
    const dot = s.includes('pos') ? 'bg-green-500' : s.includes('neg') ? 'bg-red-500' : 'bg-gray-400';
    return (
      <div className={`inline-flex items-center gap-2 text-xs px-2 py-1 rounded border ${color}`}>
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <span className="font-medium">User Sentiment: {sentiment}</span>
      </div>
    );
  }, [sentiment]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="flex items-center gap-2 text-gray-700"><Loader2 className="animate-spin" /> Loading results...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 text-sm">{error}</div>
      </div>
    );
  }

  const ring = (value: number | undefined, max: number = 10) => {
    if (typeof value !== 'number' || !isFinite(value)) return null;
    const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
    const bg = `conic-gradient(#2563eb ${pct * 3.6}deg, #e5e7eb ${pct * 3.6}deg)`; // blue to gray
    return (
      <div className="relative w-14 h-14">
        <div className="w-14 h-14 rounded-full" style={{ background: bg }} />
        <div className="absolute inset-1 bg-white rounded-full flex items-center justify-center">
          <span className="text-sm font-semibold text-gray-900">{value}<span className="text-[10px] text-gray-500">/{max}</span></span>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><FileText className="text-blue-600" /> <h2 className="text-lg font-semibold">Evaluation Summary</h2></div>
          <div className="text-xs text-gray-600">Resume ID: {data?.resume_id} {data?.jd_id ? `• JD ID: ${data.jd_id}` : ''}</div>
        </div>
      </div>

      {/* Three-card summary row */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-start gap-3">
            {ring(overallScore10)}
            <div>
              <div className="text-base font-semibold text-gray-900">Overall Hiring Score</div>
              <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                {overallFeedback || 'No overall feedback available.'}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-start gap-3">
            {ring(communicationScore10)}
            <div>
              <div className="text-base font-semibold text-gray-900">Communication</div>
              <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                {communicationFeedback || 'No communication notes available.'}
              </p>
            </div>
          </div>
        </div>
        
      </div>

      {/* Raw block as a collapsible fallback */}
      {data?.result && (
        <details className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          {/* <summary className="cursor-pointer text-sm font-medium text-gray-900">Raw Evaluation JSON</summary> */}
          <pre className="mt-3 whitespace-pre-wrap text-xs text-gray-800">{JSON.stringify(data.result, null, 2)}</pre>
        </details>
      )}

      {/* Technical Competency card */}
      {(typeof technicalScore10 === 'number' || technicalFeedback) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-start gap-3">
            {ring(technicalScore10)}
            <div>
              <div className="text-base font-semibold text-gray-900">Technical Competency</div>
              <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                {technicalFeedback || 'No technical feedback available.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


