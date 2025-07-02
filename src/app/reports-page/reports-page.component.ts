import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common'; // Import CurrencyPipe and DatePipe
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

// Services
// import { InvoiceService } from '../invoice-form/invoice.service';
// import { ExpenseService } from '../expense.service';
// import { CustomerService } from '../customer.service';

// Models
import { Invoice, Expense, Customer, CurrencyCode, DEFAULT_CURRENCY_CODE } from '../core/models/app.models'; // Added CurrencyCode, DEFAULT_CURRENCY_CODE

// Services
import { InvoiceService } from '../invoice-form/invoice.service';
import { ExpenseService } from '../expense.service';
import { CustomerService } from '../customer.service';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CurrencyPipe, DatePipe],
  templateUrl: './reports-page.component.html',
  styleUrls: ['./reports-page.component.css'],
  providers: [CurrencyPipe, DatePipe] // Add pipes to providers for injecting into the component
})
export class ReportsPageComponent implements OnInit {
  private fb = inject(FormBuilder);
  private invoiceService = inject(InvoiceService);
  private expenseService = inject(ExpenseService);
  private customerService = inject(CustomerService);

  reportForm!: FormGroup;
  reportTypeOptions = [
    { value: 'invoiceLog', label: 'Invoice Log' },
    { value: 'expenseLog', label: 'Expense Log' }
  ];

  isLoading = false;
  errorMessage: string | null = null;

  // Data properties for reports (to be populated later)
  currentReportType: 'invoiceLog' | 'expenseLog' | null = null;
  reportData: any[] = [];
  invoiceLogSummary = {
    totalPaidInvoices: 0,
    totalUnpaidInvoices: 0,
    totalPartiallyPaidInvoices: 0,
    totalPaidAmount: 0
  };
  expenseLogSummary = {
    totalExpenseAmount: 0
  };

  private currencyDefault: CurrencyCode = DEFAULT_CURRENCY_CODE; // For PDF formatting if item currency is not available


  constructor(
    private currencyPipe: CurrencyPipe, // Inject CurrencyPipe
    private datePipe: DatePipe         // Inject DatePipe
  ) {}

  ngOnInit(): void {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    this.reportForm = this.fb.group({
      reportType: [this.reportTypeOptions[0].value, Validators.required],
      startDate: [this.formatDate(firstDayOfMonth), Validators.required],
      endDate: [this.formatDate(today), Validators.required]
    });
  }

  // Helper to format date to YYYY-MM-DD for date inputs
  private formatDate(date: Date): string {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
  }

  onSubmit(): void {
    if (this.reportForm.invalid) {
      this.errorMessage = "Please select a report type and valid start/end dates.";
      return;
    }
    this.errorMessage = null;
    this.isLoading = true;
    this.reportData = []; // Clear previous data
    this.currentReportType = null;
    this.resetSummaries();

    const { reportType, startDate: startDateString, endDate: endDateString } = this.reportForm.value;

    // Convert string dates from form to Date objects
    const startDate = new Date(startDateString);
    const endDate = new Date(endDateString);
    // It's good practice to adjust time for date ranges, e.g., start of day for startDate, end of day for endDate.
    // The services already handle adjusting endDate to end-of-day.
    // startDate by default will be 00:00:00 of the selected day.

    console.log('Generating report for:', reportType, startDate, endDate);

    if (reportType === 'invoiceLog') {
      this.generateInvoiceLog(startDate, endDate);
    } else if (reportType === 'expenseLog') {
      this.generateExpenseLog(startDate, endDate);
    }
  }

