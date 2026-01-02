import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Lock, Mail, User, ArrowLeft } from "lucide-react";

type AuthMode = "login" | "signup" | "forgot" | "reset";

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
      } else if (session && mode !== "reset") {
        navigate("/");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && mode !== "reset") {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Welcome back!");
      } else if (mode === "signup") {
        if (!username.trim()) {
          toast.error("Username is required");
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { username: username.trim() },
          },
        });
        if (error) throw error;
        toast.success("Account created! You're now logged in.");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        toast.success("Password reset link sent! Check your email.");
      } else if (mode === "reset") {
        if (password !== confirmPassword) {
          toast.error("Passwords do not match");
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          toast.error("Password must be at least 6 characters");
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast.success("Password updated successfully!");
        setMode("login");
        navigate("/");
      }
    } catch (error: any) {
      if (error.message.includes("User already registered")) {
        toast.error("This email is already registered. Please login instead.");
      } else {
        toast.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case "login": return "Welcome Back";
      case "signup": return "Join Sai Webpage";
      case "forgot": return "Reset Password";
      case "reset": return "Set New Password";
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case "login": return "Sign in to continue chatting";
      case "signup": return "Create your account to get started";
      case "forgot": return "Enter your email to receive a reset link";
      case "reset": return "Enter your new password";
    }
  };

  const getButtonText = () => {
    if (loading) return "Please wait...";
    switch (mode) {
      case "login": return "Sign In";
      case "signup": return "Create Account";
      case "forgot": return "Send Reset Link";
      case "reset": return "Update Password";
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* Animated ocean background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-primary/10" />
      
      {/* Floating orbs */}
      <div className="absolute inset-0 floating-orbs" />
      
      {/* Light rays effect */}
      <div className="light-rays" />
      
      {/* Animated wave layers */}
      <div className="absolute bottom-0 left-0 right-0 h-64 pointer-events-none">
        <svg className="absolute bottom-0 w-full h-32 animate-[wave-drift_8s_ease-in-out_infinite]" viewBox="0 0 1440 120" preserveAspectRatio="none">
          <path fill="hsl(185 75% 45% / 0.15)" d="M0,60 C360,120 720,0 1080,60 C1260,90 1380,90 1440,60 L1440,120 L0,120 Z" />
        </svg>
        <svg className="absolute bottom-0 w-full h-28 animate-[wave-drift_6s_ease-in-out_infinite_reverse]" viewBox="0 0 1440 120" preserveAspectRatio="none">
          <path fill="hsl(175 70% 42% / 0.12)" d="M0,80 C240,40 480,100 720,60 C960,20 1200,80 1440,50 L1440,120 L0,120 Z" />
        </svg>
        <svg className="absolute bottom-0 w-full h-24 animate-[wave-drift_10s_ease-in-out_infinite]" viewBox="0 0 1440 120" preserveAspectRatio="none">
          <path fill="hsl(195 80% 55% / 0.08)" d="M0,40 C180,80 360,20 540,60 C720,100 900,40 1080,70 C1260,100 1380,60 1440,80 L1440,120 L0,120 Z" />
        </svg>
      </div>

      {/* Floating bubbles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-4 h-4 rounded-full bg-primary/20 animate-[bubble-rise_15s_linear_infinite]" style={{ left: '10%', animationDelay: '0s' }} />
        <div className="absolute w-3 h-3 rounded-full bg-accent/15 animate-[bubble-rise_12s_linear_infinite]" style={{ left: '20%', animationDelay: '2s' }} />
        <div className="absolute w-5 h-5 rounded-full bg-primary/15 animate-[bubble-rise_18s_linear_infinite]" style={{ left: '35%', animationDelay: '4s' }} />
        <div className="absolute w-2 h-2 rounded-full bg-accent/20 animate-[bubble-rise_10s_linear_infinite]" style={{ left: '50%', animationDelay: '1s' }} />
        <div className="absolute w-4 h-4 rounded-full bg-primary/20 animate-[bubble-rise_14s_linear_infinite]" style={{ left: '65%', animationDelay: '3s' }} />
        <div className="absolute w-3 h-3 rounded-full bg-accent/15 animate-[bubble-rise_16s_linear_infinite]" style={{ left: '80%', animationDelay: '5s' }} />
        <div className="absolute w-5 h-5 rounded-full bg-primary/10 animate-[bubble-rise_20s_linear_infinite]" style={{ left: '90%', animationDelay: '2s' }} />
      </div>

      {/* Main content */}
      <div className="w-full max-w-md relative z-10">
        <div className="glass-card card-ocean rounded-3xl p-8 shadow-2xl hover-lift">
          {(mode === "forgot" || mode === "reset") && (
            <button
              onClick={() => setMode("login")}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors hover-bright"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </button>
          )}

          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl btn-gradient flex items-center justify-center shadow-lg shimmer">
              <Lock className="w-10 h-10 text-primary-foreground" />
            </div>
            <h1 className="font-display text-3xl font-bold text-gradient mb-2">
              {getTitle()}
            </h1>
            <p className="text-muted-foreground">
              {getSubtitle()}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="relative group">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 bg-background/50 border-border rounded-xl h-12 hover-glow focus:border-primary"
                  required
                />
              </div>
            )}

            {(mode === "login" || mode === "signup" || mode === "forgot") && (
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-background/50 border-border rounded-xl h-12 hover-glow focus:border-primary"
                  required
                />
              </div>
            )}

            {(mode === "login" || mode === "signup" || mode === "reset") && (
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  type="password"
                  placeholder={mode === "reset" ? "New Password" : "Password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-background/50 border-border rounded-xl h-12 hover-glow focus:border-primary"
                  required
                  minLength={6}
                />
              </div>
            )}

            {mode === "reset" && (
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  type="password"
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 bg-background/50 border-border rounded-xl h-12 hover-glow focus:border-primary"
                  required
                  minLength={6}
                />
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full btn-gradient text-primary-foreground font-semibold py-3 h-12 rounded-xl ripple-effect"
            >
              {getButtonText()}
            </Button>
          </form>

          {mode === "login" && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setMode("forgot")}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Forgot your password?
              </button>
            </div>
          )}

          {(mode === "login" || mode === "signup") && (
            <div className="mt-6 text-center">
              <button
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                className="text-primary hover:text-primary/80 font-medium transition-colors hover-bright"
              >
                {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
