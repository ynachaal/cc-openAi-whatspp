import { PrismaClient } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../../auth/[...nextauth]/route"

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

// PUT - Update specific API key
export async function PUT(
  request: Request,
  { params }: { params: { key: string } }
) {
  const session = await getServerSession(authOptions);
  
  // Check if user is authenticated and is admin
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { message: "Unauthorized - Admin access required" },
      { status: 401 }
    );
  }

  try {
    const { key } = params
    const { value } = await request.json()

    // Validate key parameter
    if (!['googleSheetId', 'openaiKey'].includes(key)) {
      return NextResponse.json(
        { message: "Invalid key parameter. Must be 'googleSheetId' or 'openaiKey'" },
        { status: 400 }
      )
    }

    // Validate value
    if (!value) {
      return NextResponse.json(
        { message: "Value is required" },
        { status: 400 }
      )
    }

    // Check if API keys exist
    const existingKeys = await prisma.apiKeys.findFirst()

    let apiKeys

    if (existingKeys) {
      // Update existing record
      apiKeys = await prisma.apiKeys.update({
        where: { id: existingKeys.id },
        data: {
          [key]: value,
        },
      })
    } else {
      // Create new record with the specific key
      const data: any = {}
      data[key] = value
      
      apiKeys = await prisma.apiKeys.create({
        data,
      })
    }

    return NextResponse.json(apiKeys)
  } catch (error) {
    console.error("Error updating API key:", error)
    return NextResponse.json(
      { message: "Error updating API key" },
      { status: 500 }
    )
  }
}

// DELETE - Delete specific API key
export async function DELETE(
  request: Request,
  { params }: { params: { key: string } }
) {
  const session = await getServerSession(authOptions);
  
  // Check if user is authenticated and is admin
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { message: "Unauthorized - Admin access required" },
      { status: 401 }
    );
  }

  try {
    const { key } = params

    // Validate key parameter
    if (!['googleSheetId', 'openaiKey'].includes(key)) {
      return NextResponse.json(
        { message: "Invalid key parameter. Must be 'googleSheetId' or 'openaiKey'" },
        { status: 400 }
      )
    }

    // Check if API keys exist
    const existingKeys = await prisma.apiKeys.findFirst()

    if (!existingKeys) {
      return NextResponse.json(
        { message: "No API keys found" },
        { status: 404 }
      )
    }

    // Update the record to set the specific key to null
    const apiKeys = await prisma.apiKeys.update({
      where: { id: existingKeys.id },
      data: {
        [key]: null,
      },
    })

    return NextResponse.json(apiKeys)
  } catch (error) {
    console.error("Error deleting API key:", error)
    return NextResponse.json(
      { message: "Error deleting API key" },
      { status: 500 }
    )
  }
} 