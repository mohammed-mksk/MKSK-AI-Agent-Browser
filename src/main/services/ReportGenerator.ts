import { writeFile } from 'fs/promises';
import { join } from 'path';
import { app, dialog } from 'electron';
import { 
  AutomationResult, 
  AutomationReport, 
  ReportMetadata 
} from '../../shared/types.js';
import { EXPORT_FORMATS } from '../../shared/constants.js';
import { Logger } from './Logger.js';
import { nanoid } from 'nanoid';

export class ReportGenerator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  generateReport(result: AutomationResult): AutomationReport {
    const report: AutomationReport = {
      id: nanoid(),
      title: `Automation Report - ${result.command}`,
      summary: this.generateSummary(result),
      data: result.extractedData,
      screenshots: result.screenshots,
      metadata: {
        generatedAt: new Date(),
        totalResults: result.extractedData.length,
        executionTime: result.duration,
        successRate: result.success ? 1 : 0
      }
    };

    return report;
  }

  async exportToPDF(report: AutomationReport): Promise<Buffer> {
    try {
      // Create HTML content for PDF generation
      const htmlContent = this.generateHTMLReport(report);
      
      // For now, return the HTML as buffer (in a real implementation, you'd use puppeteer to generate PDF)
      const buffer = Buffer.from(htmlContent, 'utf8');
      
      this.logger.info(`PDF report generated: ${report.id}`);
      return buffer;
    } catch (error) {
      this.logger.error('Failed to generate PDF report:', error);
      throw error;
    }
  }

  async exportToExcel(report: AutomationReport): Promise<Buffer> {
    try {
      // Create CSV content (simplified Excel export)
      const csvContent = this.generateCSVContent(report);
      const buffer = Buffer.from(csvContent, 'utf8');
      
      this.logger.info(`Excel report generated: ${report.id}`);
      return buffer;
    } catch (error) {
      this.logger.error('Failed to generate Excel report:', error);
      throw error;
    }
  }

  async exportToCSV(data: any[]): Promise<string> {
    try {
      if (data.length === 0) {
        return 'No data to export';
      }

      // Get all unique keys from the data
      const allKeys = new Set<string>();
      data.forEach(item => {
        if (typeof item === 'object' && item !== null) {
          Object.keys(item).forEach(key => allKeys.add(key));
        }
      });

      const headers = Array.from(allKeys);
      const csvRows = [headers.join(',')];

      // Convert each data item to CSV row
      data.forEach(item => {
        const row = headers.map(header => {
          const value = item[header];
          if (value === null || value === undefined) {
            return '';
          }
          // Escape commas and quotes
          const stringValue = String(value).replace(/"/g, '""');
          return stringValue.includes(',') ? `"${stringValue}"` : stringValue;
        });
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');
      this.logger.info('CSV export generated successfully');
      return csvContent;
    } catch (error) {
      this.logger.error('Failed to generate CSV export:', error);
      throw error;
    }
  }

  async exportToJSON(data: any): Promise<string> {
    try {
      const jsonContent = JSON.stringify(data, null, 2);
      this.logger.info('JSON export generated successfully');
      return jsonContent;
    } catch (error) {
      this.logger.error('Failed to generate JSON export:', error);
      throw error;
    }
  }

  async createScreenshotReport(screenshots: Buffer[]): Promise<Buffer> {
    try {
      // Create HTML report with embedded screenshots
      const htmlContent = this.generateScreenshotHTML(screenshots);
      const buffer = Buffer.from(htmlContent, 'utf8');
      
      this.logger.info(`Screenshot report generated with ${screenshots.length} images`);
      return buffer;
    } catch (error) {
      this.logger.error('Failed to generate screenshot report:', error);
      throw error;
    }
  }

  async saveReport(report: AutomationReport, format: string, filePath?: string): Promise<string> {
    try {
      let content: Buffer | string;
      let extension: string;
      let defaultName: string;

      switch (format.toLowerCase()) {
        case EXPORT_FORMATS.PDF:
          content = await this.exportToPDF(report);
          extension = 'pdf';
          defaultName = `automation-report-${Date.now()}.pdf`;
          break;
        case EXPORT_FORMATS.EXCEL:
          content = await this.exportToExcel(report);
          extension = 'csv';
          defaultName = `automation-report-${Date.now()}.csv`;
          break;
        case EXPORT_FORMATS.CSV:
          content = await this.exportToCSV(report.data);
          extension = 'csv';
          defaultName = `automation-data-${Date.now()}.csv`;
          break;
        case EXPORT_FORMATS.JSON:
          content = await this.exportToJSON(report);
          extension = 'json';
          defaultName = `automation-data-${Date.now()}.json`;
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      // If no file path provided, show save dialog
      if (!filePath) {
        const result = await dialog.showSaveDialog({
          defaultPath: join(app.getPath('downloads'), defaultName),
          filters: [
            { name: `${format.toUpperCase()} Files`, extensions: [extension] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });

        if (result.canceled || !result.filePath) {
          throw new Error('Save operation cancelled');
        }

        filePath = result.filePath;
      }

      // Write file
      await writeFile(filePath, content);
      
      this.logger.info(`Report saved to: ${filePath}`);
      return filePath;
    } catch (error) {
      this.logger.error('Failed to save report:', error);
      throw error;
    }
  }

  private generateSummary(result: AutomationResult): string {
    const summary = [
      `Automation Command: ${result.command}`,
      `Status: ${result.success ? 'Success' : 'Failed'}`,
      `Duration: ${Math.round(result.duration / 1000)} seconds`,
      `Data Items Extracted: ${result.extractedData.length}`,
      `Screenshots Captured: ${result.screenshots.length}`,
      `Intent Type: ${result.intent.type}`,
      `Execution Steps: ${result.executionPlan.steps.length}`
    ];

    if (result.errors.length > 0) {
      summary.push(`Errors Encountered: ${result.errors.length}`);
    }

    return summary.join('\n');
  }

  private generateHTMLReport(report: AutomationReport): string {
    const screenshotElements = report.screenshots.map((screenshot, index) => 
      `<img src="data:image/png;base64,${screenshot.toString('base64')}" 
           alt="Screenshot ${index + 1}" 
           style="max-width: 100%; margin: 10px 0; border: 1px solid #ddd;" />`
    ).join('\n');

    const dataTable = this.generateDataTable(report.data);

    return `
<!DOCTYPE html>
<html>
<head>
    <title>${report.title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .summary { background: #e8f4fd; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 2px solid #007acc; padding-bottom: 5px; }
        table { border-collapse: collapse; width: 100%; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .metadata { font-size: 12px; color: #666; }
        .screenshots { text-align: center; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${report.title}</h1>
        <div class="metadata">
            Generated on: ${report.metadata.generatedAt.toLocaleString()}<br>
            Total Results: ${report.metadata.totalResults}<br>
            Execution Time: ${Math.round(report.metadata.executionTime / 1000)}s<br>
            Success Rate: ${Math.round(report.metadata.successRate * 100)}%
        </div>
    </div>

    <div class="summary">
        <h2>Summary</h2>
        <pre>${report.summary}</pre>
    </div>

    <div class="section">
        <h2>Extracted Data</h2>
        ${dataTable}
    </div>

    <div class="section screenshots">
        <h2>Screenshots</h2>
        ${screenshotElements}
    </div>
</body>
</html>`;
  }

  private generateDataTable(data: any[]): string {
    if (data.length === 0) {
      return '<p>No data extracted</p>';
    }

    // Get all unique keys
    const allKeys = new Set<string>();
    data.forEach(item => {
      if (typeof item.content === 'object' && item.content !== null) {
        Object.keys(item.content).forEach(key => allKeys.add(key));
      }
    });

    const headers = ['Type', 'Source', 'Confidence', ...Array.from(allKeys)];
    
    const headerRow = headers.map(h => `<th>${h}</th>`).join('');
    const dataRows = data.map(item => {
      const cells = [
        item.type || '',
        item.source?.url || '',
        Math.round((item.confidence || 0) * 100) + '%',
        ...Array.from(allKeys).map(key => {
          const value = item.content?.[key];
          return typeof value === 'object' ? JSON.stringify(value) : (value || '');
        })
      ];
      return `<tr>${cells.map(cell => `<td>${String(cell).substring(0, 100)}</td>`).join('')}</tr>`;
    }).join('');

    return `
<table>
    <thead><tr>${headerRow}</tr></thead>
    <tbody>${dataRows}</tbody>
</table>`;
  }

  private generateCSVContent(report: AutomationReport): string {
    const rows = [
      ['Report Title', report.title],
      ['Generated At', report.metadata.generatedAt.toISOString()],
      ['Total Results', report.metadata.totalResults.toString()],
      ['Execution Time (ms)', report.metadata.executionTime.toString()],
      ['Success Rate', report.metadata.successRate.toString()],
      [''],
      ['Summary'],
      [report.summary],
      [''],
      ['Extracted Data']
    ];

    // Add data headers
    if (report.data.length > 0) {
      const headers = ['Type', 'Source URL', 'Confidence', 'Content'];
      rows.push(headers);

      // Add data rows
      report.data.forEach(item => {
        rows.push([
          item.type || '',
          item.source?.url || '',
          Math.round((item.confidence || 0) * 100) + '%',
          typeof item.content === 'object' ? JSON.stringify(item.content) : String(item.content || '')
        ]);
      });
    }

    return rows.map(row => 
      row.map(cell => {
        const stringCell = String(cell).replace(/"/g, '""');
        return stringCell.includes(',') ? `"${stringCell}"` : stringCell;
      }).join(',')
    ).join('\n');
  }

  private generateScreenshotHTML(screenshots: Buffer[]): string {
    const screenshotElements = screenshots.map((screenshot, index) => 
      `<div style="margin: 20px 0; text-align: center;">
         <h3>Screenshot ${index + 1}</h3>
         <img src="data:image/png;base64,${screenshot.toString('base64')}" 
              alt="Screenshot ${index + 1}" 
              style="max-width: 90%; border: 1px solid #ddd; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
       </div>`
    ).join('\n');

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Screenshot Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        h1 { text-align: center; color: #333; }
        .metadata { text-align: center; color: #666; margin-bottom: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Automation Screenshots</h1>
        <div class="metadata">
            Generated on: ${new Date().toLocaleString()}<br>
            Total Screenshots: ${screenshots.length}
        </div>
        ${screenshotElements}
    </div>
</body>
</html>`;
  }
}