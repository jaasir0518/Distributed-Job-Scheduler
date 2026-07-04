import { prisma } from "../lib/prisma";

async function main() {
  console.log("Seeding database...");

  // Delete existing data to start clean
  await prisma.organization.deleteMany({});
  await prisma.user.deleteMany({});

  // Create starter user
  const user = await prisma.user.create({
    data: {
      name: "Starter Admin",
      email: "admin@scheduler.local",
      password: "starterpassword123", // Dummy starter password
    },
  });

  console.log(`Created user: ${user.name} (${user.email})`);

  // Create starter organization
  const org = await prisma.organization.create({
    data: {
      name: "Starter Org",
      ownerId: user.id,
    },
  });

  console.log(`Created organization: ${org.name}`);
  console.log("Seeding completed successfully.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Error during seed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
