import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

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
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>(activeListeningGroups);
  const [search, setSearch] = useState("");
  const [analysisStatus, setAnalysisStatus] = useState<{ status: "idle" | "running" | "completed" | "error"; message?: string }>({ status: "idle" });

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
    wsRef.current.send(JSON.stringify({ type: "get_chats" }));
  };

  useEffect(() => {
    if (!wsRef.current) return;
    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.type === "chats_response") {
        setLoading(false);
        if (data.status === "success") {
          setChats(data.data);
        } else {
          setError(data.error || "Failed to fetch chats");
        }
      }
      if (data.type === "analyze_historical_response") {
        if (data.status === "started") {
          setAnalysisStatus({ status: "running", message: data.message });
        } else if (data.status === "completed") {
          setAnalysisStatus({ status: "completed", message: data.message });
          setTimeout(() => setAnalysisStatus({ status: "idle" }), 5000);
        } else if (data.status === "error") {
          setAnalysisStatus({ status: "error", message: data.error });
          setTimeout(() => setAnalysisStatus({ status: "idle" }), 10000);
        }
      }
    };

    wsRef.current.addEventListener("message", handleMessage);
    fetchChats();

    return () => wsRef.current?.removeEventListener("message", handleMessage);
  }, [wsRef]);

  const updateWAServerWhatsAppNumbers = async (groups: string[]) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "set_whatsapp_numbers", numbers: groups }));
    }
  };

  const updateSessionGroups = async (groups: string[]) => {
    try {
      const response = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionName: "default",
          activeListeningGroups: groups,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update session groups");
    } catch (error) {
      console.error("Error updating session groups:", error);
    }
  };

  const handleGroupToggle = (chatId: string, isSelected: boolean) => {
    const updated = isSelected ? [...selectedGroups, chatId] : selectedGroups.filter((id) => id !== chatId);
    setSelectedGroups(updated);
    setActiveListeningGroups(updated);
    updateSessionGroups(updated);
    updateWAServerWhatsAppNumbers(updated);
  };

  if (loading) return <div className="text-center py-4">Loading chats...</div>;
  if (error)
    return (
      <div className="text-destructive py-4">
        Error: {error}
        <Button onClick={fetchChats} className="ml-4" variant="default" size="sm">
          Retry
        </Button>
      </div>
    );

  // --- FILTERED & CATEGORIZED ---
  const filteredChats = chats.filter((chat) => {
    const term = search.toLowerCase();
    return (
      !term ||
      chat.name?.toLowerCase().includes(term) ||
      chat.id?._serialized?.toLowerCase().includes(term)
    );
  });

  const groupsList = filteredChats.filter((chat) => chat.id?._serialized?.endsWith("@g.us") || chat.isGroup);
  const clientChats = filteredChats.filter((chat) => chat.name?.toUpperCase().includes("CLT"));
  const unknownChats = filteredChats.filter(
    (chat) =>
      (!chat.name || chat.name.match(/^\+?\d+/)) && // numeric or no name
      !(chat.id?._serialized?.endsWith("@g.us") || chat.isGroup) &&
      !chat.name?.toUpperCase().includes("CLT")
  );
  const individualChats = filteredChats.filter(
    (chat) =>
      chat.name &&
      !chat.name.match(/^\+?\d+/) &&
      !chat.name.toUpperCase().includes("CLT") &&
      !(chat.id?._serialized?.endsWith("@g.us") || chat.isGroup)
  );

  const renderChatList = (list: any[], color: string, hover = true) => (
    <div
      className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2"
      style={{ borderColor: `${color}33` }}
    >
      {list.map((chat) => {
        const chatId = typeof chat.id === "object" ? chat.id._serialized : chat.id;
        const isSelected = selectedGroups.includes(chatId);
        const displayName =
          color === "gray"
            ? "+" + chatId.replace("@c.us", "").replace("@g.us", "")
            : chat.name || chatId;

        return (
          <div
            key={chatId}
            className={`flex items-center space-x-3 p-2 rounded-md
            }`}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => handleGroupToggle(chatId, e.target.checked)}
              className={`w-4 h-4 text-${color}-600 border-gray-300 rounded`}
            />
            <label className="flex-1 text-sm font-medium cursor-pointer">{displayName}</label>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-foreground">Select WhatsApp Chats to Listen</h2>

      {/* 🔍 SEARCH BAR */}
      <input
        type="text"
        placeholder="Search chats..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:ring-blue-300 dark:bg-background dark:border-gray-700"
      />

      {clientChats.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-green-600">Client Chats</h3>
          {renderChatList(clientChats, "green")}
        </div>
      )}

      {groupsList.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-blue-600">Groups</h3>
          {renderChatList(groupsList, "blue")}
        </div>
      )}

      {individualChats.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-purple-600">Individuals</h3>
          {renderChatList(individualChats, "purple")}
        </div>
      )}

      {unknownChats.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-600">Unknown Numbers</h3>
          {renderChatList(unknownChats, "gray", false)}
        </div>
      )}

      {selectedGroups.length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md">
          <p className="text-sm font-medium text-blue-800">Selected ({selectedGroups.length}):</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedGroups.map((id) => {
              const chat = chats.find((c) => (typeof c.id === "object" ? c.id._serialized : c.id) === id);
              const nameOrNumber = chat?.name || ("+" + id.replace("@c.us", "").replace("@g.us", ""));
              return (
                <span
                  key={id}
                  className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {nameOrNumber}
                  <button
                    onClick={() => handleGroupToggle(id, false)}
                    className="ml-1 text-blue-600 hover:text-blue-800"
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
  );
}
