import prisma from "../prisma";
import bcrypt from "bcryptjs";

export const seedSamplePosts = async () => {
  try {
    const postCount = await prisma.post.count();
    if (postCount >= 5) {
      console.log(`[Seed] Database already has ${postCount} posts. Skipping seed.`);
      return;
    }

    console.log("[Seed] Seeding sample posts for DROP60.LIVE 24/7 Stage...");

    // 1. Ensure system host / curator user exists
    let hostUser = await prisma.user.findUnique({
      where: { username: "drop60_curator" },
    });

    if (!hostUser) {
      const passwordHash = await bcrypt.hash("curator123456", 10);
      hostUser = await prisma.user.create({
        data: {
          username: "drop60_curator",
          passwordHash,
          balance: 999999.0,
        },
      });
    }

    // 2. Sample posts with authentic high-resolution Unsplash images
    const samplePosts = [
      {
        title: "Cyberpunk Neo-Tokyo lúc 3 giờ sáng: Sương đêm và ánh đèn Neon",
        imageUrls: JSON.stringify([
          "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=1200&q=80",
          "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80",
        ]),
        bgmCategory: "moody",
        isPriority: true,
        status: "queued",
      },
      {
        title: "Cú drift 180 độ nghẹt thở trên đỉnh đèo Mã Pí Lèng mây phủ",
        imageUrls: JSON.stringify([
          "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=1200&q=80",
          "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1200&q=80",
        ]),
        bgmCategory: "dramatic",
        isPriority: false,
        status: "queued",
      },
      {
        title: "Khi AI thử nấu món Phở Bò truyền thống và cái kết bất ngờ...",
        imageUrls: JSON.stringify([
          "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=1200&q=80",
          "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
        ]),
        bgmCategory: "funny",
        isPriority: false,
        status: "queued",
      },
      {
        title: "Lễ hội âm nhạc điện tử ngoài vũ trụ 2077 - Drop beat cực căng!",
        imageUrls: JSON.stringify([
          "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80",
          "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80",
        ]),
        bgmCategory: "upbeat",
        isPriority: false,
        status: "queued",
      },
      {
        title: "Hành trình độc hành xuyên bão tuyết Everest chạm đỉnh vinh quang",
        imageUrls: JSON.stringify([
          "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
          "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=1200&q=80",
        ]),
        bgmCategory: "dramatic",
        isPriority: false,
        status: "queued",
      },
    ];

    for (const postData of samplePosts) {
      await prisma.post.create({
        data: {
          userId: hostUser.id,
          title: postData.title,
          imageUrls: postData.imageUrls,
          bgmCategory: postData.bgmCategory,
          isPriority: postData.isPriority,
          status: postData.status,
          survivedSeconds: 0,
        },
      });
    }

    console.log(`[Seed] Successfully seeded ${samplePosts.length} posts.`);
  } catch (error) {
    console.error("[Seed Error]:", error);
  }
};
