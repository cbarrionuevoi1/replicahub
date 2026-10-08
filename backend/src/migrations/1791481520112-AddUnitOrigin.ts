import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUnitOrigin1791481520112 implements MigrationInterface {
    name = 'AddUnitOrigin1791481520112'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Agregamos la columna origin con valor por defecto
        await queryRunner.query(`ALTER TABLE "units" ADD "origin" character varying NOT NULL DEFAULT 'MANUAL'`);
        // Hacemos que la placa sea nullable
        await queryRunner.query(`ALTER TABLE "units" ALTER COLUMN "plate" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "units" ALTER COLUMN "plate" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "units" DROP COLUMN "origin"`);
    }

}
