import { Component, OnInit } from '@angular/core';
import { CustomerService } from '../customer.service';
import { InvoiceService } from '../invoice-form/invoice.service';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Customer, Invoice, CurrencyCode, DEFAULT_CURRENCY_CODE } from '../core/models/app.models'; // Import currency models
import { RecordPaymentComponent } from '../record-payment/record-payment.component';
import { EditCustomerComponent } from '../edit-customer/edit-customer.component';

// Moved CustomerWithInvoices interface definition here, before the component decorator
export interface CustomerWithInvoices extends Customer {
  invoices: Invoice[];
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, RecordPaymentComponent, EditCustomerComponent], // Add EditCustomerComponent
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  // customers: Customer[] = []; // Will be part of groupedData
  // invoices: Invoice[] = []; // Will be part of groupedData

  groupedCustomerData: CustomerWithInvoices[] = [];

  private customerMap = new Map<string, string>(); // Still useful for getCustomerName if needed elsewhere

  isLoadingCustomers = false;
  isLoadingInvoices = false;
  customerError: string | null = null;
  invoiceError: string | null = null;
  deleteError: string | null = null;
  deleteSuccess: string | null = null;
  paymentMessage: string | null = null; // For payment success/error messages
  customerDeleteMessage: string | null = null; // For customer delete success/error
  customerUpdateMessage: string | null = null; // For customer update success

  showRecordPaymentModal = false;
  selectedInvoiceForPayment: Invoice | null = null;

  showEditCustomerModal = false;
  selectedCustomerForEdit: Customer | null = null;

  defaultCurrencyCode: CurrencyCode = DEFAULT_CURRENCY_CODE; // For template fallback

  constructor(
    private customerService: CustomerService,
    private invoiceService: InvoiceService
  ) {}

  ngOnInit() {
    this.loadInitialData();
  }

  async loadInitialData() {
    this.isLoadingCustomers = true;
    this.isLoadingInvoices = true; // Both start loading
    this.customerError = null;
    this.invoiceError = null;
    this.groupedCustomerData = [];
    this.customerMap.clear();

    try {
      // Fetch customers and invoices in parallel
      const [customers, invoices] = await Promise.all([
        this.customerService.getCustomers(),
        this.invoiceService.getInvoices()
      ]);

      customers.forEach(customer => {
        if (customer.id) {
          this.customerMap.set(customer.id, customer.name);
        }
        // Find invoices for the current customer
        // Find invoices for the current customer and convert their dates
        const customerInvoices = invoices
          .filter(
            inv => (inv.customerId === customer.id) ||
                   (typeof inv.customer === 'object' && inv.customer?.id === customer.id) ||
                   (typeof inv.customer === 'string' && inv.customer === customer.id)
          )
          .map(inv => {
            const invDate = inv.date as any;
            const invDueDate = inv.dueDate as any;
            return {
              ...inv,
              date: invDate && invDate.toDate ? invDate.toDate() : new Date(invDate),
              dueDate: invDueDate && invDueDate.toDate ? invDueDate.toDate() : (invDueDate ? new Date(invDueDate) : undefined)
            };
          });
        this.groupedCustomerData.push({ ...customer, invoices: customerInvoices });
      });

      // If there are invoices without a matching customer (e.g. customer deleted, bad data)
      // We could list them under an "Unassigned Invoices" group if needed. For now, they are ignored.

    } catch (error) {
      console.error('Error loading admin data:', error);
      // Set a generic error or specific ones if distinguishable
      this.customerError = 'Failed to load customer or invoice data.';
      this.invoiceError = 'Failed to load customer or invoice data.';
    } finally {
      this.isLoadingCustomers = false;
      this.isLoadingInvoices = false;
    }
  }

  // loadCustomers() and loadInvoices() are now part of loadInitialData()
  // If individual refresh is needed later, they can be refactored.

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
      this.deleteSuccess = `Invoice (ID: ${id}) deleted successfully. Refreshing data...`;
      // Refresh grouped data list
      await this.loadInitialData();
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
    this.paymentMessage = 'Payment recorded successfully. Refreshing data...';
    this.closeRecordPaymentModal();
    this.loadInitialData(); // Refresh the entire grouped data structure
    // Clear the message after a few seconds
    setTimeout(() => this.paymentMessage = null, 5000);
  }

  async confirmDeleteCustomer(customer: Customer): Promise<void> {
    if (!customer.id) {
      this.customerDeleteMessage = "Error: Customer ID is missing.";
      setTimeout(() => this.customerDeleteMessage = null, 5000);
      return;
    }

    const confirmation = confirm(`Are you sure you want to delete customer "${customer.name}"? This action cannot be undone.`);
    if (confirmation) {
      this.customerDeleteMessage = null; // Clear previous messages
      this.deleteSuccess = null;
      this.deleteError = null;
      this.paymentMessage = null;
      try {
        await this.customerService.deleteCustomer(customer.id);
        this.customerDeleteMessage = `Customer "${customer.name}" deleted successfully. Refreshing data...`;
        await this.loadInitialData(); // Refresh the entire grouped data structure
      } catch (error: any) {
        if (error.message?.startsWith('CUSTOMER_HAS_INVOICES:')) {
          this.customerDeleteMessage = error.message.replace('CUSTOMER_HAS_INVOICES: ', '');
        } else {
          this.customerDeleteMessage = `Error deleting customer "${customer.name}". Please try again.`;
          console.error(`Error deleting customer ${customer.id}:`, error);
        }
      } finally {
        setTimeout(() => this.customerDeleteMessage = null, 7000); // Longer timeout for this message
      }
    }
  }

  openEditCustomerModal(customer: Customer): void {
    this.selectedCustomerForEdit = { ...customer }; // Pass a copy to avoid unintended two-way binding issues
    this.showEditCustomerModal = true;
    this.customerUpdateMessage = null; // Clear previous messages
    this.customerDeleteMessage = null;
    this.paymentMessage = null;
    this.deleteError = null;
    this.deleteSuccess = null;
  }

  closeEditCustomerModal(): void {
    this.showEditCustomerModal = false;
    this.selectedCustomerForEdit = null;
  }

  handleCustomerUpdated(): void {
    this.customerUpdateMessage = 'Customer details updated successfully. Refreshing data...';
    this.closeEditCustomerModal();
    this.loadInitialData(); // Refresh the entire grouped data structure
    setTimeout(() => this.customerUpdateMessage = null, 5000);
  }
}
