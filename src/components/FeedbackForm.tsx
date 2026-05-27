import { useState } from "react";
import { Star, Upload, Video, Sparkles, MessageSquare, ShieldCheck, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_BASE_URL } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface Props {
  onSubmitSuccess: () => void;
}

export default function FeedbackForm({ onSubmitSuccess }: Props) {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [videoBase64, setVideoBase64] = useState("");
  const [videoName, setVideoName] = useState("");
  const [videoSize, setVideoSize] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleStarClick = (stars: number) => {
    setRating(stars);
  };

  const handleStarMouseEnter = (stars: number) => {
    setHoverRating(stars);
  };

  const handleStarMouseLeave = () => {
    setHoverRating(0);
  };

  // Convert selected video testimonial to base64 payload
  const handleVideoUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 20MB max
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "File too large", description: "Video testimonials are limited to 20MB.", variant: "destructive" });
      return;
    }

    setVideoName(file.name);
    setVideoSize((file.size / (1024 * 1024)).toFixed(2) + " MB");

    const reader = new FileReader();
    reader.onloadend = () => {
      setVideoBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast({ title: "Rating Required", description: "Please select a star rating from 1 to 5.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem("mm_token");
      const res = await fetch(`${API_BASE_URL}/assessment/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          rating,
          text: feedbackText,
          video: videoBase64 || null
        })
      });

      const data = await res.json();

      if (res.ok) {
        toast({ title: "Thank You! 🎉", description: "Your feedback is submitted and report is fully unlocked!" });
        onSubmitSuccess();
      } else {
        toast({ title: "Submission Failed", description: data.message || "Failed to submit feedback.", variant: "destructive" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="max-w-xl mx-auto mt-12 glass-panel fade-in border-2 border-primary/20 shadow-elevated overflow-hidden">
      <div className="relative bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-6 text-center border-b border-border">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/15 flex items-center justify-center mb-3">
          <Sparkles className="w-6 h-6 text-primary animate-pulse" />
        </div>
        <h2 className="text-xl font-display font-bold text-foreground">Unlock Your Detailed Report</h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          Please share your feedback about the assessment. Your report will unlock instantly after submitting.
        </p>
      </div>

      <CardContent className="p-6 md:p-8 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* 5-STAR INTERACTIVE SELECTOR */}
          <div className="space-y-2 text-center">
            <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Rate Your Experience *</Label>
            <div className="flex justify-center items-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((index) => {
                const filled = index <= (hoverRating || rating);
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleStarClick(index)}
                    onMouseEnter={() => handleStarMouseEnter(index)}
                    onMouseLeave={handleStarMouseLeave}
                    className="p-1 transition-transform hover:scale-125 focus:outline-none"
                  >
                    <Star
                      className={`w-10 h-10 transition-colors duration-250 ${
                        filled ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            {rating > 0 && (
              <p className="text-xs font-semibold text-primary">
                {rating === 5 ? "Loved it! Excellent! 😍" : rating === 4 ? "Great experience! 😊" : rating === 3 ? "Neutral / Good. 🙂" : rating === 2 ? "Could be better. 🙁" : "Poor. 😢"}
              </p>
            )}
          </div>

          {/* WRITTEN COMMENT TEXTAREA */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground">
              <MessageSquare className="w-4 h-4 text-primary" /> Share Your Testimonial (Written)
            </Label>
            <textarea
              required
              rows={4}
              placeholder="How did this personality and intelligence assessment help you? Your feedback helps us grow!"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className="w-full text-sm rounded-xl p-3 border border-border bg-card/50 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors leading-relaxed"
            />
          </div>

          {/* VIDEO TESTIMONIAL LOADER */}
          <div className="space-y-2 p-4 rounded-xl border border-dashed border-primary/20 bg-primary/5">
            <Label className="text-xs font-semibold flex items-center justify-between gap-1.5 uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-1.5"><Video className="w-4 h-4 text-primary" /> Video Testimonial</span>
              <span className="text-[10px] bg-muted py-0.5 px-2 rounded-full uppercase text-muted-foreground">Optional</span>
            </Label>
            
            <div className="mt-2 flex flex-col gap-3">
              <Input
                type="file"
                id="testimonial-video"
                accept="video/*"
                onChange={handleVideoUploadChange}
                className="hidden"
              />
              <Label
                htmlFor="testimonial-video"
                className="cursor-pointer border border-dashed border-primary/40 hover:border-primary rounded-xl p-4 flex flex-col items-center gap-1.5 bg-card hover:bg-primary/5 transition-all text-center"
              >
                <Upload className="w-5 h-5 text-primary" />
                <span className="text-xs font-semibold text-foreground">
                  {videoName ? `Selected: ${videoName}` : "Choose video file"}
                </span>
                <span className="text-[9px] text-muted-foreground">Accepts MP4, MOV, WebM (Max size: 20MB)</span>
              </Label>

              {videoName && (
                <div className="flex items-center justify-between text-xs bg-muted/50 p-2.5 rounded-lg border border-border">
                  <span className="font-semibold text-primary truncate max-w-[200px]">{videoName}</span>
                  <span className="text-muted-foreground font-mono text-[10px]">{videoSize}</span>
                </div>
              )}
            </div>
          </div>

          {/* BUTTON FOR ACTION SUBMIT */}
          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-12 gradient-primary text-primary-foreground gap-2 font-semibold hover:scale-[1.01] transition-transform shadow-lg rounded-xl"
          >
            {submitting ? (
              <span>Uploading &amp; Unlocking...</span>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5" /> Submit Feedback &amp; Unlock Report <Check className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
