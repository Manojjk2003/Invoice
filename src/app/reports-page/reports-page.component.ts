import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import jsPDF from 'jspdf';
import * as autoTableLib from 'jspdf-autotable'; // Namespace import

// Models
import { Invoice, Expense, Customer, CurrencyCode, DEFAULT_CURRENCY_CODE } from '../core/models/app.models';

// Services
import { InvoiceService } from '../invoice-form/invoice.service';
import { ExpenseService } from '../expense.service';
import { CustomerService } from '../customer.service';

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CurrencyPipe, DatePipe],
  templateUrl: './reports-page.component.html',
  styleUrls: ['./reports-page.component.css']
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
  
  constructor() {}

  ngOnInit(): void {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    this.reportForm = this.fb.group({
      reportType: [this.reportTypeOptions[0].value, Validators.required],
      startDate: [this.formatDate(firstDayOfMonth), Validators.required],
      endDate: [this.formatDate(today), Validators.required]
    });
  }

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
    this.isLoading = true;
    this.errorMessage = null;
    this.reportData = [];
    this.currentReportType = null;
    this.resetSummaries();

    const { reportType, startDate: startDateString, endDate: endDateString } = this.reportForm.value;
    
    const startDate = new Date(startDateString);
    const endDate = new Date(endDateString);

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
        this.customerService.getCustomers()
      ]);

      const customerMap = new Map(customers.map(c => [c.id, c.name]));

      this.reportData = invoices.map(invoice => ({
        invoiceId: invoice.invoiceNumber || invoice.id,
        date: invoice.date,
        customerName: typeof invoice.customer === 'string' ? (customerMap.get(invoice.customer) || 'Unknown Customer') : invoice.customer.name,
        productNames: invoice.items.map(item => item.description).join(', '),
        paymentStatus: invoice.paymentStatus,
        grandTotal: invoice.grandTotal,
        currency: invoice.currency 
      }));

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
        date: expense.date,
        category: expense.category,
        description: expense.description,
        vendorName: expense.vendor || 'N/A',
        amount: expense.amount,
        currency: expense.currency
      }));

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
      this.errorMessage = 'No report data available to download.';
      return;
    }

    const doc = new jsPDF();
    const currencyPipe = new CurrencyPipe('en-US'); // Use appropriate locale
    const datePipe = new DatePipe('en-US');

    const reportTitle = this.currentReportType === 'invoiceLog' ? 'Invoice Log' : 'Expense Log';
    const startDate = datePipe.transform(this.reportForm.value.startDate, 'mediumDate');
    const endDate = datePipe.transform(this.reportForm.value.endDate, 'mediumDate');
    const title = `${reportTitle} (${startDate} - ${endDate})`;

    doc.setFontSize(18);
    doc.text(title, 14, 22);

    let head: string[][] = [];
    let body: any[][] = [];
    let summaryText: string[] = [];
    let finalY = 0; // To track where the table ends

    if (this.currentReportType === 'invoiceLog') {
      head = [['Invoice ID', 'Date', 'Customer', 'Product(s)', 'Status', 'Amount']];
      body = this.reportData.map(row => [
        row.invoiceId,
        datePipe.transform(row.date, 'mediumDate'),
        row.customerName,
        row.productNames,
        row.paymentStatus,
        currencyPipe.transform(row.grandTotal, row.currency || DEFAULT_CURRENCY_CODE)
      ]);
      summaryText = [
        `Total Paid Invoices: ${this.invoiceLogSummary.totalPaidInvoices}`,
        `Total Unpaid Invoices: ${this.invoiceLogSummary.totalUnpaidInvoices}`,
        `Total Partially Paid Invoices: ${this.invoiceLogSummary.totalPartiallyPaidInvoices}`,
        `Total Paid Amount: ${currencyPipe.transform(this.invoiceLogSummary.totalPaidAmount, DEFAULT_CURRENCY_CODE)}`
      ];
    } else if (this.currentReportType === 'expenseLog') {
      head = [['Date', 'Category', 'Description', 'Vendor', 'Amount']];
      body = this.reportData.map(row => [
        datePipe.transform(row.date, 'mediumDate'),
        row.category,
        row.description,
        row.vendorName,
        currencyPipe.transform(row.amount, row.currency || DEFAULT_CURRENCY_CODE)
      ]);
      summaryText = [
        `Total Expenses: ${currencyPipe.transform(this.expenseLogSummary.totalExpenseAmount, DEFAULT_CURRENCY_CODE)}`
      ];
    }

    // Assuming autoTable is the default export, accessible via .default with namespace import
    autoTableLib.default(doc, {
      head: head,
      body: body,
      startY: 30,
      didDrawPage: (data: any) => {
        // Header could be repeated per page if needed
      },
      didParseCell: (data: any) => {
        // Custom cell styling if needed
      },
      // Ensure finalY is set after the table is drawn
      didDrawTable: (data: any) => {
        finalY = data.cursor?.y || 0;
      }
    });

    // Add summary section
    if (summaryText.length > 0) {
      doc.setFontSize(10);
      let summaryYPosition = finalY + 10; // Start 10 units below the table

      // Check if summary fits on the current page, otherwise add a new page
      const pageHeight = doc.internal.pageSize.height;
      const summaryHeight = summaryText.length * 5 + 5; // Approximate height of summary block
      if (summaryYPosition + summaryHeight > pageHeight - 20) { // 20 for bottom margin
        doc.addPage();
        summaryYPosition = 20; // Start near top of new page
      }

      doc.text('Summary:', 14, summaryYPosition);
      summaryYPosition += 5;
      summaryText.forEach(line => {
        doc.text(line, 14, summaryYPosition);
        summaryYPosition += 5;
      });
    }

    const fileName = `${reportTitle.toLowerCase().replace(/\s+/g, '_')}_${this.formatDate(new Date())}.pdf`;
    doc.save(fileName);
    this.errorMessage = null; // Clear any previous error
  }
}