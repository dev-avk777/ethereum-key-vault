import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddGoogleFields1717082640000 implements MigrationInterface {
  name = 'AddGoogleFields1717082640000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if google_id column exists
    const hasGoogleIdColumn = await queryRunner.hasColumn('users', 'google_id')
    if (!hasGoogleIdColumn) {
      await queryRunner.query(`ALTER TABLE "users" ADD "google_id" character varying`)
    }

    // Check if display_name column exists
    const hasDisplayNameColumn = await queryRunner.hasColumn('users', 'display_name')
    if (!hasDisplayNameColumn) {
      await queryRunner.query(`ALTER TABLE "users" ADD "display_name" character varying`)
    }

    // Modify password column to allow NULL
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove columns on rollback
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "google_id"`)
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "display_name"`)

    // Restore NOT NULL constraint for password
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "password" SET NOT NULL`)
  }
}
