import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding sheet fields...');

    // Create default sheet fields for real estate data extraction
    const defaultFields = [
        {
            fieldName: 'transaction_type',
            fieldType: 'enum',
            isRequired: true,
            order: 0,
            description: 'The primary intent or category of the message (buy, sell, rent, general)',
            enumValues: JSON.stringify(['buy', 'sell', 'rent', 'general'])
        },
        {
            fieldName: 'property_type',
            fieldType: 'text',
            isRequired: false,
            order: 1,
            description: 'The property description (e.g., "2 bedroom apartment", "villa")'
        },
        {
            fieldName: 'location',
            fieldType: 'text',
            isRequired: false,
            order: 2,
            description: 'City, area, or address where the property is located'
        },
        {
            fieldName: 'price',
            fieldType: 'number',
            isRequired: false,
            order: 3,
            description: 'Price amount (numbers only, no currency symbols)'
        },
        {
            fieldName: 'bedrooms',
            fieldType: 'number',
            isRequired: false,
            order: 4,
            description: 'Number of bedrooms in the property'
        },
        {
            fieldName: 'bathrooms',
            fieldType: 'number',
            isRequired: false,
            order: 5,
            description: 'Number of bathrooms in the property'
        },
        {
            fieldName: 'size_sqft',
            fieldType: 'number',
            isRequired: false,
            order: 6,
            description: 'Property size in square feet'
        },
        {
            fieldName: 'status',
            fieldType: 'enum',
            isRequired: false,
            order: 7,
            description: 'Property construction/availability status',
            enumValues: JSON.stringify(['ready', 'under_construction', 'off_plan'])
        },
        {
            fieldName: 'contact',
            fieldType: 'text',
            isRequired: false,
            order: 8,
            description: 'Contact details (phone number, email, etc.)'
        },
        {
            fieldName: 'special_features',
            fieldType: 'array',
            isRequired: false,
            order: 9,
            description: 'Notable features like sea view, balcony, parking, etc.'
        },
        {
            fieldName: 'note',
            fieldType: 'text',
            isRequired: false,
            order: 10,
            description: 'Additional notes or comments about the property'
        }
    ];

    for (const field of defaultFields) {
        try {
            const existingField = await prisma.sheetFields.findUnique({
                where: { fieldName: field.fieldName }
            });

            if (existingField) {
                console.log(`⚠️  Field "${field.fieldName}" already exists, skipping...`);
                continue;
            }

            await prisma.sheetFields.create({
                data: field
            });
            
            console.log(`✅ Created field: ${field.fieldName} (${field.fieldType})`);
        } catch (error) {
            console.error(`❌ Error creating field "${field.fieldName}":`, error);
        }
    }

    console.log('🎉 Sheet fields seeding completed!');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
