import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddTransactionsTable1717082640001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userAddress" character varying NOT NULL,
        "txHash" character varying NOT NULL,
        "amount" character varying NOT NULL,
        "toAddress" character varying NOT NULL,
        "timestamp" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transactions" PRIMARY KEY ("id")
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "transactions"`)
  }
}
