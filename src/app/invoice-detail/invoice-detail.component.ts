import { Component, OnInit, OnDestroy, Pipe, PipeTransform } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common'; // Import DatePipe and DecimalPipe
import { Subscription } from 'rxjs';
import jsPDF from 'jspdf'; // Import jsPDF

import { InvoiceService } from '../invoice-form/invoice.service';
import { CustomerService } from '../customer.service';
import { Invoice, Customer, Payment, InvoiceItem } from '../core/models/app.models';

// Removed SimpleDatePipe as it's not used. Using DatePipe instance directly.

@Component({
  selector: 'app-invoice-detail',
  standalone: true, // Ensuring it's standalone
  imports: [CommonModule, RouterLink], // Removed SimpleDatePipe from imports
  templateUrl: './invoice-detail.component.html',
  styleUrls: ['./invoice-detail.component.css']
})
export class InvoiceDetailComponent implements OnInit, OnDestroy {
  // Pipes for use in PDF generation logic
  private datePipe = new DatePipe('en-US');
  private decimalPipe = new DecimalPipe('en-US');

  invoice: Invoice | null = null;
  customer: Customer | null = null;
  payments: Payment[] = []; // To store payments for this invoice
  isLoading = true;
  isLoadingPayments = false; // Separate loading for payments
  errorMessage: string | null = null;
  paymentErrorMessage: string | null = null; // Separate error message for payments
  private routeSub!: Subscription;

  // Default company information
  defaultCompanyName = "Your Awesome Company"; // Placeholder, can be configured
  defaultCompanyLogoUrl = "assets/images/default-logo.png"; // Path to default logo
  defaultCompanyAddress = "123 Default Street, Default City, DS 12345";
  defaultCompanyContact = "contact@awesomecompany.com | (555) 555-5555";


