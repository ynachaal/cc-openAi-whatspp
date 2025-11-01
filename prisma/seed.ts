import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create admin user
  const adminPassword = await hash('admin123', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: adminPassword,
      role: 'ADMIN',
    },
  })

  console.log('✅ Admin user created:', admin.email)

  // Create API keys entry (use values from .env)
  const apiKeys = await prisma.apiKeys.upsert({
    where: { googleSheetId: process.env.GOOGLE_SHEET_ID || '' },
    update: {
      openaiKey: process.env.OPENAI_API_KEY,
      googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL,
      googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY,
    },
    create: {
      googleSheetId: process.env.GOOGLE_SHEET_ID,
      openaiKey: process.env.OPENAI_API_KEY,
      googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL,
      googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY,
    },
  })

  console.log('✅ API keys created for sheet:', apiKeys.googleSheetId)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
