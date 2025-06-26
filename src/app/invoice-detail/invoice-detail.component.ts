import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { InvoiceService } from '../invoice-form/invoice.service';
import { CustomerService } from '../customer.service';
import { Invoice, Customer, Payment } from '../core/models/app.models'; // Import Payment

@Component({
  selector: 'app-invoice-detail',
  standalone: true, // Ensuring it's standalone
  imports: [CommonModule, RouterLink], // CommonModule for *ngIf, etc. RouterLink for back links
  templateUrl: './invoice-detail.component.html',
  styleUrls: ['./invoice-detail.component.css'] // Changed to styleUrls
})
export class InvoiceDetailComponent implements OnInit, OnDestroy {
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
}
