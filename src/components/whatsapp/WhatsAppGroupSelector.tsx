import { WhatsAppChat } from "@/types/whatsapp";
import { WhatsAppSession } from "@prisma/client";
import { useEffect, useState } from "react";
import {
  Button
} from "@/components/ui/button";
import WhatsAppMessageFilters from "./WhatsAppMessageFilters";
import WhatsAppMessagesList from "./WhatsAppMessagesList";

interface WhatsAppGroupSelectorProps {
  wsRef: React.RefObject<WebSocket | null>;
  onGetMessages: (chatId: string) => void;
  dateStart: string;
  setDateStart: (date: string) => void;
  time: string;
  setTime: (time: string) => void;
  limit: number;
  setLimit: (limit: number) => void;
  messageType: "higherThan" | "equal" | "lowerThan" | "full";
  setMessageType: (type: "higherThan" | "equal" | "lowerThan" | "full") => void;
  messages: any[];
  activeListeningGroups: string[];
  setActiveListeningGroups: (groups: string[]) => void;
}

export default function WhatsAppGroupSelector({
  wsRef,
  onGetMessages,
  dateStart,
  setDateStart,
  time,
  setTime,
  limit,
  setLimit,
  messageType,
  setMessageType,
  messages,
  activeListeningGroups,
  setActiveListeningGroups,
}: WhatsAppGroupSelectorProps) {

  console.log("messages", messages)
  const [groups, setGroups] = useState<{
    id: string;
    name: string;
}[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>(activeListeningGroups);
  const [chats, setChats] = useState<any[]>([]);

  const [analysisStatus, setAnalysisStatus] = useState<{
    status: 'idle' | 'running' | 'completed' | 'error';
    message?: string;
  }>({ status: 'idle' });

  useEffect(() => {
    if (activeListeningGroups && JSON.stringify(activeListeningGroups) !== JSON.stringify(selectedGroups)) {
      setSelectedGroups(activeListeningGroups);
    }
  }, [activeListeningGroups]);

  const fetchChats = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError("WebSocket connection not available");
      return;
    }

    setLoading(true);
    setError(null);
    wsRef.current?.send(JSON.stringify({ type: "get_chats" }));
  };

  useEffect(() => {
    if (!wsRef.current) return;

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      if (data.type === "chats_response") {
        setLoading(false);
        if (data.status === "success") {
          console.log("chats_response", data.data);
          setGroups(
            data.data as {
              id: string;
              name: string;
            }[]
          );
          setChats(data.data);
        } else {
          setError(data.error || "Failed to fetch chats");
        }
      }

      if (data.type === "analyze_historical_response") {
        if (data.status === "started") {
          setAnalysisStatus({ status: 'running', message: data.message });
        } else if (data.status === "completed") {
          setAnalysisStatus({ status: 'completed', message: data.message });
          // Reset status after 5 seconds
          setTimeout(() => setAnalysisStatus({ status: 'idle' }), 5000);
        } else if (data.status === "error") {
          setAnalysisStatus({ status: 'error', message: data.error });
          // Reset status after 10 seconds
          setTimeout(() => setAnalysisStatus({ status: 'idle' }), 10000);
        }
      }
    };

    wsRef.current.addEventListener("message", handleMessage);
    fetchChats();

    return () => {
      wsRef.current?.removeEventListener("message", handleMessage);
    };
  }, [wsRef]);

  const updateWAServerWhatsAppNumbers = async (groups: string[]) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "set_whatsapp_numbers", numbers: groups }));
    }
  };

  const updateSessionGroups = async (groups: string[]) => {
    try {
      console.log("Updating session groups:", groups); // Debug log
      const response = await fetch("/api/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionName: "default",
          activeListeningGroups: groups,
        }),
      });
      const data = await response.json();
      console.log("Groups update response:", data); // Debug log
      if (!response.ok) throw new Error("Failed to update session groups");
    } catch (error) {
      console.error("Error updating session groups:", error);
    }
  };

  const handleGroupToggle = (groupId: string, isSelected: boolean) => {
    let updatedGroups: string[];
    
    if (isSelected) {
      // Add group to selection
      updatedGroups = [...selectedGroups, groupId];
    } else {
      // Remove group from selection
      updatedGroups = selectedGroups.filter(id => id !== groupId);
    }
    
    setSelectedGroups(updatedGroups);
    setActiveListeningGroups(updatedGroups);
    updateSessionGroups(updatedGroups);
    updateWAServerWhatsAppNumbers(updatedGroups);

  };

  const handleChatSelect = (chatId: string) => {
    onGetMessages(chatId);
  };

  const triggerHistoricalAnalysis = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setAnalysisStatus({ status: 'error', message: 'WebSocket connection not available' });
      return;
    }

    setAnalysisStatus({ status: 'running', message: 'Starting historical analysis...' });
    wsRef.current.send(JSON.stringify({ type: "analyze_historical_messages" }));
  };

  if (loading) {
    return <div className="text-center py-4">Loading groups...</div>;
  }

  if (error) {
    return (
      <div className="text-destructive py-4">
        Error: {error}
        <Button
          onClick={fetchChats}
          className="ml-4"
          variant="default"
          size="sm"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Select Groups to Listen</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {chats.length === 0 ? (
              <p className="text-muted-foreground text-sm">No chats available</p>
            ) : (
              chats.map((chat) => {
                const chatId = typeof chat.id === "object" ? chat.id._serialized : chat.id;
                const isSelected = selectedGroups.includes(chatId);
                
                return (
                  <div key={chatId} className="flex items-center space-x-3 p-2 hover:bg-muted rounded-md">
                    <input
                      type="checkbox"
                      id={`chat-${chatId}`}
                      checked={isSelected}
                      onChange={(e) => handleGroupToggle(chatId, e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-background border-border rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <label 
                      htmlFor={`chat-${chatId}`} 
                      className="flex-1 text-sm font-medium text-foreground cursor-pointer"
                    >
                      {chat.name || chatId}
                    </label>
                   
                  </div>
                );
              })
            )}
          </div>
          
          {selectedGroups.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md">
              <p className="text-sm font-medium text-blue-800">
                Selected Groups ({selectedGroups.length}):
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedGroups.map((groupId) => {
                  const chat = chats.find(c => (typeof c.id === "object" ? c.id._serialized : c.id) === groupId);
                  return (
                    <span key={groupId} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                      {chat?.name || groupId}
                      <button
                        onClick={() => handleGroupToggle(groupId, false)}
                        className="ml-1 text-blue-600 hover:text-blue-800 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* <div className="space-y-4">
          <h2 className="text-xl font-semibold">Message Filters</h2>
          <WhatsAppMessageFilters
            dateStart={dateStart}
            setDateStart={setDateStart}
            time={time}
            setTime={setTime}
            messageType={messageType}
            setMessageType={setMessageType}
            limit={limit}
            setLimit={setLimit}
          />
        </div> */}

        {/* <div className="space-y-4">
          <h2 className="text-xl font-semibold">Historical Analysis</h2>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Analyze all messages since the last analyzed date and process them for real estate content.
            </p>
            
            <Button
              onClick={triggerHistoricalAnalysis}
              disabled={analysisStatus.status === 'running'}
              className={`w-full ${
                analysisStatus.status === 'running' 
                  ? 'bg-yellow-500 hover:bg-yellow-600' 
                  : analysisStatus.status === 'completed'
                  ? 'bg-green-500 hover:bg-green-600'
                  : analysisStatus.status === 'error'
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {analysisStatus.status === 'running' && '🔄 '}
              {analysisStatus.status === 'completed' && '✅ '}
              {analysisStatus.status === 'error' && '❌ '}
              {analysisStatus.status === 'running' 
                ? 'Analyzing Messages...' 
                : analysisStatus.status === 'completed'
                ? 'Analysis Completed'
                : analysisStatus.status === 'error'
                ? 'Analysis Failed'
                : 'Analyze Historical Messages'
              }
            </Button>
            
            {analysisStatus.message && (
              <div className={`p-3 rounded-md text-sm ${
                analysisStatus.status === 'running' 
                  ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                  : analysisStatus.status === 'completed'
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : analysisStatus.status === 'error'
                  ? 'bg-red-100 text-red-800 border border-red-200'
                  : 'bg-blue-100 text-blue-800 border border-blue-200'
              }`}>
                {analysisStatus.message}
              </div>
            )}
          </div>
        </div> */}
      </div>

      {/* Messages List */}
      {/* <WhatsAppMessagesList messages={messages} /> */}
    </div>
  );
}
