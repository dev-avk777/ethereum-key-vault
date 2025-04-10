import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddGoogleFields1717082640000 implements MigrationInterface {
  name = 'AddGoogleFields1717082640000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Проверка существования колонки google_id
    const hasGoogleIdColumn = await queryRunner.hasColumn('users', 'google_id')
    if (!hasGoogleIdColumn) {
      await queryRunner.query(`ALTER TABLE "users" ADD "google_id" character varying`)
    }

    // Проверка существования колонки display_name
    const hasDisplayNameColumn = await queryRunner.hasColumn('users', 'display_name')
    if (!hasDisplayNameColumn) {
      await queryRunner.query(`ALTER TABLE "users" ADD "display_name" character varying`)
    }

    // Изменяем колонку password, чтобы она могла быть null
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем колонки при откате миграции
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "google_id"`)

    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "display_name"`)

    // Восстанавливаем ограничение NOT NULL для password
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "password" SET NOT NULL`)
  }
}
