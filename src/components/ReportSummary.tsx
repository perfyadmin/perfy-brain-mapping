import { useState, useRef } from "react";
import { type User, useAuth } from "@/lib/auth";
import { calculateAllResults, type Responses } from "@/lib/scoring";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer,
} from "recharts";
import { generateDeepReport } from "@/lib/pdfReport";
import { Download, Lock, Brain, Sparkles, Lightbulb, Target, Compass, Check, Camera, Trash2, Upload, Video } from "lucide-react";
import { mbtiInterpretations } from "@/lib/interpretations";
import { BrainLogo, SECTION_LOBE_COLORS } from "@/components/BrainLogo";
import PaymentDialog from "@/components/PaymentDialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/api";

const birdIcons: Record<string, string> = { Eagle: "🦅", Parrot: "🦜", Dove: "🕊️", Owl: "🦉" };

const archetypeLines: Record<string, string> = {
  // MBTI -> famous person
  INTJ: "An INTJ — the strategic mind of an Elon Musk.",
  INTP: "An INTP — the curious analyst, like Einstein.",
  ENTJ: "An ENTJ — the natural commander, like Steve Jobs.",
  ENTP: "An ENTP — the visionary debater, like Mark Twain.",
  INFJ: "An INFJ — the quiet idealist, like Martin Luther King Jr.",
  INFP: "An INFP — the dreamer-poet, like J.R.R. Tolkien.",
  ENFJ: "An ENFJ — the inspirer, like Oprah Winfrey.",
  ENFP: "An ENFP — the creative explorer, like Walt Disney.",
  ISTJ: "An ISTJ — the reliable inspector, like George Washington.",
  ISFJ: "An ISFJ — the dedicated protector, like Mother Teresa.",
  ESTJ: "An ESTJ — the systematic director, like John D. Rockefeller.",
  ESFJ: "An ESFJ — the host of the room, like Taylor Swift.",
  ISTP: "An ISTP — the calm builder, like Clint Eastwood.",
  ISFP: "An ISFP — the artist's soul, like Frida Kahlo.",
  ESTP: "An ESTP — the bold doer, like Madonna.",
  ESFP: "An ESFP — the entertainer, like Jamie Foxx.",
};

interface Props {
  targetUser: User;
  responses: Responses;
  unlocked: boolean;
  setUnlocked: (val: boolean) => void;
}

