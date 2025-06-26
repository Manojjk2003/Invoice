// src/app/invoice-form/invoice.service.ts
import { Injectable } from '@angular/core';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc, CollectionReference, DocumentReference } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, getStorage, StorageReference } from 'firebase/storage';
import { db } from '../../main'; // Firebase app storage is not directly used here, db is.
import { Invoice } from '../core/models/app.models'; // Corrected path

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  private invoicesRef: CollectionReference;
  private storage = getStorage(); // Initialize Firebase Storage instance

  constructor() {
    this.invoicesRef = collection(db, 'invoices');
  }

  async createInvoice(invoiceData: Omit<Invoice, 'id'>): Promise<string> {
    try {
      const docRef: DocumentReference = await addDoc(this.invoicesRef, invoiceData);
      return docRef.id;
    } catch (error) {
      console.error("Error creating invoice:", error);
      throw error;
    }
  }

  async uploadLogo(file: File): Promise<string> {
    try {
      const storageRef: StorageReference = ref(this.storage, 'logos/' + file.name);
      await uploadBytes(storageRef, file);
      const logoUrl = await getDownloadURL(storageRef);
      // console.log('Logo URL:', logoUrl); // Keep for debugging if needed, or remove
      return logoUrl;
    } catch (error) {
      console.error("Error uploading logo:", error);
      throw error;
    }
  }

  async getInvoices(): Promise<Invoice[]> {
    try {
      const snapshot = await getDocs(this.invoicesRef);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
    } catch (error) {
      console.error("Error fetching invoices:", error);
      throw error;
    }
  }

  async updateInvoice(id: string, data: Partial<Invoice>): Promise<void> {
    try {
      const invoiceRef: DocumentReference = doc(db, 'invoices', id);
      await updateDoc(invoiceRef, data);
    } catch (error) {
      console.error("Error updating invoice:", error);
      throw error;
    }
  }

  async deleteInvoice(id: string): Promise<void> {
    try {
      const invoiceRef: DocumentReference = doc(db, 'invoices', id);
      await deleteDoc(invoiceRef);
    } catch (error) {
      console.error("Error deleting invoice:", error);
      throw error;
    }
  }
  
  // Removed addCustomer and getCustomers as they are consolidated in CustomerService
}
