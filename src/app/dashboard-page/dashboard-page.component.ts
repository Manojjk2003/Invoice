import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BarChartModule } from '@swimlane/ngx-charts'; // Try importing BarChartModule
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { CustomerService } from '../customer.service';
import { InvoiceService } from '../invoice-form/invoice.service';
import { ExpenseService } from '../expense.service';
import { Customer, Invoice, Expense, CurrencyCode, DEFAULT_CURRENCY_CODE } from '../core/models/app.models';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyPipe, BarChartModule,NgxChartsModule], // Use BarChartModule
  templateUrl: './dashboard-page.component.html',
  styleUrls: ['./dashboard-page.component.css']
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
  incomeExpenseChartData: any[] = [];
  chartView: [number, number] = [700, 400]; // width, height
  chartColorScheme = {
    domain: ['#5AA454', '#A10A28', '#C7B42C', '#AAAAAA'] // Green for income, Red for expenses
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
    this.incomeExpenseChartData = []; // Reset chart data

    try {
      // Fetch all necessary data in parallel
      const [customers, invoices, expenses, allPayments] = await Promise.all([
        this.customerService.getCustomers(),
        this.invoiceService.getInvoices(), // Still needed for some metrics if not derived from payments
        this.expenseService.getExpenses(),
        this.invoiceService.getAllPayments() // Fetch all payments
      ]);

      // Calculate summary metrics (as before)
      this.totalCustomers = customers.length;
      this.totalInvoices = invoices.length;

      this.totalUnpaidValue = invoices
        .filter(inv => inv.paymentStatus === 'Unpaid' || inv.paymentStatus === 'Partially Paid')
        .reduce((sum, inv) => sum + (inv.total - inv.totalPaid), 0);

      this.totalOverdueValue = invoices
        .filter(inv => inv.paymentStatus === 'Overdue') // Assuming 'Overdue' status is set correctly
        .reduce((sum, inv) => sum + (inv.total - inv.totalPaid), 0);

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      this.totalExpensesThisMonth = expenses
        .filter(exp => {
          // Ensure exp.date is a JS Date object before calling getMonth/getFullYear
          const expenseDate = (exp.date as any).toDate ? (exp.date as any).toDate() : new Date(exp.date);
          return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
        })
        .reduce((sum, exp) => sum + exp.amount, 0);

      // Prepare data for Income vs. Expenses chart (last 12 months)
      const chartDataResult = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = date.toLocaleString('default', { month: 'short' });
        const year = date.getFullYear().toString().slice(-2);
        const monthKey = `${monthName} '${year}`;

        const monthlyIncome = allPayments
          .filter(p => {
            const paymentDate = p.paymentDate instanceof Date ? p.paymentDate : new Date(p.paymentDate);
            return paymentDate.getFullYear() === date.getFullYear() && paymentDate.getMonth() === date.getMonth();
          })
          .reduce((sum, p) => sum + p.amountPaid, 0);

        // Calculate monthlyExpenses (removed duplicate block)
        const monthlyExpenses = expenses
          .filter(exp => {
            const expenseDate = (exp.date as any).toDate ? (exp.date as any).toDate() : new Date(exp.date);
            return expenseDate.getFullYear() === date.getFullYear() && expenseDate.getMonth() === date.getMonth();
          })
          .reduce((sum, exp) => sum + exp.amount, 0);

        // Data format for grouped bar chart
        chartDataResult.push({
          name: monthKey,
          series: [
            { name: 'Income', value: monthlyIncome },
            { name: 'Expenses', value: monthlyExpenses }
          ]
        });
      }
      this.incomeExpenseChartData = chartDataResult;
      this.chartShowLegend = true; // Restore legend for grouped chart

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
