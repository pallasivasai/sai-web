import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, LogOut, Users, MessageSquare, Image, Mic, Square, Play, Pause } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";

interface Profile {
  id: string;
  user_id: string;
  username: string;
}

interface Message {
  id: string;
  content: string;
  sender_name: string;
  sender_id: string;
  recipient_id: string;
  created_at: string;
  image_url?: string | null;
  voice_url?: string | null;
}

interface ChatRoomProps {
  user: User;
  onLogout: () => void;
}

const ChatRoom = ({ user, onLogout }: ChatRoomProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    fetchCurrentProfile();
    fetchProfiles();
  }, [user.id]);

  useEffect(() => {
    if (currentProfile && selectedRecipient) {
      fetchMessages();
      
      const channel = supabase
        .channel('private-messages')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          (payload) => {
            const newMsg = payload.new as Message;
            if (
              (newMsg.sender_id === currentProfile.id && newMsg.recipient_id === selectedRecipient) ||
              (newMsg.sender_id === selectedRecipient && newMsg.recipient_id === currentProfile.id)
            ) {
              setMessages((prev) => [...prev, newMsg]);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentProfile, selectedRecipient]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchCurrentProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      toast({
        title: "Failed to load profile",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setCurrentProfile(data);
  };

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .neq('user_id', user.id);

    if (error) {
      toast({
        title: "Failed to load users",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setProfiles(data || []);
    setLoading(false);
  };

  const fetchMessages = async () => {
    if (!currentProfile || !selectedRecipient) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${currentProfile.id},recipient_id.eq.${selectedRecipient}),and(sender_id.eq.${selectedRecipient},recipient_id.eq.${currentProfile.id})`
      )
      .order('created_at', { ascending: true });

    if (error) {
      toast({
        title: "Failed to load messages",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setMessages(data || []);
  };

  const uploadFile = async (file: File, type: 'image' | 'voice'): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-media')
      .upload(fileName, file);

    if (uploadError) {
      toast({
        title: "Upload failed",
        description: uploadError.message,
        variant: "destructive",
      });
      return null;
    }

    const { data } = supabase.storage
      .from('chat-media')
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentProfile || !selectedRecipient) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const imageUrl = await uploadFile(file, 'image');

    if (imageUrl) {
      const { error } = await supabase.from("messages").insert({
        content: "",
        sender_name: currentProfile.username,
        sender_id: currentProfile.id,
        recipient_id: selectedRecipient,
        image_url: imageUrl,
      });

      if (error) {
        toast({
          title: "Failed to send image",
          description: error.message,
          variant: "destructive",
        });
      }
    }

    setIsLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        
        stream.getTracks().forEach(track => track.stop());
        
        if (!currentProfile || !selectedRecipient) return;

        setIsLoading(true);
        const voiceUrl = await uploadFile(audioFile, 'voice');

        if (voiceUrl) {
          const { error } = await supabase.from("messages").insert({
            content: "",
            sender_name: currentProfile.username,
            sender_id: currentProfile.id,
            recipient_id: selectedRecipient,
            voice_url: voiceUrl,
          });

          if (error) {
            toast({
              title: "Failed to send voice",
              description: error.message,
              variant: "destructive",
            });
          }
        }
        setIsLoading(false);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access to record voice messages",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playVoice = (url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    if (playingVoice === url) {
      setPlayingVoice(null);
      return;
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play();
    setPlayingVoice(url);
    
    audio.onended = () => {
      setPlayingVoice(null);
    };
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentProfile || !selectedRecipient) return;

    setIsLoading(true);

    const { error } = await supabase.from("messages").insert({
      content: newMessage.trim(),
      sender_name: currentProfile.username,
      sender_id: currentProfile.id,
      recipient_id: selectedRecipient,
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

  const selectedUser = profiles.find(p => p.id === selectedRecipient);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background cyber-grid relative">
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
                Logged in as <span className="text-primary">{currentProfile?.username}</span>
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

      {/* User Selection */}
      <div className="relative z-20 bg-card/50 border-b border-primary/20 px-4 py-3">
        <div className="max-w-4xl mx-auto">
          <label className="block text-xs font-medium text-muted-foreground mb-2">
            Select a user to chat with:
          </label>
          <Select value={selectedRecipient || ""} onValueChange={setSelectedRecipient}>
            <SelectTrigger className="w-full max-w-xs bg-background/50 border-primary/30">
              <SelectValue placeholder="Choose a user..." />
            </SelectTrigger>
            <SelectContent className="bg-card border-primary/30">
              {profiles.length === 0 ? (
                <div className="p-2 text-muted-foreground text-sm">No other users yet</div>
              ) : (
                profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.username}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Messages container */}
      <div className="flex-1 overflow-y-auto px-4 py-6 relative z-20">
        <div className="max-w-4xl mx-auto space-y-4">
          {!selectedRecipient ? (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-primary/30 bg-card/50 mb-4">
                <Users className="w-8 h-8 text-primary/50" />
              </div>
              <p className="text-muted-foreground text-sm">
                Select a user from the dropdown to start chatting
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-primary/30 bg-card/50 mb-4">
                <MessageSquare className="w-8 h-8 text-primary/50" />
              </div>
              <p className="text-muted-foreground text-sm">
                No messages with {selectedUser?.username} yet. Start the conversation!
              </p>
            </div>
          ) : (
            messages.map((message) => {
              const isOwn = message.sender_id === currentProfile?.id;
              return (
                <div
                  key={message.id}
                  className={`message-enter flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
                >
                  {/* Avatar */}
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isOwn
                        ? "bg-accent/20 border border-accent/50 text-accent"
                        : "bg-primary/20 border border-primary/50 text-primary"
                    }`}
                  >
                    {message.sender_name.charAt(0).toUpperCase()}
                  </div>

                  {/* Message bubble */}
                  <div className={`max-w-[70%] ${isOwn ? "items-end" : "items-start"}`}>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className={`text-xs font-medium ${isOwn ? "text-accent" : "text-primary"}`}>
                        {message.sender_name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(message.created_at)}
                      </span>
                    </div>
                    <div
                      className={`rounded-lg px-4 py-2 ${
                        isOwn
                          ? "bg-accent/20 border border-accent/30"
                          : "bg-card border border-primary/20"
                      }`}
                    >
                      {message.image_url && (
                        <img 
                          src={message.image_url} 
                          alt="Shared image" 
                          className="max-w-full rounded-lg mb-2 max-h-64 object-contain"
                        />
                      )}
                      {message.voice_url && (
                        <button
                          onClick={() => playVoice(message.voice_url!)}
                          className="flex items-center gap-2 text-sm py-1 px-3 rounded-full bg-primary/20 hover:bg-primary/30 transition-colors"
                        >
                          {playingVoice === message.voice_url ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                          Voice Message
                        </button>
                      )}
                      {message.content && (
                        <p className="text-sm text-foreground break-words">
                          {message.content}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      {selectedRecipient && (
        <div className="relative z-20 bg-card/80 backdrop-blur-xl border-t border-primary/30 px-4 py-4">
          <form
            onSubmit={handleSendMessage}
            className="max-w-4xl mx-auto flex gap-3 items-center"
          >
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />
            
            {/* Image upload button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="h-12 w-12 border border-primary/30 hover:bg-primary/10"
            >
              <Image className="w-5 h-5 text-primary" />
            </Button>

            {/* Voice record button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading && !isRecording}
              className={`h-12 w-12 border ${
                isRecording 
                  ? "border-destructive bg-destructive/20 hover:bg-destructive/30" 
                  : "border-primary/30 hover:bg-primary/10"
              }`}
            >
              {isRecording ? (
                <Square className="w-5 h-5 text-destructive" />
              ) : (
                <Mic className="w-5 h-5 text-primary" />
              )}
            </Button>

            <Input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-background/50 border-primary/30 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/50 h-12"
              maxLength={500}
              disabled={isLoading || isRecording}
            />
            <Button
              type="submit"
              disabled={isLoading || !newMessage.trim() || isRecording}
              className="h-12 px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-display tracking-wider glow-primary transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ChatRoom;
