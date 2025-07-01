import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core'; // Import CUSTOM_ELEMENTS_SCHEMA
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgxChartsModule } from '@swimlane/ngx-charts';

import { CustomerService } from '../customer.service';
import { InvoiceService } from '../invoice-form/invoice.service';
import { ExpenseService } from '../expense.service';
import { Customer, Invoice, Expense, CurrencyCode, DEFAULT_CURRENCY_CODE } from '../core/models/app.models';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyPipe, NgxChartsModule],
  templateUrl: './dashboard-page.component.html',
  styleUrls: ['./dashboard-page.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA] // Add CUSTOM_ELEMENTS_SCHEMA
})
export class DashboardPageComponent implements OnInit {
  isLoadingMetrics = false;
  metricsError: string | null = null;

  totalCustomers = 0;
  totalInvoices = 0;
  totalUnpaidValue = 0;
  totalOverdueValue = 0;
  totalExpensesThisMonth = 0;

  // For simplicity, using the app's default. A more complex app might need to handle multiple currencies here.
  displayCurrency: CurrencyCode = DEFAULT_CURRENCY_CODE;

  // Chart properties
  financialSummaryChartData: any[] = []; // Renamed for clarity
  chartView: [number, number] = [700, 400];
  chartColorScheme = { // Updated for 3 series
    domain: ['#4FC3F7', '#5AA454', '#F44336'] // Light Blue (Bills), Green (Income), Red (Expenses)
  };
  chartShowXAxis = true;
  chartShowYAxis = true;
  chartGradient = false;
  chartShowLegend = true;
  chartShowXAxisLabel = true;
  chartXAxisLabel = 'Month';
  chartShowYAxisLabel = true;
  chartYAxisLabel = 'Amount';


  constructor(
    private customerService: CustomerService,
    private invoiceService: InvoiceService,
    private expenseService: ExpenseService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  async loadDashboardData(): Promise<void> {
    this.isLoadingMetrics = true;
    this.metricsError = null;
    this.financialSummaryChartData = []; // Reset chart data

    try {
      // Fetch all necessary data in parallel
      const [customers, allInvoices, allExpenses, allPayments] = await Promise.all([
        this.customerService.getCustomers(),
        this.invoiceService.getInvoices(),
        this.expenseService.getExpenses(),
        this.invoiceService.getAllPayments()
      ]);

      // Convert all relevant dates in fetched data to JS Date objects immediately
      const convertToDate = (dateInput: any): Date | undefined => {
        if (!dateInput) return undefined;
        if (dateInput.toDate) return dateInput.toDate(); // Firestore Timestamp
        const d = new Date(dateInput);
        return isNaN(d.getTime()) ? undefined : d; // Return undefined if date is invalid
      };

      const invoices = allInvoices.map(inv => {
        const mappedInv = {
          ...inv,
          date: convertToDate(inv.date), // Invoice.date is optional
          dueDate: convertToDate(inv.dueDate)
        };
        return mappedInv;
      });

      const expenses = allExpenses.map(exp => ({
        ...exp,
        date: convertToDate(exp.date)! // Expense.date is required
      }));
      // allPayments' paymentDate are already converted to Date objects in InvoiceService.getAllPayments()

      // Calculate summary metrics (as before)
      this.totalCustomers = customers.length;
      this.totalInvoices = invoices.length;

      this.totalUnpaidValue = invoices
        .filter(inv => inv.paymentStatus === 'Unpaid' || inv.paymentStatus === 'Partially Paid')
        .reduce((sum, inv) => sum + (inv.grandTotal - inv.totalPaid), 0);

      this.totalOverdueValue = invoices
        .filter(inv => inv.paymentStatus === 'Overdue') // Assuming 'Overdue' status is set correctly
        .reduce((sum, inv) => sum + (inv.grandTotal - inv.totalPaid), 0);

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      // Use the already date-converted 'expenses' array for totalExpensesThisMonth
      this.totalExpensesThisMonth = expenses
        .filter(exp => exp.date.getMonth() === currentMonth && exp.date.getFullYear() === currentYear)
        .reduce((sum, exp) => sum + exp.amount, 0);

      // Prepare data for Bills vs. Income vs. Expenses chart (last 12 months)
      const chartDataResult = [];
      for (let i = 11; i >= 0; i--) {
        const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = targetDate.toLocaleString('default', { month: 'short' });
        const year = targetDate.getFullYear().toString().slice(-2);
        const monthKey = `${monthName} '${year}`;

        const monthlyBillsCreated = invoices
          .filter(inv => {
            // inv.date is now Date | undefined
            return inv.date && inv.date.getFullYear() === targetDate.getFullYear() && inv.date.getMonth() === targetDate.getMonth();
          })
          .reduce((sum, inv) => sum + inv.grandTotal, 0); // Use grandTotal for bills created value

        const monthlyIncomeReceived = allPayments // allPayments' dates are already JS Dates
          .filter(p => p.paymentDate.getFullYear() === targetDate.getFullYear() && p.paymentDate.getMonth() === targetDate.getMonth())
          .reduce((sum, p) => sum + p.amountPaid, 0);

        const monthlyExpenses = expenses // expenses' dates are already JS Dates (and required)
          .filter(exp => exp.date.getFullYear() === targetDate.getFullYear() && exp.date.getMonth() === targetDate.getMonth())
          .reduce((sum, exp) => sum + exp.amount, 0);

        chartDataResult.push({
          name: monthKey,
          series: [
            { name: 'Bills Created', value: monthlyBillsCreated },
            { name: 'Income Received', value: monthlyIncomeReceived },
            { name: 'Expenses', value: monthlyExpenses }
          ]
        });
      }
      this.financialSummaryChartData = chartDataResult;
      this.chartShowLegend = true;

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.metricsError = 'Failed to load dashboard metrics. Please try again.';
    } finally {
      this.isLoadingMetrics = false;
    }
  }

  onChartSelect(event: any): void {
    console.log('Chart event:', event);
    // Can be used to drill down or show more details based on chart selection
  }
}
