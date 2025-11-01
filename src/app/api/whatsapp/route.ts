import { NextResponse } from "next/server";
import { PrismaClient, WhatsAppSession } from "@prisma/client";
import type { NextRequest } from "next/server";
import { verifyApiKey } from "./middleware";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  // Verify API key
  if (session?.user) {
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    const authError = verifyApiKey(request);
    if (authError) return authError;
  }

  try {
    const session = await prisma.whatsAppSession.findFirst();
    return NextResponse.json(session || { isLoggedIn: false });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch WhatsApp session" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  // Verify API key
  if (session?.user) {
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    const authError = verifyApiKey(request);
    if (authError) return authError;
  }
  try {
    const body = await request.json();
    const { isLoggedIn, activeListeningGroups, lastAnalyzedMessageDate, lastProcessedMessageId } = body as WhatsAppSession;

    // First try to find an existing session
    const existingSession = await prisma.whatsAppSession.findFirst();

    if (existingSession) {
      // Prepare update data
      const updateData: any = {
        lastUpdated: new Date(),
      };

      // Only update fields that are provided
      if (isLoggedIn !== undefined) {
        updateData.isLoggedIn = isLoggedIn;
      }
      
      if (activeListeningGroups !== undefined) {
        // Convert array to JSON string for storage
        updateData.activeListeningGroups = Array.isArray(activeListeningGroups) 
          ? JSON.stringify(activeListeningGroups)
          : activeListeningGroups;
      }

      if (lastAnalyzedMessageDate !== undefined) {
        // Convert to Date object if it's a string
        const dateToSave = typeof lastAnalyzedMessageDate === 'string' 
          ? new Date(lastAnalyzedMessageDate) 
          : lastAnalyzedMessageDate;
        
        // Validate the date
        if (isNaN(dateToSave.getTime()) || dateToSave.getFullYear() < 1970 || dateToSave.getFullYear() > 2100) {
          console.error(`❌ Invalid date received: ${lastAnalyzedMessageDate}, skipping date update`);
        } else {
          updateData.lastAnalyzedMessageDate = dateToSave;
          
          // Set firstAnalyzedMessageDate if it doesn't exist
          if (!existingSession.firstAnalyzedMessageDate) {
            updateData.firstAnalyzedMessageDate = dateToSave;
          }
          
          console.log(`📅 Valid date to save: ${dateToSave.toISOString()}`);
        }
      }

      if (lastProcessedMessageId !== undefined) {
        updateData.lastProcessedMessageId = lastProcessedMessageId;
        console.log(`🆔 Message ID to save: ${lastProcessedMessageId}`);
      }

      console.log("Updating session with data:", updateData);

      // Update the existing session
      const updatedSession = await prisma.whatsAppSession.update({
        where: { id: existingSession.id },
        data: updateData,
      });
      
      console.log("Session updated successfully:", updatedSession);
      return NextResponse.json(updatedSession);
    } else {
      // Create a new session if none exists
      const createData: any = {
        sessionName: "whatsapp-session", // Always use the same session name
        isLoggedIn: isLoggedIn ?? false,
      };

      if (activeListeningGroups !== undefined) {
        // Convert array to JSON string for storage
        createData.activeListeningGroups = Array.isArray(activeListeningGroups) 
          ? JSON.stringify(activeListeningGroups)
          : activeListeningGroups;
      }

      if (lastAnalyzedMessageDate !== undefined) {
        const dateToSave = typeof lastAnalyzedMessageDate === 'string' 
          ? new Date(lastAnalyzedMessageDate) 
          : lastAnalyzedMessageDate;
        
        // Validate the date
        if (isNaN(dateToSave.getTime()) || dateToSave.getFullYear() < 1970 || dateToSave.getFullYear() > 2100) {
          console.error(`❌ Invalid date received: ${lastAnalyzedMessageDate}, skipping date in new session`);
        } else {
          createData.lastAnalyzedMessageDate = dateToSave;
          createData.firstAnalyzedMessageDate = dateToSave;
          console.log(`📅 Valid date for new session: ${dateToSave.toISOString()}`);
        }
      }

      if (lastProcessedMessageId !== undefined) {
        createData.lastProcessedMessageId = lastProcessedMessageId;
        console.log(`🆔 Message ID for new session: ${lastProcessedMessageId}`);
      }

      console.log("Creating new session with data:", createData);

      const newSession = await prisma.whatsAppSession.create({
        data: createData,
      });
      
      console.log("Session created successfully:", newSession);
      return NextResponse.json(newSession);
    }
  } catch (error) {
    console.error("Error updating WhatsApp session:", error);
    return NextResponse.json(
      { error: "Failed to update WhatsApp session" },
      { status: 500 }
    );
  }
}
