import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import ReportSummary from "@/components/ReportSummary";
import { BrainLogo } from "@/components/BrainLogo";

import { API_BASE_URL } from "@/lib/api";
import { type Responses } from "@/lib/scoring";

export default function ResultsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [responses, setResponses] = useState<Responses | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [paymentScreenshotUrl, setPaymentScreenshotUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    
    const fetchResults = async () => {
      try {
        const token = localStorage.getItem("mm_token");
        const res = await fetch(`${API_BASE_URL}/assessment`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.completed && data.responses) {
            setResponses(data.responses);
            setUnlocked(data.unlocked || false);
            setPaymentStatus(data.paymentStatus || null);
            setPaymentScreenshotUrl(data.paymentScreenshotUrl || null);
            setReady(true);
          } else {
            navigate("/assessment");
          }
        } else {
          // If fetch fails, fall back to check if they completed it locally? No, rely on cloud.
          navigate("/assessment");
        }
      } catch (err) {
        console.error("Failed to fetch results", err);
        navigate("/assessment");
      }
    };
    
    fetchResults();
  }, [user, navigate]);

  if (!user || !ready) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-2 mb-5">
          <div className="flex items-center gap-3">
            <BrainLogo size={42} />
            <div>
              <p className="text-sm font-display font-bold leading-tight">Personality &amp; Intelligence</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Your snapshot</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>Dashboard</Button>
          </div>
        </div>
        {!unlocked && paymentStatus === "pending" ? (
          <div className="max-w-xl mx-auto mt-12 glass-panel fade-in text-center p-8 space-y-6 border-2 border-primary/20 shadow-elevated">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
              <span className="text-3xl">⏳</span>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-display font-bold text-primary animate-pulse">Payment Verification Pending</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Thank you for your payment! Our admin team is currently reviewing your uploaded screenshot.
              </p>
              <p className="text-xs text-primary font-medium bg-primary/5 py-2 px-3 rounded-lg border border-primary/10 inline-block">
                Your detailed 20-page report will unlock automatically once approved. This usually takes 5-10 minutes.
              </p>
            </div>

            {paymentScreenshotUrl && (
              <div className="space-y-2 border-t border-border pt-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Uploaded Screenshot</p>
                <div className="relative group max-w-xs mx-auto border border-border rounded-xl overflow-hidden shadow-sm bg-muted/30">
                  <img 
                    src={paymentScreenshotUrl} 
                    alt="Payment Upload" 
                    className="w-full h-48 object-cover rounded-xl transition-all duration-300"
                  />
                  <a 
                    href={paymentScreenshotUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition-opacity"
                  >
                    View Fullscreen
                  </a>
                </div>
              </div>
            )}
            <div className="flex justify-center gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                Refresh Status
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate("/dashboard")}>
                Go to Dashboard
              </Button>
            </div>
          </div>
        ) : (
          <>
            {paymentStatus === "rejected" && (
              <div className="max-w-5xl mx-auto mb-5 p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-xs font-semibold flex items-center gap-2 shadow-sm">
                <span>⚠️ Your previous payment screenshot was rejected by the admin team. Please pay again via UPI QR and upload a clear screenshot of the transaction receipt.</span>
              </div>
            )}
            {responses && <ReportSummary targetUser={user} responses={responses} unlocked={unlocked} setUnlocked={setUnlocked} />}
          </>
        )}
      </div>
    </div>
  );
}
