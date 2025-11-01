import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { verifyApiKey } from '../whatsapp/middleware';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    // Verify API key or admin session
    if (session?.user) {
        if (session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    } else {
        const authError = verifyApiKey(request);
        if (authError) return authError;
    }

    try {

        const fields = await prisma.sheetFields.findMany({
            orderBy: {
                order: 'asc'
            }
        });
        
        return NextResponse.json(fields);
    } catch (error) {
        console.error('Error fetching sheet fields:', error);
        return NextResponse.json(
            { error: 'Failed to fetch sheet fields' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    // Verify API key or admin session
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
        const { fieldName, fieldType, isRequired, order, description, enumValues } = body;
        
        const field = await prisma.sheetFields.create({
            data: {
                fieldName,
                fieldType,
                isRequired,
                order: order || 0,
                description,
                enumValues: enumValues ? JSON.stringify(enumValues) : null
            }
        });
        
        return NextResponse.json(field, { status: 201 });
    } catch (error) {
        console.error('Error creating sheet field:', error);
        return NextResponse.json(
            { error: 'Failed to create sheet field' },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
    const session = await getServerSession(authOptions);
    // Verify API key or admin session
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
        const { id, fieldName, fieldType, isRequired, order, description, enumValues } = body;
        
        const field = await prisma.sheetFields.update({
            where: { id },
            data: {
                fieldName,
                fieldType,
                isRequired,
                order: order || 0,
                description,
                enumValues: enumValues ? JSON.stringify(enumValues) : null
            }
        });
        
        return NextResponse.json(field);
    } catch (error) {
        console.error('Error updating sheet field:', error);
        return NextResponse.json(
            { error: 'Failed to update sheet field' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    const session = await getServerSession(authOptions);
    // Verify API key or admin session
    if (session?.user) {
        if (session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    } else {
        const authError = verifyApiKey(request);
        if (authError) return authError;
    }

    try {

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        
        if (!id) {
            return NextResponse.json(
                { error: 'Field ID is required' },
                { status: 400 }
            );
        }
        
        await prisma.sheetFields.delete({
            where: { id }
        });
        
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting sheet field:', error);
        return NextResponse.json(
            { error: 'Failed to delete sheet field' },
            { status: 500 }
        );
    }
}
