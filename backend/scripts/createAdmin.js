require("dotenv").config();

const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");

const [, , email, password, ...nameParts] = process.argv;
const name = nameParts.join(" ") || "Platform Admin";

if (!email || !password) {
    console.error("Usage: npm run create-admin -- <email> <password> [name]");
    process.exit(1);
}

const createAdmin = async () => {
    try {
        const cleanEmail = email.toLowerCase().trim();
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await prisma.user.upsert({
            where: { email: cleanEmail },
            update: {
                role: "admin",
                name,
                password: hashedPassword,
            },
            create: {
                name,
                email: cleanEmail,
                password: hashedPassword,
                role: "admin",
            },
        });

        console.log(`Admin access enabled for ${user.email}`);
    } catch (error) {
        console.error("Could not create admin:", error.message);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
};

createAdmin();
