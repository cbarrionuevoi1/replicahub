import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { AuditLog } from '../entities/AuditLog';
import { ReportExport } from '../entities/ReportExport';
import { transmissionFilters } from './transmission-filters';
import ExcelJS from 'exceljs';
import { stringify } from 'csv-stringify';

interface ExportRow {
  eventTime: Date | null; receivedAt: Date | null; createdAt: Date | null;
  lastAttemptAt: Date | null; lastResponseAt: Date | null;
  clientName: string | null; plate: string; imei: string; repeaterName: string;
  status: string; httpCode: number | null; attempts: number; durationMs: number | null;
  responseReceived: unknown; error: string | null;
}
const iso = (date: Date | string | null) => date ? new Date(date).toISOString() : '';
const asText = (value: unknown) => value === null || value === undefined ? '' :
  typeof value === 'string' ? value : JSON.stringify(value);
// Evita ejecución de fórmulas si el CSV se abre en una hoja de cálculo.
const csvSafe = (value: string) => /^[\s]*[=+@\-\t\r]/.test(value) ? `'${value}` : value;
const exportData = (t: ExportRow) => ({
  eventTime: iso(t.eventTime), receivedAt: iso(t.receivedAt),
  createdAt: iso(t.createdAt), lastAttemptAt: iso(t.lastAttemptAt),
  lastResponseAt: iso(t.lastResponseAt), clientName: t.clientName || '', plate: t.plate,
  imei: t.imei, repeaterName: t.repeaterName, status: t.status,
  httpResponded: t.httpCode !== null ? 'Sí' : 'No', httpCode: t.httpCode ?? '',
  attempts: t.attempts, durationMs: t.durationMs ?? '',
  error: t.error || '', responseReceived: asText(t.responseReceived),
});
const columns = [
  ['eventTime', 'Fecha evento GPS'], ['receivedAt', 'Fecha recepción'],
  ['createdAt', 'Fecha registro'], ['lastAttemptAt', 'Fecha último intento'],
  ['lastResponseAt', 'Fecha respuesta HTTP'], ['clientName', 'Cliente'],
  ['plate', 'Placa'], ['imei', 'IMEI'], ['repeaterName', 'Repetidor'],
  ['status', 'Estado'], ['httpResponded', '¿Respondió HTTP?'],
  ['httpCode', 'Código HTTP'], ['attempts', 'Intentos'],
  ['durationMs', 'Duración (ms)'], ['error', 'Error'], ['responseReceived', 'Respuesta del servidor'],
] as const;

export const exportTransmissions = async (req: Request, res: Response) => {
  const format = req.query.format;
  if (format !== 'xlsx' && format !== 'csv') return res.status(400).json({ error: 'Usa format=xlsx o format=csv.' });
  let filter;
  try { filter = transmissionFilters(req); }
  catch (err) { return res.status(400).json({ error: (err as Error).message }); }

  try {
    // Igual filtro y orden que la tabla; evitar exportaciones silenciosamente truncadas.
    const rows: ExportRow[] = await AppDataSource.query(`
      SELECT t."eventTime", t."receivedAt", t."createdAt", t."lastAttemptAt", t."lastResponseAt",
        t."clientName", t.plate, t.imei, t."repeaterName", t.status, t."httpCode",
        t.attempts, t."durationMs", t.error, t."responseReceived"
      FROM transmissions t LEFT JOIN units u ON u.id = t."unitId"
      ${filter.where} ORDER BY t."createdAt" DESC, t.id DESC LIMIT 50001
    `, filter.params);
    if (rows.length > 50000) return res.status(422).json({ error: 'El reporte supera 50 000 filas. Reduce el intervalo de fechas.' });
    const user = (req as any).user;
    await AppDataSource.getRepository(ReportExport).save({
      userId: user.id, format: format.toUpperCase(), filters: req.query, rowCount: rows.length,
    });
    await AppDataSource.getRepository(AuditLog).save({
      userId: user.id, action: 'REPORT_EXPORTED', details: { format, rowCount: rows.length },
      ipAddress: req.ip || '',
    });

    const name = `replicahub_transmisiones_${new Date().toISOString().slice(0,10)}.${format}`;
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Cache-Control', 'no-store');

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      const stream = stringify({ header: true, columns: Object.fromEntries(columns) });
      stream.pipe(res);
      for (const t of rows) {
        const data = exportData(t);
        stream.write(Object.fromEntries(Object.entries(data).map(([key, value]) =>
          [key, typeof value === 'string' ? csvSafe(value) : value])));
      }
      stream.end();
      return;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
    const sheet = workbook.addWorksheet('Transmisiones');
    sheet.columns = columns.map(([key, header]) => ({ key, header, width: key === 'responseReceived' ? 65 : 23 }));
    for (const t of rows) {
      const item = exportData(t);
      // Celdas de Excel tienen un límite práctico de 32767 caracteres.
      sheet.addRow(Object.fromEntries(Object.entries(item).map(([key, value]) =>
        [key, typeof value === 'string' ? csvSafe(value.slice(0, 32000)) : value]))).commit();
    }
    sheet.commit();
    await workbook.commit();
  } catch (error) {
    console.error('[export]', error);
    if (!res.headersSent) res.status(500).json({ error: 'No se pudo generar el reporte.' });
  }
};
