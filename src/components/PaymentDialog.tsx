import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Building2, GraduationCap, Briefcase, Lock, ArrowRight, Upload, QrCode, Ticket } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

type Audience = "individual" | "working" | "organization" | "group";

interface AddOn {
  id: string;
  label: string;
  base: number;
  discountPct?: number;
  helper?: string;
  required?: boolean;
}

const PLANS: Record<Exclude<Audience, "organization" | "group">, { title: string; addons: AddOn[] }> = {
  individual: {
    title: "Individual",
    addons: [
      { id: "brain", label: "Brain Mapping (Detailed Report)", base: 1000, discountPct: 20, helper: "Full 20-page interpretation report", required: true },
      { id: "tech", label: "Technical Counseling Session", base: 800, helper: "1-on-1 session with our specialist" },
      { id: "career", label: "Course & Career Guidance (School / College)", base: 800, helper: "Personalised academic & career roadmap" },
    ],
  },
  working: {
    title: "Working Professional",
    addons: [
      { id: "brain", label: "Brain Mapping (Detailed Report)", base: 1000, helper: "Full 20-page interpretation report", required: true },
      { id: "tech", label: "Technical Counseling Session", base: 800, helper: "1-on-1 session with our specialist" },
    ],
  },
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onUnlock: () => void;
}

function priceAfter(addon: AddOn, groupDiscount: boolean): number {
  let p = addon.base;
  if (addon.discountPct) p = Math.round(p * (1 - addon.discountPct / 100));
  if (groupDiscount) p = Math.round(p * 0.85);
  return p;
}

