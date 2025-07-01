import { Component, OnInit, OnDestroy } from '@angular/core'; // Removed Pipe, PipeTransform
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Subscription } from 'rxjs';
import jsPDF from 'jspdf';

import { InvoiceService } from '../invoice-form/invoice.service';
import { CustomerService } from '../customer.service';
import {
  Invoice, Customer, Payment, InvoiceItem,
  DEFAULT_TEMPLATE_ID, InvoiceTemplateId,
  CurrencyCode, DEFAULT_CURRENCY_CODE, SUPPORTED_CURRENCIES, AppSettings // Added AppSettings
} from '../core/models/app.models';
import { SettingsService } from '../settings.service'; // Added SettingsService

// Removed SimpleDatePipe

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
  isLoadingSettings = false; // Added for settings loading
  errorMessage: string | null = null;
  paymentErrorMessage: string | null = null; // Separate error message for payments
  settingsErrorMessage: string | null = null; // Added
  private routeSub!: Subscription;

  appSettings: AppSettings | null = null; // To store loaded settings

  // defaultTemplateId and defaultCurrencyCode can remain for local fallback if settings don't load
  defaultTemplateIdLocal: InvoiceTemplateId = DEFAULT_TEMPLATE_ID;
  defaultCurrencyCodeLocal: CurrencyCode = DEFAULT_CURRENCY_CODE;

  get effectiveCurrencyCode(): CurrencyCode {
    if (this.invoice && this.invoice.currency) {
      return this.invoice.currency;
    }
    if (this.appSettings && this.appSettings.invoiceSettings && this.appSettings.invoiceSettings.defaultCurrencyCode) {
      return this.appSettings.invoiceSettings.defaultCurrencyCode;
    }
    return this.defaultCurrencyCodeLocal;
  }

  constructor(
    private route: ActivatedRoute,
    private invoiceService: InvoiceService,
    private customerService: CustomerService,
    private settingsService: SettingsService // Added
  ) {}

  ngOnInit(): void {
    this.loadAppSettings(); // Load settings first or in parallel
    this.routeSub = this.route.paramMap.subscribe(params => {
      const invoiceId = params.get('id');
      if (invoiceId) {
        this.loadInvoiceDetails(invoiceId);
      } else {
        this.isLoading = false; // Ensure loading is stopped
        this.errorMessage = 'Invoice ID not found in route.';
      }
    });
  }

  loadAppSettings(): void {
    this.isLoadingSettings = true;
    this.settingsErrorMessage = null;
    this.settingsService.getSettings().subscribe({
      next: (settings) => {
        this.appSettings = settings;
        // If settings are null, the getDefaultSettings() in service should provide a structure
        if (!settings) {
            console.warn("InvoiceDetail: App settings are null, using fallback defaults from service.");
            // appSettings will hold the default structure from service if null was returned by observable due to error/no-doc
        }
        this.isLoadingSettings = false;
      },
      error: (err) => {
        console.error("InvoiceDetail: Error loading app settings:", err);
        this.settingsErrorMessage = "Failed to load application settings. Some details might be missing.";
        // Attempt to use service's default settings as a fallback
        this.appSettings = this.settingsService['getDefaultSettings']();
        this.isLoadingSettings = false;
      }
    });
  }

  async loadInvoiceDetails(invoiceId: string): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;
    this.invoice = null;
    this.customer = null;

    // Wait for settings to be loaded (or attempt to have been loaded) before proceeding
    // This is a simple way; more robust might involve RxJS combinations if settings are critical for query
    if (this.isLoadingSettings) {
        // A simple busy wait or a more complex observable chain might be needed
        // For now, let's assume settings are loaded or defaulted by the time this is crucial
        // A better pattern: Chain this call after settings load in ngOnInit or use an observable switchMap/combineLatest
    }

    try {
      // NOTE: Ideally, InvoiceService and CustomerService should have methods
      // like getInvoiceById(id: string) and getCustomerById(id: string)
      // that fetch a single document directly from Firestore.
      // Fetching all and then filtering is inefficient for larger datasets.
      // This is a simplification due to current service limitations.

      const invoices = await this.invoiceService.getInvoices(); // Inefficient
      // Removed duplicate declaration of 'invoices'
      let foundInvoice = invoices.find(inv => inv.id === invoiceId);

      if (foundInvoice) {
        // Convert dates in foundInvoice
        const invDate = foundInvoice.date as any;
        foundInvoice.date = invDate && invDate.toDate ? invDate.toDate() : new Date(invDate);

        if (foundInvoice.dueDate) {
          const invDueDate = foundInvoice.dueDate as any;
          foundInvoice.dueDate = invDueDate && invDueDate.toDate ? invDueDate.toDate() : new Date(invDueDate);
        }

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
      const fetchedPayments = await this.invoiceService.getPaymentsForInvoice(invoiceId);
      this.payments = fetchedPayments.map(p => {
        const paymentDateValue = p.paymentDate as any;
        return {
          ...p,
          paymentDate: paymentDateValue && paymentDateValue.toDate ? paymentDateValue.toDate() : new Date(paymentDateValue)
        };
      });
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
    let currentY = 20;
    const lineSpacing = 7;
    const sectionSpacing = 10;
    const leftMargin = 15;
    const rightMargin = doc.internal.pageSize.width - 15; // Max X for content
    const contentWidth = rightMargin - leftMargin;

    // Get company info from settings or use fallbacks
    const companyInfo = this.appSettings?.companyInformation;
    const companyName = companyInfo?.companyName || 'Your Company Name';
    const companyAddress = companyInfo?.address || '123 Your Street, Your City';
    const companyContact = `${companyInfo?.email || ''}${companyInfo?.email && companyInfo?.phone ? ' | ' : ''}${companyInfo?.phone || ''}`;
    const companyGst = companyInfo?.gstOrTaxId || '';

    // Get payment details from settings
    const paymentDetails = this.appSettings?.paymentSettings?.acceptedPaymentMethodsDetails || '';

    // Default logo URL (as per plan, not from settings object)
    const defaultCompanyLogoUrl = "assets/images/default-logo.png";


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


    // Template specific settings
    const templateId = this.invoice.templateId || this.defaultTemplateIdLocal; // Use local fallback
    let primaryColor = '#000000'; // Default black for classic/simple
    let headerFont = 'helvetica';
    let bodyFont = 'helvetica';

    if (templateId === 'modern') {
      primaryColor = '#007bff'; // Modern blue
      headerFont = 'helvetica'; // Or a more modern sans-serif if available and loaded
      bodyFont = 'helvetica';
    } else if (templateId === 'simple') {
      headerFont = 'courier';
      bodyFont = 'courier';
    }

    const currentInvoiceCurrencyCode = this.invoice.currency || this.appSettings?.invoiceSettings?.defaultCurrencyCode || this.defaultCurrencyCodeLocal;
    const currencyInfo = SUPPORTED_CURRENCIES.find(c => c.code === currentInvoiceCurrencyCode);
    const currencySymbol = currencyInfo ? currencyInfo.symbol : currentInvoiceCurrencyCode;


    // --- Header ---
    doc.setFontSize(18);
    doc.setFont(headerFont, 'bold');
    doc.setTextColor(primaryColor); // Use template color for INVOICE title
    currentY = addText('INVOICE', rightMargin, currentY, { align: 'right' });
    doc.setTextColor(0, 0, 0); // Reset to black for other text unless specified

    doc.setFontSize(12);
    doc.setFont(headerFont, 'bold');
    currentY = addText(companyName, rightMargin, currentY, { align: 'right'});
    doc.setFont(bodyFont, 'normal');
    if (companyAddress) currentY = addText(companyAddress, rightMargin, currentY, { align: 'right'});
    if (companyContact) currentY = addText(companyContact, rightMargin, currentY, { align: 'right'});
    if (companyGst) currentY = addText(`GST/Tax ID: ${companyGst}`, rightMargin, currentY, {align: 'right'});

    currentY += sectionSpacing / 2;

    // --- Bill To and Invoice Meta ---
    const billToY = currentY; // Use currentY for start of this section
    const invoiceMetaY = currentY;

    doc.setFontSize(10);
    doc.setFont(headerFont, 'bold');
    currentY = addText('Bill To:', leftMargin, billToY);
    doc.setFont(bodyFont, 'normal');
    currentY = addText(this.customer.name, leftMargin, currentY);
    if (this.customer.address) currentY = addText(this.customer.address, leftMargin, currentY);
    if (this.customer.contact) currentY = addText(`Contact: ${this.customer.contact}`, leftMargin, currentY);
    if (this.customer.gst) currentY = addText(`GSTIN: ${this.customer.gst}`, leftMargin, currentY);

    let currentMetaContentY = invoiceMetaY; // Separate Y for the right column content
    doc.setFontSize(10);
    doc.setFont(headerFont, 'bold');
    currentMetaContentY = addText(`Invoice #: ${this.invoice.invoiceNumber || this.invoice.id}`, rightMargin, currentMetaContentY, { align: 'right' });
    doc.setFont(bodyFont, 'normal');
    currentMetaContentY = addText(`Date: ${this.datePipe.transform(this.invoice.date, 'longDate') || ''}`, rightMargin, currentMetaContentY, { align: 'right' });
    if (this.invoice.dueDate) currentMetaContentY = addText(`Due Date: ${this.datePipe.transform(this.invoice.dueDate, 'longDate') || ''}`, rightMargin, currentMetaContentY, { align: 'right' });

    doc.setFont(bodyFont, 'bold'); // Status can be bold
    doc.setTextColor(this.invoice.paymentStatus === 'Paid' ? '#28a745' : (this.invoice.paymentStatus === 'Partially Paid' || this.invoice.paymentStatus === 'Overdue' ? '#ffc107' : '#dc3545') );
    currentMetaContentY = addText(`Status: ${this.invoice.paymentStatus}`, rightMargin, currentMetaContentY, { align: 'right' });
    doc.setTextColor(0,0,0); // Reset color
    doc.setFont(bodyFont, 'normal');


    currentY = Math.max(currentY, currentMetaContentY) + sectionSpacing;
    currentY = checkPageBreak(currentY);

    // --- Items Table ---
    doc.setFontSize(12);
    doc.setFont(headerFont, 'bold');
    currentY = addText('Items', leftMargin, currentY);
    currentY += lineSpacing / 2;

    const descriptionX = leftMargin;
    const quantityX = contentWidth * 0.5 + leftMargin; // Approx 50% for description
    const unitPriceX = contentWidth * 0.7 + leftMargin; // Approx 20% for quantity
    const lineTotalX = rightMargin; // Approx 20% for unit price, then line total

    const descriptionColWidth = quantityX - descriptionX - 5;
    // Other column widths can be implicitly managed by alignment or fixed values.

    const tableHeaderY = currentY;
    doc.setFontSize(10);
    doc.setFont(headerFont, 'bold');
    if (templateId === 'modern') doc.setTextColor(primaryColor);
    addText('Description', descriptionX, tableHeaderY);
    addText('Qty', quantityX, tableHeaderY, { align: 'center' });
    addText('Unit Price', unitPriceX, tableHeaderY, { align: 'right' });
    addText('Line Total', lineTotalX, tableHeaderY, { align: 'right' });
    doc.setTextColor(0,0,0); // Reset
    currentY += lineSpacing;
    doc.setDrawColor(templateId === 'modern' ? primaryColor : '#000000');
    doc.line(leftMargin, currentY - lineSpacing / 2, rightMargin, currentY - lineSpacing / 2);
    doc.setDrawColor(0,0,0); // Reset draw color

    doc.setFont(bodyFont, 'normal');
    this.invoice.items.forEach((item: InvoiceItem) => {
      currentY = checkPageBreak(currentY);
      const splitDesc = doc.splitTextToSize(item.description, descriptionColWidth);
      let itemContentY = currentY;
      splitDesc.forEach((line: string, index: number) => {
          if (index > 0) itemContentY += (lineSpacing / 1.5);
          itemContentY = checkPageBreak(itemContentY);
          doc.text(line, descriptionX, itemContentY);
      });

      doc.text(item.quantity.toString(), quantityX, currentY, { align: 'center' });
      doc.text(currencySymbol + (this.decimalPipe.transform(item.unitPrice, '1.2-2') || '0.00'), unitPriceX, currentY, { align: 'right' });
      doc.text(currencySymbol + (this.decimalPipe.transform(item.lineTotal, '1.2-2') || '0.00'), lineTotalX, currentY, { align: 'right' });
      currentY = Math.max(currentY, itemContentY) + lineSpacing;
    });
    doc.setDrawColor(templateId === 'modern' ? primaryColor : '#cccccc');
    doc.line(leftMargin, currentY - lineSpacing / 2, rightMargin, currentY - lineSpacing / 2);
    doc.setDrawColor(0,0,0);
    currentY = checkPageBreak(currentY);

    // --- Totals ---
    // Define x-coordinates for labels and values in the totals section
    const totalLabelX = rightMargin - 50; // Position for the right-aligned labels
    const totalValueX = rightMargin;    // Position for the right-aligned values

    const addTotalLine = (label: string, value: number | string, localY: number, isBold = false): number => {
        localY = checkPageBreak(localY);
        doc.setFont(bodyFont, isBold ? 'bold' : 'normal');
        doc.text(label, totalLabelX, localY, { align: 'right' });
        const formattedValue = typeof value === 'number' ? (this.decimalPipe.transform(value, '1.2-2') || '0.00') : value;
        doc.text(currencySymbol + formattedValue, totalValueX, localY, { align: 'right' });
        return localY + lineSpacing;
    };

    currentY = addTotalLine('Subtotal:', this.invoice.subtotal, currentY);

    if (this.invoice.discountAmount && this.invoice.discountAmount > 0) {
      let discountLabel = 'Discount';
      if (this.invoice.discountType === 'percentage') {
        discountLabel += ` (${this.invoice.discountValue}%)`;
      } else if (this.invoice.discountType === 'fixed') {
        discountLabel += ` (Fixed)`;
      }
      currentY = addTotalLine(discountLabel + ':', -this.invoice.discountAmount, currentY);
      const subtotalAfterDiscount = this.invoice.subtotal - this.invoice.discountAmount;
      currentY = addTotalLine('Subtotal After Discount:', subtotalAfterDiscount, currentY);
    }

    const gstRateFromSettings = (this.appSettings?.invoiceSettings?.defaultGstRate !== undefined)
                               ? (this.appSettings.invoiceSettings.defaultGstRate / 100)
                               : 0.18;
    currentY = addTotalLine(`GST (${(gstRateFromSettings * 100).toFixed(0)}%):`, this.invoice.gst, currentY);

    currentY = addTotalLine('Total Before Round-off:', this.invoice.totalBeforeRoundOff, currentY);

    if (this.invoice.roundOffAmount && this.invoice.roundOffAmount !== 0) {
      currentY = addTotalLine('Round-off:', this.invoice.roundOffAmount, currentY);
    }

    doc.setFont(bodyFont, 'bold'); // Grand Total is bold
    if (templateId === 'modern') doc.setTextColor(primaryColor); // Optional: color grand total for modern
    currentY = addTotalLine('Grand Total:', this.invoice.grandTotal, currentY, true);
    doc.setTextColor(0,0,0); // Reset color
    doc.setFont(bodyFont, 'normal'); // Reset font weight

    currentY = addTotalLine('Total Paid:', this.invoice.totalPaid, currentY);

    doc.setFont(bodyFont, 'bold'); // Balance due always bold
    if (templateId === 'modern') doc.setTextColor(primaryColor);
    currentY = addTotalLine('Balance Due:', this.invoice.grandTotal - this.invoice.totalPaid, currentY, true);
    doc.setTextColor(0,0,0);
    currentY = checkPageBreak(currentY);
    currentY += sectionSpacing;

    // --- Amount in Words ---
    doc.setFontSize(10);
    doc.setFont(bodyFont, 'normal');
    // this.invoice.amountInWords should already be based on grandTotal from when it was saved
    currentY = addText(`Amount in Words (Grand Total): ${this.invoice.amountInWords}`, leftMargin, currentY);
    currentY = checkPageBreak(currentY);
    currentY += sectionSpacing;

    // --- Payment Instructions from Settings ---
    if (paymentDetails) { // paymentDetails is already defined using this.appSettings
        currentY = checkPageBreak(currentY);
        doc.setFontSize(10);
        doc.setFont(headerFont, 'bold');
        currentY = addText('Payment Instructions:', leftMargin, currentY);
        doc.setFont(bodyFont, 'normal');
        doc.setFontSize(9); // Smaller font for potentially long details
        const paymentLines = doc.splitTextToSize(paymentDetails, contentWidth);
        paymentLines.forEach((line: string) => {
            currentY = checkPageBreak(currentY, lineSpacing * (paymentLines.length > 3 ? 1.1 : 1) );
            currentY = addText(line, leftMargin, currentY);
        });
        currentY += sectionSpacing;
    }

    // --- Payment History (Optional) ---
    if (this.payments.length > 0) {
        currentY = checkPageBreak(currentY);
        doc.setFontSize(11);
        doc.setFont(headerFont, 'bold');
        currentY = addText('Payment History:', leftMargin, currentY);
        doc.setFontSize(9);
        doc.setFont(bodyFont, 'normal');
        this.payments.forEach(p => {
            currentY = checkPageBreak(currentY, lineSpacing * 2);
            // Assuming payments are in the same currency as the invoice for this basic implementation
            let paymentLine = `Paid ${currencySymbol}${this.decimalPipe.transform(p.amountPaid, '1.2-2') || '0.00'} on ${this.datePipe.transform(p.paymentDate, 'mediumDate') || ''}`;
            if (p.paymentMethod) paymentLine += ` (Method: ${p.paymentMethod})`;
            currentY = addText(paymentLine, leftMargin, currentY);
            if (p.notes) {
                currentY = checkPageBreak(currentY);
                const splitNotes = doc.splitTextToSize(`Notes: ${p.notes}`, contentWidth);
                splitNotes.forEach((line: string) => {
                    currentY = checkPageBreak(currentY);
                    currentY = addText(line, leftMargin + 5, currentY);
                });
            }
        });
        currentY += sectionSpacing;
    }

    // --- Footer ---
    if (templateId !== 'simple') { // Simple template hides footer via CSS, replicate for PDF
        currentY = checkPageBreak(currentY, pageHeight - 20);
        doc.setFontSize(10);
        doc.setFont(bodyFont, 'italic');
        addText('Thank you for your business!', contentWidth / 2 + leftMargin, currentY, { align: 'center' });
    }

    doc.save(`Invoice-${this.invoice.invoiceNumber || this.invoice.id}.pdf`);
  }

  sendReminder(): void {
    if (!this.invoice || !this.customer || !this.customer.email) {
      alert('Customer email or invoice details are missing. Cannot send reminder.');
      return;
    }

    const invoiceNumber = this.invoice.invoiceNumber || this.invoice.id;
    const totalAmount = this.decimalPipe.transform(this.invoice.grandTotal, '1.2-2') || 'N/A';
    const dueDate = this.invoice.dueDate ? (this.datePipe.transform(this.invoice.dueDate, 'longDate') || 'N/A') : 'N/A';

    const subject = `Payment Reminder: Invoice #${invoiceNumber}`;
    const body = `Dear ${this.customer.name},\n\n` +
                 `This is a friendly reminder regarding Invoice #${invoiceNumber} for a total amount of ${totalAmount}.\n` +
                 (dueDate !== 'N/A' ? `This invoice was due on ${dueDate}.\n\n` : `Please find the details attached or contact us for more information.\n\n`) +
                 `Your prompt payment would be greatly appreciated.\n\n` +
                 `Thank you,\n` +
                 `${this.appSettings?.companyInformation?.companyName || 'Your Company Name'}`;

    const mailtoLink = `mailto:${this.customer.email}` +
                       `?subject=${encodeURIComponent(subject)}` +
                       `&body=${encodeURIComponent(body)}`;

    // Check if window is defined (for SSR or testing environments)
    if (typeof window !== 'undefined') {
      window.location.href = mailtoLink;
    } else {
      console.warn('Cannot open mailto link: window object is not available.');
      // Provide feedback that mailto link could not be opened automatically
      alert('Could not automatically open email client. Please manually send a reminder to ' + this.customer.email);
    }
  }
}
