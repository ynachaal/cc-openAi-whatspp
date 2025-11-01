import { WhatsAppChat } from '@/types/whatsapp';
import { useEffect, useState } from 'react';

interface WhatsAppChatsProps {
  wsRef: React.RefObject<WebSocket | null>;
}

export default function WhatsAppChats({ wsRef }: WhatsAppChatsProps) {
  const [chats, setChats] = useState<{
    id: string;
    name: string;
}[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChats = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('WebSocket connection not available');
      return;
    }

    setLoading(true);
    setError(null);
    wsRef.current.send(JSON.stringify({ type: 'get_chats' }));
  };

  useEffect(() => {
    if (!wsRef.current) return;

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'chats_response') {
        setLoading(false);
        if (data.status === 'success') {
          setChats(data.data);
        } else {
          setError(data.error || 'Failed to fetch chats');
        }
      }
    };

    wsRef.current.addEventListener('message', handleMessage);
    fetchChats();

    return () => {
      wsRef.current?.removeEventListener('message', handleMessage);
    };
  }, [wsRef]);

  if (loading) {
    return <div className="text-center py-4">Loading chats...</div>;
  }

  if (error) {
    return (
      <div className="text-red-500 py-4">
        Error: {error}
        <button 
          onClick={fetchChats}
          className="ml-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow border">
      <div className="p-4 border-b border-border">
        <h2 className="text-xl font-semibold text-foreground">WhatsApp Chats</h2>
      </div>
      <div className="divide-y">
        {chats.map((chat) => (
          <div key={chat.id} className="p-4 hover:bg-muted cursor-pointer">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-medium text-foreground">
                  {chat.name}
                </h3>
                {/* <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-500">
                    {new Date(chat.t * 1000).toLocaleString()}
                  </p>
                  {chat.groupMetadata && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                      Group
                    </span>
                  )}
                </div> */}
              </div>
              {/* {chat.unreadCount > 0 && (
                <span className="bg-green-500 text-white px-2 py-1 rounded-full text-sm">
                  {chat.unreadCount}
                </span>
              )} */}
            </div>
          </div>
        ))}
        {chats.length === 0 && (
          <div className="p-4 text-center text-muted-foreground">
            No chats found
          </div>
        )}
      </div>
    </div>
  );
} 