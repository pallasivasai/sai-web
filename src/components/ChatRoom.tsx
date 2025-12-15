import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, LogOut, Users, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  content: string;
  sender_name: string;
  created_at: string;
}

interface ChatRoomProps {
  userName: string;
  onLogout: () => void;
}

const ChatRoom = ({ userName, onLogout }: ChatRoomProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Fetch initial messages
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(100);

      if (error) {
        toast({
          title: "Error loading messages",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setMessages(data || []);
      }
    };

    fetchMessages();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("messages-channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim()) return;

    setIsLoading(true);

    const { error } = await supabase.from("messages").insert({
      content: newMessage.trim(),
      sender_name: userName,
    });

    if (error) {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setNewMessage("");
    }

    setIsLoading(false);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background cyber-grid relative">
      {/* Scanline overlay */}
      <div className="absolute inset-0 scanline pointer-events-none z-10" />

      {/* Header */}
      <header className="relative z-20 bg-card/80 backdrop-blur-xl border-b border-primary/30 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-primary text-glow tracking-wider">
                SECURE CHANNEL
              </h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" />
                Logged in as <span className="text-primary">{userName}</span>
              </p>
            </div>
          </div>
          <Button
            onClick={onLogout}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/30"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Exit
          </Button>
        </div>
      </header>

      {/* Messages container */}
      <div className="flex-1 overflow-y-auto px-4 py-6 relative z-20">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-primary/30 bg-card/50 mb-4">
                <MessageSquare className="w-8 h-8 text-primary/50" />
              </div>
              <p className="text-muted-foreground text-sm">
                No messages yet. Be the first to send one!
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`message-enter flex gap-3 ${
                  message.sender_name === userName ? "flex-row-reverse" : ""
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    message.sender_name === userName
                      ? "bg-accent/20 border border-accent/50 text-accent"
                      : "bg-primary/20 border border-primary/50 text-primary"
                  }`}
                >
                  {message.sender_name.charAt(0).toUpperCase()}
                </div>

                {/* Message bubble */}
                <div
                  className={`max-w-[70%] ${
                    message.sender_name === userName ? "items-end" : "items-start"
                  }`}
                >
                  <div className="flex items-baseline gap-2 mb-1">
                    <span
                      className={`text-xs font-medium ${
                        message.sender_name === userName
                          ? "text-accent"
                          : "text-primary"
                      }`}
                    >
                      {message.sender_name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatTime(message.created_at)}
                    </span>
                  </div>
                  <div
                    className={`rounded-lg px-4 py-2 ${
                      message.sender_name === userName
                        ? "bg-accent/20 border border-accent/30"
                        : "bg-card border border-primary/20"
                    }`}
                  >
                    <p className="text-sm text-foreground break-words">
                      {message.content}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="relative z-20 bg-card/80 backdrop-blur-xl border-t border-primary/30 px-4 py-4">
        <form
          onSubmit={handleSendMessage}
          className="max-w-4xl mx-auto flex gap-3"
        >
          <Input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your encrypted message..."
            className="flex-1 bg-background/50 border-primary/30 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/50 h-12"
            maxLength={500}
            disabled={isLoading}
          />
          <Button
            type="submit"
            disabled={isLoading || !newMessage.trim()}
            className="h-12 px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-display tracking-wider glow-primary transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatRoom;
