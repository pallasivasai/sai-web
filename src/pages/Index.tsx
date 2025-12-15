import { useState } from "react";
import SecretCodeGate from "@/components/SecretCodeGate";
import ChatRoom from "@/components/ChatRoom";

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState("");

  const handleAccessGranted = (name: string) => {
    setUserName(name);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserName("");
  };

  if (!isAuthenticated) {
    return <SecretCodeGate onAccessGranted={handleAccessGranted} />;
  }

  return <ChatRoom userName={userName} onLogout={handleLogout} />;
};

export default Index;
