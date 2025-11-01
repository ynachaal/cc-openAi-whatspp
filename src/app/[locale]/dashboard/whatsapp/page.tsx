"use client";

import WhatsAppLogin from "@/components/whatsapp/WhatsAppLogin";
import WhatsAppChats from "@/components/whatsapp/WhatsAppChats";
import { useState, useEffect, useRef, useCallback } from "react";
import WhatsAppGroupSelector from "@/components/whatsapp/WhatsAppGroupSelector";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RotateCcw, AlertTriangle, Settings, Eye, EyeOff, Save, X, ExternalLink, Edit, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { validateAndExtractSheetId, generateGoogleSheetsUrl } from "@/lib/google-sheets-utils";

export default function WhatsAppPage() {
  const { data: session } = useSession();
  const t = useTranslations('whatsapp');
  const [connectionStatus, setConnectionStatus] = useState<{
    whatsappConnected: boolean,
    whatsappAuthenticated: boolean
  }>({
    whatsappConnected: false,
    whatsappAuthenticated: false
  });
  const [wsData, setWsData] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [dateStart, setDateStart] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [limit, setLimit] = useState<number>(50);
  const [messageType, setMessageType] = useState<
    "higherThan" | "equal" | "lowerThan" | "full"
  >("lowerThan");
  const [activeListeningGroups, setActiveListeningGroups] = useState<string[]>([]);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);
  const [disconnectConfirmation, setDisconnectConfirmation] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [disconnectError, setDisconnectError] = useState("");
  const [resetError, setResetError] = useState("");
  
  // API Keys state
  const [apiKeys, setApiKeys] = useState<{
    id?: string;
    googleSheetId?: string;
    openaiKey?: string;
    createdAt?: string;
    updatedAt?: string;
  } | null>(null);
  const [isApiKeysDialogOpen, setIsApiKeysDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingKeys, setEditingKeys] = useState({
    googleSheetId: "",
    openaiKey: "",
  });
  const [editingUrl, setEditingUrl] = useState("");
  const [isEditingGoogleSheet, setIsEditingGoogleSheet] = useState(false);
  const [urlError, setUrlError] = useState("");
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showGroupsEditor, setShowGroupsEditor] = useState(false);

  const [initialLoading, setInitialLoading] = useState(true);
  
  // WebSocket connection monitoring
  const [wsConnectionStatus, setWsConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'error'>('disconnected');
  const [wsRetryCount, setWsRetryCount] = useState(0);
  const [wsLastError, setWsLastError] = useState<string>('');
  const [wsNextRetryTime, setWsNextRetryTime] = useState<number>(0);
  const [wsRetryCountdown, setWsRetryCountdown] = useState<number>(0);
  console.log("1111111", initialLoading);
  console.log("1111111", connectionStatus);
  console.log("1111111", wsConnectionStatus);
  
  const wsRef = useRef<WebSocket | null>(null);
  const wsRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wsRetryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Check if user is admin
  const isAdmin = session?.user?.role === 'ADMIN';


  // WebSocket connection management
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    setWsConnectionStatus('connecting');
    setWsLastError('');

    let wsUrl = process.env.NEXT_PUBLIC_WHATSAPP_SERVER;
    if (!wsUrl) {
      wsUrl = "ws://ae.artimandevs.com:3000";
    }

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
        setWsConnectionStatus('connecting'); // Set to connecting first
        setWsRetryCount(0);
        setWsLastError('');
        
        // Clear any existing retry timers
        if (wsRetryTimeoutRef.current) {
          clearTimeout(wsRetryTimeoutRef.current);
          wsRetryTimeoutRef.current = null;
        }
        if (wsRetryIntervalRef.current) {
          clearInterval(wsRetryIntervalRef.current);
          wsRetryIntervalRef.current = null;
        }

        // Add delay before requesting login status to allow WhatsApp agent to initialize
        setTimeout(() => {
          console.log("Requesting initial login status check");
          ws.send(JSON.stringify({ type: "check_login_status" }));
          
          // Wait 3 seconds after sending the request to properly detect connection status
          setTimeout(() => {
            setWsConnectionStatus('connected');
            setInitialLoading(false);
          }, 3000);
        }, 3000); // 3 second delay to ensure agent is ready
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setWsData(data);

        console.log("data1111111111: ", data);

        if (data.type === "connection_status") {
          console.log("connection_status", data.data);
          setConnectionStatus(data.data);
        } else if (data.type === "login_status") {
          console.log("login_status", data.data);
          setConnectionStatus(data.data);
        } else if (data.type === "logout_response") {
          if (data.status === "logged_out") {
            setConnectionStatus({
              whatsappConnected: false,
              whatsappAuthenticated: false
            });
            setWsData(null);
          }
        } else if (data.type === "reset_everything_response") {
          if (data.status === "success") {
            console.log("Reset successful:", data.message);
            toast({
              title: "Reset Successful",
              description: data.message || "Everything has been reset successfully",
            });
          } else {
            console.error("Reset failed:", data.error || "Unknown error");
            toast({
              title: "Reset Failed",
              description: data.error || "Failed to reset everything. Please try again.",
            });
          }
          setIsResetting(false);
        } else if (data.type === "chat_messages_response") {
          if (data.status === "success") {
            setMessages(data.data);
          } else {
            console.error("Error getting messages:", data.error);
          }
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setWsConnectionStatus('error');
        setWsLastError('Connection error occurred');
      };

      ws.onclose = (event) => {
        console.log("WebSocket disconnected", event.code, event.reason);
        setWsConnectionStatus('disconnected');
        setConnectionStatus({
          whatsappConnected: false,
          whatsappAuthenticated: false
        });
        
        // Only retry if it wasn't a manual close (code 1000)
        if (event.code !== 1000) {
          scheduleRetry();
        }
      };

    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      setWsConnectionStatus('error');
      setWsLastError('Failed to create connection');
      scheduleRetry();
    }
  }, [toast]);

  const scheduleRetry = useCallback(() => {
    if (wsRetryTimeoutRef.current) {
      clearTimeout(wsRetryTimeoutRef.current);
    }
    if (wsRetryIntervalRef.current) {
      clearInterval(wsRetryIntervalRef.current);
    }

    const retryDelay = 15000; // Exactly 15 seconds
    const nextRetryTime = Date.now() + retryDelay;
    
    setWsNextRetryTime(nextRetryTime);
    setWsRetryCount(prev => prev + 1);
    setWsRetryCountdown(retryDelay / 1000);

    // Start countdown timer
    wsRetryIntervalRef.current = setInterval(() => {
      setWsRetryCountdown(prev => {
        if (prev <= 1) {
          if (wsRetryIntervalRef.current) {
            clearInterval(wsRetryIntervalRef.current);
            wsRetryIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    wsRetryTimeoutRef.current = setTimeout(() => {
      console.log(`Retrying WebSocket connection (attempt ${wsRetryCount + 1})`);
      connectWebSocket();
    }, retryDelay);
  }, [wsRetryCount, connectWebSocket]);

  const manualRetry = useCallback(() => {
    if (wsRetryTimeoutRef.current) {
      clearTimeout(wsRetryTimeoutRef.current);
      wsRetryTimeoutRef.current = null;
    }
    if (wsRetryIntervalRef.current) {
      clearInterval(wsRetryIntervalRef.current);
      wsRetryIntervalRef.current = null;
    }
    
    setWsRetryCount(0);
    setWsLastError('');
    setWsRetryCountdown(0);
    connectWebSocket();
  }, [connectWebSocket]);

  useEffect(() => {
    // Fetch initial session data
    const fetchSessionData = async () => {
      try {
      const response = await fetch("/api/whatsapp", {
  headers: {
    Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_SECRET_KEY || "s3dfgERGfdKIhgn234%454$5"}`,
  },
});
        const data = await response.json();
        if (data.activeListeningGroups) {
          // Parse JSON string to array
          const groups = typeof data.activeListeningGroups === 'string' 
            ? JSON.parse(data.activeListeningGroups) 
            : data.activeListeningGroups;
          setActiveListeningGroups(Array.isArray(groups) ? groups : []);
        }
      } catch (error) {
        console.error("Failed to fetch WhatsApp session:", error);
      }
    };

    fetchSessionData();
  }, []);

  // Fetch API keys
  useEffect(() => {
    const fetchApiKeys = async () => {
      try {
       const response = await fetch("/api/whatsapp", {
  headers: {
    Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_SECRET_KEY || "s3dfgERGfdKIhgn234%454$5"}`,
  },
});
        if (response.ok) {
          const data = await response.json();
          setApiKeys(data);
        } else if (response.status === 404) {
          // No API keys found, that's okay
          setApiKeys(null);
        }
      } catch (error) {
        console.error("Failed to fetch API keys:", error);
      }
    };

    if (isAdmin) {
      fetchApiKeys();
    }
  }, [isAdmin]);

  // Initialize WebSocket connection
  useEffect(() => {
    connectWebSocket();

    return () => {
      // Cleanup on unmount
      if (wsRetryTimeoutRef.current) {
        clearTimeout(wsRetryTimeoutRef.current);
      }
      if (wsRetryIntervalRef.current) {
        clearInterval(wsRetryIntervalRef.current);
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [connectWebSocket]);


  console.log("connectionStatus", connectionStatus);

  const isWhatsappConnected =
    connectionStatus.whatsappConnected;

  console.log("1111111", isWhatsappConnected , !initialLoading , connectionStatus);


  const handleLogout = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "logout" }));
      // Reset states immediately for better UX
      setConnectionStatus({
        whatsappConnected: false,
        whatsappAuthenticated: false
      });
      setWsData(null);
    }
    // Close dialog and reset states
    setIsDisconnectDialogOpen(false);
    setDisconnectConfirmation("");
    setDisconnectError("");
  };

  const handleDisconnectConfirm = () => {
    const expectedText = "DISCONNECT";
    if (disconnectConfirmation.trim() !== expectedText) {
      setDisconnectError(t('disconnect.confirmationError'));
      return;
    }
    setDisconnectError("");
    handleLogout();
  };

  const handleResetEverything = () => {
    setIsResetting(true);
    
    // Send reset command to WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "reset_everything" }));
    }
    
    // Reset all local states
    setConnectionStatus({
      whatsappConnected: false,
      whatsappAuthenticated: false
    });
    setWsData(null);
    setMessages([]);
    setDateStart("");
    setTime("");
    setLimit(50);
    setMessageType("lowerThan");
    setActiveListeningGroups([]);
    
    // Close the dialog and reset confirmation states
    setIsResetDialogOpen(false);
    setResetConfirmation("");
    setResetError("");
  };

  const handleResetConfirm = () => {
    const expectedText = "RESET EVERYTHING";
    if (resetConfirmation.trim() !== expectedText) {
      setResetError(t('resetEverything.confirmationError'));
      return;
    }
    setResetError("");
    handleResetEverything();
  };

  const getChatMessagesByDate = (chatId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "getChatMessagesByDate",
          chatId,
          messageType,
          dateStart,
          time,
          limit,
        })
      );
    }
  };

  // API Keys management functions
  const handleEditApiKeys = () => {
    setEditingKeys({
      googleSheetId: "", // Not used in the OpenAI-only modal
      openaiKey: apiKeys?.openaiKey || "",
    });
    setIsEditing(true);
  };

  // Google Sheets URL management functions
  const handleEditGoogleSheet = () => {
    setEditingUrl(apiKeys?.googleSheetId ? generateGoogleSheetsUrl(apiKeys.googleSheetId) : "");
    setIsEditingGoogleSheet(true);
    setUrlError("");
  };

  const handleSaveGoogleSheetUrl = async () => {
    const validation = validateAndExtractSheetId(editingUrl);
    
    if (!validation.isValid) {
      setUrlError(validation.error || t('invalidUrl'));
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          googleSheetId: validation.id,
          openaiKey: apiKeys?.openaiKey || undefined,
        }),
      });

      if (response.ok) {
        const updatedKeys = await response.json();
        setApiKeys(updatedKeys);
        setIsEditingGoogleSheet(false);
        setUrlError("");
        toast({
          title: "Success",
          description: "Google Sheets URL updated successfully",
        });
      } else {
        const error = await response.json();
        setUrlError(error.message || "Failed to update Google Sheets URL");
      }
    } catch (error) {
      console.error("Error saving Google Sheets URL:", error);
      setUrlError("Failed to save Google Sheets URL");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelGoogleSheetEdit = () => {
    setIsEditingGoogleSheet(false);
    setEditingUrl("");
    setUrlError("");
  };

  const openGoogleSheet = () => {
    if (apiKeys?.googleSheetId) {
      const url = generateGoogleSheetsUrl(apiKeys.googleSheetId);
      window.open(url, '_blank');
    }
  };

  const handleSaveApiKeys = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          googleSheetId: apiKeys?.googleSheetId || undefined, // Keep existing Google Sheet ID
          openaiKey: editingKeys.openaiKey,
        }),
      });

      if (response.ok) {
        const updatedKeys = await response.json();
        setApiKeys(updatedKeys);
        setIsEditing(false);
        toast({
          title: "Success",
          description: "OpenAI API key updated successfully",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to update OpenAI API key",
        });
      }
    } catch (error) {
      console.error("Error saving OpenAI API key:", error);
      toast({
        title: "Error",
        description: "Failed to save OpenAI API key",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingKeys({
      googleSheetId: "", // Not used in the OpenAI-only modal
      openaiKey: apiKeys?.openaiKey || "",
    });
  };

  const maskApiKey = (key: string) => {
    if (!key) return "";
    return key.length > 8 ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : "****";
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-foreground">WhatsApp Dashboard</h1>
        <div className="flex items-center gap-3">
          {isAdmin && !initialLoading && (
            <Dialog open={isApiKeysDialogOpen} onOpenChange={setIsApiKeysDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  OpenAI API Key
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>OpenAI API Key Management</DialogTitle>
                  <DialogDescription>
                    Manage your OpenAI API key for AI processing. Only administrators can modify this setting.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {!isEditing ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">OpenAI API Key</CardTitle>
                        <CardDescription>
                          Your OpenAI API key for AI processing
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <code className="bg-muted border border-border px-3 py-2 rounded text-sm font-mono text-foreground">
                            {apiKeys?.openaiKey ? maskApiKey(apiKeys.openaiKey) : "Not configured"}
                          </code>
                          <Button
                            onClick={handleEditApiKeys}
                            variant="outline"
                            size="sm"
                          >
                            Edit
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="openaiKey">OpenAI API Key</Label>
                        <div className="relative">
                          <Input
                            id="openaiKey"
                            type={showOpenAIKey ? "text" : "password"}
                            value={editingKeys.openaiKey}
                            onChange={(e) => setEditingKeys(prev => ({ ...prev, openaiKey: e.target.value }))}
                            placeholder="Enter OpenAI API Key"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                          >
                            {showOpenAIKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  {isEditing ? (
                    <>
                      <Button
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSaveApiKeys}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setIsApiKeysDialogOpen(false)}
                    >
                      Close
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          
          <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-300"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset Everything
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  {t('resetEverything.title')}
                </DialogTitle>
                <DialogDescription>
                  {t('resetEverything.description')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="resetConfirmation">{t('resetEverything.confirmationLabel')}</Label>
                  <Input
                    id="resetConfirmation"
                    value={resetConfirmation}
                    onChange={(e) => {
                      setResetConfirmation(e.target.value);
                      setResetError("");
                    }}
                    placeholder={t('resetEverything.confirmationPlaceholder')}
                    className={resetError ? "border-destructive" : ""}
                  />
                  {resetError && (
                    <p className="text-sm text-destructive">
                      {resetError}
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsResetDialogOpen(false);
                    setResetConfirmation("");
                    setResetError("");
                  }}
                >
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleResetConfirm}
                  disabled={isResetting}
                  className="bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50"
                >
                  {isResetting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Resetting...
                    </>
                  ) : (
                    t('resetEverything.button')
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>


      {/* Google Sheets Configuration Section - Top */}
      {isAdmin && !initialLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('googleSheetsTitle')}</CardTitle>
            <CardDescription>
              {t('googleSheetsDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isEditingGoogleSheet ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  {apiKeys?.googleSheetId ? (
                    <button
                      onClick={openGoogleSheet}
                      className="flex items-center gap-2 bg-muted border border-border px-3 py-2 rounded text-sm font-mono text-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {generateGoogleSheetsUrl(apiKeys.googleSheetId)}
                    </button>
                  ) : (
                    <code className="bg-muted border border-border px-3 py-2 rounded text-sm font-mono text-muted-foreground">
                      {t('notConfigured')}
                    </code>
                  )}
                  <Button
                    onClick={handleEditGoogleSheet}
                    variant="outline"
                    size="sm"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    {t('editUrl')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="googleSheetUrl">{t('googleSheetUrl')}</Label>
                  <Input
                    id="googleSheetUrl"
                    value={editingUrl}
                    onChange={(e) => {
                      setEditingUrl(e.target.value);
                      setUrlError("");
                    }}
                    placeholder={t('googleSheetUrlPlaceholder')}
                    className={urlError ? "border-destructive" : ""}
                  />
                  <p className="text-sm text-muted-foreground">
                    {t('googleSheetUrlHelp')}
                  </p>
                  {urlError && (
                    <p className="text-sm text-destructive">
                      {urlError}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveGoogleSheetUrl}
                    disabled={isSaving}
                    size="sm"
                  >
                    {isSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-1" />
                        {t('saveChanges')}
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleCancelGoogleSheetEdit}
                    variant="outline"
                    size="sm"
                    disabled={isSaving}
                  >
                    {t('cancel')}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* WhatsApp Connection Section */}
      {initialLoading && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-foreground"></div>
        </div>
      )}

      {!isWhatsappConnected && !initialLoading && connectionStatus.whatsappConnected === false && (
        <WhatsAppLogin
          wsRef={wsRef}
          onConnectionStatusChange={(status) => setConnectionStatus(status)}
          wsData={wsData}
        />
      )}

      {/* WhatsApp Status and Controls Section - Bottom */}
      {isWhatsappConnected && !initialLoading && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('whatsappStatus')}</CardTitle>
              <CardDescription>
                {t('connectionStatus')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-foreground">{t('connected')}</span>
                  </div>
                  {activeListeningGroups.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      {activeListeningGroups.length} group{activeListeningGroups.length !== 1 ? 's' : ''} selected
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setShowGroupsEditor(!showGroupsEditor)}
                    variant="outline"
                  >
                    {showGroupsEditor ? t('hideGroupsEditor') : t('editSelectedGroups')}
                  </Button>
                  <Dialog open={isDisconnectDialogOpen} onOpenChange={setIsDisconnectDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                      >
                        {t('disconnect.button')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                          {t('disconnect.title')}
                        </DialogTitle>
                        <DialogDescription>
                          {t('disconnect.description')}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="disconnectConfirmation">{t('disconnect.confirmationLabel')}</Label>
                          <Input
                            id="disconnectConfirmation"
                            value={disconnectConfirmation}
                            onChange={(e) => {
                              setDisconnectConfirmation(e.target.value);
                              setDisconnectError("");
                            }}
                            placeholder={t('disconnect.confirmationPlaceholder')}
                            className={disconnectError ? "border-destructive" : ""}
                          />
                          {disconnectError && (
                            <p className="text-sm text-destructive">
                              {disconnectError}
                            </p>
                          )}
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsDisconnectDialogOpen(false);
                            setDisconnectConfirmation("");
                            setDisconnectError("");
                          }}
                        >
                          {t('cancel')}
                        </Button>
                        <Button
                          onClick={handleDisconnectConfirm}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          {t('disconnect.button')}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* WebSocket Connection Retry Panel - Only show when there's an issue */}
          {wsConnectionStatus !== 'connected' && (
            <Card className="border-destructive/20 bg-destructive/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {wsConnectionStatus === 'connecting' && (
                      <>
                        <RefreshCw className="w-5 h-5 text-primary animate-spin" />
                        <span className="text-sm font-medium text-foreground">Reconnecting to WhatsApp server...</span>
                      </>
                    )}
                    {wsConnectionStatus === 'disconnected' && (
                      <>
                        <WifiOff className="w-5 h-5 text-destructive" />
                        <span className="text-sm font-medium text-foreground">WhatsApp server disconnected</span>
                      </>
                    )}
                    {wsConnectionStatus === 'error' && (
                      <>
                        <WifiOff className="w-5 h-5 text-destructive" />
                        <span className="text-sm font-medium text-foreground">Connection error</span>
                      </>
                    )}
                    
                    {wsRetryCount > 0 && (
                      <span className="text-sm text-muted-foreground">
                        (Retry {wsRetryCount})
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {wsRetryCountdown > 0 && (
                      <span className="text-sm text-muted-foreground">
                        Retrying in {wsRetryCountdown}s
                      </span>
                    )}
                    <Button
                      onClick={manualRetry}
                      variant="outline"
                      size="sm"
                      disabled={wsConnectionStatus === 'connecting'}
                    >
                      <RefreshCw className={`w-4 h-4 mr-1 ${wsConnectionStatus === 'connecting' ? 'animate-spin' : ''}`} />
                      Retry Now
                    </Button>
                  </div>
                </div>
                
                {wsLastError && (
                  <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                    {wsLastError}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Groups Editor - Conditionally shown */}
          {showGroupsEditor && (
            <div className="mt-4">
              <WhatsAppGroupSelector
                wsRef={wsRef}
                onGetMessages={getChatMessagesByDate}
                dateStart={dateStart}
                setDateStart={setDateStart}
                time={time}
                setTime={setTime}
                limit={limit}
                setLimit={setLimit}
                messageType={messageType}
                setMessageType={setMessageType}
                messages={messages}
                activeListeningGroups={activeListeningGroups}
                setActiveListeningGroups={setActiveListeningGroups}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
