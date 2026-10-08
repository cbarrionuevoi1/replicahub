import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUnitRepeaterConfig1791487000000 implements MigrationInterface {
  name = 'AddUnitRepeaterConfig1791487000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('unit_repeaters');
    if (!table) {
      throw new Error('La tabla "unit_repeaters" no existe. La migración no puede continuar.');
    }

    const configColumn = table.columns.find(c => c.name === 'config');

    if (!configColumn) {
      // Si no existe, la creamos.
      await queryRunner.query(`ALTER TABLE "unit_repeaters" ADD COLUMN "config" json`);
    } else {
      // Si ya existe, verificamos que su tipo y nulabilidad sean correctos.
      if (configColumn.type !== 'json' || configColumn.isNullable !== true) {
        throw new Error(`La columna "config" ya existe pero tiene un tipo incorrecto (${configColumn.type}) o no es nula. Deteniendo la migración por seguridad.`);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    throw new Error('La reversión de esta migración está bloqueada por seguridad para evitar la pérdida accidental de las configuraciones almacenadas en "config". Si es absolutamente necesario revertir, debes eliminar la columna manualmente o crear una migración de limpieza.');
  }
}