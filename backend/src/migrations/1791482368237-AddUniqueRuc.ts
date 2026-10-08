import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUniqueRuc1791482368237 implements MigrationInterface {
    name = 'AddUniqueRuc1791482368237'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "clients" ADD CONSTRAINT "UQ_8871e085e4697493f195e1ab056" UNIQUE ("ruc")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "clients" DROP CONSTRAINT "UQ_8871e085e4697493f195e1ab056"`);
    }

}
