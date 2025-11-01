import React from "react";

interface WhatsAppMessagesListProps {
  messages: any[];
}

const WhatsAppMessagesList: React.FC<WhatsAppMessagesListProps> = ({ messages }) => {
  if (!messages || messages.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold mb-4 text-foreground">Messages</h2>
      <div className="max-h-96 overflow-y-auto border border-border rounded-lg">
        {messages.map((message, index) => (
          <div
            key={`$\{message.id?._serialized || message.id || message.timestamp\}-${index}`}
            className="p-3 border-b border-border last:border-b-0"
          >
            <p className="text-sm text-muted-foreground">
              {new Date(message.timestamp * 1000).toLocaleString()}
            </p>
            <p className="mt-1 text-foreground">{message.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WhatsAppMessagesList; 