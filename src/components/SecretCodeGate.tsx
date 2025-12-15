import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Shield, AlertTriangle } from "lucide-react";

interface SecretCodeGateProps {
  onAccessGranted: (name: string) => void;
}

const SECRET_CODE = "CIPHER2024";

const SecretCodeGate = ({ onAccessGranted }: SecretCodeGateProps) => {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isShaking, setIsShaking] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError("Enter your alias to proceed");
      triggerShake();
      return;
    }

    if (code.toUpperCase() === SECRET_CODE) {
      onAccessGranted(name.trim());
    } else {
      setError("ACCESS DENIED - Invalid code");
      triggerShake();
    }
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background cyber-grid relative overflow-hidden">
      {/* Scanline overlay */}
      <div className="absolute inset-0 scanline pointer-events-none" />
      
      {/* Floating particles effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-primary/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      <div
        className={`relative w-full max-w-md p-8 transition-transform ${
          isShaking ? "animate-shake" : ""
        }`}
        style={{
          animation: isShaking ? "shake 0.5s ease-in-out" : undefined,
        }}
      >
        {/* Main card */}
        <div className="bg-card/80 backdrop-blur-xl border border-primary/30 rounded-lg p-8 glow-primary">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-2 border-primary/50 bg-background/50 mb-4 animate-pulse-glow">
              <Shield className="w-10 h-10 text-primary" />
            </div>
            <h1 className="font-display text-3xl font-bold text-primary text-glow tracking-wider">
              SECURE CHANNEL
            </h1>
            <p className="text-muted-foreground mt-2 text-sm tracking-wide">
              [ ENCRYPTED MESSAGING PROTOCOL ]
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                Your Alias
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                placeholder="Enter your codename..."
                className="bg-background/50 border-primary/30 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/50 h-12"
                maxLength={20}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Lock className="w-3 h-3" />
                Access Code
              </label>
              <Input
                type="password"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError("");
                }}
                placeholder="Enter secret code..."
                className="bg-background/50 border-primary/30 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/50 h-12 font-mono tracking-widest"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded px-3 py-2">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-display tracking-wider uppercase text-sm glow-primary transition-all duration-300 hover:scale-[1.02]"
            >
              Authenticate
            </Button>
          </form>

          {/* Hint */}
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground/60">
              Hint: The code is <span className="text-primary/80 font-mono">CIPHER2024</span>
            </p>
          </div>
        </div>

        {/* Decorative corners */}
        <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-primary/50" />
        <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-primary/50" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-primary/50" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-primary/50" />
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-20px) scale(1.5); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
};

export default SecretCodeGate;
