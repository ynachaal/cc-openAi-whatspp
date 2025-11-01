import React from "react";

type MessageType = "higherThan" | "equal" | "lowerThan" | "full";

interface WhatsAppMessageFiltersProps {
  dateStart: string;
  setDateStart: (date: string) => void;
  time: string;
  setTime: (time: string) => void;
  messageType: MessageType;
  setMessageType: (type: MessageType) => void;
  limit: number;
  setLimit: (limit: number) => void;
}

const WhatsAppMessageFilters: React.FC<WhatsAppMessageFiltersProps> = ({
  dateStart,
  setDateStart,
  time,
  setTime,
  messageType,
  setMessageType,
  limit,
  setLimit,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Date
        </label>
        <input
          type="date"
          value={dateStart}
          onChange={(e) => setDateStart(e.target.value)}
          className="mt-1 p-3 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Time
        </label>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="mt-1 p-3 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Message Type
        </label>
        <select
          value={messageType}
          onChange={(e) =>
            setMessageType(
              e.target.value as MessageType
            )
          }
          className="mt-1 p-3 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="lowerThan">After Date</option>
          <option value="higherThan">Before Date</option>
          <option value="equal">On Date</option>
          <option value="full">All Messages</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Message Limit
        </label>
        <input
          type="number"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          min="1"
          max="100"
          className="mt-1 p-3 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>
    </div>
  );
};

export default WhatsAppMessageFilters; 