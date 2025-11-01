import { PrismaClient } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]/route"

const prisma = new PrismaClient()

// API key validation function
function verifyApiKey(request: Request) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) {
    return false;
  }

  const API_SECRET_KEY = "s3dfgERGfdKIhgn234%454$5"; // Match the hardcoded key from WhatsApp agent
  const providedKey = authHeader.replace('Bearer ', '').trim();
  
  return providedKey === API_SECRET_KEY;
}

// GET - Retrieve API keys
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  
  // Check if user is authenticated and is admin OR if API key is valid
  if ((!session?.user || session.user.role !== "ADMIN") && !verifyApiKey(request)) {
    return NextResponse.json(
      { message: "Unauthorized - Admin access required" },
      { status: 401 }
    );
  }

  try {
    const apiKeys = await prisma.apiKeys.findFirst()
    
    if (!apiKeys) {
      return NextResponse.json(
        { message: "No API keys found" },
        { status: 404 }
      )
    }

    return NextResponse.json(apiKeys)
  } catch (error) {
    console.error("Error fetching API keys:", error)
    return NextResponse.json(
      { message: "Error fetching API keys" },
      { status: 500 }
    )
  }
}

// POST - Create or update API keys
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  
  // Check if user is authenticated and is admin
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { message: "Unauthorized - Admin access required" },
      { status: 401 }
    );
  }

  try {
    const { googleSheetId, openaiKey, googleClientEmail, googlePrivateKey } = await request.json()

    // Validate input - at least one key should be provided
    if (!googleSheetId && !openaiKey && !googleClientEmail && !googlePrivateKey) {
      return NextResponse.json(
        { message: "At least one API key must be provided" },
        { status: 400 }
      )
    }

    // Check if API keys already exist
    const existingKeys = await prisma.apiKeys.findFirst()

    let apiKeys

    if (existingKeys) {
      // Update existing record
      apiKeys = await prisma.apiKeys.update({
        where: { id: existingKeys.id },
        data: {
          googleSheetId: googleSheetId || existingKeys.googleSheetId,
          openaiKey: openaiKey || existingKeys.openaiKey,
          googleClientEmail: googleClientEmail || existingKeys.googleClientEmail,
          googlePrivateKey: googlePrivateKey || existingKeys.googlePrivateKey,
        },
      })
    } else {
      // Create new record
      apiKeys = await prisma.apiKeys.create({
        data: {
          googleSheetId,
          openaiKey,
          googleClientEmail,
          googlePrivateKey,
        },
      })
    }

    return NextResponse.json(apiKeys)
  } catch (error) {
    console.error("Error saving API keys:", error)
    return NextResponse.json(
      { message: "Error saving API keys" },
      { status: 500 }
    )
  }
} 