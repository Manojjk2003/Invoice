import { Injectable, inject } from '@angular/core'; // Added inject
import {
  collection, addDoc, getDocs, updateDoc, doc, deleteDoc, CollectionReference, DocumentReference,
  query, orderBy, Firestore
} from '@angular/fire/firestore'; // Changed to @angular/fire/firestore
import { ref, uploadBytes, getDownloadURL, StorageReference, deleteObject as deleteFile } from 'firebase/storage';
import { Storage } from '@angular/fire/storage';
// import { db } from '../main'; // Removed db import
import { Expense } from './core/models/app.models';

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {
  private firestore: Firestore;
  private storage: Storage;
  private expensesRef: CollectionReference;

  constructor() {
    this.firestore = inject(Firestore); // Moved inject here
    this.storage = inject(Storage);     // Moved inject here
    this.expensesRef = collection(this.firestore, 'expenses');
  }

  // Add a new expense
  async addExpense(expenseData: Omit<Expense, 'id'>): Promise<string> {
    try {
      const docRef: DocumentReference = await addDoc(this.expensesRef, expenseData);
      return docRef.id;
    } catch (error) {
      console.error("Error adding expense:", error);
      throw error;
    }
  }

  // Get all expenses, ordered by date (descending)
  async getExpenses(): Promise<Expense[]> {
    try {
      const q = query(this.expensesRef, orderBy("date", "desc")); // Order by date, newest first
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
    } catch (error) {
      console.error("Error fetching expenses:", error);
      throw error;
    }
  }

  // Update an existing expense
  async updateExpense(expenseId: string, expenseData: Partial<Expense>): Promise<void> {
    try {
      const expenseDocRef = doc(this.expensesRef, expenseId);
      await updateDoc(expenseDocRef, expenseData);
    } catch (error) {
      console.error(`Error updating expense ${expenseId}:`, error);
      throw error;
    }
  }

  // Delete an expense (and its associated receipt from storage if it exists)
  async deleteExpense(expenseId: string, receiptUrl?: string): Promise<void> {
    try {
      // If a receipt URL exists, try to delete the file from Firebase Storage
      if (receiptUrl) {
        try {
          const receiptRef = ref(this.storage, receiptUrl); // Create a reference from the full URL
          await deleteFile(receiptRef);
          console.log(`Receipt file ${receiptUrl} deleted successfully.`);
        } catch (fileError: any) {
          // Log file deletion error but don't necessarily stop expense deletion
          // unless it's critical. Common errors: file not found (already deleted), permissions.
          if (fileError.code === 'storage/object-not-found') {
            console.warn(`Receipt file not found for deletion (may have been already deleted): ${receiptUrl}`);
          } else {
            console.error(`Error deleting receipt file ${receiptUrl}:`, fileError);
            // Optionally re-throw or handle if receipt deletion failure should prevent expense doc deletion
          }
        }
      }

      const expenseDocRef = doc(this.expensesRef, expenseId);
      await deleteDoc(expenseDocRef);
    } catch (error) {
      console.error(`Error deleting expense ${expenseId}:`, error);
      throw error;
    }
  }

  // Upload a receipt file
  async uploadReceipt(file: File): Promise<string> {
    try {
      // Create a unique filename, e.g., using timestamp or UUID + original name
      const filePath = `receipts/${new Date().getTime()}_${file.name}`;
      const storageRef: StorageReference = ref(this.storage, filePath);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      return downloadUrl;
    } catch (error) {
      console.error("Error uploading receipt:", error);
      throw error;
    }
  }

  // Deletes only the file from Firebase Storage given its full URL
  async deleteReceiptFile(receiptUrl: string): Promise<void> {
    if (!receiptUrl) return Promise.resolve(); // No URL, nothing to delete

    try {
      const receiptRef = ref(this.storage, receiptUrl); // Create a reference from the full URL
      await deleteFile(receiptRef);
      console.log(`Storage file ${receiptUrl} deleted successfully.`);
    } catch (fileError: any) {
      if (fileError.code === 'storage/object-not-found') {
        console.warn(`Storage file not found for deletion (may have been already deleted): ${receiptUrl}`);
      } else {
        console.error(`Error deleting storage file ${receiptUrl}:`, fileError);
        throw fileError; // Re-throw to indicate the file deletion failed, caller can decide how to handle
      }
    }
  }
}
