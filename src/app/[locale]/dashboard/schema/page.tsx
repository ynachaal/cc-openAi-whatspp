'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, GripVertical, RefreshCw } from 'lucide-react';

interface SheetField {
    id: string;
    fieldName: string;
    fieldType: string;
    isRequired: boolean;
    order: number;
    description?: string;
    enumValues?: string;
}

const fieldTypes = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'enum', label: 'Enum' },
    { value: 'array', label: 'Array' }
];

export default function SchemaPage() {
    const [fields, setFields] = useState<SheetField[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editingField, setEditingField] = useState<SheetField | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedFieldType, setSelectedFieldType] = useState<string>('');
    const [isConnected, setIsConnected] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    
    const wsRef = useRef<WebSocket | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        fetchFields();
        connectWebSocket();
        
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

    const connectWebSocket = () => {
        try {
            const ws = new WebSocket('ws://localhost:3000');
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('WebSocket connected');
                setIsConnected(true);
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    handleWebSocketMessage(message);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            ws.onclose = () => {
                console.log('WebSocket disconnected');
                setIsConnected(false);
                // Attempt to reconnect after 3 seconds
                setTimeout(() => {
                    if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
                        connectWebSocket();
                    }
                }, 3000);
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                setIsConnected(false);
            };
        } catch (error) {
            console.error('Failed to connect to WebSocket:', error);
            setIsConnected(false);
        }
    };

    const handleWebSocketMessage = (message: any) => {
        switch (message.type) {
            case 'sync_sheet_columns_response':
                setIsSyncing(false);
                if (message.status === 'success') {
                    toast({
                        title: "Success",
                        description: message.message || "Sheet headers synced successfully"
                    });
                } else {
                    toast({
                        title: "Error",
                        description: message.error || "Failed to sync sheet headers"
                    });
                }
                break;
            default:
                // Handle other message types if needed
                break;
        }
    };

    const sendWebSocketMessage = (message: any) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message));
        } else {
            toast({
                title: "Error",
                description: "WebSocket connection not available"
            });
        }
    };

    const syncSheetHeaders = () => {
        if (!isConnected) {
            toast({
                title: "Error",
                description: "WebSocket connection not available"
            });
            return;
        }

        setIsSyncing(true);
        sendWebSocketMessage({
            type: 'sync_sheet_columns'
        });
    };

    const fetchFields = async () => {
        try {
            const response = await fetch('/api/sheet-fields');
            if (response.ok) {
                const data = await response.json();
                setFields(data);
            } else {
                throw new Error('Failed to fetch fields');
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to fetch schema fields"
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        
        const enumValuesString = formData.get('enumValues') as string;
        let processedEnumValues = null;
        
        if (enumValuesString && selectedFieldType === 'enum') {
            // Split by comma and trim whitespace
            const enumArray = enumValuesString.split(',').map(val => val.trim()).filter(val => val);
            processedEnumValues = enumArray;
        }
        
        const fieldData = {
            fieldName: formData.get('fieldName') as string,
            fieldType: formData.get('fieldType') as string,
            isRequired: formData.get('isRequired') === 'on',
            order: editingField ? parseInt(formData.get('order') as string) || editingField.order : getNextOrder(),
            description: formData.get('description') as string,
            enumValues: processedEnumValues
        };

        try {
            if (editingField) {
                const response = await fetch('/api/sheet-fields', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...fieldData, id: editingField.id })
                });
                
                if (!response.ok) throw new Error('Failed to update field');
                
                toast({
                    title: "Success",
                    description: "Field updated successfully"
                });
            } else {
                const response = await fetch('/api/sheet-fields', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(fieldData)
                });
                
                if (!response.ok) throw new Error('Failed to create field');
                
                toast({
                    title: "Success",
                    description: "Field created successfully"
                });
            }
            
            setIsDialogOpen(false);
            setEditingField(null);
            setSelectedFieldType('');
            fetchFields();
            
            // Sync sheet headers after field changes
            setTimeout(() => {
                syncSheetHeaders();
            }, 500);
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to save field"
            });
        }
    };

    const handleEdit = (field: SheetField) => {
        setEditingField(field);
        setIsEditing(true);
        setSelectedFieldType(field.fieldType);
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this field?')) return;
        
        try {
            const response = await fetch(`/api/sheet-fields?id=${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete field');
            
            toast({
                title: "Success",
                description: "Field deleted successfully"
            });
            fetchFields();
            
            // Sync sheet headers after field deletion
            setTimeout(() => {
                syncSheetHeaders();
            }, 500);
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to delete field"
            });
        }
    };

    const handleAddNew = () => {
        setIsEditing(false);
        setEditingField(null);
        setSelectedFieldType('');
        setIsDialogOpen(true);
    };

    const getNextOrder = () => {
        if (fields.length === 0) return 0;
        const maxOrder = Math.max(...fields.map(field => field.order));
        return maxOrder + 1;
    };



    const getEnumDisplayValue = (enumValues: string | undefined) => {
        if (!enumValues) return '';
        try {
            const parsed = JSON.parse(enumValues);
            return Array.isArray(parsed) ? parsed.join(', ') : enumValues;
        } catch {
            return enumValues;
        }
    };

    return (
        <div className="container mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Schema Configuration</h1>
                    <p className="text-muted-foreground mt-2">Configure the fields that will be extracted from messages and saved to Google Sheets. Fields are ordered by their position number - new fields are automatically placed at the end.</p>
                    <div className="flex items-center space-x-2 mt-2">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-sm text-muted-foreground">
                            {isConnected ? 'Connected to WhatsApp Agent' : 'Disconnected from WhatsApp Agent'}
                        </span>
                    </div>
                </div>
                <div className="flex space-x-2">
                    <Button
                        variant="outline"
                        onClick={syncSheetHeaders}
                        disabled={!isConnected || isSyncing}
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Syncing...' : 'Sync Headers'}
                    </Button>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={handleAddNew}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Field
                        </Button>
                    </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>
                                {isEditing ? 'Edit Field' : 'Add New Field'}
                            </DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="fieldName">Field Name</Label>
                                    <Input
                                        id="fieldName"
                                        name="fieldName"
                                        defaultValue={editingField?.fieldName}
                                        placeholder="e.g., property_type"
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="fieldType">Field Type</Label>
                                    <Select 
                                        name="fieldType" 
                                        defaultValue={editingField?.fieldType}
                                        onValueChange={setSelectedFieldType}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {fieldTypes.map(type => (
                                                <SelectItem key={type.value} value={type.value}>
                                                    {type.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="order">Order</Label>
                                    <Input
                                        id="order"
                                        name="order"
                                        type="number"
                                        defaultValue={editingField?.order ?? getNextOrder()}
                                        min="0"
                                        readOnly={!isEditing}
                                        className={!isEditing ? "bg-muted" : ""}
                                    />
                                    {!isEditing && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                            New fields are automatically placed at the end
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center space-x-2 pt-8">
                                    <input
                                        type="checkbox"
                                        id="isRequired"
                                        name="isRequired"
                                        defaultChecked={editingField?.isRequired}
                                        className="rounded"
                                    />
                                    <Label htmlFor="isRequired">Required Field</Label>
                                </div>
                            </div>
                            
                            <div>
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    name="description"
                                    defaultValue={editingField?.description}
                                    placeholder="Describe what this field represents..."
                                    rows={2}
                                />
                            </div>
                            
                            {(selectedFieldType === 'enum' || editingField?.fieldType === 'enum') && (
                                <div>
                                    <Label htmlFor="enumValues">Enum Values (comma-separated)</Label>
                                    <Input
                                        id="enumValues"
                                        name="enumValues"
                                        placeholder="buy, sell, rent, general"
                                        defaultValue={getEnumDisplayValue(editingField?.enumValues)}
                                    />
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Enter comma-separated values for the enum field
                                    </p>
                                </div>
                            )}
                            
                            <div className="flex justify-end space-x-2 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsDialogOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit">
                                    {isEditing ? 'Update Field' : 'Create Field'}
                                </Button>
                            </div>
                        </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {fields.length === 0 ? (
                <Card>
                    <CardContent className="p-8 text-center">
                        <h3 className="text-lg font-semibold mb-2">No Fields Configured</h3>
                        <p className="text-muted-foreground mb-4">
                            Start by adding your first field to define the schema for data extraction. Fields will be ordered automatically as you add them.
                        </p>
                        <Button onClick={handleAddNew}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Your First Field
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {fields.sort((a, b) => a.order - b.order).map((field, index) => (
                        <Card key={field.id}>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />
                                        <div>
                                            <div className="flex items-center space-x-2 mb-1">
                                                <span className="bg-primary text-primary-foreground px-2 py-1 rounded text-sm font-medium">
                                                    #{field.order}
                                                </span>
                                                <h3 className="font-semibold text-lg">{field.fieldName}</h3>
                                            </div>
                                            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                                <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                                                    {field.fieldType}
                                                </span>
                                                {field.isRequired && (
                                                    <span className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded">
                                                        Required
                                                    </span>
                                                )}
                                            </div>
                                            {field.description && (
                                                <p className="text-sm text-muted-foreground mt-1">{field.description}</p>
                                            )}
                                            {field.fieldType === 'enum' && field.enumValues && (
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    <strong>Values:</strong> {getEnumDisplayValue(field.enumValues)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex space-x-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleEdit(field)}
                                        >
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDelete(field.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
