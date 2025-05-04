import { MigrationInterface, QueryRunner } from 'typeorm'

export class MakePublicKeyNullable1746378595773 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users"
             ALTER COLUMN "publicKey" DROP NOT NULL;`
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users"
             ALTER COLUMN "publicKey" SET NOT NULL;`
    )
  }
}
