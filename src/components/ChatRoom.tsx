import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, LogOut, Users, MessageSquare, Image, Mic, Square, Play, Pause, Check, CheckCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";

interface Profile {
  id: string;
  user_id: string;
  username: string;
  last_active?: string | null;
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
  read_at?: string | null;
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
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [isRecipientTyping, setIsRecipientTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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

  // Update last_active and track presence
  useEffect(() => {
    if (!currentProfile) return;

    // Update last_active immediately
    const updateLastActive = async () => {
      await supabase
        .from('profiles')
        .update({ last_active: new Date().toISOString() })
        .eq('id', currentProfile.id);
    };
    updateLastActive();

    // Update every 30 seconds
    const interval = setInterval(updateLastActive, 30000);

    // Setup presence channel
    const presenceChannel = supabase.channel('online-users')
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const online = new Set<string>();
        Object.values(state).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            if (presence.profile_id) online.add(presence.profile_id);
          });
        });
        setOnlineUsers(online);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ profile_id: currentProfile.id });
        }
      });

    return () => {
      clearInterval(interval);
      supabase.removeChannel(presenceChannel);
    };
  }, [currentProfile]);

  useEffect(() => {
    if (currentProfile && selectedRecipient) {
      fetchMessages();
      markMessagesAsRead();
      
      // Messages channel for new messages and read receipts
      const messagesChannel = supabase
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
              // Mark as read if we're the recipient
              if (newMsg.sender_id === selectedRecipient) {
                markMessageAsRead(newMsg.id);
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
          },
          (payload) => {
            const updatedMsg = payload.new as Message;
            setMessages((prev) => 
              prev.map(msg => msg.id === updatedMsg.id ? updatedMsg : msg)
            );
          }
        )
        .subscribe();

      // Typing indicator channel
      const typingChannel = supabase
        .channel(`typing-${[currentProfile.id, selectedRecipient].sort().join('-')}`)
        .on('broadcast', { event: 'typing' }, (payload) => {
          if (payload.payload.user_id === selectedRecipient) {
            setIsRecipientTyping(true);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => setIsRecipientTyping(false), 2000);
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(messagesChannel);
        supabase.removeChannel(typingChannel);
      };
    }
  }, [currentProfile, selectedRecipient]);

  // Mark messages as read when viewing conversation
  const markMessagesAsRead = async () => {
    if (!currentProfile || !selectedRecipient) return;
    
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', selectedRecipient)
      .eq('recipient_id', currentProfile.id)
      .is('read_at', null);
  };

  const markMessageAsRead = async (messageId: string) => {
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId);
  };

  // Send typing indicator
  const sendTypingIndicator = async () => {
    if (!currentProfile || !selectedRecipient) return;
    
    const channelName = `typing-${[currentProfile.id, selectedRecipient].sort().join('-')}`;
    await supabase.channel(channelName).send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: currentProfile.id }
    });
  };

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

  const formatLastSeen = (dateString: string | null | undefined) => {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const selectedUser = profiles.find(p => p.id === selectedRecipient);
  const isSelectedUserOnline = selectedRecipient ? onlineUsers.has(selectedRecipient) : false;

  if (loading) {
    return (
      <div className="min-h-screen mesh-bg floating-orbs flex items-center justify-center">
        <div className="text-gradient font-display text-xl animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col mesh-bg floating-orbs relative overflow-hidden">
      {/* Light rays effect */}
      <div className="light-rays" />
      
      {/* Header */}
      <header className="relative z-20 glass-card card-ocean border-b px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl btn-gradient flex items-center justify-center shadow-lg hover-lift">
              <MessageSquare className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-gradient">
                S-Secret Chat
              </h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" />
                Welcome, <span className="text-primary font-medium">{currentProfile?.username}</span>
              </p>
            </div>
          </div>
          <Button
            onClick={onLogout}
            variant="outline"
            size="sm"
            className="rounded-xl hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 hover-lift ripple-effect"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* User Selection with Status */}
      <div className="relative z-20 glass-card card-ocean border-b px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-foreground mb-2">
              Chat with
            </label>
            <Select value={selectedRecipient || ""} onValueChange={setSelectedRecipient}>
              <SelectTrigger className="w-full max-w-xs rounded-xl bg-background/50 border-border hover-glow">
                <SelectValue placeholder="Select a friend..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl bg-card border-border">
                {profiles.length === 0 ? (
                  <div className="p-3 text-muted-foreground text-sm">No other users yet</div>
                ) : (
                  profiles.map((profile) => {
                    const isOnline = onlineUsers.has(profile.id);
                    return (
                      <SelectItem key={profile.id} value={profile.id} className="rounded-lg hover-bright">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 pulse-online' : 'bg-muted-foreground/50'}`} />
                          <span>{profile.username}</span>
                          {!isOnline && profile.last_active && (
                            <span className="text-xs text-muted-foreground">
                              • {formatLastSeen(profile.last_active)}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
          </div>
          
          {/* Selected user status */}
          {selectedUser && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-background/30 card-ocean">
              <span className={`w-3 h-3 rounded-full ${isSelectedUserOnline ? 'bg-green-500 pulse-online' : 'bg-muted-foreground/50'}`} />
              <div className="text-sm">
                <span className="font-medium">{selectedUser.username}</span>
                <span className="text-muted-foreground ml-2">
                  {isSelectedUserOnline ? 'Online' : `Last seen ${formatLastSeen(selectedUser.last_active)}`}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages container */}
      <div className="flex-1 overflow-y-auto px-4 py-6 relative z-20 water-pattern">
        <div className="max-w-4xl mx-auto space-y-4">
          {!selectedRecipient ? (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl btn-gradient mb-4 shadow-lg hover-lift shimmer">
                <Users className="w-10 h-10 text-primary-foreground" />
              </div>
              <p className="text-muted-foreground">
                Select a friend to start chatting
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl btn-gradient mb-4 shadow-lg hover-lift shimmer">
                <MessageSquare className="w-10 h-10 text-primary-foreground" />
              </div>
              <p className="text-muted-foreground">
                No messages with {selectedUser?.username} yet. Say hi! 👋
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
                    className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-md hover-scale ${
                      isOwn
                        ? "btn-gradient text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {message.sender_name.charAt(0).toUpperCase()}
                  </div>

                  {/* Message bubble */}
                  <div className={`max-w-[70%] ${isOwn ? "items-end" : "items-start"}`}>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className={`text-xs font-semibold ${isOwn ? "text-accent" : "text-primary"}`}>
                        {message.sender_name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(message.created_at)}
                      </span>
                    </div>
                    <div
                      className={`rounded-2xl px-4 py-3 shadow-sm hover-bright ${
                        isOwn
                          ? "message-ocean text-primary-foreground"
                          : "glass-card card-ocean"
                      }`}
                    >
                      {message.image_url && (
                        <img 
                          src={message.image_url} 
                          alt="Shared image" 
                          className="max-w-full rounded-xl mb-2 max-h-64 object-contain"
                        />
                      )}
                      {message.voice_url && (
                        <button
                          onClick={() => playVoice(message.voice_url!)}
                          className={`flex items-center gap-2 text-sm py-2 px-4 rounded-full transition-all ${
                            isOwn 
                              ? "bg-primary-foreground/20 hover:bg-primary-foreground/30" 
                              : "bg-primary/10 hover:bg-primary/20"
                          }`}
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
                        <p className={`text-sm break-words ${isOwn ? "" : "text-foreground"}`}>
                          {message.content}
                        </p>
                      )}
                      {/* Read receipts for own messages */}
                      {isOwn && (
                        <div className="flex justify-end mt-1">
                          {message.read_at ? (
                            <CheckCheck className="w-4 h-4 text-primary-foreground/80" />
                          ) : (
                            <Check className="w-4 h-4 text-primary-foreground/50" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          
          {/* Typing indicator */}
          {isRecipientTyping && selectedUser && (
            <div className="message-enter flex gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-md bg-secondary text-secondary-foreground">
                {selectedUser.username.charAt(0).toUpperCase()}
              </div>
              <div className="glass-card rounded-2xl px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      {selectedRecipient && (
        <div className="relative z-20 glass-card card-ocean border-t px-4 py-4">
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
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="h-12 w-12 rounded-xl hover:bg-primary/10 hover:border-primary hover-lift ripple-effect"
            >
              <Image className="w-5 h-5 text-primary" />
            </Button>

            {/* Voice record button */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading && !isRecording}
              className={`h-12 w-12 rounded-xl hover-lift ripple-effect ${
                isRecording 
                  ? "border-destructive bg-destructive/10 hover:bg-destructive/20" 
                  : "hover:bg-primary/10 hover:border-primary"
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
              onChange={(e) => {
                setNewMessage(e.target.value);
                if (e.target.value.trim()) sendTypingIndicator();
              }}
              placeholder="Type your message..."
              className="flex-1 bg-background/50 rounded-xl h-12 focus:ring-2 focus:ring-primary/50 hover-glow"
              maxLength={500}
              disabled={isLoading || isRecording}
            />
            <Button
              type="submit"
              disabled={isLoading || !newMessage.trim() || isRecording}
              className="h-12 px-6 btn-gradient rounded-xl text-primary-foreground font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
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
