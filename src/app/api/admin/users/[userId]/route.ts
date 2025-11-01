import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../../auth/[...nextauth]/route"
import { PrismaClient } from "@prisma/client"
import { hash } from "bcryptjs"

const prisma = new PrismaClient()

// Helper function to check if user is admin
async function isAdmin(request: NextRequest) {
  const session = await getServerSession(authOptions)
  return session?.user?.role === 'ADMIN'
}

// Helper function to get current user ID
async function getCurrentUserId(request: NextRequest) {
  const session = await getServerSession(authOptions)
  return session?.user?.id
}

// PATCH - Update user (admin only, or user updating their own password)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const currentUserId = session?.user?.id
    const isCurrentUserAdmin = session?.user?.role === 'ADMIN'
    const { userId } = params

    // Check authorization - admin can update anyone, users can only update their own password
    if (!isCurrentUserAdmin && currentUserId !== userId) {
      return NextResponse.json(
        { message: "Unauthorized. You can only update your own password." },
        { status: 403 }
      )
    }

    const { password, name, role, email } = await request.json()

    // If not admin, only allow password updates
    if (!isCurrentUserAdmin && (name !== undefined || role !== undefined || email !== undefined)) {
      return NextResponse.json(
        { message: "Unauthorized. Non-admin users can only update their password." },
        { status: 403 }
      )
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!existingUser) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: any = {}

    if (password) {
      // Validate password strength
      if (password.length < 6) {
        return NextResponse.json(
          { message: "Password must be at least 6 characters long" },
          { status: 400 }
        )
      }
      updateData.password = await hash(password, 12)
    }

    if (isCurrentUserAdmin) {
      if (name !== undefined) updateData.name = name
      if (email !== undefined) {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
          return NextResponse.json(
            { message: "Invalid email format" },
            { status: 400 }
          )
        }
        
        // Check if email is already taken by another user
        const existingUserWithEmail = await prisma.user.findFirst({
          where: {
            email: email,
            id: { not: userId }
          }
        })
        
        if (existingUserWithEmail) {
          return NextResponse.json(
            { message: "Email is already taken by another user" },
            { status: 400 }
          )
        }
        
        updateData.email = email
      }
      if (role !== undefined) {
        // Validate role
        if (role !== 'USER' && role !== 'ADMIN') {
          return NextResponse.json(
            { message: "Invalid role. Must be USER or ADMIN" },
            { status: 400 }
          )
        }
        updateData.role = role
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        image: true,
      }
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json(
      { message: "Error updating user" },
      { status: 500 }
    )
  }
}

// DELETE - Delete user (admin only, cannot delete self)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const currentUserId = session?.user?.id
    const isCurrentUserAdmin = session?.user?.role === 'ADMIN'
    const { userId } = params

    // Check if user is admin
    if (!isCurrentUserAdmin) {
      return NextResponse.json(
        { message: "Unauthorized. Admin access required." },
        { status: 403 }
      )
    }

    // Prevent admin from deleting themselves
    if (currentUserId === userId) {
      return NextResponse.json(
        { message: "Cannot delete your own account" },
        { status: 400 }
      )
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!existingUser) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      )
    }

    // Delete user (this will cascade to accounts and sessions due to schema)
    await prisma.user.delete({
      where: { id: userId }
    })

    return NextResponse.json(
      { message: "User deleted successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error deleting user:", error)
    return NextResponse.json(
      { message: "Error deleting user" },
      { status: 500 }
    )
  }
}

// GET - Get specific user (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json(
        { message: "Unauthorized. Admin access required." },
        { status: 403 }
      )
    }

    const { userId } = params

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        image: true,
        accounts: {
          select: {
            provider: true,
          }
        },
        sessions: {
          select: {
            expires: true,
          },
          orderBy: {
            expires: 'desc'
          },
          take: 1
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error("Error fetching user:", error)
    return NextResponse.json(
      { message: "Error fetching user" },
      { status: 500 }
    )
  }
}
