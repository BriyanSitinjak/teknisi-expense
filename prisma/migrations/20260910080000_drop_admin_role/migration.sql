-- Convert leftover Admin accounts to HR, then drop the enum value.
UPDATE "users" SET role = 'hr' WHERE role = 'admin';

ALTER TYPE "user_role" RENAME TO "user_role_old";
CREATE TYPE "user_role" AS ENUM ('hr', 'branch_head');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "user_role" USING ("role"::text::"user_role");
DROP TYPE "user_role_old";
