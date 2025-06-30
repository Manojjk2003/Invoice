import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { ProductOrService } from '../core/models/app.models';
import { ProductService } from '../product.service';
import { ProductFormComponent } from '../product-form/product-form.component'; // Import the form component

@Component({
  selector: 'app-product-management',
  standalone: true,
  imports: [CommonModule, ProductFormComponent], // Add ProductFormComponent here
  templateUrl: './product-management.component.html',
  styleUrls: ['./product-management.component.css']
})
export class ProductManagementComponent implements OnInit {
  private productService: ProductService = inject(ProductService);

  products$: Observable<ProductOrService[]>;

  isProductFormVisible = false;
  currentProduct: ProductOrService | null = null;
  feedbackMessage: string | null = null;
  feedbackType: 'success' | 'error' = 'success';


  constructor() {
    this.products$ = this.productService.getProducts();
  }

  ngOnInit(): void {
    // Products are loaded via async pipe in the template
  }

  showAddProductForm(): void {
    this.currentProduct = null;
    this.isProductFormVisible = true;
    this.feedbackMessage = null;
  }

  showEditProductForm(product: ProductOrService): void {
    this.currentProduct = { ...product }; // Clone to avoid direct mutation if form is cancelled
    this.isProductFormVisible = true;
    this.feedbackMessage = null;
  }

  async handleSaveProduct(product: ProductOrService): Promise<void> {
    try {
      if (product.id) { // Editing existing product
        await this.productService.updateProduct(product.id, product);
        this.showFeedback('Product updated successfully!', 'success');
      } else { // Adding new product
        const newProductId = await this.productService.addProduct(product);
        this.showFeedback(`Product "${product.name}" added successfully (ID: ${newProductId})!`, 'success');
      }
      this.closeProductForm();
      this.products$ = this.productService.getProducts(); // Refresh list
    } catch (error: any) {
      console.error('Error saving product:', error);
      this.showFeedback(`Error saving product: ${error.message || 'Unknown error'}`, 'error');
      // Keep form open if there's an error
    }
  }

  async handleDeleteProduct(productId: string, productName: string): Promise<void> {
    if (confirm(`Are you sure you want to delete the product "${productName}"? This action cannot be undone.`)) {
      try {
        await this.productService.deleteProduct(productId);
        this.showFeedback(`Product "${productName}" deleted successfully!`, 'success');
        this.products$ = this.productService.getProducts(); // Refresh list
      } catch (error: any) {
        console.error('Error deleting product:', error);
        this.showFeedback(`Error deleting product: ${error.message || 'Unknown error'}`, 'error');
      }
    }
  }

  closeProductForm(): void {
    this.isProductFormVisible = false;
    this.currentProduct = null;
  }

  private showFeedback(message: string, type: 'success' | 'error'): void {
    this.feedbackMessage = message;
    this.feedbackType = type;
    setTimeout(() => this.feedbackMessage = null, 5000); // Hide after 5 seconds
  }
}
