import { Component, OnInit } from '@angular/core';
import { CustomerService } from '../customer.service';
import { InvoiceService } from '../invoice-form/invoice.service';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Customer, Invoice } from '../core/models/app.models';
import { RecordPaymentComponent } from '../record-payment/record-payment.component'; // Import RecordPaymentComponent

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, RecordPaymentComponent], // Add RecordPaymentComponent
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  customers: Customer[] = [];
  invoices: Invoice[] = [];

  private customerMap = new Map<string, string>();

  isLoadingCustomers = false;
  isLoadingInvoices = false;
  customerError: string | null = null;
  invoiceError: string | null = null;
  deleteError: string | null = null;
  deleteSuccess: string | null = null;
  paymentMessage: string | null = null; // For payment success/error messages

  showRecordPaymentModal = false;
  selectedInvoiceForPayment: Invoice | null = null;

  constructor(
    private customerService: CustomerService,
    private invoiceService: InvoiceService
  ) {}

  ngOnInit() {
    this.loadCustomers();
    this.loadInvoices();
  }

  async loadCustomers() {
    this.isLoadingCustomers = true;
    this.customerError = null;
    try {
      this.customers = await this.customerService.getCustomers();
      this.customerMap.clear();
      this.customers.forEach(customer => {
        if (customer.id) {
          this.customerMap.set(customer.id, customer.name);
        }
      });
    } catch (error) {
      this.customerError = 'Failed to load customers.';
      console.error('Error loading customers:', error);
    } finally {
      this.isLoadingCustomers = false;
    }
  }

  async loadInvoices() {
    // Ensure customers are loaded first or handle data display if not.
    // For simplicity, we assume loadCustomers is called and populates the map.
    // A more robust solution might involve Promise.all in ngOnInit or chaining.
    this.isLoadingInvoices = true;
    this.invoiceError = null;
    try {
      this.invoices = await this.invoiceService.getInvoices();
    } catch (error) {
      this.invoiceError = 'Failed to load invoices.';
      console.error('Error loading invoices:', error);
    } finally {
      this.isLoadingInvoices = false;
    }
  }

  async deleteInvoice(id: string | undefined) {
    if (!id) {
      this.deleteError = 'Cannot delete invoice: ID is missing.';
      return;
    }
    this.deleteError = null;
    this.deleteSuccess = null;

    // Optimistically remove from UI or add a specific loading state for the item
    // For simplicity here, we'll just show a general message and reload.

    try {
      await this.invoiceService.deleteInvoice(id);
      this.deleteSuccess = `Invoice (ID: ${id}) deleted successfully. Refreshing list...`;
      // Refresh invoices list
      await this.loadInvoices();
    } catch (error) {
      this.deleteError = `Failed to delete invoice (ID: ${id}). Please try again.`;
      console.error('Error deleting invoice:', error);
    }
  }

  getCustomerName(customerId: string | undefined | Customer): string {
    if (!customerId) return 'N/A';
    if (typeof customerId === 'object' && customerId.name) return customerId.name; // If full customer object passed
    if (typeof customerId === 'string') {
      return this.customerMap.get(customerId) || 'Unknown Customer';
    }
    return 'Invalid Customer Data';
  }

  openRecordPaymentModal(invoice: Invoice): void {
    this.selectedInvoiceForPayment = invoice;
    this.showRecordPaymentModal = true;
    this.paymentMessage = null; // Clear previous messages
    this.deleteSuccess = null; // Clear other messages too
    this.deleteError = null;
  }

  closeRecordPaymentModal(): void {
    this.showRecordPaymentModal = false;
    this.selectedInvoiceForPayment = null;
  }

  handlePaymentRecorded(): void {
    this.paymentMessage = 'Payment recorded successfully. Refreshing invoices...';
    this.closeRecordPaymentModal();
    this.loadInvoices(); // Refresh the invoice list to show updated status and totalPaid
    // Clear the message after a few seconds
    setTimeout(() => this.paymentMessage = null, 5000);
  }
}
