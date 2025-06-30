import { Injectable, inject } from '@angular/core';
import { Firestore, addDoc, collection, collectionData, deleteDoc, doc, orderBy, query, updateDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { ProductOrService } from './core/models/app.models';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private firestore: Firestore = inject(Firestore);
  private productsCollection = collection(this.firestore, 'products');

  constructor() { }

  // Create: Add a new product or service
  async addProduct(productData: Omit<ProductOrService, 'id'>): Promise<string> {
    try {
      // Consider adding a check for unique product name here if needed
      // e.g., const q = query(this.productsCollection, where('name', '==', productData.name));
      // const querySnapshot = await getDocs(q);
      // if (!querySnapshot.empty) {
      //   throw new Error(`Product with name "${productData.name}" already exists.`);
      // }
      const docRef = await addDoc(this.productsCollection, productData);
      return docRef.id;
    } catch (error) {
      console.error("Error adding product:", error);
      throw error; // Re-throw for component to handle
    }
  }

  // Read: Get all products or services, ordered by name
  getProducts(): Observable<ProductOrService[]> {
    try {
      const q = query(this.productsCollection, orderBy('name'));
      return collectionData(q, { idField: 'id' }) as Observable<ProductOrService[]>;
    } catch (error) {
      console.error("Error getting products:", error);
      throw error; // Re-throw for component to handle
    }
  }

  // Update: Update an existing product or service
  async updateProduct(productId: string, productData: Partial<ProductOrService>): Promise<void> {
    try {
      const productDocRef = doc(this.firestore, 'products', productId);
      await updateDoc(productDocRef, productData);
    } catch (error) {
      console.error("Error updating product:", error);
      throw error; // Re-throw for component to handle
    }
  }

  // Delete: Delete a product or service
  async deleteProduct(productId: string): Promise<void> {
    try {
      const productDocRef = doc(this.firestore, 'products', productId);
      await deleteDoc(productDocRef);
    } catch (error) {
      console.error("Error deleting product:", error);
      throw error; // Re-throw for component to handle
    }
  }
}
