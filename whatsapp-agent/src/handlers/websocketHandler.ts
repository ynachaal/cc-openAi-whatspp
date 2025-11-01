import { WebSocket } from "ws";
import { CONFIG } from "../config/constants";
import { WhatsAppClientService } from "../services/whatsappClient";
import { WebSocketMessage } from "../types/whatsapp";
import { WhatsAppAgentApp } from "../app";

export class WebSocketHandler {
  private static instance: WebSocketHandler;
  private whatsappService: WhatsAppClientService;

  private constructor() {
    this.whatsappService = WhatsAppClientService.getInstance();
  }

  public static getInstance(): WebSocketHandler {
    if (!WebSocketHandler.instance) {
      WebSocketHandler.instance = new WebSocketHandler();
    }
    return WebSocketHandler.instance;
  }

  private validateOrigin(origin: string | undefined): boolean {
    return true
  }

  private sendMessage(ws: WebSocket, message: WebSocketMessage): void {
    ws.send(JSON.stringify(message));
  }

  handleConnection(ws: WebSocket, req: any): void {
    const origin = req.headers.origin;

    if (!this.validateOrigin(origin)) {
      ws.close(1008, "Unauthorized origin");
      return;
    }

    console.log("New WebSocket connection established");

    // Send initial connection status
    setTimeout(async () => {
      const whatsappConnected = await this.whatsappService.isConnected();
      this.sendMessage(ws, {
        type: "connection_status",
        data: {
          whatsappConnected: whatsappConnected,
          connectionStatus: this.whatsappService.getConnectionStatus(),
        },
      });
    }, 500);

    // Send initial connection status
    setTimeout(async () => {
      this.sendMessage(ws, {
        type: "is_initializing",
        data: {
          isInitializing: this.whatsappService.isInitializing,
        },
      });
    }, 1000);

    ws.on("message", async (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        await this.handleMessage(ws, data);
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
        this.sendMessage(ws, {
          type: "error",
          error: "Invalid message format",
        });
      }
    });