  private async generateInvoiceLog(startDate: Date, endDate: Date): Promise<void> {
    try {
      const [invoices, customers] = await Promise.all([
        this.invoiceService.getInvoicesByDateRange(startDate, endDate),
        this.customerService.getCustomers() // Fetch all customers for mapping
      ]);

      const customerMap = new Map(customers.map(c => [c.id, c.name]));

      this.reportData = invoices.map(invoice => ({
        invoiceId: invoice.invoiceNumber || invoice.id,
        date: invoice.date, // Already a Date object from service
        customerName: typeof invoice.customer === 'string' ? (customerMap.get(invoice.customer) || 'Unknown Customer') : invoice.customer.name,
        productNames: invoice.items.map(item => item.description).join(', '),
        paymentStatus: invoice.paymentStatus,
        grandTotal: invoice.grandTotal
      }));

      // Calculate summaries
      this.invoiceLogSummary.totalPaidInvoices = invoices.filter(inv => inv.paymentStatus === 'Paid').length;
      this.invoiceLogSummary.totalUnpaidInvoices = invoices.filter(inv => inv.paymentStatus === 'Unpaid').length;
      this.invoiceLogSummary.totalPartiallyPaidInvoices = invoices.filter(inv => inv.paymentStatus === 'Partially Paid').length;
      this.invoiceLogSummary.totalPaidAmount = invoices
        .filter(inv => inv.paymentStatus === 'Paid' || inv.paymentStatus === 'Partially Paid')
        .reduce((sum, inv) => sum + (inv.totalPaid || 0), 0);

      this.currentReportType = 'invoiceLog';
    } catch (error) {
      this.errorMessage = 'Failed to generate invoice log. Please try again.';
      console.error('Error generating invoice log:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private async generateExpenseLog(startDate: Date, endDate: Date): Promise<void> {
    try {
      const expenses = await this.expenseService.getExpensesByDateRange(startDate, endDate);
      this.reportData = expenses.map(expense => ({
        date: expense.date, // Already a Date object from service
        category: expense.category,
        description: expense.description,
        vendorName: expense.vendor || 'N/A',
        amount: expense.amount,
        currency: expense.currency // For display if needed, though summary is primary
      }));

      // Calculate summary
      this.expenseLogSummary.totalExpenseAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);
      this.currentReportType = 'expenseLog';
    } catch (error) {
      this.errorMessage = 'Failed to generate expense log. Please try again.';
      console.error('Error generating expense log:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private resetSummaries(): void {
    this.invoiceLogSummary = {
      totalPaidInvoices: 0,
      totalUnpaidInvoices: 0,
      totalPartiallyPaidInvoices: 0,
      totalPaidAmount: 0
    };
    this.expenseLogSummary = {
      totalExpenseAmount: 0
    };
  }

  downloadReportAsPdf(): void {
    if (!this.currentReportType || this.reportData.length === 0) {
      alert('No data available to download. Please generate a report first.');
      return;
    }

    const doc = new jsPDF({
      orientation: 'landscape', // Use landscape for wider tables
      unit: 'pt', // points as unit
      format: 'a4'
    });

    const reportTitle = this.currentReportType === 'invoiceLog' ? 'Invoice Log Report' : 'Expense Log Report';
    const dateRange = `(${this.reportForm.value.startDate} to ${this.reportForm.value.endDate})`;
    const fullTitle = `${reportTitle} ${dateRange}`;

    doc.setFontSize(18);
    doc.text(fullTitle, 40, 40); // Add title with some margin

    let head: string[][] = [];
    let body: any[][] = [];
    let finalY = 0; // To track the Y position after the table

    if (this.currentReportType === 'invoiceLog') {
      head = [['Invoice ID', 'Date', 'Customer Name', 'Product/Service(s)', 'Status', 'Amount']];
      body = this.reportData.map(row => [
        row.invoiceId,
        this.datePipe.transform(row.date, 'mediumDate') || '',
        row.customerName,
        row.productNames, // Assuming this is already a concatenated string
        row.paymentStatus,
        this.currencyPipe.transform(row.grandTotal, row.currency || this.currencyDefault) || ''
      ]);

      autoTable(doc, {
        head: head,
        body: body,
        startY: 60, // Start table below the title
        theme: 'striped', // or 'grid', 'plain'
        headStyles: { fillColor: [22, 160, 133] }, // Example header style
        didDrawPage: (data) => { // Ensure title is repeated on new pages if table spans
            doc.setFontSize(18);
            doc.text(fullTitle, 40, 40);
        }
      });

      finalY = (doc as any).lastAutoTable.finalY || 60; // Get Y pos after table

      // Add summary for Invoice Log
      const summaryY = finalY + 20;
      doc.setFontSize(12);
      doc.text('Summary:', 40, summaryY);
      autoTable(doc, {
        body: [
          ['Total Paid Invoices:', this.invoiceLogSummary.totalPaidInvoices.toString()],
          ['Total Unpaid Invoices:', this.invoiceLogSummary.totalUnpaidInvoices.toString()],
          ['Total Partially Paid Invoices:', this.invoiceLogSummary.totalPartiallyPaidInvoices.toString()],
          ['Total Paid Amount:', this.currencyPipe.transform(this.invoiceLogSummary.totalPaidAmount, this.currencyDefault) || ''],
        ],
        startY: summaryY + 15,
        theme: 'plain',
        tableWidth: 'wrap',
        styles: { cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold' } }
      });

    } else if (this.currentReportType === 'expenseLog') {
      head = [['Date', 'Category', 'Description', 'Vendor', 'Amount']];
      body = this.reportData.map(row => [
        this.datePipe.transform(row.date, 'mediumDate') || '',
        row.category,
        row.description,
        row.vendorName,
        this.currencyPipe.transform(row.amount, row.currency || this.currencyDefault) || ''
      ]);

      autoTable(doc, {
        head: head,
        body: body,
        startY: 60,
        theme: 'striped',
        headStyles: { fillColor: [22, 160, 133] },
         didDrawPage: (data) => {
            doc.setFontSize(18);
            doc.text(fullTitle, 40, 40);
        }
      });

      finalY = (doc as any).lastAutoTable.finalY || 60;

      // Add summary for Expense Log
      const summaryY = finalY + 20;
      doc.setFontSize(12);
      doc.text('Summary:', 40, summaryY);
      autoTable(doc, {
        body: [
          ['Total Expenses:', this.currencyPipe.transform(this.expenseLogSummary.totalExpenseAmount, this.currencyDefault) || ''],
        ],
        startY: summaryY + 15,
        theme: 'plain',
        tableWidth: 'wrap',
        styles: { cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold' } }
      });
    }

    const filename = `${reportTitle.replace(/\s+/g, '_')}_${this.reportForm.value.startDate}_to_${this.reportForm.value.endDate}.pdf`;
    doc.save(filename);
  }
}
