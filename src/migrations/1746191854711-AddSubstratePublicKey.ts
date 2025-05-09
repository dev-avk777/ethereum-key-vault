import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddSubstratePublicKey1746191854711 implements MigrationInterface {
  name = 'AddSubstratePublicKey1746191854711'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "substrate_public_key" character varying`)
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_b4f93799032f0b9ea6042551b4e" UNIQUE ("substrate_public_key")`
    )
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "userAddress"`)
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD "userAddress" character varying(42) NOT NULL`
    )
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "txHash"`)
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD "txHash" character varying(66) NOT NULL`
    )
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "toAddress"`)
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD "toAddress" character varying(42) NOT NULL`
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "toAddress"`)
    await queryRunner.query(`ALTER TABLE "transactions" ADD "toAddress" character varying NOT NULL`)
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "txHash"`)
    await queryRunner.query(`ALTER TABLE "transactions" ADD "txHash" character varying NOT NULL`)
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "userAddress"`)
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD "userAddress" character varying NOT NULL`
    )
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_b4f93799032f0b9ea6042551b4e"`)
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "substrate_public_key"`)
  }
}