export default function ReportSummary({ targetUser, responses, unlocked, setUnlocked }: Props) {
  const { user: viewer } = useAuth();
  const results = calculateAllResults(responses, targetUser.role === "employee");

  const isAdmin = viewer?.role === "admin";
  const [payOpen, setPayOpen] = useState(false);
  const canDownload = isAdmin || unlocked || viewer?.email === "hari@gmail.com";

  // Selfie / Upload photo states
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [activePhotoTab, setActivePhotoTab] = useState<"upload" | "webcam">("upload");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const startWebcam = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 300, height: 300, facingMode: "user" },
        audio: false
      });
      setStream(mediaStream);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 50);
    } catch (err) {
      console.error("Error accessing webcam:", err);
      toast({
        title: "Camera Access Error",
        description: "Could not open your camera. Please check permissions or upload an image instead.",
        variant: "destructive"
      });
    }
  };

  const stopWebcam = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handlePhotoUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please choose an image under 5MB.",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmDownload = async () => {
    // 1. Instantly trigger PDF download using local base64 for optimal zero-lag UX!
    generateDeepReport(targetUser, results, photoBase64 || undefined);
    setPhotoOpen(false);
    stopWebcam();

    // 2. Upload to S3 and save URL in database in the background
    if (photoBase64) {
      try {
        const token = localStorage.getItem("mm_token");
        await fetch(`${API_BASE_URL}/assessment/profile-photo`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ photo: photoBase64 })
        });
      } catch (err) {
        console.error("Failed to save profile photo in database:", err);
      }
    }
  };

  const handleSkipDownload = () => {
    generateDeepReport(targetUser, results);
    setPhotoOpen(false);
    stopWebcam();
  };

  const handleDialogChange = (open: boolean) => {
    setPhotoOpen(open);
    if (!open) {
      stopWebcam();
    }
  };

  const handleUnlock = () => {
    setUnlocked(true);
    setPhotoOpen(true);
  };

  const handleDownloadClick = () => {
    if (canDownload) {
      setPhotoOpen(true);
    } else {
      setPayOpen(true);
    }
  };

  // Brain dominance: real value from scoring (works for all roles now)
  const left = results.brainDominance.left;
  const right = results.brainDominance.right;

  // Section fills for the brain visual = 100% per completed section
  const fills: Record<string, number> = { A: 1, B: 1, C: 1, D: 1, E: 1, F: 1 };

  const birdEmoji = birdIcons[results.disc.bird] || "🦅";
  const mbtiInfo = mbtiInterpretations[results.mbti.type];
  const archetype = archetypeLines[results.mbti.type] ?? `${results.mbti.type} — ${mbtiInfo?.title ?? "a unique mind"}.`;

  // Compact radar — quotients
  const quotientData = [
    { subject: "IQ", value: results.quotients.IQ },
    { subject: "EQ", value: results.quotients.EQ },
    { subject: "AQ", value: results.quotients.AQ },
    { subject: "CQ", value: results.quotients.CQ },
  ];

  // Recommended bundle price based on role
  const isWorking = targetUser.role === "employee";
  const mappingPrice = isWorking ? 1000 : 800; // Students get 20% off mapping
  const counselingPrice = 800;
  const bundleTotal = mappingPrice + counselingPrice;

  return (
    <div className="space-y-6">
      {/* HERO */}
      <Card className="overflow-hidden border-0 shadow-elevated">
        <CardContent className="p-0">
          <div className="relative bg-gradient-to-br from-primary/15 via-background to-secondary/15 p-6 md:p-8">
            <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-primary/10 blur-3xl" aria-hidden />
            <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-secondary/10 blur-3xl" aria-hidden />
            <div className="relative grid md:grid-cols-[220px_1fr] gap-6 items-center">
              <div className="flex items-center justify-center">
                <BrainLogo size={200} fills={fills} animated />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">
                  Your snapshot, {targetUser.name.split(" ")[0]}
                </p>
                <h1 className="text-2xl md:text-3xl font-display font-bold leading-tight">
                  {archetype}
                </h1>
                <p className="text-sm text-muted-foreground mt-2 max-w-xl">
                  You're a <strong className="text-foreground">{results.disc.bird} {birdEmoji}</strong> with strong{" "}
                  <strong className="text-foreground">{results.intelligence.top2[0]}</strong> intelligence and a leaning toward{" "}
                  <strong className="text-foreground">{results.career.top2[0]}</strong> careers. The full analysis — 20+ pages,
                  charts, action plan and roadmap — is in your detailed report.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="lg"
                    onClick={handleDownloadClick}
                    className="rounded-xl gradient-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow"
                  >
                    {canDownload ? <Download className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                    {canDownload ? "Download Detailed Report (PDF)" : `Unlock for ₹${bundleTotal}`}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KEY HIGHLIGHTS — 4 small cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Highlight
          icon={<span className="text-xl">{birdEmoji}</span>}
          label="DISC Type"
          value={results.disc.bird}
          accent={SECTION_LOBE_COLORS.A}
          sub={results.disc.dominant}
        />
        <Highlight
          icon={<Brain className="w-4 h-4" />}
          label="MBTI"
          value={results.mbti.type}
          accent={SECTION_LOBE_COLORS.B}
          sub={mbtiInfo?.title ?? ""}
        />
        <Highlight
          icon={<Lightbulb className="w-4 h-4" />}
          label="Top Intelligence"
          value={results.intelligence.top2[0]}
          accent={SECTION_LOBE_COLORS.C}
          sub={`+ ${results.intelligence.top2[1]}`}
        />
        <Highlight
          icon={<Target className="w-4 h-4" />}
          label="Best Career Fit"
          value={results.career.top2[0]}
          accent={SECTION_LOBE_COLORS.F}
          sub={`+ ${results.career.top2[1]}`}
        />
      </div>

      {/* QUOTIENTS RADAR + LEFT/RIGHT BRAIN */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-elevated">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="font-display font-bold text-sm">Quotient Snapshot</h3>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={quotientData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fontWeight: 600 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
                  <Radar
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.25}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "hsl(var(--primary))" }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-muted-foreground text-center mt-1">
              Detailed interpretation of each quotient is in the full PDF.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-elevated">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Compass className="w-4 h-4 text-primary" />
              <h3 className="font-display font-bold text-sm">Left vs Right Brain</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{left}%</div>
                <p className="text-[11px] text-muted-foreground">🔬 Left — Logical</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-secondary">{right}%</div>
                <p className="text-[11px] text-muted-foreground">🎨 Right — Creative</p>
              </div>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden flex">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-1000"
                style={{ width: `${left}%` }}
              />
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-1000"
                style={{ width: `${right}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
              {left > right
                ? "You lean toward analytical, structured thinking. The PDF breaks down where this strength shines and where to balance it."
                : left < right
                  ? "You lean toward creative, intuitive thinking. The PDF shows the careers and habits that channel this best."
                  : "Beautifully balanced — your detailed report explains how to leverage both hemispheres."}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* PAYWALL TEASER */}
      <Card className="border-0 shadow-elevated overflow-hidden">
        <CardContent className="p-6 bg-gradient-to-r from-primary/10 via-background to-secondary/10">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold mb-2">
                <Lock className="w-3 h-3" /> What's inside the detailed report
              </div>
              <h3 className="text-lg font-display font-bold mb-1">
                20+ pages of deep analysis, charts, action plan and career roadmap.
              </h3>
              <ul className="text-xs text-muted-foreground grid sm:grid-cols-2 gap-x-4 gap-y-1 mt-2">
                <li><Check className="w-3 h-3 text-primary inline mr-1" /> Full DISC + MBTI interpretation</li>
                <li><Check className="w-3 h-3 text-primary inline mr-1" /> 8 Multiple-Intelligence breakdown</li>
                <li><Check className="w-3 h-3 text-primary inline mr-1" /> IQ • EQ • AQ • CQ deep dive</li>
                <li><Check className="w-3 h-3 text-primary inline mr-1" /> Learning style guide</li>
                <li><Check className="w-3 h-3 text-primary inline mr-1" /> SWOT analysis</li>
                <li><Check className="w-3 h-3 text-primary inline mr-1" /> 0-2 / 2-5 / 5-10 year career roadmap</li>
                <li><Check className="w-3 h-3 text-primary inline mr-1" /> Personalised action plan</li>
                <li><Check className="w-3 h-3 text-primary inline mr-1" /> Left vs Right brain dominance</li>
              </ul>
            </div>
            <Button
              size="lg"
              onClick={handleDownloadClick}
              className="rounded-xl gradient-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow shrink-0"
            >
              {canDownload ? <Download className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
              {canDownload ? "Download PDF" : `Unlock for ₹${bundleTotal}`}
            </Button>
          </div>
        </CardContent>
      </Card>

      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} onUnlock={handleUnlock} />

      {/* Dynamic Profile Photo Collection Modal */}
      <Dialog open={photoOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-md w-[95%] glass-panel rounded-2xl border border-primary/20 shadow-elevated p-6 bg-card/95">
          <DialogHeader className="text-center">
            <DialogTitle className="text-xl font-display font-bold flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-primary animate-pulse" /> Add Your Profile Photo
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Add a professional photo or capture a quick selfie to personalize the cover page of your 20+ page deep interpretation report.
            </DialogDescription>
          </DialogHeader>

          {/* Simple Tab Toggler */}
          <div className="flex bg-muted/50 p-1 rounded-xl border border-border mt-4">
            <button
              type="button"
              onClick={() => { setActivePhotoTab("upload"); stopWebcam(); }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activePhotoTab === "upload" 
                  ? "bg-card text-foreground shadow-sm animate-fade-in" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Upload className="w-3.5 h-3.5" /> Upload File
            </button>
            <button
              type="button"
              onClick={() => { setActivePhotoTab("webcam"); startWebcam(); }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activePhotoTab === "webcam" 
                  ? "bg-card text-foreground shadow-sm animate-fade-in" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Camera className="w-3.5 h-3.5" /> Take Selfie
            </button>
          </div>

          <div className="mt-5 flex flex-col items-center justify-center min-h-[180px]">
            {activePhotoTab === "upload" ? (
              <div className="w-full flex flex-col items-center justify-center gap-4">
                {photoBase64 ? (
                  <div className="relative group w-32 h-32 rounded-2xl overflow-hidden border-2 border-primary/30 shadow-md">
                    <img src={photoBase64} alt="Profile preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotoBase64(null)}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-200"
                    >
                      <Trash2 className="w-5 h-5 text-red-400" />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="file"
                      id="profile-photo-input"
                      accept="image/*"
                      onChange={handlePhotoUploadChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="profile-photo-input"
                      className="cursor-pointer w-full border border-dashed border-primary/40 hover:border-primary rounded-xl p-8 flex flex-col items-center gap-2 bg-card hover:bg-primary/5 transition-all text-center"
                    >
                      <Upload className="w-8 h-8 text-primary" />
                      <span className="text-xs font-semibold text-foreground">Select local image file</span>
                      <span className="text-[10px] text-muted-foreground">Supports PNG, JPG, JPEG (Max 5MB)</span>
                    </label>
                  </>
                )}
              </div>
            ) : (
              <div className="w-full flex flex-col items-center justify-center gap-4">
                {photoBase64 ? (
                  <div className="relative group w-32 h-32 rounded-2xl overflow-hidden border-2 border-primary/30 shadow-md">
                    <img src={photoBase64} alt="Selfie preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setPhotoBase64(null); startWebcam(); }}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-200"
                    >
                      <Trash2 className="w-5 h-5 text-red-400" />
                    </button>
                  </div>
                ) : (
                  <div className="relative w-full max-w-[280px] aspect-square rounded-2xl overflow-hidden border border-border bg-black/10 flex items-center justify-center">
                    {stream ? (
                      <>
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const video = videoRef.current;
                            const canvas = canvasRef.current;
                            if (video && canvas) {
                              const ctx = canvas.getContext("2d");
                              if (ctx) {
                                canvas.width = 300;
                                canvas.height = 300;
                                const minDim = Math.min(video.videoWidth, video.videoHeight);
                                const sx = (video.videoWidth - minDim) / 2;
                                const sy = (video.videoHeight - minDim) / 2;
                                ctx.drawImage(video, sx, sy, minDim, minDim, 0, 0, 300, 300);
                                setPhotoBase64(canvas.toDataURL("image/jpeg", 0.95));
                                stopWebcam();
                              }
                            }
                          }}
                          className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground hover:scale-105 transition-transform p-3 rounded-full shadow-lg"
                        >
                          <Camera className="w-5 h-5" />
                        </button>
                      </>
                    ) : (
                      <div className="text-center p-4">
                        <Button type="button" onClick={startWebcam} variant="outline" size="sm" className="gap-2">
                          <Camera className="w-4 h-4 text-primary" /> Start Camera
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                {/* Hidden canvas for capturing selfie */}
                <canvas ref={canvasRef} className="hidden" />
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex gap-3 mt-6 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleSkipDownload}
              className="flex-1 rounded-xl text-xs"
            >
              Skip &amp; Download
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDownload}
              disabled={!photoBase64}
              className="flex-1 rounded-xl text-xs gradient-primary text-primary-foreground shadow-md"
            >
              Confirm &amp; Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Highlight({
  icon, label, value, sub, accent,
}: { icon: React.ReactNode; label: string; value: string; sub?: string; accent: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl p-3.5 border bg-card hover-scale"
      style={{ borderColor: accent + "33" }}
    >
      <div
        className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-30"
        style={{ background: accent }}
        aria-hidden
      />
      <div className="relative">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: accent }}>
          {icon} {label}
        </div>
        <p className="text-xl font-display font-bold mt-1 leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}
      </div>
    </div>
  );
}
