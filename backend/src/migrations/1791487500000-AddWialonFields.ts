import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWialonFields1791487500000 implements MigrationInterface {
    name = 'AddWialonFields1791487500000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Verificar tabla units
        const unitsTable = await queryRunner.getTable("units");
        if (!unitsTable) throw new Error("La tabla units no existe.");
        
        if (!unitsTable.columns.find(c => c.name === "wialonUniqueId")) {
            await queryRunner.query(`ALTER TABLE "units" ADD "wialonUniqueId" character varying`);
            await queryRunner.query(`ALTER TABLE "units" ADD CONSTRAINT "UQ_wialonUniqueId" UNIQUE ("wialonUniqueId")`);
        } else {
            throw new Error("La columna wialonUniqueId ya existe en units. Abortando para no sobrescribir datos.");
        }

        // Verificar tabla raw_messages
        const rawMessagesTable = await queryRunner.getTable("raw_messages");
        if (!rawMessagesTable) throw new Error("La tabla raw_messages no existe.");

        const requiredColumns = ["ipAddress", "unitId", "clientId", "status", "errorMessage", "decodedData"];
        for (const col of requiredColumns) {
            if (rawMessagesTable.columns.find(c => c.name === col)) {
                throw new Error(`La columna ${col} ya existe en raw_messages. Abortando migración.`);
            }
        }

        await queryRunner.query(`ALTER TABLE "raw_messages" ADD "ipAddress" character varying`);
        await queryRunner.query(`ALTER TABLE "raw_messages" ADD "unitId" uuid`);
        await queryRunner.query(`ALTER TABLE "raw_messages" ADD "clientId" uuid`);
        await queryRunner.query(`ALTER TABLE "raw_messages" ADD "status" character varying`);
        await queryRunner.query(`ALTER TABLE "raw_messages" ADD "errorMessage" text`);
        await queryRunner.query(`ALTER TABLE "raw_messages" ADD "decodedData" json`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        throw new Error("Reversión bloqueada: Eliminar estas columnas podría destruir el historial de asociaciones y datos decodificados de la recepción Wialon.");
    }
}
