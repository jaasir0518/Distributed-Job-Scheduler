import { prisma } from "../lib/prisma";

async function verify() {
  try {
    // Attempt one read from the database (User count/records)
    const users = await prisma.user.findMany();
    console.log(`✅ Connected. Retrieved ${users.length} users from the database.`);
  } catch (error) {
    console.error("❌ Connection failed!");
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
