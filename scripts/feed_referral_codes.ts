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
    const existing = await prisma.referral_code.findUnique({ where: { code } });
    isUnique = !existing;
  } while (!isUnique);

  return code;
}

// Function to populate the ReferralCode, User, and ReferralUsage tables
async function populateReferralCodes() {
  try {
    // Generate 10 users for unused codes
    const unusedUsers = Array.from({ length: 10 }, (_, index) => ({
      id: generateMockAddress(index + 1).toLowerCase(),
      address: generateMockAddress(index + 1).toLowerCase(),
      onboarded: false,
      created_at: new Date(),
      referral_count: 0,
    }));

    // Generate 10 users for used codes
    const usedCodeUsers = Array.from({ length: 10 }, (_, index) => ({
      id: generateMockAddress(index + 11).toLowerCase(),
      address: generateMockAddress(index + 11).toLowerCase(),
      onboarded: false,
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      referral_count: 0,
    }));

    // Generate 10 additional users to use the codes (for ReferralUsage)
    const usingUsers = Array.from({ length: 10 }, (_, index) => ({
      id: generateMockAddress(index + 21).toLowerCase(),
      address: generateMockAddress(index + 21).toLowerCase(),
      onboarded: true,
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      referral_count: 0,
    }));

    // Insert all users
    await prisma.user.createMany({
      data: [...unusedUsers, ...usedCodeUsers, ...usingUsers],
      skipDuplicates: true,
    });

    // Generate 10 unused codes
    const unusedCodes = await Promise.all(
      unusedUsers.map(async (user, index) => {
        const code = await generateUniqueCode();
        return {
          code,
          userId: user.id,
          created_at: new Date(),
        };
      })
    );

    // Generate 10 used codes with 1–3 users each
    const usedCodes = await Promise.all(
      usedCodeUsers.map(async (user, index) => {
        const code = await generateUniqueCode();
        // Randomly assign 1–3 users to use this code
        const numUsers = Math.floor(Math.random() * 3) + 1; // 1 to 3
        const selectedUsers = usingUsers.slice(0, numUsers);
        return {
          code,
          userId: user.id,
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          users: selectedUsers,
          referral_count: numUsers,
        };
      })
    );

    // Insert all referral codes
    await prisma.$transaction(
      [...unusedCodes, ...usedCodes].map((codeData) =>
        prisma.referral_code.create({
          data: {
            code: codeData.code,
            user_id: codeData.userId,
            created_at: codeData.created_at,
          },
        })
      )
    );

    // Update User.referralCode for all codes
    await prisma.$transaction(
      [...unusedCodes, ...usedCodes].map((codeData) =>
        prisma.user.update({
          where: { id: codeData.userId },
          data: { code: codeData.code },
        })
      )
    );

    // Insert ReferralUsage records for used codes
    let referralUsages: Array<any> = [];
    for (const codeData of usedCodes) {
      const code = await prisma.referral_code.findUnique({
        where: { code: codeData.code },
      });
      if (code && codeData.users) {
        for (const user of codeData.users) {
          referralUsages.push({
            referral_code_id: code.id,
            user_id: user.id,
            used_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          });
        }
        // Update referralCount for the code's owner
        await prisma.user.update({
          where: { id: codeData.userId },
          data: { referral_count: codeData.referral_count },
        });
      }
    }

    if (referralUsages.length > 0) {
      await prisma.referral_usage.createMany({
        data: referralUsages,
        skipDuplicates: true,
      });
    }

    console.log("Successfully populated tables:");
    console.log(
      "Unused codes:",
      unusedCodes.map((c) => c.code)
    );
    console.log(
      "Used codes:",
      usedCodes.map((c) => c.code)
    );
    console.log(
      "Total users created:",
      unusedUsers.length + usedCodeUsers.length + usingUsers.length
    );
    console.log("Total ReferralUsage records:", referralUsages.length);
  } catch (err) {
    console.error("Error populating tables:", err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

async function createBlankUser() {
  const userAddress = "0x64129410B4Ae43c13D79537f114E3B46F97Ac92a";
  // const userAddress = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

  try {
    // Create or update user (upsert to handle duplicates)
    await prisma.user.upsert({
      where: { address: userAddress.toLowerCase() },
      update: {
        // Reset to blank state if exists
        onboarded: false,
        code: null,
        referral_count: 0,
      },
      create: {
        id: userAddress.toLowerCase(),
        address: userAddress.toLowerCase(),
        onboarded: false,
        created_at: new Date(),
        code: null,
        referral_count: 0,
      },
    });

    // Ensure no ReferralUsage records exist for this user
    await prisma.referral_usage.deleteMany({
      where: { user_id: userAddress.toLowerCase() },
    });
  } catch (err) {
    console.error("Error creating blank user:", err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createBlankUser().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});

// // Run the script
// populateReferralCodes().catch((err) => {
//   console.error("Script failed:", err);
//   process.exit(1);
// });