  constructor(
    private route: ActivatedRoute,
    private invoiceService: InvoiceService,
    private customerService: CustomerService
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const invoiceId = params.get('id');
      if (invoiceId) {
        this.loadInvoiceDetails(invoiceId);
      } else {
        this.isLoading = false;
        this.errorMessage = 'Invoice ID not found in route.';
      }
    });
  }

  async loadInvoiceDetails(invoiceId: string): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;
    this.invoice = null;
    this.customer = null;

    try {
      // NOTE: Ideally, InvoiceService and CustomerService should have methods
      // like getInvoiceById(id: string) and getCustomerById(id: string)
      // that fetch a single document directly from Firestore.
      // Fetching all and then filtering is inefficient for larger datasets.
      // This is a simplification due to current service limitations.

      const invoices = await this.invoiceService.getInvoices(); // Inefficient
      const foundInvoice = invoices.find(inv => inv.id === invoiceId);

      if (foundInvoice) {
        this.invoice = foundInvoice;
        const customerIdToFetch = this.invoice.customerId || (typeof this.invoice.customer === 'string' ? this.invoice.customer : null);

        if (customerIdToFetch) {
          const customers = await this.customerService.getCustomers(); // Inefficient
          this.customer = customers.find(cust => cust.id === customerIdToFetch) || null;
        } else if (typeof this.invoice.customer === 'object' && this.invoice.customer !== null) {
           // If a full customer object is already embedded in the invoice
          this.customer = this.invoice.customer as Customer;
        }

        if (!this.customer) {
          this.errorMessage = `Customer details could not be loaded for this invoice.`;
        }
        // After loading invoice, load its payments
        this.loadPayments(invoiceId);
      } else {
        this.errorMessage = `Invoice with ID ${invoiceId} not found.`;
      }
    } catch (error) {
      console.error('Error loading invoice details:', error);
      this.errorMessage = 'Failed to load invoice details. Please try again.';
    } finally {
      this.isLoading = false; // Main invoice/customer loading done
    }
  }

  async loadPayments(invoiceId: string): Promise<void> {
    this.isLoadingPayments = true;
    this.paymentErrorMessage = null;
    try {
      this.payments = await this.invoiceService.getPaymentsForInvoice(invoiceId);
    } catch (error) {
      console.error(`Error loading payments for invoice ${invoiceId}:`, error);
      this.paymentErrorMessage = 'Failed to load payment history.';
    } finally {
      this.isLoadingPayments = false;
    }
  }

  ngOnDestroy(): void {
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }
  }

  printInvoice(): void {
    window.print();
  }

  downloadInvoiceAsPdf(): void {
    if (!this.invoice || !this.customer) {
      console.error('Invoice or customer data is not available for PDF generation.');
      // Optionally show an error message to the user
      return;
    }

    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    let y = 20; // Initial Y position
    const lineSpacing = 7;
    const sectionSpacing = 10;
    const leftMargin = 15;
    const rightMargin = doc.internal.pageSize.width - 15;
    const contentWidth = rightMargin - leftMargin;

    // Helper to add text and move Y
    const addText = (text: string, x: number, currentY: number, options?: any): number => {
      doc.text(text, x, currentY, options);
      return currentY + lineSpacing;
    };

    const checkPageBreak = (currentY: number, spaceNeeded = lineSpacing): number => {
        if (currentY > pageHeight - 30) { // 30mm margin from bottom
            doc.addPage();
            return 20; // Reset Y to top margin
        }
        return currentY;
    };


    // --- Header ---
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    y = addText('INVOICE', rightMargin, y, { align: 'right' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    y = addText(this.defaultCompanyName, rightMargin, y, { align: 'right'});
    doc.setFont('helvetica', 'normal');
    y = addText(this.defaultCompanyAddress, rightMargin, y, { align: 'right'});
    y = addText(this.defaultCompanyContact, rightMargin, y, { align: 'right'});

    y += sectionSpacing / 2;

    // --- Bill To and Invoice Meta ---
    const billToY = y;
    const invoiceMetaY = y;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    y = addText('Bill To:', leftMargin, billToY);
    doc.setFont('helvetica', 'normal');
    y = addText(this.customer.name, leftMargin, y);
    if (this.customer.address) y = addText(this.customer.address, leftMargin, y);
    if (this.customer.contact) y = addText(`Contact: ${this.customer.contact}`, leftMargin, y);
    if (this.customer.gst) y = addText(`GSTIN: ${this.customer.gst}`, leftMargin, y);

    let currentMetaY = invoiceMetaY;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    currentMetaY = addText(`Invoice #: ${this.invoice.invoiceNumber || this.invoice.id}`, rightMargin, currentMetaY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    currentMetaY = addText(`Date: ${this.datePipe.transform(this.invoice.date, 'longDate') || ''}`, rightMargin, currentMetaY, { align: 'right' });
    if (this.invoice.dueDate) currentMetaY = addText(`Due Date: ${this.datePipe.transform(this.invoice.dueDate, 'longDate') || ''}`, rightMargin, currentMetaY, { align: 'right' });
    currentMetaY = addText(`Status: ${this.invoice.paymentStatus}`, rightMargin, currentMetaY, { align: 'right' });


    y = Math.max(y, currentMetaY) + sectionSpacing;
    y = checkPageBreak(y);

    // --- Items Table ---
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    y = addText('Items', leftMargin, y);
    y += lineSpacing / 2;

    const tableStartY = y;
    const descriptionX = leftMargin;
    const amountX = rightMargin - 30; // Amount column width approx 30
    const tableHeaderY = y;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    addText('Description', descriptionX, tableHeaderY);
    addText('Amount', amountX, tableHeaderY, {align: 'right'});
    y += lineSpacing;
    doc.line(leftMargin, y - lineSpacing / 2, rightMargin, y - lineSpacing / 2); // Line under header

    doc.setFont('helvetica', 'normal');
    this.invoice.items.forEach((item: InvoiceItem) => {
      y = checkPageBreak(y);
      // Handle potential multi-line descriptions (simple split for now)
      const splitDesc = doc.splitTextToSize(item.description, amountX - descriptionX - 5);
      let itemY = y;
      splitDesc.forEach((line: string, index: number) => {
          if (index > 0) itemY += lineSpacing / 1.5; // Adjust line spacing for multi-line
          itemY = checkPageBreak(itemY);
          doc.text(line, descriptionX, itemY);
      });
      doc.text(this.decimalPipe.transform(item.amount, '1.2-2') || '0.00', amountX, y, {align: 'right'});
      y = Math.max(y, itemY) + lineSpacing; // Ensure y advances by at least one line + item height
    });
    doc.line(leftMargin, y - lineSpacing / 2, rightMargin, y - lineSpacing / 2); // Line after items
    y = checkPageBreak(y);

    // --- Totals ---
    const addTotalLine = (label: string, value: number | string, currentY: number): number => {
        currentY = checkPageBreak(currentY);
        doc.setFont('helvetica', 'bold');
        doc.text(label, amountX - 30, currentY, { align: 'right' }); // Adjust X for label
        doc.setFont('helvetica', 'normal');
        doc.text(typeof value === 'number' ? (this.decimalPipe.transform(value, '1.2-2') || '0.00') : value, amountX, currentY, { align: 'right' });
        return currentY + lineSpacing;
    };

    y = addTotalLine('Subtotal:', this.invoice.subtotal, y);
    y = addTotalLine(`GST (${(0.18 * 100).toFixed(0)}%):`, this.invoice.gst, y); // Assuming GST rate, make dynamic if needed
    doc.setFont('helvetica', 'bold');
    y = addTotalLine('Total Amount:', this.invoice.total, y);
    doc.setFont('helvetica', 'normal');
    y = addTotalLine('Total Paid:', this.invoice.totalPaid, y);
    doc.setFont('helvetica', 'bold');
    y = addTotalLine('Balance Due:', this.invoice.total - this.invoice.totalPaid, y);
    y = checkPageBreak(y);
    y += sectionSpacing;

    // --- Amount in Words ---
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    y = addText(`Amount in Words (Total): ${this.invoice.amountInWords}`, leftMargin, y);
    y = checkPageBreak(y);
    y += sectionSpacing;

    // --- Payment History (Optional) ---
    if (this.payments.length > 0) {
        y = checkPageBreak(y);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        y = addText('Payment History:', leftMargin, y);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        this.payments.forEach(p => {
            y = checkPageBreak(y, lineSpacing * 2); // Need more space for payment line
            let paymentLine = `Paid ${this.decimalPipe.transform(p.amountPaid, '1.2-2') || '0.00'} on ${this.datePipe.transform(p.paymentDate, 'mediumDate') || ''}`;
            if (p.paymentMethod) paymentLine += ` (Method: ${p.paymentMethod})`;
            y = addText(paymentLine, leftMargin, y);
            if (p.notes) {
                y = checkPageBreak(y);
                const splitNotes = doc.splitTextToSize(`Notes: ${p.notes}`, contentWidth);
                splitNotes.forEach((line: string) => {
                    y = checkPageBreak(y);
                    y = addText(line, leftMargin + 5, y); // Indent notes
                });
            }
        });
        y += sectionSpacing;
    }


    // --- Footer ---
    y = checkPageBreak(y, pageHeight - 20); // Try to position footer near bottom
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    addText('Thank you for your business!', contentWidth / 2 + leftMargin, y, { align: 'center' });

    doc.save(`Invoice-${this.invoice.invoiceNumber || this.invoice.id}.pdf`);
  }
}
