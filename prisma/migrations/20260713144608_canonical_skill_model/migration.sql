/*
  Warnings:

  - You are about to drop the column `clarity` on the `round_scores` table. All the data in the column will be lost.
  - You are about to drop the column `delivery` on the `round_scores` table. All the data in the column will be lost.
  - You are about to drop the column `impact` on the `round_scores` table. All the data in the column will be lost.
  - You are about to drop the column `structure` on the `round_scores` table. All the data in the column will be lost.
  - Added the required column `approach` to the `round_scores` table without a default value. This is not possible if the table is not empty.
  - Added the required column `concision` to the `round_scores` table without a default value. This is not possible if the table is not empty.
  - Added the required column `framing` to the `round_scores` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quantification` to the `round_scores` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "round_scores" DROP COLUMN "clarity",
DROP COLUMN "delivery",
DROP COLUMN "impact",
DROP COLUMN "structure",
ADD COLUMN     "approach" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "concision" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "framing" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "quantification" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "turns" ADD COLUMN     "skills" JSONB;
