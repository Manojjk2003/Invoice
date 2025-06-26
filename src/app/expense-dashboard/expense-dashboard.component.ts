import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common'; // Import pipes
import { ExpenseService } from '../expense.service';
import { Expense } from '../core/models/app.models';
import { ExpenseFormComponent } from '../expense-form/expense-form.component'; // Import form component

@Component({
  selector: 'app-expense-dashboard',
  standalone: true,
  imports: [CommonModule, ExpenseFormComponent, DatePipe, CurrencyPipe], // Add form component and pipes
  templateUrl: './expense-dashboard.component.html',
  styleUrls: ['./expense-dashboard.component.css'] // Corrected to styleUrls
})
export class ExpenseDashboardComponent implements OnInit {
  expenses: Expense[] = [];
  isLoading = false;
  errorMessage: string | null = null;
  actionMessage: string | null = null; // For success/error messages from actions

  showExpenseForm = false;
  expenseToEdit: Expense | null = null;

  constructor(private expenseService: ExpenseService) {}

  ngOnInit(): void {
    this.loadExpenses();
  }

  async loadExpenses(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;
    try {
      this.expenses = await this.expenseService.getExpenses();
    } catch (error) {
      this.errorMessage = 'Failed to load expenses.';
      console.error('Error loading expenses:', error);
    } finally {
      this.isLoading = false;
    }
  }

  openAddExpenseForm(): void {
    this.expenseToEdit = null;
    this.showExpenseForm = true;
    this.actionMessage = null; // Clear previous messages
  }

  openEditExpenseForm(expense: Expense): void {
    this.expenseToEdit = { ...expense }; // Pass a copy
    this.showExpenseForm = true;
    this.actionMessage = null; // Clear previous messages
  }

  closeExpenseForm(): void {
    this.showExpenseForm = false;
    this.expenseToEdit = null;
  }

  handleExpenseSaved(): void {
    this.actionMessage = this.expenseToEdit ? 'Expense updated successfully.' : 'Expense added successfully.';
    this.closeExpenseForm();
    this.loadExpenses(); // Refresh the list
    setTimeout(() => this.actionMessage = null, 3000);
  }

  async confirmDeleteExpense(expense: Expense): Promise<void> {
    if (!expense.id) {
      this.actionMessage = "Error: Expense ID is missing. Cannot delete.";
      setTimeout(() => this.actionMessage = null, 3000);
      return;
    }
    const confirmation = confirm(`Are you sure you want to delete the expense: "${expense.description}"?`);
    if (confirmation) {
      this.actionMessage = null;
      try {
        await this.expenseService.deleteExpense(expense.id, expense.receiptUrl);
        this.actionMessage = 'Expense deleted successfully.';
        this.loadExpenses(); // Refresh list
      } catch (error) {
        this.actionMessage = 'Error deleting expense. Please try again.';
        console.error(`Error deleting expense ${expense.id}:`, error);
      } finally {
        setTimeout(() => this.actionMessage = null, 3000);
      }
    }
  }
}
