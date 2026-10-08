'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { apiUrl } from '@/lib/api';

type ExportFormat = 'xlsx' | 'csv';

export default function TransmissionExportButtons({ clientId = '', repeaterId = '', status = '' }: {
  clientId?: string; repeaterId?: string; status?: string;
}) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [error, setError] = useState('');

  const downloadReport = async (format: ExportFormat) => {
    if (exporting) {
      return;
    }

    setError('');
    setExporting(format);

    try {
      const params = new URLSearchParams({format});
      if (clientId) params.set('clientId', clientId);
      if (repeaterId) params.set('repeaterId', repeaterId);
      if (status) params.set('status', status);
      const response = await fetch(
        apiUrl(`/api/transmissions/export?${params}`),
        {
          method: 'GET',
          credentials: 'include',
        },
      );

      if (!response.ok) {
        let message = 'No se pudo generar el reporte';

        try {
          const data = (await response.json()) as { error?: string; message?: string };
          message = data.error || data.message || message;
        } catch {
          // La respuesta no era JSON. Conservamos el mensaje genérico.
        }

        throw new Error(message);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);

      link.href = objectUrl;
      link.download = `replicahub_transmisiones_${date}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'No se pudo generar el reporte');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => void downloadReport('xlsx')}
          disabled={exporting !== null}
          className="bg-success hover:bg-success/90 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-colors shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {exporting === 'xlsx' ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Download size={18} />
          )}
          Exportar Excel
        </button>

        <button
          type="button"
          onClick={() => void downloadReport('csv')}
          disabled={exporting !== null}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-colors shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {exporting === 'csv' ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Download size={18} />
          )}
          Exportar CSV
        </button>
      </div>

      {error && <p className="text-sm text-error font-medium">{error}</p>}
    </div>
  );
}