const loadRazorpay = () => {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function PaymentDialog({ open, onOpenChange, onUnlock }: Props) {
  const [audience, setAudience] = useState<Audience>("individual");
  const [selected, setSelected] = useState<Record<string, boolean>>({ brain: true });
  const [contactEmail, setContactEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const [upiId, setUpiId] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [screenshot, setScreenshot] = useState("");
  const [screenshotName, setScreenshotName] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Load UPI config from backend
  useEffect(() => {
    if (!open) return;
    const fetchUpiConfig = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/payment/upi-config`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.upiId) {
            setUpiId(data.upiId);
          }
        }
      } catch (err) {
        console.error("Failed to load UPI config", err);
      }
    };
    fetchUpiConfig();
  }, [open]);

  // Handle discount code application
  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) return;
    setApplyingDiscount(true);
    try {
      const token = localStorage.getItem("mm_token");
      const res = await fetch(`${API_BASE_URL}/payment/apply-discount`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ code: discountCode })
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Success! 🎉", description: "Discount code applied. Your report is now unlocked." });
        onOpenChange(false);
        onUnlock();
      } else {
        toast({ title: "Invalid Code", description: data.message || "Failed to apply discount code.", variant: "destructive" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setApplyingDiscount(false);
    }
  };

  // Convert uploaded image file to base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please upload an image smaller than 5MB.", variant: "destructive" });
      return;
    }

    setScreenshotName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshot(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const isContact = audience === "organization" || audience === "group";
  const isGroup = audience === "group";

  const plan = !isContact ? PLANS[(isGroup ? "individual" : audience) as keyof typeof PLANS] : null;

  const total = useMemo(() => {
    if (!plan) return 0;
    return plan.addons.reduce((sum, a) => {
      if (!selected[a.id] && !a.required) return sum;
      return sum + priceAfter(a, isGroup);
    }, 0);
  }, [plan, selected, isGroup]);

  // Submit payment screenshot to backend S3
  const handleUpiPaySubmit = async () => {
    if (!screenshot) {
      toast({ title: "Upload Required", description: "Please select your transaction screenshot first.", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    try {
      const planTitle = audience === "group" ? "Group / Students" : (plan ? plan.title : audience);
      const selectedAddonLabels = plan
        ? plan.addons
            .filter(a => selected[a.id] || a.required)
            .map(a => a.label)
            .join(", ")
        : "";

      const token = localStorage.getItem("mm_token");
      const res = await fetch(`${API_BASE_URL}/payment/submit-screenshot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          screenshot,
          selectedPlan: planTitle,
          selectedAddons: selectedAddonLabels,
          payableAmount: total
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Screenshot Submitted! 🚀", description: "Our team is verifying your payment. Your report will unlock shortly!" });
        onOpenChange(false);
        // Force a page reload to pull the new "Pending Verification" assessment state
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        toast({ title: "Submission Failed", description: data.message || "Failed to upload screenshot.", variant: "destructive" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAudience = (v: string) => {
    setAudience(v as Audience);
    setSelected({ brain: true });
    setSubmitted(false);
  };

  const submitContact = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          scope: audience,
          message: "Custom Plan Request from Brain Mapping Results Page (Dialog)"
        })
      });
      if (res.ok) {
        setSubmitted(true);
        setTimeout(() => { 
          setSubmitted(false); 
          setContactName(""); 
          setContactEmail("");
          onOpenChange(false);
        }, 3000);
      } else {
        toast({ title: "Error", description: "Failed to send inquiry. Please try again.", variant: "destructive" });
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePay = async () => {
    setSubmitted(true);
    const resLoaded = await loadRazorpay();
    
    if (!resLoaded) {
      toast({ title: "Error", description: "Razorpay SDK failed to load. Are you online?", variant: "destructive" });
      setSubmitted(false);
      return;
    }

    try {
      const token = localStorage.getItem("mm_token");
      
      // 1. Create order on backend
      const orderRes = await fetch(`${API_BASE_URL}/payment/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ amount: total })
      });
      
      const orderData = await orderRes.json();
      
      if (!orderRes.ok) throw new Error(orderData.message || "Failed to create order");

      // 2. Initialize Razorpay Checkout
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Perfy",
        description: "Brain Mapping Detailed Report",
        image: "https://perfy.com/logo.png", // Replace with real logo if needed
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            // 3. Verify payment on backend
            const verifyRes = await fetch(`${API_BASE_URL}/payment/verify`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              })
            });

            if (verifyRes.ok) {
              toast({ title: "Payment Successful!", description: "Your detailed report is now unlocked." });
              onOpenChange(false);
              onUnlock();
            } else {
              const verifyData = await verifyRes.json();
              toast({ title: "Verification Failed", description: verifyData.message, variant: "destructive" });
            }
          } catch (err) {
            console.error(err);
            toast({ title: "Error", description: "Something went wrong during verification.", variant: "destructive" });
          }
        },
        prefill: {
          name: contactName || "User",
          email: contactEmail || "user@example.com",
        },
        theme: {
          color: "#3b82f6", // Primary blue color
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        toast({ title: "Payment Failed", description: response.error.description, variant: "destructive" });
      });
      
      // Crucial Fix: Close the Radix UI Dialog BEFORE opening Razorpay.
      // Radix Dialogs trap focus, which prevents users from typing in the Razorpay iframe on mobile!
      onOpenChange(false);
      
      rzp.open();

    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Could not initiate payment.", variant: "destructive" });
      setSubmitted(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" /> Unlock Your Detailed Report
          </DialogTitle>
          <DialogDescription>
            Choose your plan and add-ons. The base detailed report is required; counseling and guidance are optional add-ons.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={audience} onValueChange={handleAudience} className="mt-2">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-auto">
            <TabsTrigger value="individual" className="gap-1 text-xs"><GraduationCap className="w-3.5 h-3.5" /> Individual</TabsTrigger>
            <TabsTrigger value="working" className="gap-1 text-xs"><Briefcase className="w-3.5 h-3.5" /> Working</TabsTrigger>
            <TabsTrigger value="organization" className="gap-1 text-xs"><Building2 className="w-3.5 h-3.5" /> Organization</TabsTrigger>
            <TabsTrigger value="group" className="gap-1 text-xs"><Sparkles className="w-3.5 h-3.5" /> Group / Students</TabsTrigger>
          </TabsList>

          {/* Individual / Working / Group share addon UI */}
          {!isContact && (
            <TabsContent value={audience} className="mt-4 space-y-3">
              {isGroup && (
                <div className="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Group of students: an additional 15% off applied on every add-on.
                </div>
              )}
              {plan!.addons.map(a => {
                const checked = !!selected[a.id] || !!a.required;
                const finalPrice = priceAfter(a, isGroup);
                const original = a.base;
                return (
                  <Card
                    key={a.id}
                    className={`cursor-pointer transition-all ${checked ? "border-primary shadow-md" : "hover:border-primary/40"}`}
                    onClick={() => !a.required && setSelected(s => ({ ...s, [a.id]: !s[a.id] }))}
                  >
                    <CardContent className="p-4 flex items-start gap-3">
                      <Checkbox checked={checked} disabled={a.required} className="mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="font-display font-semibold text-sm">
                            {a.label}
                            {a.required && <span className="ml-2 text-[10px] uppercase tracking-wider text-primary">Included</span>}
                            {a.discountPct && (
                              <span className="ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                                {a.discountPct}% off
                              </span>
                            )}
                          </p>
                          <p className="font-bold text-primary tabular-nums">
                            ₹{finalPrice}
                            {finalPrice !== original && (
                              <span className="ml-2 text-xs text-muted-foreground line-through font-normal">₹{original}</span>
                            )}
                          </p>
                        </div>
                        {a.helper && <p className="text-xs text-muted-foreground mt-0.5">{a.helper}</p>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Discount Code Section */}
              <div className="p-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 space-y-2 mt-4">
                <Label className="text-xs font-bold flex items-center gap-1.5 text-primary">
                  <Ticket className="w-3.5 h-3.5" /> Have a Discount Code?
                </Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Enter code (e.g. FREE100)" 
                    value={discountCode} 
                    onChange={e => setDiscountCode(e.target.value)} 
                    className="h-9 text-xs"
                  />
                  <Button 
                    size="sm" 
                    onClick={handleApplyDiscount} 
                    disabled={applyingDiscount || !discountCode.trim()} 
                    className="gradient-primary text-primary-foreground h-9 font-semibold text-xs whitespace-nowrap px-4"
                  >
                    {applyingDiscount ? "Applying..." : "Apply Code"}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">Valid single-use codes immediately unlock your report for download.</p>
              </div>

              {/* UPI Payment / QR Code Section */}
              <div className="p-5 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5 space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap border-b border-primary/10 pb-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Payable</p>
                    <p className="text-2xl font-display font-bold text-primary tabular-nums">₹{total}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-primary font-semibold">
                    <QrCode className="w-4 h-4" /> Pay via UPI QR Code
                  </div>
                </div>

                {upiId ? (
                  <div className="flex flex-col gap-4 items-center">
                    {/* Render Dynamic QR Code */}
                    <div className="text-center space-y-2 w-full">
                      <div className="inline-block p-3 rounded-2xl bg-white border border-primary/15 shadow-md">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=${upiId.trim()}&pn=Perfy&am=${total}&cu=INR`)}`} 
                          alt="UPI QR Code" 
                          className="w-44 h-44 object-contain mx-auto"
                        />
                      </div>
                      <p className="text-xs font-semibold mt-1">Scan using GPay, PhonePe, Paytm, or BHIM</p>
                      <p className="text-[11px] text-muted-foreground font-mono bg-muted py-1 px-2.5 rounded-lg inline-block select-all">UPI ID: {upiId}</p>
                    </div>

                    {/* Screenshot File Upload */}
                    <div className="w-full space-y-2">
                      <Label className="text-xs font-bold block mb-1">Upload Payment Screenshot *</Label>
                      <div className="flex flex-col gap-2">
                        <Input 
                          type="file" 
                          id="upi-screenshot" 
                          accept="image/*" 
                          onChange={handleFileChange} 
                          className="hidden" 
                        />
                        <Label 
                          htmlFor="upi-screenshot" 
                          className="cursor-pointer border border-dashed border-primary/40 hover:border-primary rounded-xl p-3 flex flex-col items-center gap-1.5 bg-card hover:bg-primary/5 transition-all text-center"
                        >
                          <Upload className="w-5 h-5 text-primary" />
                          <span className="text-xs font-medium text-foreground">
                            {screenshotName ? `Selected: ${screenshotName}` : "Choose screenshot image"}
                          </span>
                          <span className="text-[9px] text-muted-foreground">Formats: PNG, JPG, JPEG (Max 5MB)</span>
                        </Label>
                      </div>
                    </div>

                    {/* Submit Verification Button */}
                    <Button
                      size="lg"
                      className="w-full gradient-primary text-primary-foreground gap-2 font-semibold hover:scale-[1.01] transition-transform shadow-md mt-2"
                      onClick={handleUpiPaySubmit}
                      disabled={isUploading || !screenshot || total === 0}
                    >
                      {isUploading ? "Uploading Screenshot..." : <>Submit Transaction for Approval <ArrowRight className="w-4 h-4" /></>}
                    </Button>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-800 dark:text-amber-300 text-xs text-center">
                    ⚠️ UPI configuration is pending. Please contact admin support or enter a discount code to unlock.
                  </div>
                )}
              </div>
            </TabsContent>
          )}

          <TabsContent value={audience} className="mt-4 space-y-3">
            <Card>
              <CardContent className="p-5 space-y-4">
                <div>
                  <h3 className="font-display font-bold text-lg">
                    {audience === "group" ? "Group / Student" : "Custom Organisation"} Plan
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {audience === "group" 
                      ? "Special group pricing, academic discounts, and bulk report access for your school or study group." 
                      : "Bulk pricing, dedicated dashboard, company-wise analytics, and on-demand counseling sessions for your team."
                    } Tell us about your needs and our team will reach out.
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Your name</Label>
                    <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Jane Doe" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Work email</Label>
                    <Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="jane@company.com" />
                  </div>
                </div>
                <Button
                  className="w-full gradient-primary text-primary-foreground"
                  disabled={!contactName || !contactEmail || submitted || isSubmitting}
                  onClick={submitContact}
                >
                  {isSubmitting ? "Sending..." : submitted ? "✓ Sent! We'll be in touch." : "Contact Sales Team"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter className="text-[11px] text-muted-foreground italic">
          Secure checkout • Instant report delivery • 100% confidential
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
