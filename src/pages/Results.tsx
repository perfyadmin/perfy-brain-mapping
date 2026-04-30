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
        {responses && <ReportSummary targetUser={user} responses={responses} unlocked={unlocked} setUnlocked={setUnlocked} />}
      </div>
    </div>
  );
}
