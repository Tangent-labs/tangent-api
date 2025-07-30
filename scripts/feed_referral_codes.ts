import { PrismaClient } from "@prisma/client";
import { customAlphabet } from "nanoid";

// Initialize Prisma client
const prisma = new PrismaClient();

// Custom alphabet for generating 8-character codes like YHD6D87E
const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8);

// Generate a mock Ethereum address
function generateMockAddress(index: number): string {
  const hex = index.toString(16).padStart(38, "0");
  return `0x${hex}`;
}

// Function to generate a unique referral code
async function generateUniqueCode(): Promise<string> {
  let code: string;
  let isUnique = false;

  do {
    code = nanoid();
    const existing = await prisma.user.findFirst({
      where: { code },
    });
    isUnique = !existing;
  } while (!isUnique);

  return code;
}

// Function to populate the user and referral_usages tables
async function populateReferralData() {
  try {
    // Generate 10 users with unused codes
    const unusedUsers = await Promise.all(
      Array.from({ length: 10 }, async (_, index) => {
        const address = generateMockAddress(index + 1).toLowerCase();
        const code = await generateUniqueCode();
        return {
          address,
          onboarded: false,
          code,
        };
      })
    );

    // Generate 10 users with used codes
    const usedCodeUsers = await Promise.all(
      Array.from({ length: 10 }, async (_, index) => {
        const address = generateMockAddress(index + 11).toLowerCase();
        const code = await generateUniqueCode();
        return {
          address,
          onboarded: false,
          code,
        };
      })
    );

    // Generate 10 users who used codes
    const usingUsers = Array.from({ length: 10 }, (_, index) => ({
      address: generateMockAddress(index + 21).toLowerCase(),
      onboarded: true,
    }));

    // Generate 1 non-existent user for testing referral usage
    const nonExistentUser = {
      address: generateMockAddress(31).toLowerCase(),
      onboarded: false,
    };

    // Insert all users (except non-existent user)
    const allUsers = [...unusedUsers, ...usedCodeUsers, ...usingUsers];
    await prisma.user.createMany({
      data: allUsers.map((user) => ({
        ...user,
      })),
      skipDuplicates: true,
    });

    // Fetch user IDs for referral_usages
    const userRecords = await prisma.user.findMany({
      where: { address: { in: allUsers.map((u) => u.address) } },
      select: { id: true, address: true, code: true },
    });

    const userMap = new Map(userRecords.map((u) => [u.address, u]));

    // Generate referral_usages for used codes (1–3 users per code)
    let referralUsages: Array<any> = [];
    for (const user of usedCodeUsers) {
      const referrer = userMap.get(user.address);
      if (!referrer || !referrer.code) continue;

      const numUsers = Math.floor(Math.random() * 3) + 1; // 1 to 3
      const selectedUsers = usingUsers.slice(0, numUsers);

      for (const usingUser of selectedUsers) {
        const userRecord = userMap.get(usingUser.address);
        if (userRecord) {
          referralUsages.push({
            referrer_id: referrer.id,
            address: usingUser.address,
            used_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          });
        }
      }
    }

    // Add a referral usage for the non-existent user
    const testReferrer = userMap.get(usedCodeUsers[0].address);
    if (testReferrer && testReferrer.code) {
      referralUsages.push({
        referrer_id: testReferrer.id,
        address: nonExistentUser.address,
        used_at: new Date(),
      });
    }

    if (referralUsages.length > 0) {
      await prisma.referral_usages.createMany({
        data: referralUsages,
        skipDuplicates: true,
      });

      // Create the non-existent user after referral usage
      await prisma.user.create({
        data: {
          address: nonExistentUser.address,
          onboarded: true,
        },
      });
    }

    console.log("Successfully populated tables:");
    console.log(
      "Unused codes:",
      unusedUsers.map((u) => u.code)
    );
    console.log(
      "Used codes:",
      usedCodeUsers.map((u) => u.code)
    );
    console.log(
      "Total users created:",
      unusedUsers.length + usedCodeUsers.length + usingUsers.length + 1
    );
    console.log("Total referral_usages records:", referralUsages.length);
    console.log(
      "Non-existent user address for testing:",
      nonExistentUser.address
    );
  } catch (err) {
    console.error("Error populating tables:", err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

// Function to create or reset a blank user
async function createBlankUser() {
  const userAddress = "0x64129410B4Ae43c13D79537f114E3B46F97Ac92a";

  try {
    // Create or update user (upsert to handle duplicates)
    await prisma.user.upsert({
      where: { address: userAddress.toLowerCase() },
      update: {
        onboarded: false,
        code: null,
      },
      create: {
        address: userAddress.toLowerCase(),
        onboarded: false,
      },
    });

    // Delete any referral_usages records for this user
    await prisma.referral_usages.deleteMany({
      where: { address: userAddress.toLowerCase() },
    });

    console.log(`Successfully created/reset blank user: ${userAddress}`);
  } catch (err) {
    console.error("Error creating blank user:", err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script (uncomment to use)
// populateReferralData().catch((err) => {
//   console.error("Script failed:", err);
//   process.exit(1);
// });

// Run createBlankUser by default
createBlankUser().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