    ws.on("close", () => {
      console.log("WebSocket connection closed");
    });
  }

  private async handleResetEverything(ws: WebSocket): Promise<void> {
    await this.whatsappService.resetEverything();
    this.sendMessage(ws, {
      type: "reset_everything_response",
      status: "success",
      message: "Everything reset successfully",
    });
  }

  private async handleRefreshApiKeys(ws: WebSocket): Promise<void> {
    try {
      const app = WhatsAppAgentApp.getInstance();
      await app.refreshApiKeys();
      const apiKeys = app.getApiKeys();
      
      this.sendMessage(ws, {
        type: "refresh_api_keys_response",
        status: "success",
        data: {
          googleSheetId: apiKeys?.googleSheetId ? "Configured" : "Not configured",
          openaiKey: apiKeys?.openaiKey ? "Configured" : "Not configured",
        },
        message: "API keys refreshed successfully",
      });
    } catch (error) {
      console.error("Error refreshing API keys:", error);
      this.sendMessage(ws, {
        type: "refresh_api_keys_response",
        status: "error",
        error: "Failed to refresh API keys",
      });
    }
  }

  private async handleMessage(ws: WebSocket, data: any): Promise<void> {
    switch (data.type) {
      case "login":
        await this.handleLogin(ws);
        break;

      case "logout":
        await this.handleLogout(ws);
        break;

      case "health_check":
        await this.handleHealthCheck(ws);
        break;

      case "check_login_status":
        await this.handleCheckLoginStatus(ws);
        break;

      case "get_chats":
          await this.handleGetChats(ws);
        break;

      case "set_whatsapp_number":
        await this.handleSetWhatsAppNumber(ws, data);
        break;

      case "set_whatsapp_numbers":
        await this.handleSetWhatsAppNumbers(ws, data);
        break;

      case "reset_everything":
        await this.handleResetEverything(ws);
        break;

      case "refresh_api_keys":
        await this.handleRefreshApiKeys(ws);
        break;

      case "getChatMessagesByDate":
        await this.handleGetChatMessagesByDate(ws, data);
        break;

      case "analyze_historical_messages":
        await this.handleAnalyzeHistoricalMessages(ws);
        break;

      default:
        this.sendMessage(ws, {
          type: "error",
          error: "Unknown message type",
        });
    }
  }

  private async handleLogin(ws: WebSocket): Promise<void> {
    try {
      const success = await this.whatsappService.initialize(ws);
      this.sendMessage(ws, {
        type: "login_response",
        status: success ? "connected" : "error",
        error: success ? undefined : "Failed to initialize WhatsApp client",
      });
    } catch (error) {
      console.error("Error during login:", error);
      this.sendMessage(ws, {
        type: "login_response",
        status: "error",
        error: "Failed to initialize WhatsApp client",
      });
    }
  }

  private async handleLogout(ws: WebSocket): Promise<void> {
    const whatsappConnected = await this.whatsappService.isConnected();
    if (!whatsappConnected) {
      this.sendMessage(ws, {
        type: "logout_response",
        status: "not_connected",
      });
      return;
    }

    try {
      await this.whatsappService.logout();
      this.sendMessage(ws, {
        type: "logout_response",
        status: "logged_out",
      });
    } catch (error) {
      console.error("Error during logout:", error);
      this.sendMessage(ws, {
        type: "logout_response",
        status: "error",
        error: "Failed to logout",
      });
    }
  }

  private async handleHealthCheck(ws: WebSocket): Promise<void> {
    const whatsappConnected = await this.whatsappService.isConnected();
    this.sendMessage(ws, {
      type: "health_response",
      data: {
        status: "ok",
        whatsappConnected: whatsappConnected,
        connectionStatus: this.whatsappService.getConnectionStatus(),
      },
    });
  }

  private async handleCheckLoginStatus(ws: WebSocket): Promise<void> {
    const whatsappConnected = await this.whatsappService.isConnected();
    setTimeout(() => {
      this.sendMessage(ws, {
        type: "login_status",
        data: {
          isLoggedIn: whatsappConnected,
          connectionStatus: {
            whatsappConnected: whatsappConnected,
            whatsappAuthenticated: this.whatsappService.getConnectionStatus() === "successChat",
          },
        },
      });
    }, 1000);
  }

  private async handleGetChats(ws: WebSocket): Promise<void> {
    const whatsappConnected = await this.whatsappService.isConnected();
    if (!whatsappConnected) {
      this.sendMessage(ws, {
        type: "chats_response",
        status: "error",
        error: "WhatsApp client not connected",
      });
      return;
    }

    try {
      console.log("Getting chats");
      const chats = await this.whatsappService.getAllChats();
      console.log("Chats", chats?.length);
      this.sendMessage(ws, {
        type: "chats_response",
        status: "success",
        data: chats,
      });
    } catch (error) {
      console.error("Error getting chats:", error);
      this.sendMessage(ws, {
        type: "chats_response",
        status: "error",
        error: "Failed to get chats",
      });
    }
  }

  private async handleSetWhatsAppNumber(
    ws: WebSocket,
    data: any
  ): Promise<void> {
    this.whatsappService.setWhatsAppNumber(data.number);
    this.sendMessage(ws, {
      type: "whatsapp_number_response",
      status: "success",
      data: { number: this.whatsappService.getWhatsAppNumber() },
    });
  }

  private async handleSetWhatsAppNumbers(
    ws: WebSocket,
    data: any
  ): Promise<void> {
    const numbers = Array.isArray(data.numbers) ? data.numbers : [];
    this.whatsappService.setWhatsAppNumbers(numbers);
    this.sendMessage(ws, {
      type: "whatsapp_numbers_response",
      status: "success",
      data: { 
        numbers: this.whatsappService.getWhatsAppNumbers(),
        count: this.whatsappService.getWhatsAppNumbers().length
      },
    });
  }

  private async handleGetChatMessagesByDate(
    ws: WebSocket,
    data: any
  ): Promise<void> {
    const whatsappConnected = await this.whatsappService.isConnected();
    if (!whatsappConnected) {
      this.sendMessage(ws, {
        type: "chat_messages_response",
        status: "error",
        error: "WhatsApp client not connected",
      });
      return;
    }

    try {
      const { type, dateStart, time, limit, messageType } = data;
      const whatsappNumber = this.whatsappService.getWhatsAppNumber();

      if (!whatsappNumber) {
        this.sendMessage(ws, {
          type: "chat_messages_response",
          status: "error",
          error: "No WhatsApp number configured",
        });
        return;
      }

      // Format date to DD/MM/YYYY format
      const formattedDate = dateStart.split("-").reverse().join("/");
      // Format time to HH:mm format if provided
      const formattedTime = time ? time.padStart(5, "0") : undefined;

      const messages = await this.whatsappService.getAllMessagesDate(
        whatsappNumber,
        messageType as "higherThan" | "equal" | "lowerThan" | "full",
        formattedDate,
        formattedTime,
        limit
      );

      console.log(
        "messages",
        whatsappNumber,
        messageType,
        formattedDate,
        formattedTime,
        limit
      );

      this.sendMessage(ws, {
        type: "chat_messages_response",
        status: "success",
        data: messages,
      });
    } catch (error) {
      console.error("Error getting chat messages:", error);
      this.sendMessage(ws, {
        type: "chat_messages_response",
        status: "error",
        error: "Failed to get chat messages",
      });
    }
  }

  private async handleAnalyzeHistoricalMessages(ws: WebSocket): Promise<void> {
    const whatsappConnected = await this.whatsappService.isConnected();
    if (!whatsappConnected) {
      this.sendMessage(ws, {
        type: "analyze_historical_response",
        status: "error",
        error: "WhatsApp client not connected",
      });
      return;
    }

    const whatsappNumbers = this.whatsappService.getWhatsAppNumbers();
    if (whatsappNumbers.length === 0) {
      this.sendMessage(ws, {
        type: "analyze_historical_response",
        status: "error",
        error: "No WhatsApp numbers configured",
      });
      return;
    }

    try {
      this.sendMessage(ws, {
        type: "analyze_historical_response",
        status: "started",
        message: "Historical message analysis started",
      });

      // Run analysis in background
      this.whatsappService
        .analyzeMessagesSinceLastDate()
        .then(() => {
          this.sendMessage(ws, {
            type: "analyze_historical_response",
            status: "completed",
            message: "Historical message analysis completed",
          });
        })
        .catch((error) => {
          console.error("Error in manual historical analysis:", error);
          this.sendMessage(ws, {
            type: "analyze_historical_response",
            status: "error",
            error: "Failed to analyze historical messages",
          });
        });
    } catch (error) {
      console.error("Error starting historical analysis:", error);
      this.sendMessage(ws, {
        type: "analyze_historical_response",
        status: "error",
        error: "Failed to start historical analysis",
      });
    }
  }
}
