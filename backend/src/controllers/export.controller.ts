import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Transmission } from '../entities/Transmission';
import { AuditLog } from '../entities/AuditLog';
import { ReportExport } from '../entities/ReportExport';
import ExcelJS from 'exceljs';
import { stringify } from 'csv-stringify';

const buildQuery = (req: Request) => {
  const { clientId, plate, imei, repeaterId, status, dateFrom, dateTo } = req.query;
  const qb = AppDataSource.getRepository(Transmission)
    .createQueryBuilder('t')
    .select([
      't.id', 't.plate', 't.imei', 't.clientName', 't.repeaterName',
      't.status', 't.httpCode', 't.attempts', 't.eventTime',
      't.receivedAt', 't.durationMs', 't.createdAt'
    ]);

  if (plate) qb.andWhere('t.plate ILIKE :plate', { plate: `%${plate}%` });
  if (imei) qb.andWhere('t.imei ILIKE :imei', { imei: `%${imei}%` });
  if (repeaterId) qb.andWhere('t.repeaterId = :repeaterId', { repeaterId });
  if (status) qb.andWhere('t.status = :status', { status });
  if (dateFrom) qb.andWhere('t.createdAt >= :dateFrom', { dateFrom });
  if (dateTo) qb.andWhere('t.createdAt <= :dateTo', { dateTo: dateTo + ' 23:59:59' });

  return qb;
};

export const exportTransmissions = async (req: Request, res: Response) => {
  const { format } = req.query;
  const user = (req as any).user;

  try {
    const qb = buildQuery(req);
    const rows = await qb.getMany();

    await AppDataSource.getRepository(ReportExport).save({
      userId: user.id,
      format: (format as string || '').toUpperCase(),
      filters: req.query,
      rowCount: rows.length
    });

    await AppDataSource.getRepository(AuditLog).save({
      userId: user.id,
      action: 'REPORT_EXPORTED',
      details: { format, rowCount: rows.length },
      ipAddress: req.ip || ''
    });

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `replicahub_transmisiones_${dateStr}.${format}`;

    const mapRow = (t: Transmission) => ({
      eventTime: t.eventTime ? new Date(t.eventTime).toISOString() : '',
      receivedAt: t.receivedAt ? new Date(t.receivedAt).toISOString() : '',
      clientName: t.clientName || '',
      plate: t.plate,
      imei: t.imei,
      repeaterName: t.repeaterName,
      status: t.status,
      httpCode: t.httpCode ?? '',
      attempts: t.attempts,
      durationMs: t.durationMs ?? '',
      createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : ''
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      const stringifier = stringify({
        header: true,
        columns: {
          eventTime: 'Fecha evento GPS',
          receivedAt: 'Fecha recepción',
          clientName: 'Cliente',
          plate: 'Placa',
          imei: 'IMEI',
          repeaterName: 'Repetidor',
          status: 'Estado',
          httpCode: 'Código HTTP',
          attempts: 'Intentos',
          durationMs: 'Tiempo respuesta (ms)',
          createdAt: 'Fecha envío'
        }
      });

      stringifier.pipe(res);
      for (const t of rows) stringifier.write(mapRow(t));
      stringifier.end();
      return;
    }

    if (format === 'xlsx') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
      const sheet = workbook.addWorksheet('Transmisiones');
      sheet.columns = [
        { header: 'Fecha evento GPS', key: 'eventTime', width: 22 },
        { header: 'Fecha recepción', key: 'receivedAt', width: 22 },
        { header: 'Cliente', key: 'clientName', width: 20 },
        { header: 'Placa', key: 'plate', width: 14 },
        { header: 'IMEI', key: 'imei', width: 18 },
        { header: 'Repetidor', key: 'repeaterName', width: 20 },
        { header: 'Estado', key: 'status', width: 14 },
        { header: 'Código HTTP', key: 'httpCode', width: 14 },
        { header: 'Intentos', key: 'attempts', width: 10 },
        { header: 'Tiempo respuesta (ms)', key: 'durationMs', width: 22 },
        { header: 'Fecha envío', key: 'createdAt', width: 22 }
      ];

      for (const t of rows) sheet.addRow(mapRow(t)).commit();
      sheet.commit();
      await workbook.commit();
      return;
    }

    res.status(400).json({ error: 'Formato no soportado. Use format=xlsx o format=csv' });
  } catch (error: any) {
    console.error('[export]', error.message);
    if (!res.headersSent) res.status(500).json({ error: 'Error exportando reporte' });
  }
};
